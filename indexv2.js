// Copyright 2023 ChatGPT Jan 9 Version
/* eslint-disable new-cap */ // to fix new Buffer.from
'use strict'
const ECMA_SIZES = require('./byte_size')

function objectSize (obj) {
  var objectList = []
  var stack = [obj]
  var bytes = 0

  while (stack.length) {
    var value = stack.pop()

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
    } else if (typeof value === 'object' && objectList.indexOf(value) === -1) {
      objectList.push(value)

      for (var i in value) {
        stack.push(value[i])
      }
    }
  }
  return bytes
}

module.exports = function (obj) {
  let totalSize = 0
  const errorIndication = -1

  if (obj !== null && typeof obj === 'object') {
    try {
      const objectToString = JSON.stringify(obj)
      const buffer = new Buffer.from(objectToString)
      totalSize = buffer.byteLength
    } catch (ex) {
      console.error('Error detected, return ' + errorIndication, ex)
      return errorIndication
    }
  } else {
    console.log('type of object not recognized', typeof obj)
    return objectSize(obj)
  }

  return totalSize
}
