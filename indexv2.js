// Copyright 2023 ChatGPT Jan 9 Version
/* eslint-disable new-cap */ // to fix new Buffer.from
'use strict'
const util = require('util')
const ECMA_SIZES = require('./byte_size')

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
      bytes += value.length * ECMA_SIZES.STRING
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
      bytes += Buffer.byteLength(util.inspect(value), 'utf8')
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
