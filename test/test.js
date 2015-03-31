"use strict";

/*global describe, it, before, beforeEach, after, afterEach */

var should = require('should');
var sizeof = require("../index");
var _ = require('lodash');

describe('sizeof', function() {

  it('should handle null in object keys', function() {
    var badData = {"1":{"depot_id":null,"hierarchy_node_id":null}};
    console.log('size', sizeof(badData));
    sizeof(badData);
    _.isNaN(sizeof(badData)).should.be.equal(false);
  });

  it('null is 0', function() {
    sizeof(null).should.be.equal(0);
  });

  it('undefined is 0', function() {
    sizeof().should.be.equal(0);
  });

  it('of 3 chars string is 2*3=6', function() {
    sizeof("abc").should.be.equal(6);
  });

  it('simple object of 3 chars for key and value', function() {
    sizeof({abc: 'def'}).should.be.equal(2*3 * 2);
  });

  it('boolean size shall be 4', function() {
    sizeof(true).should.be.equal(4);
  });

  it('nested objects shall be counted in full', function() {
    // 4 one two-bytes char strings and 3 eighth-bytes numbers
    var param = { a: 1, b: 2, c: {d: 4}};
    sizeof(param).should.be.equal(4*2 + 3*8);
  });

  it('object with 100 three-chars keys and values as numbers => 100 * 2 * 3 + 100 * 8', function() {
    var obj = {};
    var ELEMENTS = 100;
    // start from 1M to have the same keys length
    for (var i=100; i< 100 + ELEMENTS; i++) {
      obj[i] = i;
    }

    sizeof(obj).should.be.equal(ELEMENTS * 2 * (('' + ELEMENTS).length) + ELEMENTS * 8);
  });

})