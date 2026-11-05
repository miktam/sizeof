## object-sizeof

[![Build](https://img.shields.io/npm/v/object-sizeof)](https://img.shields.io/npm/v/object-sizeof) ![GitHub contributors](https://img.shields.io/github/contributors/miktam/sizeof) [![NPM](https://img.shields.io/npm/dy/object-sizeof)](https://img.shields.io/npm/dy/object-sizeof) [![codecov](https://codecov.io/gh/miktam/sizeof/branch/master/graph/badge.svg?token=qPHxmWpC1K)](https://codecov.io/gh/miktam/sizeof)

### Get the size of a JavaScript object in Bytes

Approximate size of the data a value holds, the same in Node.js, browsers and web workers. No dependencies.

```javascript
import sizeof from 'object-sizeof'
// or: const sizeof = require('object-sizeof')

sizeof({ abc: 'def' }) // 6
sizeof([1, 2, 3]) // 24
```

### How sizes are counted

| Value | Bytes |
|---|---|
| string, property name | UTF-8 length: `'abc'` is 3, `'ж'` is 2, `'😀'` is 4 |
| number, Date | 8 |
| boolean | 4 |
| BigInt | length of its decimal form: `-5n` is 2 |
| symbol | its description |
| function | its source text, as the engine prints it (native and bound functions differ between engines) |
| typed array, Buffer, DataView, ArrayBuffer, SharedArrayBuffer | `byteLength`, per view: two views of one buffer count twice |
| Blob, File | `size` |
| RegExp | its literal text: `/a/g` is 4 |
| object with a `toJSON` method | what `toJSON` returns, as `JSON.stringify` would use it |
| other object | own enumerable keys and their values, symbol keys included |
| array, Set | elements |
| Map | keys and values |
| boxed primitive, e.g. `new String('abc')` | as its value |
| `null`, `undefined` | 0 |

Only what the table names is counted: other own properties of arrays, Maps, Sets, functions and typed arrays are ignored, and so is data an object keeps outside its own enumerable properties (an Error's message, `#private` fields). So a value with nothing to count is 0: `{}`, `[]`, `''`, `[null]`.

Host objects other than Blob and File, such as EventTarget, streams or TextDecoder, are measured like any other object. In Node.js that includes internal fields Node keeps in enumerable symbol properties, so their sizes differ from browsers and between Node.js versions. Blob and File are recognized only when they come from the Blob implementation that is global where `object-sizeof` loads: a Node.js Blob inside a jsdom test, or happy-dom's Blob, is measured as an object.

Each object is counted once, so shared and circular references are fine. A built-in is recognized by its internal slot, never by its `Symbol.toStringTag` alone, so a spoofed tag or borrowed prototype is measured as a plain object, or returns `-1` if its `toJSON` rejects it (Date, URL, Buffer). Subclasses of Map, Set, Date, RegExp, ArrayBuffer and typed arrays are recognized whatever their tag; other built-ins, and built-ins from other realms (iframes, vm contexts, Jest), by their own tag. A proxy over a Map or Set that forwards `size` and hands out its own `entries()` or `values()`, as Vue's `reactive()` does, is walked through them, and so is a look-alike that defines both. Any other proxy over a built-in is measured as a plain object, or returns `-1` if the built-in's `toJSON` rejects the proxy (Date, URL, Buffer).

Getters run when read, and `toJSON` is called once per value, as `JSON.stringify` does. `sizeof` returns `-1` if a getter, `toJSON` or proxy trap throws, or a proxy over an object is revoked. A getter that builds a new object on every read describes an endless structure, which `sizeof` walks until memory runs out.

This is the size of the data, not of V8's internal representation. For what a value actually retains in memory, take a heap snapshot in DevTools. Nor is it a safe limit for untrusted input: an array of a million `null`s is 0.

### Performance

Objects are walked with an explicit stack: no recursion, no serialization, no limit on nesting depth. Extra memory grows mainly with the number of distinct objects: about 60 bytes each at the million-object scale of the benchmark below, more on smaller inputs. Three things grow with the data instead: the key list of the object being walked, a concatenated string that V8 flattens when it is first read (as for any reader), and whatever a `toJSON` method allocates, such as a base64 copy of binary data. A chain linked through each object's last key, as in most linked lists, needs no stack per link; a chain through another key, or through Maps and Sets, keeps about 180 bytes per level until the walk unwinds.

That memory is on the V8 heap, so a process already close to its `--max-old-space-size` can run out of heap where 2.6.5 did not: most of 2.6.5's extra memory, the serializer's buffers and its result string, was outside V8's old generation, which that flag limits. Arrays are walked by index, so a sparse array with a huge `length` takes time in proportion to that length.

`npm run bench` compares this version with 2.6.5 on synthetic datasets shaped like the cache in #102, and on the inputs reported in #82, #87, #91 and #101. Its output, unedited:

Node.js v26.9.0, darwin-arm64, median of 3 runs

| | 2.6.5 | 3.0.0 |
|---|---|---|
| 1M small records (138 MB heap): first call | 409 ms | 218 ms |
| 1M small records (138 MB heap): repeat call | 375 ms | 358 ms |
| 1M small records (138 MB heap): extra memory | +393 MB | +119 MB |
| 100k records, 1 KB text + 50 numbers each (155 MB heap): first call | 303 ms | 42 ms |
| 100k records, 1 KB text + 50 numbers each (155 MB heap): repeat call | 283 ms | 47 ms |
| 100k records, 1 KB text + 50 numbers each (155 MB heap): extra memory | +543 MB | +16 MB |
| 100,000-deep nested arrays (#91) | returns an Error object | 100,000 |
| Circular reference | returns an Error object | 13 |
| `'abcde'` vs `['abcde']` (#87) | 20 vs 9 | 5 vs 5 |
| `'abc'` in Node.js vs browser (#82) | 16 vs 6 | 3 vs 3 |
| `{ m: new Map([['k', 1 KB string]]) }` | 8 | 1,002 |
| `'abc'` in a web worker (#101) | throws: global is not defined | 3 |

Browser bundle, minified and gzipped: 9.3 KB in 2.6.5, 1.8 KB now.

### Upgrading from 2.x

- Sizes change. 2.x measured objects as JSON text and strings as V8 heap estimates in Node.js but 2 bytes per character in browsers; 3.0 applies the rules above everywhere. Recalibrate any thresholds built on 2.x numbers.
- A value with nothing to count is now 0. lru-cache rejects a size of 0, so use `sizeCalculation: (value) => sizeof(value) || 1`.
- Failures return `-1` instead of an `Error` object: check `size < 0`, not `instanceof Error` or `typeof size === 'number'`. Circular structures are no longer failures; they are measured.
- The only entry point is `object-sizeof`. `object-sizeof/indexv2` and `object-sizeof/byte_size` are gone, and `object-sizeof/index`, which was the 1.x implementation, now loads 3.0.
- TypeScript: import with `import sizeof from 'object-sizeof'`. `import * as sizeof` is not callable in ES module output, and TypeScript 4.1+ reports that only with `esModuleInterop` or under node16/nodenext. The types are now a module, so a project on classic module resolution needs `moduleResolution` `node`, `node16` or `bundler`. Name the function's type `typeof import('object-sizeof').default`, and a dynamic import `Promise<{ default: typeof import('object-sizeof').default }>`. Plain `typeof import('object-sizeof')` describes `require()` under node16/nodenext, and TypeScript 4.0 and older read it as the module object when a library's declaration files, emitted by 4.1+, use it.

### Coding standards

The project follows [JavaScript Standard Style](https://standardjs.com/) as a JavaScript style guide.
Code coverage reports are done using Codecov.io.

Code is written with the assumptions that any code added, which is not tested properly, is already or will be buggy.
Hence test coverage, with the BDD style unit tests, stating the intent, and expected behaviour, is a must.

### Licence

The MIT License (MIT)

Copyright (c) 2015, Andrei Karpuszonak aka @miktam

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiktam%2Fsizeof.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmiktam%2Fsizeof?ref=badge_shield)

### Maintainer

First published in May 2014 by Andrei, who still maintains it.
[github.com/miktam](https://github.com/miktam)
