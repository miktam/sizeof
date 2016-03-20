"use strict";

var _           = require('lodash');
var ECMA_SIZES  = require('./byte_size');

/**
 * Main module's entry point
 * Calculates Bytes for the provided parameter
 * @param object - handles object/string/boolean/buffer
 * @returns {*}
 */
function sizeof(object) {
  try {
    if (_.isObject(object)) {
      if (Buffer.isBuffer(object)) {
        return object.length;
      }
      else {
        var bytes = 0;
        _.forOwn(object, function (value, key) {
          bytes += sizeof(key) + sizeof(value);
        });
        return bytes;
      }
    } else if (_.isString(object)) {
      return object.length * ECMA_SIZES.STRING;
    } else if (_.isBoolean(object)) {
      return ECMA_SIZES.BOOLEAN;
    } else if (_.isNumber(object)) {
      return ECMA_SIZES.NUMBER;
    } else {
      return 0;
    }
  } catch (ex) {
    // do not rethrow, just nullify current branch
    return 0
  }
}

module.exports = sizeof;
