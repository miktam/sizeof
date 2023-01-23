// Copyright 2023 ChatGPT Jan 9 Version
/* eslint-disable new-cap */ // to fix new Buffer.from
'use strict'

const oldSizeof = require('./index')

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
    return oldSizeof(obj)
  }

  return totalSize
}
