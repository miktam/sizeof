// Copyright 2014 Andrei Karpushonak

'use strict'

var ECMA_SIZES = require('./byte_size')
var Buffer = require('buffer').Buffer

function sizeOfObject (seen, object) {
  if (object == null) {
    return 0
  }

  var bytes = 0
  for (var key in object) {
    // Do not recalculate circular references
    if (typeof object[key] === 'object' && object[key] !== null) {
      if (seen.has(object[key])) {
        continue
      }
      seen.add(object[key])
    }

    bytes += getCalculator(seen)(key)
    try {
      bytes += getCalculator(seen)(object[key])
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

function getCalculator (seen) {
  return function (object) {
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
        if (Array.isArray(object)) {
          return object.map(getCalculator(seen)).reduce(function (acc, curr) {
            return acc + curr
          }, 0)
        } else {
          return sizeOfObject(seen, object)
        }
      default:
        return 0
    }
  }
}

/**
 * Main module's entry point
 * Calculates Bytes for the provided parameter
 * @param object - handles object/string/boolean/buffer
 * @returns {*}
 */
function sizeof (object) {
  return getCalculator(new WeakSet())(object)
}

module.exports = sizeof
