// Copyright 2014 Andrei Karpushonak

'use strict'

var ECMA_SIZES = require('./byte_size')
var Buffer = require('buffer').Buffer

function allProperties(obj) {
  const stringProperties = []
  for (var prop in obj) { 
      stringProperties.push(prop)
  }
  if (Object.getOwnPropertySymbols) {
      var symbolProperties = Object.getOwnPropertySymbols(obj)
      Array.prototype.push.apply(stringProperties, symbolProperties)
  }
  return stringProperties
}

function sizeOfObject (seen, object) {
  if (object == null) {
    return 0
  }

  var bytes = 0
  var properties = allProperties(object)
  for (var i = 0; i < properties.length; i++) {
    var key = properties[i]
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
  return function calculator(object) {
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
      case 'symbol':
        const isGlobalSymbol = Symbol.keyFor && Symbol.keyFor(object)
        return isGlobalSymbol ? Symbol.keyFor(object).length * ECMA_SIZES.STRING : (object.toString().length - 8) * ECMA_SIZES.STRING 
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
