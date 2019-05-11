'use strict';
const {describe, it, beforeEach} = require('mocha-sugar-free');
const sinon = require('sinon');

const {isFalse, isTrue, isFunction, isNull, strictEqual: eq, lengthOf} = require('../assert');
const {Timer} = require('../../lib/Timer');

describe('Timer', () => {
    let nextId = 1;
    let timerCallback;
    let timer;
    let setTimeout;
    let clearTimeout;

    beforeEach(() => {
        timerCallback = sinon.spy();
        setTimeout = sinon.spy(() => nextId++);
        clearTimeout = sinon.spy();
        timer = new Timer(1234, timerCallback);
        timer.setTimeout = setTimeout;
        timer.clearTimeout = clearTimeout;
    });

    describe('construction', () => {
        it('should initialize properties', () => {
            eq(timer.delay, 1234);
            eq(timer.callback, timerCallback);
            isFalse(timer.isScheduled);
        });

        it('should not schedule the timer', () => {
            isFalse(timerCallback.called);
            isFalse(setTimeout.called);
            isFalse(clearTimeout.called);
            isFalse(timer.isScheduled);
        });
    });

    describe('Without mocking', () => {
        it('Should not crash', () => {
            const timer = new Timer(1234, timerCallback);
            timer.schedule();
            timer.cancel();
        });
    });

    describe('#schedule()', () => {
        it('should schedule the timer', () => {
            timer.schedule();
            isFalse(timerCallback.called);
            isTrue(setTimeout.calledOnce);
            isFunction(setTimeout.firstCall.args[0]);
            eq(setTimeout.firstCall.args[1], 1234);
            isFalse(clearTimeout.called);
            isTrue(timer.isScheduled);
        });

        it('should not schedule the timer concurrently', () => {
            timer.schedule();
            timer.schedule();
            timer.schedule();
            isFalse(timerCallback.called);
            isTrue(setTimeout.calledOnce);
            isFunction(setTimeout.firstCall.args[0]);
            eq(setTimeout.firstCall.args[1], 1234);
            isFalse(clearTimeout.called);
            isTrue(timer.isScheduled);
        });

        it('should call the callback after the delay has elapsed', () => {
            timer.schedule();
            setTimeout.firstCall.args[0]();
            isTrue(timerCallback.calledOnce);
            isNull(timerCallback.firstCall.thisValue);
            lengthOf(timerCallback.firstCall.args, 0);
            isTrue(setTimeout.calledOnce);
            isFalse(clearTimeout.called);
            isFalse(timer.isScheduled);
        });
    });

    describe('#cancel()', () => {
        it('should do nothing if not scheduled', () => {
            timer.cancel();
            isFalse(timerCallback.called);
            isFalse(setTimeout.called);
            isFalse(clearTimeout.called);
            isFalse(timer.isScheduled);
        });

        it('should cancel a schedule', () => {
            timer.schedule();
            isTrue(timer.isScheduled);
            timer.cancel();
            isFalse(timerCallback.called);
            isTrue(setTimeout.calledOnce);
            isTrue(clearTimeout.calledOnce);
            eq(clearTimeout.firstCall.args[0], setTimeout.firstCall.returnValue);
            isFalse(timer.isScheduled);
        });
    });

    describe('#reschedule()', () => {
        it('should schedule if not scheduled', () => {
            timer.schedule();
            isFalse(timerCallback.called);
            isTrue(setTimeout.calledOnce);
            isFunction(setTimeout.firstCall.args[0]);
            eq(setTimeout.firstCall.args[1], 1234);
            isFalse(clearTimeout.called);
            isTrue(timer.isScheduled);
        });

        it('should reset the delay if scheduled', () => {
            timer.schedule();
            timer.reschedule();
            isFalse(timerCallback.called);
            isTrue(setTimeout.calledTwice);
            isTrue(clearTimeout.calledOnce);
            eq(clearTimeout.firstCall.args[0], setTimeout.firstCall.returnValue);
            isTrue(timer.isScheduled);
        });
    });
});
