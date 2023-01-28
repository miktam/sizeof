## object-sizeof

[![Build Status](https://travis-ci.org/miktam/sizeof.svg?branch=master)](https://travis-ci.org/miktam/sizeof) ![GitHub contributors](https://img.shields.io/github/contributors/miktam/sizeof) [![NPM](https://img.shields.io/npm/dy/object-sizeof)](https://img.shields.io/npm/dy/object-sizeof) [![codecov](https://codecov.io/gh/miktam/sizeof/branch/master/graph/badge.svg?token=qPHxmWpC1K)](https://codecov.io/gh/miktam/sizeof)

### Get size of a JavaScript object in Bytes - Node.js

Node.js version uses the Buffer.from(objectToString) method to convert the object's string representation to a buffer, and then it uses the byteLength property to obtain the buffer size in bytes.

### Complex types support

- Map
- Set

### Get size of a JavaScript object in Bytes - Browser

For the browser, the calculation takes an object as an argument. It uses a combination of recursion and a stack to iterate through all of its properties, adding up the number of bytes for each data type it encounters.

Please note that this function will only work in some cases, especially when dealing with complex data structures or when the object contains functions.

### Coding standards

Project follows [JavaScript Standard Style](https://standardjs.com/) as a JavaScript style guide.
Code coverage reports done using Codecov.io.

Code is written with the assumptions, that any code added, which is not tested properly, is already or will be buggy.
Hence test coverage, with the BDD style unit tests, stating the intent, and expected behaviour, is a must.

### Get size of a JavaScript object in Bytes - version 1.x

JavaScript does not provide sizeof (like in C), and programmer does not need to care about memory allocation/deallocation.

However, according to [ECMAScript Language Specification](http://www.ecma-international.org/ecma-262/5.1/), each String value is represented by 16-bit unsigned integer, Number uses the double-precision 64-bit format IEEE 754 values including the special "Not-a-Number" (NaN) values, positive infinity, and negative infinity.

Having this knowledge, the module calculates how much memory object will allocate.

### Limitations

Please note, that V8 which compiles the JavaScript into native machine code, is not taken into account, as the compiled code is additionally heavily optimized.

### Installation

`npm install object-sizeof`

### Examples

```javascript
import sizeof from 'object-sizeof'

// 2B per character, 6 chars total => 12B
console.log(sizeof({ abc: 'def' }))

// 8B for Number => 8B
console.log(sizeof(12345))

const param = {
  a: 1,
  b: 2,
  c: {
    d: 4
  }
}
// 4 one two-bytes char strings and 3 eighth-bytes numbers => 32B
console.log(sizeof(param))
```

### Licence

The MIT License (MIT)

Copyright (c) 2015, Andrei Karpushonak aka @miktam

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiktam%2Fsizeof.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmiktam%2Fsizeof?ref=badge_shield)
