'use strict'

/* global describe, it, beforeEach, afterEach */

require('should')
const sizeof = require('../index.js')

// Runs an expression in a child process with a timeout and a small heap, so
// that a regression in a loop guard fails the suite instead of hanging it
function runIsolated (expression, heapMB = 128, flags = []) {
  const { spawnSync } = require('child_process')
  const source = `const sizeof = require(${JSON.stringify(require.resolve('../index.js'))}); console.log(JSON.stringify(${expression}))`
  const result = spawnSync(process.execPath, [`--max-old-space-size=${heapMB}`, ...flags, '-e', source], { timeout: 10000, encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr)
  return JSON.parse(result.stdout)
}

describe('sizeof primitives', () => {
  it('null and undefined are 0', () => {
    sizeof(null).should.be.equal(0)
    sizeof().should.be.equal(0)
  })

  it('number size shall be 8', () => {
    sizeof(5).should.be.equal(8)
    sizeof(NaN).should.be.equal(8)
  })

  it('boolean size shall be 4', () => {
    sizeof(true).should.be.equal(4)
  })

  it('string size is its UTF-8 byte length', () => {
    sizeof('').should.be.equal(0)
    sizeof('abc').should.be.equal(3)
    sizeof('ж').should.be.equal(2)
    sizeof('中').should.be.equal(3)
    sizeof('😀').should.be.equal(4)
    sizeof('🏳️‍🌈').should.be.equal(14)
  })

  it('string size matches Buffer.byteLength, unpaired surrogates included', () => {
    const strings = ['Lorem ipsum dolor sit amet', 'привет', '\ud800', '\ud800x', 'x\udc00y', '😀\ud83d']
    for (const str of strings) {
      sizeof(str).should.be.equal(Buffer.byteLength(str, 'utf8'))
    }
  })

  it('symbol size is the size of its description', () => {
    sizeof(Symbol('abcd')).should.be.equal(4)
    sizeof(Symbol.for('testKey')).should.be.equal(7)
    sizeof(Symbol()).should.be.equal(0) // eslint-disable-line symbol-description
  })

  it('BigInt size is the length of its decimal form', () => {
    sizeof(BigInt(21474836480)).should.be.equal(11)
    sizeof(-5n).should.be.equal(2)
  })

  it('function size is the UTF-8 size of its source, counted once', () => {
    const func = (one, two) => one + two
    sizeof(func).should.be.equal(func.toString().length)
    const greet = () => 'привет'
    sizeof(greet).should.be.equal(Buffer.byteLength(greet.toString(), 'utf8'))
    sizeof([func, func]).should.be.equal(sizeof(func))
  })
})

describe('sizeof objects', () => {
  it('counts property names and values', () => {
    const obj = { a: 1, b: 2, c: 3 }
    sizeof(obj).should.be.equal(3 + 3 * 8)
    sizeof({ d: obj }).should.be.equal(1 + 27)
  })

  it('handle hasOwnProperty key', () => {
    sizeof({ hasOwnProperty: undefined }).should.be.equal(14)
    sizeof({ hasOwnProperty: 'Hello World' }).should.be.equal(14 + 11)
    sizeof({ hasOwnProperty: 1234 }).should.be.equal(14 + 8)
  })

  it('should handle null in object keys', () => {
    sizeof({ 1: { depot_id: null } }).should.be.equal(1 + 8)
  })

  it('counts only own enumerable keys', () => {
    const object = { a: 'b' }
    Object.defineProperty(object, 'hidden', { value: 'x'.repeat(100), enumerable: false })
    Object.defineProperty(object, Symbol('hidden'), { value: 'x'.repeat(100), enumerable: false })
    sizeof(object).should.be.equal(2)
    sizeof(Object.create({ inherited: 'x'.repeat(100) })).should.be.equal(0)
  })

  it('a value with nothing to count is 0', () => {
    sizeof({}).should.be.equal(0)
    sizeof([]).should.be.equal(0)
    sizeof('').should.be.equal(0)
    sizeof([null, undefined]).should.be.equal(0)
    sizeof(new Map()).should.be.equal(0)
  })

  it('an object with toJSON counts what toJSON returns', () => {
    // shaped like decimal.js: an own `constructor` on every instance
    class Decimal {
      constructor (digits) {
        this.digits = digits.split('').map(Number)
        this.constructor = Decimal
      }

      toJSON () { return this.digits.join('') }
    }
    sizeof(new Decimal('12345')).should.be.equal(5)
    sizeof({ price: new Decimal('42') }).should.be.equal(5 + 2)
    sizeof(new URL('https://example.com/a')).should.be.equal('https://example.com/a'.length)
    const self = { a: 1, toJSON () { return this } }
    sizeof(self).should.be.equal(1 + 8 + 6 + self.toJSON.toString().length)
  })

  it('calls toJSON once per value, not on what it returned', () => {
    const hide = { toJSON () { const { secret, ...rest } = this; return rest } }
    const user = { name: 'ann', secret: 'x'.repeat(100), toJSON: hide.toJSON }
    sizeof(user).should.be.equal(4 + 3 + 6 + hide.toJSON.toString().length)
    class Copying {
      constructor () { this.x = 1 }
      toJSON () { return new Copying() }
    }
    sizeof({ list: [new Copying()] }).should.be.equal(4 + 1 + 8)
    // values inside the returned object still get their toJSON called
    sizeof({ toJSON () { return { url: new URL('https://a.io/') } } }).should.be.equal(3 + 13)
    // a toJSON that returns a string must not switch off the next value's toJSON
    const money = () => ({ toJSON: () => '1.50', cents: 'x'.repeat(100) })
    sizeof([money(), money()]).should.be.equal(4 + 4)
    // a toJSON that returns the object itself: its keys as they are afterwards
    class Stamped {
      toJSON () { this.at = 'x'; return this }
    }
    sizeof(new Stamped()).should.be.equal(2 + 1)
  })

  it('does not create keys on a proxy by probing it', function () {
    this.timeout(30000)
    // a get trap that creates every key it is asked for, like a defaultdict
    runIsolated('(() => { const handler = { get (target, key) { if (!(key in target)) target[key] = new Proxy({}, handler); return target[key] } }; return sizeof({ a: new Proxy({ x: 1 }, handler) }) })()').should.be.equal(1 + 1 + 8)
    // over a class instance, whose Symbol.toStringTag is read as well; the
    // plain object after it keeps its own Symbol.toStringTag key
    runIsolated("(() => { class K {} const handler = { get (target, key) { if (!(key in target)) target[key] = new Proxy(new K(), handler); return target[key] } }; return sizeof([new Proxy(Object.assign(new K(), { x: 1 }), handler), { [Symbol.toStringTag]: 'ab' }]) })()").should.be.equal(1 + 8 + 'Symbol.toStringTag'.length + 2)
    // and one whose getOwnPropertyDescriptor trap creates the key too
    runIsolated('(() => { class K {} const create = (target, key) => { if (!(key in target)) target[key] = new Proxy(new K(), handler) }; const handler = { get (target, key) { create(target, key); return target[key] }, getOwnPropertyDescriptor (target, key) { create(target, key); return Reflect.getOwnPropertyDescriptor(target, key) } }; return sizeof({ a: new Proxy(Object.assign(new K(), { x: 1 }), handler) }) })()').should.be.equal(1 + 1 + 8)
    // and over a class whose toJSON returns the object itself
    runIsolated('(() => { class K { toJSON () { return this } } const handler = { get (target, key) { if (!(key in target)) target[key] = new Proxy(new K(), handler); return target[key] } }; return sizeof({ a: new Proxy(Object.assign(new K(), { x: 1 }), handler) }) })()').should.be.equal(1 + 1 + 8)
  })

  it('counts enumerable symbol keys', () => {
    sizeof({ [Symbol.for('a')]: 'b' }).should.be.equal(2)
  })

  it('counts arrays by their elements', () => {
    sizeof(['a', 'b', 'c', 'd']).should.be.above(sizeof(['a', 'b']))
    sizeof([1, 2, 3]).should.be.equal(24)
    sizeof([NaN, NaN]).should.be.equal(16)
  })

  it('an array of strings is as big as the strings (#87)', () => {
    sizeof(['abcde']).should.be.equal(sizeof('abcde'))
    sizeof(['a', 'b', 'c', 'd', 'e']).should.be.equal(sizeof('abcde'))
  })

  it('nested values', () => {
    sizeof({ undef: undefined }).should.be.equal(5)
    sizeof({ symbol: Symbol('test') }).should.be.equal(6 + 4)
    sizeof({ regex: /test/g }).should.be.equal(5 + 7)
    sizeof({ date: new Date() }).should.be.equal(4 + 8)
    sizeof({ num: 123123123123123123n }).should.be.equal(3 + 18)
    const func = x => x + x
    sizeof({ func }).should.be.equal(4 + func.toString().length)
  })

  it('counts shared objects once', () => {
    const shared = { x: 'yyyy' }
    sizeof({ a: shared, b: shared }).should.be.equal(1 + 1 + 5)
  })

  it('measures circular structures, counting each object once', () => {
    // walking an object twice throws, so a broken cycle guard fails here
    // instead of looping forever
    let reads = 0
    const firstLevel = { get a () { if (++reads > 1) throw new Error('walked twice'); return 1 } }
    const secondLevel = { b: 2, c: firstLevel }
    firstLevel.second = secondLevel
    sizeof(firstLevel).should.be.equal(1 + 8 + 6 + (1 + 8 + 1))
  })

  it('stops on arrays whose length changes or is invalid', function () {
    this.timeout(30000)
    runIsolated("(() => { const list = [{ get first () { list.length = 0; return 'x' } }, 1, 2]; return sizeof(list) })()").should.be.equal(5 + 1)
    runIsolated("(() => { const list = []; const make = () => ({ get a () { list.push(make(), 'z'); return 1 } }); list.push(make(), 'z'); return sizeof(list) })()").should.be.equal(1 + 8 + 1)
    runIsolated("sizeof(new Proxy([1, 2], { get: (target, key) => key === 'length' ? NaN : target[key] }))").should.be.equal(0)
    runIsolated("sizeof(new Proxy([1, 2], { get: (target, key) => key === 'length' ? Infinity : target[key] }))").should.be.equal(0)
    runIsolated("(() => { let reads = 0; const length = { valueOf: () => ++reads > 2 ? 1e12 : 1 }; return sizeof(new Proxy([1], { get: (target, key) => key === 'length' ? length : target[key] })) })()").should.be.equal(8)
  })

  it('does not keep a stack frame per link of a long chain', function () {
    this.timeout(30000)
    // extra heap at the deepest link relative to the list's own size: about
    // 0.5 with one frame at a time, about 4 with a frame per link, whatever
    // the pointer size
    const [size, ratio] = runIsolated('(() => { const used = () => { gc(); return process.memoryUsage().heapUsed }; const before = used(); let atDeepest = 0; let list = { get v () { atDeepest = used(); return 1 }, next: null }; for (let i = 1; i < 1e6; i++) list = { v: 1, next: list }; const base = used(); return [sizeof(list), (atDeepest - base) / (base - before)] })()', 128, ['--expose-gc'])
    size.should.be.equal(13e6)
    ratio.should.be.below(2)
  })

  it('measures a proxy whose get trap expects string keys', () => {
    const trap = { get (target, key) { return key.startsWith('_') ? undefined : target[key] } }
    sizeof(new Proxy({ a: 'bc' }, trap)).should.be.equal(3)
    class Point {
      constructor () { this.x = 'y' }
    }
    sizeof(new Proxy(new Point(), trap)).should.be.equal(2)
    const descriptors = { getOwnPropertyDescriptor (target, key) { if (typeof key === 'symbol') throw new Error('symbol'); return Reflect.getOwnPropertyDescriptor(target, key) } }
    sizeof(new Proxy(new Point(), descriptors)).should.be.equal(2)
  })

  it('returns -1 when reading a property throws', () => {
    sizeof({ get boom () { throw new Error('boom') } }).should.be.equal(-1)
    const { proxy, revoke } = Proxy.revocable({}, {})
    revoke()
    sizeof({ proxy }).should.be.equal(-1)
  })
})

describe('sizeof built-in types', () => {
  it('map counts keys and values', function () {
    this.timeout(30000)
    sizeof(new Map([['a', 1]])).should.be.equal(9)
    sizeof({ m: new Map([['k', 'v'.repeat(1000)]]) }).should.be.equal(1 + 1 + 1000)
    runIsolated('(() => { const circular = new Map(); circular.set(circular, circular); return sizeof(circular) })()').should.be.equal(0)
  })

  it('set counts values', () => {
    sizeof(new Set([1, 'some text'])).should.be.equal(8 + 9)
    sizeof({ s: new Set([1, 2, 3]) }).should.be.equal(1 + 24)
  })

  it('walks a proxy that forwards a Map or Set, as Vue reactive() does', () => {
    const forwarding = (collection) => new Proxy(collection, {
      get (target, key) {
        const value = Reflect.get(target, key, target)
        return typeof value === 'function' ? value.bind(target) : value
      }
    })
    sizeof(forwarding(new Map([['k', 'v'.repeat(100)]]))).should.be.equal(101)
    sizeof({ tags: forwarding(new Set(['abc'])) }).should.be.equal(4 + 3)
    // a plain proxy cannot be iterated, so it is measured as an object, and
    // so is a proxy or look-alike whose entries() is the unbound built-in
    sizeof(new Proxy(new Map([['k', 'v']]), {})).should.be.equal(0)
    sizeof(new Proxy(new Map([['k', 'v']]), { get: (target, key) => target[key] })).should.be.equal(0)
    sizeof(Object.setPrototypeOf({ size: 3 }, Map.prototype)).should.be.equal(4 + 8)
    sizeof({ tags: Object.setPrototypeOf({ size: 3 }, Set.prototype) }).should.be.equal(4 + 4 + 8)
    // a subclass keeping its data in #private fields, behind such a proxy
    class Cache extends Map {
      * entries () { yield * this.#data }
      #data = new Map()
    }
    sizeof({ cache: new Proxy(new Cache(), { get: (target, key) => target[key] }) }).should.be.equal(5)
    // a look-alike whose class defines size and entries(), as Immer 9's
    // Map drafts do, is walked through them
    function Draft (data) { this.data = data }
    Draft.prototype = Object.create(Map.prototype)
    Object.defineProperty(Draft.prototype, 'size', { get () { return this.data.length } })
    Draft.prototype.entries = function () { return this.data[Symbol.iterator]() }
    sizeof(new Draft([['k', 'v'.repeat(100)]])).should.be.equal(101)
  })

  it('returns -1 when a Map or Set\'s own iterator method throws', () => {
    class Broken extends Map {
      entries () { throw new Error('broken') }
    }
    sizeof({ map: new Broken([['a', 1]]) }).should.be.equal(-1)
  })

  it('typed arrays and buffers count their bytes', () => {
    sizeof(new Int8Array([1, 2, 3, 4, 5])).should.be.equal(5)
    sizeof(new Uint8Array([1, 2, 3, 4, 5])).should.be.equal(5)
    sizeof(new Uint16Array([1, 2, 3, 4, 5])).should.be.equal(10)
    sizeof(new Int16Array([1, 2, 3, 4, 5])).should.be.equal(10)
    sizeof(new Uint32Array([1, 2, 3, 4, 5])).should.be.equal(20)
    sizeof(new Int32Array([1, 2, 3, 4, 5])).should.be.equal(20)
    sizeof(new Float32Array([1, 2, 3, 4, 5])).should.be.equal(20)
    sizeof(new Float64Array([1, 2, 3, 4, 5])).should.be.equal(40)
    sizeof({ t: new Float64Array(1000) }).should.be.equal(1 + 8000)
    sizeof(Buffer.from('abc')).should.be.equal(3)
    sizeof(new ArrayBuffer(16)).should.be.equal(16)
    sizeof(new DataView(new ArrayBuffer(16), 4)).should.be.equal(12)
    sizeof(new SharedArrayBuffer(16)).should.be.equal(16)
    const shared = new Uint8Array(10)
    sizeof([shared, shared]).should.be.equal(10)
  })

  it('counts a detached DataView as 0', function () {
    if (typeof structuredClone !== 'function') this.skip()
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    structuredClone(buffer, { transfer: [buffer] })
    sizeof({ view }).should.be.equal(4)
  })

  it('Blob and File count their size', function () {
    if (typeof File !== 'function') this.skip()
    sizeof(new Blob(['abc'])).should.be.equal(3)
    sizeof({ file: new File(['ж'], 'a.txt') }).should.be.equal(4 + 2)
  })

  it('recognizes Map, Set and Date subclasses whatever their tag', () => {
    class Registry extends Map {
      get [Symbol.toStringTag] () { return 'Registry' }
    }
    sizeof(new Registry([['k', 'v'.repeat(1000)]])).should.be.equal(1001)
    // shaped like quick-lru: data in private Maps, entries() overridden
    class LRU extends Map {
      #cache = new Map()
      set (key, value) {
        this.#cache.set(key, value)
        return this
      }

      * entries () { yield * this.#cache }
      get [Symbol.toStringTag] () { return 'QuickLRU' }
    }
    sizeof(new LRU().set('a', 'v'.repeat(100))).should.be.equal(101)
    class Tags extends Set {
      get [Symbol.toStringTag] () { return 'Tags' }
    }
    sizeof(new Tags(['abc'])).should.be.equal(3)
    class When extends Date {
      get [Symbol.toStringTag] () { return 'When' }
    }
    sizeof(new When(0)).should.be.equal(8)
    class Pattern extends RegExp {
      get [Symbol.toStringTag] () { return 'Pattern' }
    }
    sizeof(new Pattern('abc', 'g')).should.be.equal(6)
    class Bytes extends ArrayBuffer {
      get [Symbol.toStringTag] () { return 'Bytes' }
    }
    sizeof(new Bytes(16)).should.be.equal(16)
  })

  it('does not trust a spoofed tag, prototype or toString', () => {
    sizeof({ [Symbol.toStringTag]: 'Map', a: 'bc' }).should.be.equal(1 + 2 + 'Symbol.toStringTag'.length + 3)
    const tagged = (tag, fields) => Object.assign(new (class { get [Symbol.toStringTag] () { return tag } })(), fields)
    sizeof(tagged('ArrayBuffer', { byteLength: -5 })).should.be.equal(10 + 8)
    sizeof(tagged('Date', { when: 'x' })).should.be.equal(4 + 1)
    sizeof(tagged('RegExp', { data: 'abc' })).should.be.equal(4 + 3)
    sizeof(tagged('Blob', { size: -5 })).should.be.equal(4 + 8)
    sizeof(tagged('String', { data: 'abc' })).should.be.equal(4 + 3)
    sizeof(Object.create(Map.prototype)).should.be.equal(0)
    sizeof(Object.create(Set.prototype)).should.be.equal(0)
    class Quiet extends RegExp {
      toString () { return '' }
    }
    sizeof(new Quiet('abc', 'g')).should.be.equal(6)
  })

  it('measures a long boxed string without listing its characters', function () {
    this.timeout(30000)
    runIsolated("sizeof({ note: new String('x'.repeat(1e7)) })").should.be.equal(4 + 1e7)
    runIsolated("sizeof({ note: require('vm').runInNewContext(\"new String('x'.repeat(1e7))\") })").should.be.equal(4 + 1e7)
  })

  it('boxed primitives count as their value', () => {
    sizeof(new String('abc')).should.be.equal(3) // eslint-disable-line no-new-wrappers
    sizeof(new String('😀'.repeat(100))).should.be.equal(400) // eslint-disable-line no-new-wrappers
    sizeof(new Number(5)).should.be.equal(8) // eslint-disable-line no-new-wrappers
    sizeof(new Boolean(true)).should.be.equal(4) // eslint-disable-line no-new-wrappers
    sizeof(Object(10n)).should.be.equal(2)
    sizeof(Object(Symbol('ab'))).should.be.equal(2)
  })

  it('recognizes objects from another realm', () => {
    const vm = require('vm')
    const foreign = vm.runInNewContext(
      "({ map: new Map([['k', 1]]), set: new Set([1, 2]), date: new Date(0), regex: /a/g, buffer: new ArrayBuffer(16), list: ['ab'] })"
    )
    sizeof(foreign.map).should.be.equal(9)
    sizeof(foreign.set).should.be.equal(16)
    sizeof(foreign.date).should.be.equal(8)
    sizeof(foreign.regex).should.be.equal(4)
    sizeof(foreign.buffer).should.be.equal(16)
    sizeof(foreign.list).should.be.equal(2)
  })
})

describe('sizeof large inputs', () => {
  it('measures very deep nesting without recursion (#91)', () => {
    const root = []
    let current = root
    for (let i = 0; i < 100000; i++) {
      const next = ['x']
      current.push(next)
      current = next
    }
    sizeof(root).should.be.equal(100000)
  })

  it('measures wide arrays', () => {
    sizeof(new Array(1000000).fill(1)).should.be.equal(8000000)
  })
})

describe('sizeof browser tests', () => {
  beforeEach(function () {
    global.window = {}
    global.document = {}
  })

  it('gives the same sizes as in Node.js (#82)', () => {
    sizeof('abc').should.be.equal(3)
    sizeof({ a: 'ж' }).should.be.equal(3)
  })

  afterEach(function () {
    delete global.window
    delete global.document
  })
})

describe('sizeof outside of Node.js', () => {
  const fs = require('fs')
  const path = require('path')
  const vm = require('vm')

  // Loads index.js with only the globals a web worker has: no window,
  // no document, no global, and nothing to require
  function loadInWorkerScope (globals) {
    const module = { exports: {} }
    const context = vm.createContext({
      ...globals,
      self: {},
      module,
      exports: module.exports,
      require: (id) => {
        throw new Error(`unexpected require('${id}')`)
      }
    })
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')
    vm.runInContext(source, context)
    return module.exports
  }

  it('works in a web worker scope (#101)', () => {
    const workerSizeof = loadInWorkerScope()
    workerSizeof('abc').should.be.equal(3)
    workerSizeof({ a: 'ж', b: [1, 2n] }).should.be.equal(1 + 2 + 1 + 8 + 1)
  })

  it('loads when reading process.versions throws', () => {
    const tampered = { get versions () { throw new Error('tampered') } }
    loadInWorkerScope({ process: tampered })('x'.repeat(100)).should.be.equal(100)
  })

  it('counts longer strings with Node.js\'s native Buffer', () => {
    const counted = []
    const spy = { byteLength: (str, encoding) => { counted.push(str); return Buffer.byteLength(str, encoding) } }
    const nodeSizeof = loadInWorkerScope({ process: { versions: { node: '22.0.0' } }, Buffer: spy })
    counted.length = 0
    nodeSizeof('x'.repeat(15)).should.be.equal(15)
    nodeSizeof('ж'.repeat(16)).should.be.equal(32)
    counted.should.eql(['ж'.repeat(16)])
  })

  it('ignores a native Buffer that miscounts unpaired surrogates', () => {
    // like Bun 1.3: 2 bytes for an unpaired surrogate instead of 3
    const miscounting = { byteLength: (str) => Buffer.byteLength(str.replace(/[\ud800-\udfff]/g, 'xx'), 'utf8') }
    const bunSizeof = loadInWorkerScope({ process: { versions: { node: '22.0.0' } }, Buffer: miscounting })
    bunSizeof('\ud800'.repeat(100)).should.be.equal(300)
  })

  it('keeps counting each object once after a Set fills up', () => {
    class LimitedSet extends Set {
      add (value) {
        if (this.size >= 3) throw new RangeError('Set maximum size exceeded')
        return super.add(value)
      }
    }
    const limitedSizeof = loadInWorkerScope({ Set: LimitedSet })
    const objects = Array.from({ length: 10 }, () => ({ a: 1 }))
    const shared = { a: 1 }
    limitedSizeof([...objects, shared, shared, objects[0]]).should.be.equal(11 * 9)
  })

  it('ignores a Buffer polyfill installed as a global in a browser', () => {
    // counts correctly, so only the versions.node check keeps it out;
    // browser bundles often polyfill process too, without versions.node
    let calls = 0
    const polyfill = { byteLength: (str, encoding) => { calls++; return Buffer.byteLength(str, encoding) } }
    const browserSizeof = loadInWorkerScope({ Buffer: polyfill, process: { env: {}, versions: {} } })
    browserSizeof('x'.repeat(100)).should.be.equal(100)
    calls.should.be.equal(0)
  })

  it('counts long strings the same without Buffer', () => {
    const workerSizeof = loadInWorkerScope()
    const long = 'Lorem ipsum, привет, 中文, 😀🏳️‍🌈, \ud800 '.repeat(10)
    long.length.should.be.above(64)
    workerSizeof(long).should.be.equal(Buffer.byteLength(long, 'utf8'))
    sizeof(long).should.be.equal(Buffer.byteLength(long, 'utf8'))
  })
})

describe('module formats', () => {
  it('exposes the function as default for transpiled ES imports', () => {
    sizeof.default.should.be.equal(sizeof)
  })
})

describe('package', () => {
  it('publishes only the library files', function () {
    this.timeout(30000)
    const { execFileSync } = require('child_process')
    const fs = require('fs')
    const path = require('path')
    const output = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: path.join(__dirname, '..') })
    const files = JSON.parse(output)[0].files.map(file => file.path).sort()
    files.should.eql(['LICENSE.md', 'README.md', 'index.d.ts', 'index.js', 'package.json', 'ts41/index.d.ts'])
    // the file typesVersions sends TypeScript 4.1+ to must be published, and
    // the default one must not use export =, which TypeScript 3.0 and older
    // (they ignore typesVersions) cannot read
    const { types, typesVersions } = require('../package.json')
    files.should.containEql(typesVersions['>=4.1']['*'][0].replace('*', types))
    fs.readFileSync(path.join(__dirname, '..', types), 'utf8').should.not.match(/export\s*=/)
  })
})
