'use strict';

var suman = require('suman');
var Test = suman.init(module, {
  timeout: 10000,
  integrants: [ 'smartconnect', 'dolce-vida', 'charlie' ]
});

// (suite 2 below has error in hook)

Test.describe('suite 1', { parallel: true }, function () {

  this.before.cb('D', t => {
    t.done();
  });

  const cars = [ 1, 2, 3 ];

  this.describe('x', function () {

    this.describe('desc', function () {

      this.before.cb('C', { fatal: true }, t => {
        t.done();
      });

      this.it('does 1', { throws: /blind/ }, function () {
        throw new Error('blind');

      });

      this.it('mm', { z: 'b' });

      this.it('does 2', function () {

      });

      this.it('does 2', function () {

      });

    });

    this.before.cb('B', t => {
      t.done();
    });

    this.it('does 3', function () {

    });

    this.describe('desc 4', function () {

      this.before.cb('A', t => {
        t.done();
      });

      this.it('does 4', function () {
        //should timeout because no callback is called
      });

    });

  });

});

Test.describe('suite 2', { parallel: true }, function () {

  this.before.cb('D', t => {
    t.done();
  });

  const cars = [ 1, 2, 3 ];

  this.describe('desc', function () {

    this.describe('desc', function () {

      this.before.cb('C', { fatal: false }, t => {
        // t.done = 'fooage';
        t.done(new Error('dog'));
      });

      this.it('does 1', { throws: /blind/ }, function () {
        throw new Error('blind');

      });

      this.it('does 2', function () {

      });

      this.it('does 2', function () {

      });

      this.it('does 2', function () {

      });

    });

    this.before.cb('B', t => {
      t.done();
    });

    this.it('does 3', function () {

    });

    this.describe('desc 4', function () {

      this.before.cb('A', t => {
        t.done();
      });

      this.it('does 4', function () {
        //should timeout because no callback is called
      });

    });

  });

});