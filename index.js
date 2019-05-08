// Copyright 2014 Andrei Karpushonak

'use strict'

var ECMA_SIZES = require('./byte_size')
var Buffer = require('buffer').Buffer

function sizeOfObject (object) {
  if (object == null) {
    return 0
  }

  var bytes = 0
  for (var key in object) {
    if (!Object.hasOwnProperty.call(object, key)) {
      continue
    }

    bytes += sizeof(key)
    try {
      bytes += sizeof(object[key])
    } catch (ex) {
      if (ex instanceof RangeError) {
        // circular reference detected, final result might be incorrect
        // let's be nice and not throw an exception
        bytes = 0
      }
    }
  }

  return bytes
}

/**
 * Main module's entry point
 * Calculates Bytes for the provided parameter
 * @param object - handles object/string/boolean/buffer
 * @returns {*}
 */
function sizeof (object) {
  if (Buffer.isBuffer(object)) {
    return object.length
  }

  var objectType = typeof (object)
  switch (objectType) {
    case 'string':
      return object.length * ECMA_SIZES.STRING
    case 'boolean':
      return ECMA_SIZES.BOOLEAN
    case 'number':
      return ECMA_SIZES.NUMBER
    case 'object':
      return sizeOfObject(object)
    default:
      return 0
  }
}

module.exports = sizeof
