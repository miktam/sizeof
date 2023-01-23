'use strict'

/* global describe, it */

const should = require('should')
const sizeof = require('../indexv2.js')

describe('sizeof', function () {
  it('should handle null in object keys', function () {
    const badData = { 1: { depot_id: null, hierarchy_node_id: null } }
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

  it('of 3 chars string is 16', function () {
    sizeof('abc').should.be.equal(16)
  })

  it('boolean size shall be 4', function () {
    sizeof(true).should.be.equal(4)
  })

  it('report an error for circular dependency objects', function () {
    const firstLevel = { a: 1 }
    const secondLevel = { b: 2, c: firstLevel }
    firstLevel.second = secondLevel
    should.exist(sizeof(firstLevel))
  })

  it('handle hasOwnProperty key', function () {
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
})
