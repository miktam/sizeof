## object-sizeof

[![Build](https://img.shields.io/npm/v/object-sizeof)](https://img.shields.io/npm/v/object-sizeof) ![GitHub contributors](https://img.shields.io/github/contributors/miktam/sizeof) [![NPM](https://img.shields.io/npm/dy/object-sizeof)](https://img.shields.io/npm/dy/object-sizeof) [![codecov](https://codecov.io/gh/miktam/sizeof/branch/master/graph/badge.svg?token=qPHxmWpC1K)](https://codecov.io/gh/miktam/sizeof)

### Get the size of a JavaScript object in Bytes

Objects are measured as the UTF-8 byte length of their JSON representation. The same code runs in Node.js, browsers and web workers.

Because the JSON string is built in full, measuring a large object temporarily needs several times its serialized size in extra memory: about 3 times for records and text, and 40 to 100 bytes per element for large flat arrays of numbers, booleans or short strings, which is 5 to over 20 times their serialized size.

Please note that this function will only work in some cases, especially when dealing with complex data structures or when the object contains functions.

### Supported Standard built-in and complex types

- Map and Set passed directly (nested ones serialize as `{}`, as in JSON)
- BigInt
- Function
- Typed Arrays (Int8Array, Uint32Array, Float64Array, etc) passed directly

### Error handling

sizeof does not throw when an object cannot be serialized, e.g. because of circular references. It returns an `Error` object whose message is `-1`. A DataView passed directly returns `-1`.

### Coding standards

The project follows [JavaScript Standard Style](https://standardjs.com/) as a JavaScript style guide.
Code coverage reports are done using Codecov.io.

Code is written with the assumptions that any code added, which is not tested properly, is already or will be buggy.
Hence test coverage, with the BDD style unit tests, stating the intent, and expected behaviour, is a must.

### Get size of a JavaScript object in Bytes - version 1.x

JavaScript does not provide sizeof (like in C), and programmer does not need to care about memory allocation/deallocation.

However, according to [ECMAScript Language Specification](http://www.ecma-international.org/ecma-262/5.1/), each String value is represented by 16-bit unsigned integer, Number uses the double-precision 64-bit format IEEE 754 values including the special "Not-a-Number" (NaN) values, positive infinity, and negative infinity.

Having this knowledge, the module calculates how much memory object will allocate.

### Installation

`npm install object-sizeof`

### Examples

```javascript
import sizeof from 'object-sizeof'
// or: const sizeof = require('object-sizeof')
const sizeObj = sizeof({ abc: 'def' })
console.log(`Size of the object: ${sizeObj} bytes`)
const sizeInt = sizeof(12345)
console.log(`Size of the int: ${sizeInt} bytes`)
```

### Licence

The MIT License (MIT)

Copyright (c) 2015, Andrei Karpuszonak aka @miktam

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiktam%2Fsizeof.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmiktam%2Fsizeof?ref=badge_shield)
