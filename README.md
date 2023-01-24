## object-sizeof

[![Build Status](https://travis-ci.org/miktam/sizeof.svg?branch=master)](https://travis-ci.org/miktam/sizeof)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiktam%2Fsizeof.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmiktam%2Fsizeof?ref=badge_shield)
[![NPM](https://img.shields.io/npm/dy/object-sizeof)](https://img.shields.io/npm/dy/object-sizeof)
[![codecov](https://codecov.io/gh/miktam/sizeof/branch/master/graph/badge.svg)](https://codecov.io/gh/miktam/sizeof)

### Get size of a JavaScript object in Bytes - version 2.x

New version uses the Buffer.from(objectToString) method to convert the string representation of the object to a buffer and then it uses the byteLength property to obtain the size of the buffer in bytes.
Note that this method only work in Node.js environment.

For everything else, the calculation takes an object as an argument and uses a combination of recursion and a stack to iterate through all of its properties, adding up the number of bytes for each data type it encounters. The function works by creating an array 'objectList' which is used to keep track of objects that have already been processed so as to avoid cyclic references.
It uses stack to keep track of the object properties and iterates over the stack and for each item on the stack it checks if it's type of boolean, string, number or object. If it's boolean it's size is 4 bytes, if it's string it's size is length of string \* 2 bytes, if it's number it's size is 8 bytes, if it's object and it's not in the objectList it's pushed to the stack to be iterated again.

Please note that this function will not work on all cases, specially when dealing with complex data structures or when the object contains functions, it's just an example of how one can calculate the size of an object in javascript

### Get size of a JavaScript object in Bytes - version 1.x

JavaScript does not provide sizeof (like in C), and programmer does not need to care about memory allocation/deallocation.

However, according to [ECMAScript Language Specification](http://www.ecma-international.org/ecma-262/5.1/), each String value is represented by 16-bit unsigned integer, Number uses the double-precision 64-bit format IEEE 754 values including the special "Not-a-Number" (NaN) values, positive infinity, and negative infinity.

Having this knowledge, the module calculates how much memory object will allocate.

### Limitations

Please note, that V8 which compiles the JavaScript into native machine code, is not taken into account, as the compiled code is additionally heavily optimized.

### Installation

`npm install object-sizeof`

### Examples

#### ES5

```javascript
var sizeof = require('object-sizeof')

// 2B per character, 6 chars total => 12B
console.log(sizeof({ abc: 'def' }))

// 8B for Number => 8B
console.log(sizeof(12345))

var param = {
  a: 1,
  b: 2,
  c: {
    d: 4
  }
}
// 4 one two-bytes char strings and 3 eighth-bytes numbers => 32B
console.log(sizeof(param))
```

#### ES6

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

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiktam%2Fsizeof.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmiktam%2Fsizeof?ref=badge_large)
