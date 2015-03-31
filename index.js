// Copyright 2014 Andrei Karpushonak

"use strict";

var _           = require('lodash');
var Stats       = require('./stats').Stats;
var ECMA_SIZES  = require('./byte_size');

/**
 * Collect all the keys/values of the object
 * Handles nested objects via recursion
 * @param object  - object to analyze
 * @param stats   - helper object to collect all the keys/values
 * @returns {*}
 */
var collectKeysValues = function (object, stats) {

  for(var prop in object) {
    if(object.hasOwnProperty(prop)) {
      if (_.isObject(object[prop])) {
        // this key is a reference, count the key and proceed with the referenced value
        stats.addKey(prop);
        collectKeysValues(object[prop], stats);
      } else {
        stats.addKeyValue(prop, object[prop]);
      }
    }
  }

  return object;

};

/**
 * Main module's entry point
 * Calculates Bytes for the provided parameter
 * @param object - handles object/string/boolean
 * @returns {*}
 */
function sizeof(object) {

  var bytes = 0;

  if (_.isObject(object)) {
    var stats = new Stats();
    collectKeysValues(object, stats);
    // calculate size in Bytes based on ECMAScript Language Specs
    bytes = stats.calculateBytes();
  } else if (_.isString(object)) {
    bytes = object.length * ECMA_SIZES.STRING;
  } else if (_.isBoolean(object)) {
    bytes = ECMA_SIZES.BOOLEAN;
  }
  return bytes;
}

module.exports = sizeof;