// Copyright 2023 ChatGPT May 24 Version
'use strict'
const ECMA_SIZES = require('./byte_size')

// Node.js's own Buffer, read off globalThis so that bundlers do not inject
// a Buffer polyfill. Only trusted on Node.js: browser apps often install the
// npm `buffer` polyfill as a global, and its byteLength copies the string.
const NodeBuffer = (function () {
  try {
    const g = typeof globalThis !== 'undefined' ? globalThis : null
    const isNode = g !== null && g.process && g.process.versions && g.process.versions.node
    return isNode && g.Buffer && typeof g.Buffer.byteLength === 'function' ? g.Buffer : null
  } catch (ex) {
    // a tampered `process` must not stop the module from loading
    return null
  }
})()

/**
 * Number of bytes in the UTF-8 encoding of a string. Uses Buffer.byteLength
 * in Node.js; elsewhere counts in plain JS without allocating the encoded
 * copy, so no Buffer polyfill is needed.
 * Unpaired surrogates count as 3 bytes, as with Buffer and TextEncoder,
 * which replace them with U+FFFD.
 * @param {string} str
 */
function utf8ByteLength (str) {
  if (NodeBuffer) {
    return NodeBuffer.byteLength(str, 'utf8')
  }
  let bytes = 0
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x80) {
      bytes += 1
    } else if (code < 0x800) {
      bytes += 2
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4
        i++
      } else {
        bytes += 3
      }
    } else {
      bytes += 3
    }
  }
  return bytes
}

/**
 * Precisely calculate size of string in node
 * Based on https://stackoverflow.com/questions/68789144/how-much-memory-do-v8-take-to-store-a-string/68791382#68791382
 * @param {} str
 */
function preciseStringSizeNode (str) {
  return 12 + 4 * Math.ceil(str.length / 4)
}

/**
 * In the browser environment, window and document are defined as global objects
 * @returns true if its a Node.js env, false if it is a browser
 */
function isNodeEnvironment () {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return false
  }
  return true
}

function getSizeOfTypedArray (typedArray) {
  if (typedArray.BYTES_PER_ELEMENT) {
    return typedArray.length * typedArray.BYTES_PER_ELEMENT
  }
  return -1 // error indication
}

/**
 * Size in bytes for complex objects
 * @param {*} obj
 * @returns size in bytes, or -1 if JSON.stringify threw an exception
 */
function objectSizeComplex (obj) {
  let totalSize = 0
  const errorIndication = -1

  try {
    // convert Map and Set to an object representation
    let convertedObj = obj
    if (obj instanceof Map) {
      convertedObj = Object.fromEntries(obj)
    } else if (obj instanceof Set) {
      convertedObj = Array.from(obj)
    }

    // handle typed arrays
    if (ArrayBuffer.isView(obj)) {
      return getSizeOfTypedArray(obj)
    }

    const serializedObj = JSON.stringify(convertedObj, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString()
      } else if (typeof value === 'function') {
        return value.toString()
      } else if (typeof value === 'undefined') {
        return 'undefined'
      } else if (typeof value === 'symbol') {
        return value.toString()
      } else if (value instanceof RegExp) {
        return value.toString()
      } else {
        return value
      }
    })

    totalSize = utf8ByteLength(serializedObj)
  } catch (ex) {
    // do not log anyting to console.error
    return new Error(errorIndication)
  }

  return totalSize
}

/**
 * Size in bytes for primitive types
 * @param {*} obj
 * @returns size in bytes
 */
function objectSizeSimple (obj) {
  const objectList = []
  const stack = [obj]
  let bytes = 0

  while (stack.length) {
    const value = stack.pop()

    if (typeof value === 'boolean') {
      bytes += ECMA_SIZES.BYTES
    } else if (typeof value === 'string') {
      if (isNodeEnvironment()) {
        bytes += preciseStringSizeNode(value)
      } else {
        bytes += value.length * ECMA_SIZES.STRING
      }
    } else if (typeof value === 'number') {
      bytes += ECMA_SIZES.NUMBER
    } else if (typeof value === 'symbol') {
      const isGlobalSymbol = Symbol.keyFor && Symbol.keyFor(obj)
      if (isGlobalSymbol) {
        bytes += Symbol.keyFor(obj).length * ECMA_SIZES.STRING
      } else {
        bytes += (obj.toString().length - 8) * ECMA_SIZES.STRING
      }
    } else if (typeof value === 'bigint') {
      bytes += utf8ByteLength(value.toString())
    } else if (typeof value === 'function') {
      bytes += value.toString().length
    } else if (typeof value === 'object' && objectList.indexOf(value) === -1) {
      objectList.push(value)

      for (const i in value) {
        stack.push(value[i])
      }
    }
  }
  return bytes
}

function sizeof (obj) {
  let totalSize = 0

  if (obj !== null && typeof obj === 'object') {
    totalSize = objectSizeComplex(obj)
  } else {
    totalSize = objectSizeSimple(obj)
  }

  return totalSize
}

module.exports = sizeof
// lets `import sizeof from 'object-sizeof'` work when compiled to CommonJS without esModuleInterop
module.exports.default = sizeof
