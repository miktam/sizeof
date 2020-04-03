'use strict'

/* global describe, it */

var should = require('should')
var sizeof = require('../index')

describe('sizeof', function () {
  it('should handle null in object keys', function () {
    var badData = { 1: { depot_id: null, hierarchy_node_id: null } }
    sizeof(badData).should.be.instanceOf(Number)
  })

  it('null is 0', function () {
    sizeof(null).should.be.equal(0)
  })

  it('number size shall be 8', function () {
    sizeof(5).should.be.equal(8)
  })

  it('undefined is 0', function () {
    sizeof().should.be.equal(0)
  })

  it('of 3 chars string is 2*3=6', function () {
    sizeof('abc').should.be.equal(6)
  })

  it('simple object of 3 chars for key and value', function () {
    sizeof({ abc: 'def' }).should.be.equal(2 * 3 * 2)
  })

  it('boolean size shall be 4', function () {
    sizeof(true).should.be.equal(4)
  })

  it('buffer size should be correct', function () {
    sizeof(Buffer.alloc(3)).should.be.equal(3)
  })

  it('nested objects shall be counted in full', function () {
    // 4 one two-bytes char strings and 3 eighth-bytes numbers
    var param = { a: 1, b: 2, c: { d: 4 } }
    sizeof(param).should.be.equal(4 * 2 + 3 * 8)
  })

  it('object with 100 three-chars keys and values as numbers => 100 * 2 * 3 + 100 * 8', function () {
    var obj = {}
    var ELEMENTS = 100
    // start from 1M to have the same keys length
    for (var i = 100; i < 100 + ELEMENTS; i++) {
      obj[i] = i
    }

    sizeof(obj).should.be.equal(ELEMENTS * 2 * (('' + ELEMENTS).length) + ELEMENTS * 8)
  })

  it('report an error for circular dependency objects', function () {
    var firstLevel = { a: 1 }
    var secondLevel = { b: 2, c: firstLevel }
    firstLevel.second = secondLevel
    should.exist(sizeof(firstLevel))
  })

  it('handle hasOwnProperty key', function () {
    sizeof({ hasOwnProperty: undefined }).should.be.instanceOf(Number)
    sizeof({ hasOwnProperty: 'Hello World' }).should.be.instanceOf(Number)
    sizeof({ hasOwnProperty: 1234 }).should.be.instanceOf(Number)
  })

  it('array support for strings', function () {
    sizeof(['a', 'b', 'c', 'd']).should.be.equal(8)
  })

  it('array support for numbers', function () {
    sizeof([1, 2, 3, 4]).should.equal(32)
  })

  it('array support for NaN', function () {
    sizeof([null, undefined, 3, 4]).should.equal(16)
  })

  it('supports symbol', () => {
    const descriptor = 'abcd'
    sizeof(Symbol(descriptor)).should.equal(2 * descriptor.length)
  })

  it('supports symbols as keys', () => {
    const descriptor = 'abcd'
    const symbol = Symbol(descriptor)
    const value = 'efg'
    sizeof({ [symbol]: value }).should.equal(2 * descriptor.length + 2 * value.length)
  })

  it('supports nested symbols as keys', () => {
    const a = Symbol('a')
    const b = Symbol('b')
    const c = Symbol('c')
    const obj = { [a]: { [b]: { [c]: 'd' } } }
    sizeof(obj).should.equal(8)
  })

  it('supports nested symbols as values', () => {
    const a = Symbol('a')
    const b = Symbol('b')
    const c = Symbol('c')
    const d = Symbol('d')
    const obj = { [a]: { [b]: { [c]: d } } }
    sizeof(obj).should.equal(8)
  })

  it('does not recount seen objects', () => {
    const a = Symbol('a')
    const b = Symbol('b')
    const c = Symbol('c')
    const d = Symbol('d')
    const obj = { [a]: { [b]: { [c]: d } } }
    obj[Symbol()] = obj[a]
    sizeof(obj).should.equal(8)
  })

  it('supports global symbols', () => {
    const globalSymbol = Symbol.for('a')
    const obj = { [globalSymbol]: 'b'}
    sizeof(obj).should.equal(4)
  })
})
