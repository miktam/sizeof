'use strict'

// Compares object-sizeof 2.6.5, the version most users ran before 3.0, with
// this one: on synthetic datasets shaped like the cache in #102, and on the
// inputs reported in the GitHub issues. Prints a markdown table; the README
// shows its output unedited.
//
//   npm run bench
//
// Timing and memory runs each get a fresh Node.js process, so memory left
// over from one run cannot hide the cost of the next.

const { execFileSync } = require('child_process')
const { createRequire } = require('module')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const BASELINE = require.resolve('object-sizeof-2')
const VERSIONS = {
  [require('object-sizeof-2/package.json').version]: BASELINE,
  [require('../package.json').version]: path.join(__dirname, '..', 'index.js')
}
const RUNS = 3

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(18)

// Datasets shaped like a cache of parsed API responses
const DATASETS = {
  records: {
    label: '1M small records',
    build: () => {
      const rows = []
      for (let i = 0; i < 1000000; i++) {
        rows.push({ id: i, name: 'user-' + i, tags: ['a', 'b', 'c'], active: true, note: 'lorem ipsum dolor sit amet' })
      }
      return rows
    }
  },
  documents: {
    label: '100k records, 1 KB text + 50 numbers each',
    build: () => {
      const rows = []
      for (let i = 0; i < 100000; i++) {
        // a flat string, as JSON.parse returns it, rather than a rope
        // that would get flattened while being measured
        const body = JSON.parse(`"${LOREM}${i}"`)
        rows.push({ id: i, body, scores: new Array(50).fill(i) })
      }
      return rows
    }
  }
}

// Samples the process's resident memory every millisecond from a worker
// thread while the main thread is busy measuring; keeps the peak in `peak`
const SAMPLER = `
const { workerData, parentPort } = require('worker_threads')
const peak = new BigInt64Array(workerData)
const pause = new Int32Array(new SharedArrayBuffer(4))
parentPort.postMessage('ready')
for (;;) {
  const rss = BigInt(process.memoryUsage.rss())
  if (rss > Atomics.load(peak, 0)) Atomics.store(peak, 0, rss)
  Atomics.wait(pause, 0, 0, 1)
}
`

async function childRun (file, dataset) {
  const { Worker } = require('worker_threads')
  const sizeof = require(file)
  global.gc()
  const heapBefore = process.memoryUsage().heapUsed
  const data = DATASETS[dataset].build()
  global.gc()
  const dataMemory = process.memoryUsage().heapUsed - heapBefore

  const shared = new SharedArrayBuffer(8)
  const peak = new BigInt64Array(shared)
  const sampler = new Worker(SAMPLER, { eval: true, workerData: shared })
  await new Promise(resolve => sampler.once('message', resolve))
  global.gc()
  const rssBefore = process.memoryUsage.rss()
  Atomics.store(peak, 0, BigInt(rssBefore))

  let start = process.hrtime.bigint()
  const bytes = sizeof(data)
  const firstMs = Number(process.hrtime.bigint() - start) / 1e6
  const extraMemory = Math.max(Number(Atomics.load(peak, 0)), process.memoryUsage.rss()) - rssBefore
  await sampler.terminate()

  global.gc()
  start = process.hrtime.bigint()
  sizeof(data)
  const repeatMs = Number(process.hrtime.bigint() - start) / 1e6

  process.stdout.write(JSON.stringify({ bytes, firstMs, repeatMs, extraMemory, dataMemory }))
}

function measure (file, dataset) {
  const runs = []
  for (let i = 0; i < RUNS; i++) {
    const out = execFileSync(process.execPath, ['--expose-gc', __filename, '--child', file, dataset])
    runs.push(JSON.parse(out))
  }
  const median = (key) => runs.map(r => r[key]).sort((a, b) => a - b)[Math.floor(RUNS / 2)]
  return { firstMs: median('firstMs'), repeatMs: median('repeatMs'), extraMemory: median('extraMemory'), dataMemory: median('dataMemory') }
}

// Loads a version in a scope with the given globals and none of Node's:
// no process, no global, no Buffer. 2.6.5 may require its own files.
function loadIn (file, globals) {
  const module = { exports: {} }
  const context = vm.createContext({ ...globals, module, exports: module.exports, require: createRequire(file) })
  vm.runInContext(fs.readFileSync(file, 'utf8'), context)
  return module.exports
}

function describe (fn) {
  try {
    const result = fn()
    if (result instanceof Error) return 'returns an Error object'
    return Array.isArray(result) ? result.map(format).join(' vs ') : format(result)
  } catch (ex) {
    return `throws: ${ex.message}`
  }
}

const format = (n) => typeof n === 'number' ? n.toLocaleString('en-US') : String(n)
const mb = (bytes) => `${Math.round(bytes / 1e6)} MB`
const ms = (n) => `${Math.round(n)} ms`

async function main () {
  const versions = Object.keys(VERSIONS)
  const rows = []

  for (const dataset of Object.keys(DATASETS)) {
    const results = versions.map(v => measure(VERSIONS[v], dataset))
    const label = `${DATASETS[dataset].label} (${mb(results[0].dataMemory)} heap)`
    rows.push([`${label}: first call`, ...results.map(r => ms(r.firstMs))])
    rows.push([`${label}: repeat call`, ...results.map(r => ms(r.repeatMs))])
    rows.push([`${label}: extra memory`, ...results.map(r => `+${mb(r.extraMemory)}`)])
  }

  const deep = []
  let current = deep
  for (let i = 0; i < 100000; i++) {
    const next = ['x']
    current.push(next)
    current = next
  }
  const circular = { a: 1 }
  circular.self = circular

  const checks = [
    ['100,000-deep nested arrays (#91)', s => s(deep)],
    ['Circular reference', s => s(circular)],
    ["`'abcde'` vs `['abcde']` (#87)", s => [s('abcde'), s(['abcde'])]],
    ["`'abc'` in Node.js vs browser (#82)", (s, file) => [s('abc'), loadIn(file, { window: {}, document: {} })('abc')]],
    ["`{ m: new Map([['k', 1 KB string]]) }`", s => s({ m: new Map([['k', 'v'.repeat(1000)]]) })],
    ["`'abc'` in a web worker (#101)", (s, file) => loadIn(file, { self: {} })('abc')]
  ]
  for (const [label, check] of checks) {
    rows.push([label, ...versions.map(v => describe(() => check(require(VERSIONS[v]), VERSIONS[v])))])
  }

  console.log(`Node.js ${process.version}, ${process.platform}-${process.arch}, median of ${RUNS} runs\n`)
  console.log(`| | ${versions.join(' | ')} |`)
  console.log(`|---|${versions.map(() => '---').join('|')}|`)
  for (const row of rows) console.log(`| ${row.join(' | ')} |`)
}

if (process.argv[2] === '--child') {
  childRun(process.argv[3], process.argv[4])
} else {
  main()
}
