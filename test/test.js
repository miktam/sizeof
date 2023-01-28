'use strict'

/* global describe, it */

const should = require('should')
const sizeof = require('../indexv2.js')

describe('sizeof', () => {
  it('should handle null in object keys', () => {
    const badData = { 1: { depot_id: null, hierarchy_node_id: null } }
    sizeof(badData).should.be.instanceOf(Number)
  })

  it('null is 0', () => {
    sizeof(null).should.be.equal(0)
  })

  it('number size shall be 8', () => {
    sizeof(5).should.be.equal(8)
  })

  it('undefined is 0', () => {
    sizeof().should.be.equal(0)
  })

  it('of 3 chars string is 6', () => {
    sizeof('abc').should.be.equal(6)
  })

  it('boolean size shall be 4', () => {
    sizeof(true).should.be.equal(4)
  })

  it('report an error for circular dependency objects', () => {
    const firstLevel = { a: 1 }
    const secondLevel = { b: 2, c: firstLevel }
    firstLevel.second = secondLevel
    should.exist(sizeof(firstLevel))
  })

  it('handle hasOwnProperty key', () => {
    sizeof({ hasOwnProperty: undefined }).should.be.instanceOf(Number)
    sizeof({ hasOwnProperty: 'Hello World' }).should.be.instanceOf(Number)
    sizeof({ hasOwnProperty: 1234 }).should.be.instanceOf(Number)
  })

  it('supports symbol', () => {
    const descriptor = 'abcd'
    sizeof(Symbol(descriptor)).should.equal(2 * descriptor.length)
  })

  it('supports global symbols', () => {
    const globalSymbol = Symbol.for('a')
    const obj = { [globalSymbol]: 'b' }
    sizeof(obj).should.equal(2)
  })

  it('array support for strings - longer array should have sizeof above the shorter one', () => {
    sizeof(['a', 'b', 'c', 'd']).should.be.above(sizeof(['a', 'b']))
  })

  it('array support for numbers - longer array should have sizeof above the shorter one', () => {
    sizeof([1, 2, 3]).should.be.above(sizeof([1, 2]))
  })

  it('array support for NaN - longer array should have sizeof above the shorter one', () => {
    sizeof([NaN, NaN]).should.be.above(sizeof([NaN]))
  })

  it('map support', () => {
    const mapSmaller = new Map()
    mapSmaller.set('a', 1)
    const mapBigger = new Map()
    mapBigger.set('a', 1)
    mapBigger.set('b', 2)
    console.log(sizeof(mapBigger), sizeof(mapSmaller))
    sizeof(mapBigger).should.be.above(sizeof(mapSmaller))
  })
})
