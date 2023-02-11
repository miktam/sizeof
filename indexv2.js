// Copyright 2023 ChatGPT Jan 9 Version
/* eslint-disable new-cap */ // to fix new Buffer.from
'use strict'
const ECMA_SIZES = require('./byte_size')
const Buffer = require('buffer/').Buffer

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

/**
 * Size in bytes for complex objects
 * @param {*} obj
 * @returns size in bytes, or -1 if JSON.stringify threw an exception
 */
function objectSizeComplex (obj) {
  let totalSize = 0
  const errorIndication = -1
  try {
    // analyse the object to calculate it better
    let potentialConversion = obj
    if (obj instanceof Map) {
      // convert the map to an object
      potentialConversion = Object.fromEntries(obj)
    } else if (obj instanceof Set) {
      // convert the set to an array
      potentialConversion = Array.from(obj)
    }
    if (obj instanceof Int8Array) {
      return obj.length * ECMA_SIZES.Int8Array
    } else if (obj instanceof Uint8Array || obj instanceof Uint8ClampedArray) {
      return obj.length * ECMA_SIZES.Uint8Array
    } else if (obj instanceof Int16Array) {
      return obj.length * ECMA_SIZES.Int16Array
    } else if (obj instanceof Uint16Array) {
      return obj.length * ECMA_SIZES.Uint16Array
    } else if (obj instanceof Int32Array) {
      return obj.length * ECMA_SIZES.Int32Array
    } else if (obj instanceof Uint32Array) {
      return obj.length * ECMA_SIZES.Uint32Array
    } else if (obj instanceof Float32Array) {
      return obj.length * ECMA_SIZES.Float32Array
    } else if (obj instanceof Float64Array) {
      return obj.length * ECMA_SIZES.Float64Array
    }
    const objectToString = JSON.stringify(potentialConversion)
    const buffer = new Buffer.from(objectToString)
    totalSize = buffer.byteLength
  } catch (ex) {
    console.error('Error detected, return ' + errorIndication, ex)
    return errorIndication
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
      bytes += Buffer.from(value.toString()).byteLength
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

module.exports = function (obj) {
  let totalSize = 0

  if (obj !== null && typeof obj === 'object') {
    totalSize = objectSizeComplex(obj)
  } else {
    totalSize = objectSizeSimple(obj)
  }

  return totalSize
}
