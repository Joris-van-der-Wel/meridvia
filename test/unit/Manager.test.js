'use strict';
const sinon = require('sinon');
const {describe, it, beforeEach, afterEach} = require('mocha-sugar-free');
const Immutable = require('immutable');

const {strictEqual: eq, notStrictEqual: neq, deepEqual: deq, throws, isRejected} = require('../assert');
const {createManager} = require('../..');

const originalSetTimeout = setTimeout;
const delay = async ms => new Promise(resolve => originalSetTimeout(resolve, ms));

describe('Manager', () => {
    let clock;
    let dispatcher;
    let manager;
    let userResource;
    let postResource;
    let commentResource;
    let animalResource;
    let throwFoodFetch;
    let throwFoodClear;
    let foodResource;
    let rejectPhotoFetch;
    let photoResource;
    let session;
    let session2;

    beforeEach(() => {
        clock = sinon.useFakeTimers();

        dispatcher = sinon.spy(value => {
            if (value && value.then) {
                return value.then(dispatched => ({dispatched}));
            }
            return {dispatched: value};
        });
        manager = createManager(dispatcher);

        // Synchronous
        userResource = {
            name: 'user',
            fetch: sinon.spy(params => ({type: 'FETCH_USER', params, result: {name: 'User Foo'}})),
            clear: sinon.spy(params => ({type: 'CLEAR_USER', params})),
        };

        // Another synchronous to test that we do not confuse them and it has maximumStaleness defined
        postResource = {
            name: 'post',
            fetch: sinon.spy(params => ({type: 'FETCH_POST', params,  result: {name: 'Post Foo'}})),
            clear: sinon.spy(params => ({type: 'CLEAR_POST', params})),
            maximumStaleness: '15m',
        };

        // Asynchronous so that we can test support for promises
        commentResource = {
            name: 'comment',
            fetch: sinon.spy(async params => delay(10).then(() => ({type: 'FETCH_COMMENT', params,  result: {content: 'Hello Hello'}}))),
            clear: sinon.spy(params => ({type: 'CLEAR_POST', params})),
        };

        animalResource = {
            name: 'animal',
            fetch: sinon.spy(params => ({type: 'FETCH_ANIMAL', params, result: {type: 'Dog', name: 'Cheeka'}})),
            clear: sinon.spy(params => ({type: 'CLEAR_ANIMAL', params})),
            cacheMaxAge: '5m',
        };

        // with optional throwing
        throwFoodFetch = false;
        throwFoodClear = false;
        foodResource = {
            name: 'food',
            fetch: sinon.spy(params => {
                if (throwFoodFetch) {
                    throw Error('Error from test! foodResource.fetch()');
                }
                return {type: 'FETCH_FOOD', params, result: {name: 'Spam'}};
            }),
            clear: sinon.spy(params => {
                if (throwFoodClear) {
                    throw Error('Error from test! foodResource.clear()');
                }
                return {type: 'CLEAR_FOOD', params};
            }),
        };

        // with promises and optional rejection
        rejectPhotoFetch = false;
        photoResource = {
            name: 'photo',
            fetch: sinon.spy(async params => {
                await delay(10);

                if (rejectPhotoFetch) {
                    throw Error('Error from test! photoResource.fetch()');
                }
                return {type: 'FETCH_PHOTO', params, result: {url: 'data:,'}};
            }),
            clear: sinon.spy(params => {
                return {type: 'CLEAR_PHOTO', params};
            }),
        };

        manager.resource(userResource);
        manager.resources([postResource, commentResource, animalResource, foodResource, photoResource]);

        session = manager.createSession();
    });

    afterEach(() => {
        manager.destroy();
        session = null;
        session2 = null;
        manager = null;
        clock.restore();
        clock = null;
    });

    describe('Basic dispatching', () => {
        it('Should not dispatch any actions without starting a transaction', () => {
            eq(dispatcher.callCount, 0);
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 0);
        });

        it('Should dispatch the proper fetch action with params as a pojo', () => {
            session(fetch => {
                const originalParams = {id: 123};
                const result = fetch('user', originalParams);
                eq(userResource.fetch.callCount, 1);
                eq(dispatcher.callCount, 1);
                deq(userResource.fetch.firstCall.args[0], {id: 123});
                neq(
                    userResource.fetch.firstCall.args[0],
                    originalParams,
                    'Should have shallow cloned the original params (to guard against changes)'
                );
                deq(result, {dispatched: {type: 'FETCH_USER', params: {id: 123}, result: {name: 'User Foo'}}});
            });

            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 0);
        });

        it('Should dispatch the proper fetch action with params as an Immutable Map', () => {
            session(fetch => {
                const originalParams = Immutable.Map({id: 123});
                const result = fetch('post', originalParams);
                eq(postResource.fetch.callCount, 1);
                eq(dispatcher.callCount, 1);
                eq(postResource.fetch.firstCall.args[0], originalParams, 'Should pass the params as-is if it is Immutable');
                eq(result.dispatched.type, 'FETCH_POST');
                eq(result.dispatched.params, originalParams);
            });

            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 0);
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 1);
        });

        it('Should dispatch the proper fetch action with params as an Immutable Record instance', () => {
            const myRecord = Immutable.Record({id: 0});

            session(fetch => {
                const originalParams = myRecord({id: 123});
                const result = fetch('post', originalParams);
                eq(postResource.fetch.callCount, 1);
                eq(dispatcher.callCount, 1);
                eq(postResource.fetch.firstCall.args[0], originalParams, 'Should pass the params as-is if it is Immutable');
                eq(result.dispatched.type, 'FETCH_POST');
                eq(result.dispatched.params, originalParams);
            });

            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 0);
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 1);
        });

        it('Should dispatch with an empty object as params if the params are not set', () => {
            session(fetch => {
                const result = fetch('user');
                eq(userResource.fetch.callCount, 1);
                eq(dispatcher.callCount, 1);
                deq(userResource.fetch.firstCall.args[0], {});
                deq(result, {dispatched: {type: 'FETCH_USER', params: {}, result: {name: 'User Foo'}}});
            });

            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 0);
        });

        it('Should provide a default dispatcher which simply passes the value as-is', () => {
            const manager2 = createManager();
            manager2.resource(userResource);
            const session = manager2.createSession();
            try {
                session(fetch => {
                    const result = fetch('user', {id: 123});
                    deq(result, {type: 'FETCH_USER', params: {id: 123}, result: {name: 'User Foo'}});
                });
            }
            finally {
                session.destroy();
            }
        });

        it('Should not throw if the resource has not been registered', () => {
            session(fetch => {
                throws(() => fetch('unknown', 0), Error, /given resource.*name.*not.*registered/i);
            });
        });

        it('Should not accept params with an incorrect type', () => {
            session(fetch => {
                throws(() => fetch('post', 0), Error, /params.*must.*immutable.*or.*plain.*object/i);
                throws(() => fetch('post', false), Error, /params.*must.*immutable.*or.*plain.*object/i);
                throws(() => fetch('post', null), Error, /params.*must.*immutable.*or.*plain.*object/i);
                throws(() => fetch('post', 'foo'), Error, /params.*must.*immutable.*or.*plain.*object/i);
            });
        });

        it('Should fetch the same resource only once', () => {
            session(fetch => {
                const result0 = fetch('post', {id: 123});
                const result1 = fetch('post', {id: 123});
                eq(result0, result1);
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 1);
        });

        it('Should not re-fetch resources in the next session that are still in use', () => {
            let result0;
            session(fetch => {
                result0 = fetch('post', {id: 123});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 1);

            let result1;
            session(fetch => {
                result1 = fetch('post', {id: 123});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 1);
            eq(result0, result1);
        });

        it('Should fetch multiple times for resources that only differ in params', () => {
            session(fetch => {
                const result0 = fetch('post', {id: 123});
                deq(result0, {dispatched: {type: 'FETCH_POST', params: {id: 123}, result: {name: 'Post Foo'}}});

                const result1 = fetch('post', {id: 456});
                deq(result1, {dispatched: {type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 2);
        });

        it('Should clear resources that are no longer in use', () => {
            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 456});
                fetch('post', {id: 789});
            });
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 3);
            deq(dispatcher.getCall(0).args, [{type: 'FETCH_POST', params: {id: 123}, result: {name: 'Post Foo'}}]);
            deq(dispatcher.getCall(1).args, [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}]);
            deq(dispatcher.getCall(2).args, [{type: 'FETCH_POST', params: {id: 789}, result: {name: 'Post Foo'}}]);

            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 789});
            });
            eq(postResource.clear.callCount, 1);
            eq(postResource.fetch.callCount, 3);

            deq(postResource.clear.firstCall.args[0], {id: 456});
            deq(dispatcher.getCall(3).args, [{type: 'CLEAR_POST', params: {id: 456}}]);

            session(fetch => {
                fetch('post', {id: 456});
            });

            eq(postResource.clear.callCount, 3);
            eq(postResource.fetch.callCount, 4);
            deq(dispatcher.getCall(4).args, [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}]);
            deq(dispatcher.getCall(5).args, [{type: 'CLEAR_POST', params: {id: 123}}]);
            deq(dispatcher.getCall(6).args, [{type: 'CLEAR_POST', params: {id: 789}}]);
        });

        it('Should return promises from the fetch action as-is', async () => {
            await session(async fetch => {
                const result = fetch('comment', {commentId: 123});
                eq(typeof result.then, 'function');
                deq(await result, {dispatched: {type: 'FETCH_COMMENT', params: {commentId: 123},  result: {content: 'Hello Hello'}}});
            });
        });

        it('Should pass promises to the dispatcher as-is', async () => {
            await session(async fetch => {
                await fetch('comment', {commentId: 123});
            });
            eq(dispatcher.callCount, 1);
            eq(typeof dispatcher.firstCall.args[0].then, 'function');
        });


        it('Should not clear resources if a different session is using them', () => {
            session2 = manager.createSession();
            session(fetch => {
                fetch('post', {id: 123});
            });
            session2(fetch => {
                fetch('post', {id: 123});
            });

            session(fetch => {});
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 1);
        });


        it('Should continue on clearing other resources if the clear action throws', () => {
            throwFoodClear = true;
            session(fetch => {
                fetch('post', {id: 123});
                fetch('food', {id: 456});
                fetch('post', {id: 789});
            });

            session(fetch => {});

            eq(postResource.fetch.callCount, 2);
            eq(postResource.clear.callCount, 2);
            eq(foodResource.fetch.callCount, 1);
            eq(foodResource.clear.callCount, 1);
            eq(dispatcher.callCount, 5); // 1 action has not been dispatched because of the error

            // should not attempt the clear action again
            session(fetch => {});
            eq(foodResource.clear.callCount, 1);
            eq(dispatcher.callCount, 5);
        });

        it('Should attempt the fetch again if the action had thrown', () => {
            throwFoodFetch = true;
            session(fetch => {
                throws(() => fetch('food', {id: 456}), Error, 'Error from test! foodResource.fetch()');
                throwFoodFetch = false;
                fetch('food', {id: 456});
            });

            eq(foodResource.fetch.callCount, 2);
            eq(foodResource.clear.callCount, 0);
            deq(foodResource.fetch.firstCall.args[0], {id: 456});
            deq(foodResource.fetch.secondCall.args[0], {id: 456});

            deq(dispatcher.args, [
                [{type: 'FETCH_FOOD', params: {id: 456}, result: {name: 'Spam'}}],
            ]);
        });

        it('Should attempt the fetch again if the action threw during the previous session', () => {
            throwFoodFetch = true;
            session(fetch => {
                throws(() => fetch('food', {id: 456}), Error, 'Error from test! foodResource.fetch()');
            });

            throwFoodFetch = false;
            session(fetch => {
                fetch('food', {id: 456});
            });

            eq(foodResource.fetch.callCount, 2);
            eq(foodResource.clear.callCount, 0);
            deq(foodResource.fetch.firstCall.args[0], {id: 456});
            deq(foodResource.fetch.secondCall.args[0], {id: 456});

            deq(dispatcher.args, [
                [{type: 'FETCH_FOOD', params: {id: 456}, result: {name: 'Spam'}}],
            ]);
        });

        it('Should attempt the fetch again if the action returned a rejected promise during the previous session', async () => {
            rejectPhotoFetch = true;
            await session(async fetch => {
                await isRejected(fetch('photo', {id: 987}), Error, 'Error from test! photoResource.fetch()');
            });

            rejectPhotoFetch = false;
            await session(async fetch => {
                await fetch('photo', {id: 987});
            });

            eq(photoResource.fetch.callCount, 2);
            eq(photoResource.clear.callCount, 0);
            deq(photoResource.fetch.firstCall.args[0], {id: 987});
            deq(photoResource.fetch.secondCall.args[0], {id: 987});

            eq(dispatcher.callCount, 2);

            await isRejected(dispatcher.firstCall.args[0], Error, 'Error from test! photoResource.fetch()');
            deq(await dispatcher.secondCall.args[0], {type: 'FETCH_PHOTO', params: {id: 987}, result: {url: 'data:,'}});
        });
    });

    describe('Transaction aborting', () => {
        it('Should not allow overlapping transactions if allowTransactionAbort=false (synchronous)', () => {
            session(fetch => {
                throws(() => session(fetch => {}), Error, /previous.*transaction.*in.*progress/i);
            });
        });

        it('Should not allow overlapping transactions if allowTransactionAbort=false (asynchronous)', async () => {
            await session(async fetch => {
                await delay(1);
                await isRejected(
                    Promise.resolve().then(() => session(async fetch => {})),
                    Error,
                    /previous.*transaction.*in.*progress/i
                );
            });
        });

        it('Should abort the previous transaction if they overlap if allowTransactionAbort=true', () => {
            const manager = createManager(dispatcher, {allowTransactionAbort: true});
            manager.resource(userResource);
            const session = manager.createSession();
            try {
                let milestones = 0;
                session(fetch0 => {
                    fetch0('user', {id: 0});
                    fetch0('user', {id: 100});
                    eq(userResource.fetch.callCount, 2);
                    eq(userResource.clear.callCount, 0);

                    session(fetch1 => {
                        throws(() => fetch0('user', {id: -1}), Error, /session.*aborted.*new.*session.*started/i);
                        fetch1('user', {id: 1});
                        eq(userResource.fetch.callCount, 3);
                        eq(userResource.clear.callCount, 0);

                        session(fetch2 => {
                            // this is the first transaction that completes successfully
                            // after this transaction user 0 and 1 should be cleared.
                            // 2 and 100 which are references here should not. 100 is also references in the first
                            // transaction so that we can verify it is not cleared in between
                            throws(() => fetch0('user', {id: -1}), Error, /session.*aborted.*new.*session.*started/i);
                            throws(() => fetch1('user', {id: -1}), Error, /session.*aborted.*new.*session.*started/i);
                            fetch2('user', {id: 2});
                            fetch2('user', {id: 100});
                            eq(userResource.fetch.callCount, 4);
                            eq(userResource.clear.callCount, 0);
                            ++milestones;
                        });
                        // should only do clears after a session has completed successfully
                        eq(userResource.fetch.callCount, 4);
                        eq(userResource.clear.callCount, 2);

                        throws(() => fetch1('user', {id: -1}), Error, /session.*aborted.*new.*session.*started/i);
                        ++milestones;
                    });

                    ++milestones;
                });

                eq(userResource.fetch.callCount, 4);
                eq(userResource.clear.callCount, 2);
                deq(userResource.fetch.args[0][0], {id: 0});
                deq(userResource.fetch.args[1][0], {id: 100});
                deq(userResource.fetch.args[2][0], {id: 1});
                deq(userResource.fetch.args[3][0], {id: 2});
                deq(userResource.clear.args[0][0], {id: 0});
                deq(userResource.clear.args[1][0], {id: 1});

                eq(milestones, 3); // to verify that session() is not eating errors by accident
            }
            finally {
                session.destroy();
            }
        });
    });

    describe('Session destruction', () => {
        it('Should clear resources if a session is destroyed', () => {
            session2 = manager.createSession();
            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 456});
            });
            session2(fetch => {
                fetch('post', {id: 123});
            });
            eq(postResource.fetch.callCount, 2);
            eq(postResource.clear.callCount, 0);

            session.destroy();
            eq(postResource.fetch.callCount, 2);
            eq(postResource.clear.callCount, 1);
            deq(postResource.clear.firstCall.args[0], {id: 456});
        });

        it('Should do nothing if destroyed twice', () => {
            session(fetch => {
                fetch('post', {id: 123});
            });

            session.destroy();
            session.destroy();
            eq(postResource.fetch.callCount, 1);
            eq(postResource.clear.callCount, 1);
            deq(postResource.clear.firstCall.args[0], {id: 123});
        });

        it('Should clear resources if a session is destroyed in the middle of a transaction', () => {
            session(fetch => {
                fetch('post', {id: 123});
            });

            session(fetch => {
                fetch('post', {id: 123}); // this one already existed
                fetch('post', {id: 456}); // newly introduced in a transaction that is destroyed in the middle of it
                session.destroy();
                throws(() => fetch('post', {id: 789}), Error, /session.*destroyed/i);
            });

            eq(postResource.fetch.callCount, 2);
            eq(postResource.clear.callCount, 2);

            deq(dispatcher.getCall(0).args, [{type: 'FETCH_POST', params: {id: 123}, result: {name: 'Post Foo'}}]);
            deq(dispatcher.getCall(1).args, [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}]);
            deq(dispatcher.getCall(2).args, [{type: 'CLEAR_POST', params: {id: 123}}]);
            deq(dispatcher.getCall(3).args, [{type: 'CLEAR_POST', params: {id: 456}}]);
        });

        it('Should not allow for a new transaction after a session has been destroyed', () => {
            session.destroy();
            throws(() => session(fetch => {}), Error, /session.*destroyed/);
        });
    });

    describe('manager.invalidate()', () => {
        it('Should fetch again if all resources have been invalidated using manager.invalidate()', () => {
            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 456});
                fetch('user', {id: 789});
            });

            const invalidationCount = manager.invalidate();
            eq(invalidationCount, 3);

            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 456});
                fetch('user', {id: 789});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 4);
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 2);
            deq(postResource.fetch.args[0][0], {id: 123});
            deq(postResource.fetch.args[1][0], {id: 456});
            deq(postResource.fetch.args[2][0], {id: 123});
            deq(postResource.fetch.args[3][0], {id: 456});
            deq(userResource.fetch.args[0][0], {id: 789});
            deq(userResource.fetch.args[1][0], {id: 789});

            deq(dispatcher.args, [
                [{type: 'FETCH_POST', params: {id: 123}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_USER', params: {id: 789}, result: {name: 'User Foo'}}],
                [{type: 'FETCH_POST', params: {id: 123}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_USER', params: {id: 789}, result: {name: 'User Foo'}}],
            ]);
        });

        it('Should fetch again if a specific resource has been invalidated using manager.invalidate()', () => {
            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 456});
                fetch('user', {id: 789});
            });

            const invalidationCount = manager.invalidate('post');
            eq(invalidationCount, 2);

            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 456});
                fetch('user', {id: 789});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 4);
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
            deq(postResource.fetch.args[0][0], {id: 123});
            deq(postResource.fetch.args[1][0], {id: 456});
            deq(postResource.fetch.args[2][0], {id: 123});
            deq(postResource.fetch.args[3][0], {id: 456});

            deq(dispatcher.args, [
                [{type: 'FETCH_POST', params: {id: 123}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_USER', params: {id: 789}, result: {name: 'User Foo'}}],
                [{type: 'FETCH_POST', params: {id: 123}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}],
            ]);
        });

        it('Should fetch again if a specific resource instance has been invalidated using manager.invalidate()', () => {
            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 456});
                fetch('user', {id: 789});
            });

            const invalidationCount = manager.invalidate('post', {id: 456});
            eq(invalidationCount, 1);

            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 456});
                fetch('user', {id: 789});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 3);
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
            deq(postResource.fetch.args[0][0], {id: 123});
            deq(postResource.fetch.args[1][0], {id: 456});
            deq(postResource.fetch.args[2][0], {id: 456});

            deq(dispatcher.args, [
                [{type: 'FETCH_POST', params: {id: 123}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_USER', params: {id: 789}, result: {name: 'User Foo'}}],
                [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}],
            ]);
        });

        it('Should do nothing if manager.invalidate() does not match anything', () => {
            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 456});
                fetch('user', {id: 789});
            });

            const invalidationCount = manager.invalidate('post', {id: 9001});
            eq(invalidationCount, 0);

            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 456});
                fetch('user', {id: 789});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 2);
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);

            deq(dispatcher.args, [
                [{type: 'FETCH_POST', params: {id: 123}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_USER', params: {id: 789}, result: {name: 'User Foo'}}],
            ]);
        });
    });

    describe('invalidate() callback for actions', () => {
        let doInvalidate;
        let invalidateCallbacks;
        let albumResource;

        beforeEach(() => {
            invalidateCallbacks = [];
            doInvalidate = false;
            albumResource = {
                name: 'album',
                fetch: sinon.spy((params, {invalidate}) => {
                    invalidateCallbacks.push(invalidate);
                    if (doInvalidate) {
                        const count = invalidate();
                        eq(count, 1);
                    }
                    return {type: 'FETCH_ALBUM', params, result: {title: 'Vacation Pictures'}};
                }),
                clear: sinon.spy(params => {
                    return {type: 'CLEAR_ALBUM', params};
                }),
            };
            manager.resource(albumResource);
        });

        it('Should fetch again if the current fetch action calls invalidate() synchronously', () => {
            session(fetch => {
                doInvalidate = true;
                fetch('album', {id: 123});
                doInvalidate = false;
                fetch('album', {id: 456});
            });

            eq(albumResource.fetch.callCount, 2);
            deq(albumResource.fetch.firstCall.args[0], {id: 123});
            deq(albumResource.fetch.secondCall.args[0], {id: 456});

            session(fetch => {
                fetch('album', {id: 123});
                fetch('album', {id: 456});
            });

            eq(albumResource.fetch.callCount, 3);
            deq(albumResource.fetch.thirdCall.args[0], {id: 123});
        });

        it('Should fetch again if the most recent fetch action calls invalidate() asynchronously', () => {
            session(fetch => {
                fetch('album', {id: 123});
                fetch('album', {id: 456});
            });

            invalidateCallbacks[0]();

            eq(albumResource.fetch.callCount, 2);
            deq(albumResource.fetch.firstCall.args[0], {id: 123});
            deq(albumResource.fetch.secondCall.args[0], {id: 456});

            session(fetch => {
                fetch('album', {id: 123});
                fetch('album', {id: 456});
            });
            eq(albumResource.fetch.callCount, 3);
            deq(albumResource.fetch.thirdCall.args[0], {id: 123});

            session(fetch => {
                fetch('album', {id: 123});
                fetch('album', {id: 456});
            });
            eq(albumResource.fetch.callCount, 3);
        });

        it('Should not invalidate anything if invalidate() is used by an old fetch action', () => {
            session(fetch => {
                fetch('album', {id: 123});
            });

            eq(albumResource.fetch.callCount, 1);
            deq(albumResource.fetch.firstCall.args[0], {id: 123});

            manager.invalidate(); // so that we fetch again

            session(fetch => {
                fetch('album', {id: 123});
            });
            eq(albumResource.fetch.callCount, 2);
            deq(albumResource.fetch.secondCall.args[0], {id: 123});

            invalidateCallbacks[0](); // this invalidate() function belongs to the first fetch

            session(fetch => {
                fetch('album', {id: 123});
            });

            eq(albumResource.fetch.callCount, 2);
        });
    });

    describe('Maximum Staleness', () => {
        it('Should re-fetch stale resources if maximumStaleness is set and reached', () => {
            session(fetch => {
                fetch('user', {id: 123});
                fetch('post', {id: 123});
                fetch('post', {id: 456});
            });
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 2);

            clock.tick('15:00'); // +15 minutes
            session(fetch => {
                fetch('user', {id: 123});
                fetch('post', {id: 123});
                fetch('post', {id: 456});
            });
            // no changes yet, staleness is set to 15 minutes
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 2);

            clock.tick(1); // +1 ms to push over the staleness limit
            session(fetch => {
                fetch('user', {id: 123});
                fetch('post', {id: 123});
                fetch('post', {id: 456});
            });
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 4);
        });

        it('Should not re-fetch resources if maximumStaleness is not set', () => {
            session(fetch => {
                fetch('user', {id: 123});
            });
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);

            clock.tick('12:00:00'); // +12 hours
            session(fetch => {
                fetch('user', {id: 123});
            });
            // maximum staleness is not set for user  15 minutes
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
        });
    });

    describe('Caching', () => {
        it('Should clear resources after the cache age expires and not before', () => {
            session(fetch => {
                fetch('animal', {id: 1234});
                fetch('animal', {id: 2345});
            });
            eq(animalResource.fetch.callCount, 2);
            eq(animalResource.clear.callCount, 0);

            session(fetch => {
                fetch('animal', {id: 2345});
            });
            eq(animalResource.fetch.callCount, 2);
            eq(animalResource.clear.callCount, 0);

            clock.tick('05:00'); // (cache age is 5 minutes)
            session(fetch => {
                fetch('animal', {id: 2345});
            });
            eq(animalResource.fetch.callCount, 2);
            eq(animalResource.clear.callCount, 0);

            clock.tick(1); // 1ms to push over the cache age
            session(fetch => {
                fetch('animal', {id: 2345});
            });
            eq(animalResource.fetch.callCount, 2);
            eq(animalResource.clear.callCount, 1);

            deq(dispatcher.args, [
                [{type: 'FETCH_ANIMAL', params: {id: 1234}, result: {type: 'Dog', name: 'Cheeka'}}],
                [{type: 'FETCH_ANIMAL', params: {id: 2345}, result: {type: 'Dog', name: 'Cheeka'}}],
                [{type: 'CLEAR_ANIMAL', params: {id: 1234}}],
            ]);
        });

        it('Should clear resources with a timer after the cache age expires', () => {
            session(fetch => {
                fetch('animal', {id: 1234});
            });
            eq(animalResource.fetch.callCount, 1);
            eq(animalResource.clear.callCount, 0);

            session(fetch => {});
            eq(animalResource.fetch.callCount, 1);
            eq(animalResource.clear.callCount, 0);

            clock.tick('05:01'); // (cache age is 5 minutes);
            clock.runAll(); // cleared by a timer
            eq(animalResource.fetch.callCount, 1);
            eq(animalResource.clear.callCount, 1);

            deq(dispatcher.args, [
                [{type: 'FETCH_ANIMAL', params: {id: 1234}, result: {type: 'Dog', name: 'Cheeka'}}],
                [{type: 'CLEAR_ANIMAL', params: {id: 1234}}],
            ]);
        });

        it('Should clear resources immediately if manager.cleanupResources() is called', () => {
            session(fetch => {
                fetch('animal', {id: 1234});
            });
            eq(animalResource.fetch.callCount, 1);
            eq(animalResource.clear.callCount, 0);

            session(fetch => {});
            eq(animalResource.fetch.callCount, 1);
            eq(animalResource.clear.callCount, 0);

            clock.tick('05:01'); // (cache age is 5 minutes);
            manager.cleanupResources();
            eq(animalResource.fetch.callCount, 1);
            eq(animalResource.clear.callCount, 1);

            deq(dispatcher.args, [
                [{type: 'FETCH_ANIMAL', params: {id: 1234}, result: {type: 'Dog', name: 'Cheeka'}}],
                [{type: 'CLEAR_ANIMAL', params: {id: 1234}}],
            ]);
        });
    });

    describe('Session transaction ending', () => {
        it('Should end the transaction synchronously and forward the return value', () => {
            let innerFetch;
            const returnValue = session(fetch => {
                innerFetch = fetch;
                return 123;
            });

            eq(returnValue, 123);
            throws(() => innerFetch('whatever', {}), Error, /fetch.*no.*longer.*valid/i);
        });

        it('Should end the transaction synchronously and forward the thrown value', () => {
            const error = Error('Error from test case');

            let innerFetch;
            const forwardedError = throws(() => {
                session(fetch => {
                    innerFetch = fetch;
                    throw error;
                });
            });

            eq(error, forwardedError);
            throws(() => innerFetch('whatever', {}), Error, /fetch.*no.*longer.*valid/i);
        });

        it('Should end the transaction after the fulfillment of any returned promise', async () => {
            let innerFetch;
            const returnValue = await session(async fetch => {
                innerFetch = fetch;
                fetch('post', {id: 123});

                await delay(10);

                const result1 = fetch('post', {id: 456});
                deq(result1, {dispatched: {type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}});

                return 123;
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 2);
            eq(returnValue, 123);
            throws(() => innerFetch('whatever', {}), Error, /fetch.*no.*longer.*valid/i);
        });

        it('Should end the transaction after the fulfillment of any returned promise (rejected)', async () => {
            const error = Error('Error from test case');

            let innerFetch;
            const promise = session(async fetch => {
                innerFetch = fetch;
                fetch('post', {id: 123});

                await delay(10);

                const result1 = fetch('post', {id: 456});
                deq(result1, {dispatched: {type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}});

                throw error;
            });

            await promise.catch(forwardedError => eq(forwardedError, error));
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 2);
            throws(() => innerFetch('whatever', {}), Error, /fetch.*no.*longer.*valid/i);
        });
    });

    describe('User storage', () => {
        let appInstances;
        let appResource;
        const fetchApp = async appId => delay(10).then(() => appInstances.get(appId));

        beforeEach(() => {
            appInstances = Immutable.Map([
                [1000, {name: 'My App', createdBy: 200}],
                [1001, {name: 'My Second App', createdBy: 201}],
            ]);

            appResource = {
                name: 'app',
                initStorage: sinon.spy(params => ({
                    fetchCount: 0,
                    clearCount: 0, // (should be either 0 or 1)
                    subSession: manager.createSession(),
                })),
                fetch: sinon.spy(async ({appId}, {storage}) => {
                    ++storage.fetchCount;

                    return await storage.subSession(async fetch => {
                        const app = await fetchApp(appId);
                        fetch('user', {userId: app.createdBy});
                        return {type: 'FETCH_APP', params: {appId}, result: app};
                    });
                }),
                clear: sinon.spy(({appId}, {storage}) => {
                    ++storage.clearCount;
                    storage.subSession.destroy();
                    storage.subSession = null;
                    return {type: 'CLEAR_APP', params: {appId}};
                }),
            };
            manager.resource(appResource);
        });

        it('Should pass a persistent user modifiable object to actions', () => {
            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 456});
            });
            eq(postResource.fetch.callCount, 2);
            deq(postResource.fetch.firstCall.args[1].storage, {});
            deq(postResource.fetch.secondCall.args[1].storage, {});

            // different instance, so different storage
            neq(postResource.fetch.firstCall.args[1].storage, postResource.fetch.secondCall.args[1].storage);

            session(fetch => {
                fetch('post', {id: 456});
            });

            // same instance, so same storage
            eq(postResource.fetch.firstCall.args[1].storage, postResource.clear.firstCall.args[1].storage);
        });

        it('Should support keeping track of sub sessions using the storage object', async () => {
            await session(async fetch => {
                await fetch('app', {appId: 1000});
            });

            eq(appResource.fetch.callCount, 1);
            eq(appResource.initStorage.callCount, 1);
            eq(appResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
            eq(userResource.clear.callCount, 0);
            deq(userResource.fetch.firstCall.args[0], {userId: 200});
            deq(userResource.fetch.firstCall.args[1].storage, {});
            eq(typeof dispatcher.getCall(0).args[0].then, 'function');
            deq(await dispatcher.getCall(0).args[0], {type: 'FETCH_APP', params: {appId: 1000}, result: {createdBy: 200, name: 'My App'}});
            deq(dispatcher.getCall(1).args[0], {type: 'FETCH_USER', params: {userId: 200}, result: {name: 'User Foo'}});
            deq(appResource.initStorage.firstCall.args, [{appId: 1000}]);
            eq(appResource.initStorage.firstCall.returnValue, appResource.fetch.firstCall.args[1].storage);

            session(() => {});

            eq(appResource.clear.callCount, 1);
            eq(userResource.clear.callCount, 1);
            eq(appResource.initStorage.firstCall.returnValue, appResource.clear.firstCall.args[1].storage);
            deq(dispatcher.getCall(2).args[0], {type: 'CLEAR_USER', params: {userId: 200}});
            deq(dispatcher.getCall(3).args[0], {type: 'CLEAR_APP', params: {appId: 1000}});
        });
    });

    describe('Cancellation', () => {
        let cancelCallbacks;
        let trainResource;

        beforeEach(() => {
            cancelCallbacks = [];
            trainResource = {
                name: 'train',
                fetch: sinon.spy((params, {onCancel}) => {
                    const callback = sinon.spy();
                    cancelCallbacks.push({id: params.id, callback});
                    onCancel(callback);

                    return {type: 'FETCH_TRAIN', params, result: {isLate: true}};
                }),
                clear: sinon.spy(params => {
                    return {type: 'CLEAR_TRAIN', params};
                }),
            };
            manager.resource(trainResource);
        });

        it('Should call onCancel callbacks when a more recent fetch supersedes the old one', () => {
            session(fetch => {
                fetch('train', {id: 123});
                fetch('train', {id: 456});
            });

            eq(trainResource.fetch.callCount, 2);
            eq(cancelCallbacks.length, 2);
            eq(cancelCallbacks[0].id, 123);
            eq(cancelCallbacks[0].callback.callCount, 0);
            eq(cancelCallbacks[1].id, 456);
            eq(cancelCallbacks[1].callback.callCount, 0);

            manager.invalidate('train', {id: 123});
            session(fetch => {
                fetch('train', {id: 123});
                fetch('train', {id: 456});
            });
            eq(trainResource.fetch.callCount, 3);
            eq(cancelCallbacks.length, 3);
            eq(cancelCallbacks[0].id, 123);
            eq(cancelCallbacks[0].callback.callCount, 1);
            eq(cancelCallbacks[1].id, 456);
            eq(cancelCallbacks[1].callback.callCount, 0);
            eq(cancelCallbacks[2].id, 123);
            eq(cancelCallbacks[2].callback.callCount, 0);

            // one more time to make sure that the old onCancel callback is not called again
            manager.invalidate('train', {id: 123});
            session(fetch => {
                fetch('train', {id: 123});
                fetch('train', {id: 456});
            });
            eq(trainResource.fetch.callCount, 4);
            eq(cancelCallbacks.length, 4);
            eq(cancelCallbacks[0].id, 123);
            eq(cancelCallbacks[0].callback.callCount, 1);
            eq(cancelCallbacks[1].id, 456);
            eq(cancelCallbacks[1].callback.callCount, 0);
            eq(cancelCallbacks[2].id, 123);
            eq(cancelCallbacks[2].callback.callCount, 1);
            eq(cancelCallbacks[3].id, 123);
            eq(cancelCallbacks[3].callback.callCount, 0);
        });

        it('Should call onCancel callbacks when the clear action is dispatched', () => {
            session(fetch => {
                fetch('train', {id: 123});
                fetch('train', {id: 456});
            });

            eq(trainResource.fetch.callCount, 2);
            eq(cancelCallbacks.length, 2);
            eq(cancelCallbacks[0].id, 123);
            eq(cancelCallbacks[0].callback.callCount, 0);
            eq(cancelCallbacks[1].id, 456);
            eq(cancelCallbacks[1].callback.callCount, 0);

            session(fetch => {
                fetch('train', {id: 456});
            });
            eq(trainResource.clear.callCount, 1);
            eq(trainResource.fetch.callCount, 2);
            eq(cancelCallbacks.length, 2);
            eq(cancelCallbacks[0].id, 123);
            eq(cancelCallbacks[0].callback.callCount, 1);
            eq(cancelCallbacks[1].id, 456);
            eq(cancelCallbacks[1].callback.callCount, 0);
        });

        it('Should continue calling other onCancel callbacks if one of them throws', () => {
            session(fetch => {
                fetch('train', {id: 123});
            });

            eq(trainResource.fetch.callCount, 1);
            const onCancel = trainResource.fetch.firstCall.args[1].onCancel;

            const callback0 = sinon.spy(() => { throw Error('Error from test! 0'); });
            const callback1 = sinon.spy(() => { });
            const callback2 = sinon.spy(() => { throw Error('Error from test! 2'); });

            onCancel(callback0);
            onCancel(callback1);
            onCancel(callback2);

            manager.invalidate('train', {id: 123});
            session(fetch => {
                const error = throws(() => fetch('train', {id: 123}), Error, /error.*occurred.*callbacks/i);
                eq(error.errors[0].message, 'Error from test! 2');
                eq(error.errors[1].message, 'Error from test! 0');
            });

            eq(callback0.callCount, 1);
            eq(callback1.callCount, 1);
            eq(callback2.callCount, 1);
        });
    });

    describe('Refreshing', () => {
        it('Should immediately refresh active resource instances if manage.refresh(...) is called', () => {
            session(fetch => {
                fetch('post', {id: 123});
                fetch('post', {id: 456});
                fetch('user', {id: 789});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 2);
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
            deq(postResource.fetch.args[0][0], {id: 123});
            deq(postResource.fetch.args[1][0], {id: 456});
            const cleanUpCallback = sinon.spy();
            postResource.fetch.args[1][1].onCancel(cleanUpCallback);

            const matches = manager.refresh('post', {id: 456});
            eq(matches, 1);

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 3);
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
            deq(postResource.fetch.args[2][0], {id: 456});
            eq(cleanUpCallback.callCount, 1);

            deq(dispatcher.args, [
                [{type: 'FETCH_POST', params: {id: 123}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}],
                [{type: 'FETCH_USER', params: {id: 789}, result: {name: 'User Foo'}}],
                [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}],
            ]);
        });

        it('Should not refresh instances that are not active', () => {
            session(fetch => {
                fetch('animal', {id: 123});
                fetch('animal', {id: 456});
                fetch('animal', {id: 789});
            });

            session(fetch => {
                fetch('animal', {id: 123});
                // 456 is now cached
                fetch('animal', {id: 789});
            });

            eq(animalResource.clear.callCount, 0);
            eq(animalResource.fetch.callCount, 3);
            deq(animalResource.fetch.args[0][0], {id: 123});
            deq(animalResource.fetch.args[1][0], {id: 456});
            deq(animalResource.fetch.args[2][0], {id: 789});

            const matches = manager.refresh();
            eq(matches, 2);

            // should have fetched 123 and 789 again, and cleared 456

            eq(animalResource.clear.callCount, 1);
            eq(animalResource.fetch.callCount, 5);
            deq(animalResource.fetch.args[3][0], {id: 123});
            deq(animalResource.fetch.args[4][0], {id: 789});

            deq(dispatcher.args, [
                [{type: 'FETCH_ANIMAL', params: {id: 123}, result: {type: 'Dog', name: 'Cheeka'}}],
                [{type: 'FETCH_ANIMAL', params: {id: 456}, result: {type: 'Dog', name: 'Cheeka'}}],
                [{type: 'FETCH_ANIMAL', params: {id: 789}, result: {type: 'Dog', name: 'Cheeka'}}],
                [{type: 'FETCH_ANIMAL', params: {id: 123}, result: {type: 'Dog', name: 'Cheeka'}}],
                [{type: 'FETCH_ANIMAL', params: {id: 789}, result: {type: 'Dog', name: 'Cheeka'}}],
                [{type: 'CLEAR_ANIMAL', params: {id: 456}}],
            ]);
        });

        it('Should refresh resources using a timer if refreshInterval is set', () => {
            const dinoResource = {
                name: 'dino',
                fetch: sinon.spy(params => ({type: 'FETCH_DINO', params, result: {type: 'Ankylo'}})),
                clear: sinon.spy(params => ({type: 'CLEAR_DINO', params})),
                refreshInterval: '5m',
            };
            manager.resource(dinoResource);

            session(fetch => {
                fetch('dino', {id: 123});
            });

            clock.tick('02:00'); // +2 minutes = 02:00

            session(fetch => {
                fetch('dino', {id: 123});
                fetch('dino', {id: 456});
            });
            eq(dinoResource.fetch.callCount, 2);

            clock.tick('02:00'); // = 04:00
            eq(dinoResource.fetch.callCount, 2);

            clock.tick('01:00'); // = 05:00
            eq(dinoResource.fetch.callCount, 3);

            clock.tick('02:00'); // = 07:00
            eq(dinoResource.fetch.callCount, 4);

            clock.tick('03:00'); // = 10:00
            eq(dinoResource.fetch.callCount, 5);
        });

        it('Should pass a composite error if a fetch action throws during manager.refresh(...)', () => {
            throwFoodFetch = false;
            session(fetch => {
                fetch('animal', {id: 123});
                fetch('food', {id: 456});
                fetch('animal', {id: 789});
                fetch('food', {id: 1011});
            });
            eq(animalResource.fetch.callCount, 2);
            eq(foodResource.fetch.callCount, 2);

            throwFoodFetch = true;

            const error = throws(() => manager.refresh(), Error, /fetch.*actions.*throw.*error/i);
            eq(error.name, 'CompositeError');
            eq(
                error.message,
                'refresh(): One or more fetch actions has thrown an error\n' +
                '  Error: Error from test! foodResource.fetch()\n' +
                '  Error: Error from test! foodResource.fetch()'
            );
            eq(animalResource.fetch.callCount, 4);
            eq(foodResource.fetch.callCount, 4);
        });

        it('Should ignore errors thrown by a fetch action during a periodic refresh', () => {
            let throwDino = false;
            const dinoResource = {
                name: 'dino',
                fetch: sinon.spy(params => {
                    if (throwDino) {
                        throw Error('Error from test! dinoResource.fetch()');
                    }

                    return {type: 'FETCH_DINO', params, result: {type: 'Ankylo'}};
                }),
                clear: sinon.spy(params => ({type: 'CLEAR_DINO', params})),
                refreshInterval: '5m',
            };
            manager.resource(dinoResource);

            session(fetch => {
                fetch('dino', {id: 123});
            });
            eq(dinoResource.fetch.callCount, 1);

            throwDino = true;

            clock.tick('05:00');
            eq(dinoResource.fetch.callCount, 2);

            clock.tick('05:00');
            eq(dinoResource.fetch.callCount, 3);
        });
    });
});
