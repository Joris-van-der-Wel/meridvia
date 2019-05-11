'use strict';
const {describe, it} = require('mocha-sugar-free');

const {strictEqual: eq, throws} = require('../assert');
const {parseTimeInterval} = require('../../lib/parseTimeInterval');

describe('parseTimeInterval', () => {
    it('Should properly parse valid time intervals', () => {
        eq(parseTimeInterval(123456), 123456);
        eq(parseTimeInterval('123456ms'), 123456);
        eq(parseTimeInterval('123.456s'), 123456);
        eq(parseTimeInterval('4m'), 240000);
        eq(parseTimeInterval('4.5m'), 270000);
        eq(parseTimeInterval('1.5h'), 5400000);
        eq(parseTimeInterval('1d'), 86400000);
    });

    it('Should throw for invalid types and invalid values', () => {
        throws(() => parseTimeInterval(undefined), Error, /time.*interval.*number.*or.*string/i);
        throws(() => parseTimeInterval(null), Error, /time.*interval.*number.*or.*string/i);
        throws(() => parseTimeInterval({}), Error, /time.*interval.*number.*or.*string/i);
        throws(() => parseTimeInterval(NaN), Error, /time.*interval.*finite/i);
        throws(() => parseTimeInterval('123'), Error, /time.*interval.*incorrect.*format/i);
        throws(() => parseTimeInterval('123z'), Error, /time.*interval.*incorrect.*format/i);
        throws(() => parseTimeInterval('bla'), Error, /time.*interval.*incorrect.*format/i);
        throws(() => parseTimeInterval(''), Error, /time.*interval.*incorrect.*format/i);
    });
});
