'use strict';
const {describe, it} = require('mocha-sugar-free');

const  {strictEqual: eq, throws} = require('../assert');
const {createCompositeError} = require('../../lib/compositeError');

describe('compositeError', () => {
    it('Should not throw if none of its try() callbacks throw', () => {
        const compositeError = createCompositeError();
        eq(
            compositeError.try(() => { return 123; }),
            123,
        );
        eq(
            compositeError.try(() => {}),
            undefined,
        );
        compositeError.maybeThrow(); // should not throw
    });

    it('Should throw a composite error if one try() callback throws', () => {
        const compositeError = createCompositeError();
        const expectedErrors = [
            Error('Error from test case: ABC'),
        ];

        compositeError.try(() => { throw expectedErrors[0]; });
        const error = throws(() =>
            compositeError.maybeThrow('CompositeErrorFoo', 'Composite error from a test case', 123, 'foo'),
        );
        eq(error.name, 'CompositeErrorFoo');
        eq(
            error.message,
            'Composite error from a test case123foo\n' +
            '  Error: Error from test case: ABC',
        );
        eq(error.errors.length, 1);
        eq(error.errors[0], expectedErrors[0]);
    });

    it('Should throw a composite error if multiple try() callbacks throw', () => {
        const compositeError = createCompositeError();
        const expectedErrors = [
            Error('Error from test case: ABC'),
            Error('Error from test case: DEF'),
            Error('Error from test case: GHJ'),
            Error('Error from test case: KLM'),
            Error('Error from test case: NOP'),
        ];
        compositeError.try(() => {});
        compositeError.try(() => {throw expectedErrors[0];});
        compositeError.try(() => {throw expectedErrors[1];});
        compositeError.try(() => {throw expectedErrors[2];});
        compositeError.try(() => {throw expectedErrors[3];});
        compositeError.try(() => {throw expectedErrors[4];});
        const error = throws(() =>
            compositeError.maybeThrow('CompositeErrorFoo', 'Composite error from a test case', 123, 'foo'),
        );
        eq(error.name, 'CompositeErrorFoo');
        eq(
            error.message,
            'Composite error from a test case123foo\n' +
            '  Error: Error from test case: ABC\n' +
            '  Error: Error from test case: DEF\n' +
            '  Error: Error from test case: GHJ\n' +
            '  Error: Error from test case: KLM\n' +
            '  Error: Error from test case: NOP',
        );
        eq(error.errors.length, 5);
        eq(error.errors[0], expectedErrors[0]);
        eq(error.errors[1], expectedErrors[1]);
        eq(error.errors[2], expectedErrors[2]);
        eq(error.errors[3], expectedErrors[3]);
        eq(error.errors[4], expectedErrors[4]);
    });

    it('Should limit the error message to show the message of the first 5 child errors', () => {
        const compositeError = createCompositeError();
        const expectedErrors = [
            Error('Error from test case: ABC'),
            Error('Error from test case: DEF'),
            Error('Error from test case: GHJ'),
            Error('Error from test case: KLM'),
            Error('Error from test case: NOP'),
            Error('Error from test case: QRS'),
        ];
        compositeError.try(() => {throw expectedErrors[0];});
        compositeError.try(() => {throw expectedErrors[1];});
        compositeError.try(() => {throw expectedErrors[2];});
        compositeError.try(() => {});
        compositeError.try(() => {throw expectedErrors[3];});
        compositeError.try(() => {throw expectedErrors[4];});
        compositeError.try(() => {throw expectedErrors[5];});
        const error = throws(() =>
            compositeError.maybeThrow('CompositeErrorFoo', 'Composite error from a test case', 123, 'foo'),
        );
        eq(error.name, 'CompositeErrorFoo');
        eq(
            error.message,
            'Composite error from a test case123foo\n' +
            '  Error: Error from test case: ABC\n' +
            '  Error: Error from test case: DEF\n' +
            '  Error: Error from test case: GHJ\n' +
            '  Error: Error from test case: KLM\n' +
            '  Error: Error from test case: NOP\n' +
            '  ...',
        );
        eq(error.errors.length, 6);
        eq(error.errors[0], expectedErrors[0]);
        eq(error.errors[1], expectedErrors[1]);
        eq(error.errors[2], expectedErrors[2]);
        eq(error.errors[3], expectedErrors[3]);
        eq(error.errors[4], expectedErrors[4]);
        eq(error.errors[5], expectedErrors[5]);
    });

});
