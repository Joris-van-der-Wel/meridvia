'use strict';
const sinon = require('sinon');
const {describe, it, beforeEach, afterEach} = require('mocha-sugar-free');
const Immutable = require('immutable');

const {strictEqual: eq, notStrictEqual: neq, deepEqual: deq, throws, isRejected} = require('../assert');
const {createManager} = require('../..');
require('../failOnUnhandledRejection')();

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
    let throwCandyFetch;
    let candyResource;
    let rejectPhotoFetch;
    let photoResource;
    let videoResource;
    let rejectVideoFetch;
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

        // Another synchronous resource, to test that we do not confuse them and it has maximumStaleness defined
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

        // with optional throwing and maximumRejectedStaleness
        throwCandyFetch = false;
        candyResource = {
            name: 'candy',
            fetch: sinon.spy(params => {
                if (throwCandyFetch) {
                    throw Error('Error from test! candyResource.fetch()');
                }
                return {type: 'FETCH_CANDY', params, result: {name: 'Cookie'}};
            }),
            clear: sinon.spy(params => {
                return {type: 'CLEAR_CANDY', params};
            }),
            maximumRejectedStaleness: '15m',
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

        // with promises, optional rejection and maximumRejectedStaleness
        rejectVideoFetch = false;
        videoResource = {
            name: 'video',
            fetch: sinon.spy(async params => {
                await delay(10);

                if (rejectVideoFetch) {
                    throw Error('Error from test! videoResource.fetch()');
                }
                return {type: 'FETCH_VIDEO', params, result: {url: 'data:,'}};
            }),
            clear: sinon.spy(params => {
                return {type: 'CLEAR_VIDEO', params};
            }),
            // maximumStaleness is set here and longer than maximumRejectedStaleness so that we can test that the proper value is used.
            maximumStaleness: '60m',
            maximumRejectedStaleness: '15m',
        };

        manager.resource(userResource);
        manager.resources([postResource, commentResource, animalResource, foodResource, candyResource, photoResource, videoResource]);

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
            session(request => {
                const originalParams = {id: 123};
                const result = request('user', originalParams);
                eq(userResource.fetch.callCount, 1);
                eq(dispatcher.callCount, 1);
                deq(userResource.fetch.firstCall.args[0], {id: 123});
                neq(
                    userResource.fetch.firstCall.args[0],
                    originalParams,
                    'Should have shallow cloned the original params (to guard against changes)',
                );
                deq(result, {dispatched: {type: 'FETCH_USER', params: {id: 123}, result: {name: 'User Foo'}}});
            });

            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 0);
        });

        it('Should dispatch the proper fetch action with params as an Immutable Map', () => {
            session(request => {
                const originalParams = Immutable.Map({id: 123});
                const result = request('post', originalParams);
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

            session(request => {
                const originalParams = myRecord({id: 123});
                const result = request('post', originalParams);
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
            session(request => {
                const result = request('user');
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
                session(request => {
                    const result = request('user', {id: 123});
                    deq(result, {type: 'FETCH_USER', params: {id: 123}, result: {name: 'User Foo'}});
                });
            }
            finally {
                session.destroy();
            }
        });

        it('Should throw if the resource has not been registered', () => {
            session(request => {
                throws(() => request('unknown', 0), Error, /given resource.*name.*not.*registered/i);
            });
        });

        it('Should not accept params with an incorrect type', () => {
            session(request => {
                throws(() => request('post', 0), Error, /params.*must.*immutable.*or.*plain.*object/i);
                throws(() => request('post', false), Error, /params.*must.*immutable.*or.*plain.*object/i);
                throws(() => request('post', null), Error, /params.*must.*immutable.*or.*plain.*object/i);
                throws(() => request('post', 'foo'), Error, /params.*must.*immutable.*or.*plain.*object/i);
            });
        });

        it('Should fetch the same resource only once', () => {
            session(request => {
                const result0 = request('post', {id: 123});
                const result1 = request('post', {id: 123});
                eq(result0, result1);
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 1);
        });

        it('Should not re-fetch resources in the next session that are still in use', () => {
            let result0;
            session(request => {
                result0 = request('post', {id: 123});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 1);

            let result1;
            session(request => {
                result1 = request('post', {id: 123});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 1);
            eq(result0, result1);
        });

        it('Should not re-fetch throwing resources in the next session that are still in use', () => {
            throwFoodFetch = true;
            let result0;
            session(request => {
                result0 = throws(() => request('food', {id: 456}), Error, 'Error from test! foodResource.fetch()');
            });

            eq(foodResource.clear.callCount, 0);
            eq(foodResource.fetch.callCount, 1);

            let result1;
            throwFoodFetch = false;
            session(request => {
                result1 = throws(() => request('food', {id: 456}), Error, 'Error from test! foodResource.fetch()');
            });

            eq(foodResource.clear.callCount, 0);
            eq(foodResource.fetch.callCount, 1);
            eq(result0, result1);
            eq(dispatcher.callCount, 0);
        });

        it('Should not re-fetch rejecting resources in the next session that are still in use', async () => {
            rejectPhotoFetch = true;
            let result0;
            await session(async request => {
                result0 = await isRejected(request('photo', {id: 987}), Error, 'Error from test! photoResource.fetch()');
            });

            eq(photoResource.clear.callCount, 0);
            eq(photoResource.fetch.callCount, 1);

            let result1;
            throwFoodFetch = false;
            await session(async request => {
                result1 = await isRejected(request('photo', {id: 987}), Error, 'Error from test! photoResource.fetch()');
            });

            eq(photoResource.clear.callCount, 0);
            eq(photoResource.fetch.callCount, 1);
            eq(result0, result1);
            eq(dispatcher.length, 1);
        });

        it('Should fetch multiple times for resources that only differ in params', () => {
            session(request => {
                const result0 = request('post', {id: 123});
                deq(result0, {dispatched: {type: 'FETCH_POST', params: {id: 123}, result: {name: 'Post Foo'}}});

                const result1 = request('post', {id: 456});
                deq(result1, {dispatched: {type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 2);
        });

        it('Should clear resources that are no longer in use', () => {
            session(request => {
                request('post', {id: 123});
                request('post', {id: 456});
                request('post', {id: 789});
            });
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 3);
            deq(dispatcher.getCall(0).args, [{type: 'FETCH_POST', params: {id: 123}, result: {name: 'Post Foo'}}]);
            deq(dispatcher.getCall(1).args, [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}]);
            deq(dispatcher.getCall(2).args, [{type: 'FETCH_POST', params: {id: 789}, result: {name: 'Post Foo'}}]);

            session(request => {
                request('post', {id: 123});
                request('post', {id: 789});
            });
            eq(postResource.clear.callCount, 1);
            eq(postResource.fetch.callCount, 3);

            deq(postResource.clear.firstCall.args[0], {id: 456});
            deq(dispatcher.getCall(3).args, [{type: 'CLEAR_POST', params: {id: 456}}]);

            session(request => {
                request('post', {id: 456});
            });

            eq(postResource.clear.callCount, 3);
            eq(postResource.fetch.callCount, 4);
            deq(dispatcher.getCall(4).args, [{type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}]);
            deq(dispatcher.getCall(5).args, [{type: 'CLEAR_POST', params: {id: 123}}]);
            deq(dispatcher.getCall(6).args, [{type: 'CLEAR_POST', params: {id: 789}}]);
        });

        it('Should return promises from the fetch action as-is', async () => {
            await session(async request => {
                const result = request('comment', {commentId: 123});
                eq(typeof result.then, 'function');
                deq(await result, {dispatched: {type: 'FETCH_COMMENT', params: {commentId: 123},  result: {content: 'Hello Hello'}}});
            });
        });

        it('Should pass promises to the dispatcher as-is', async () => {
            await session(async request => {
                await request('comment', {commentId: 123});
            });
            eq(dispatcher.callCount, 1);
            eq(typeof dispatcher.firstCall.args[0].then, 'function');
        });

        it('Should not clear resources if a different session is using them', () => {
            session2 = manager.createSession();
            session(request => {
                request('post', {id: 123});
            });
            session2(request => {
                request('post', {id: 123});
            });

            session(request => {});
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 1);
        });

        it('Should continue on clearing other resources if the clear action throws', () => {
            throwFoodClear = true;
            session(request => {
                request('post', {id: 123});
                request('food', {id: 456});
                request('post', {id: 789});
            });

            session(request => {});

            eq(postResource.fetch.callCount, 2);
            eq(postResource.clear.callCount, 2);
            eq(foodResource.fetch.callCount, 1);
            eq(foodResource.clear.callCount, 1);
            eq(dispatcher.callCount, 5); // 1 action has not been dispatched because of the error

            // should not attempt the clear action again
            session(request => {});
            eq(foodResource.clear.callCount, 1);
            eq(dispatcher.callCount, 5);
        });

        it('Should allow for the clear callback to be null', async () => {
            manager.resource({
                name: 'bicycle',
                fetch: sinon.spy(params => {
                    return {type: 'FETCH_BICYCLE', params, result: {wheels: 5}};
                }),
            });

            await session(async request => {
                await request('bicycle', {id: 2});
            });

            await session(async request => {
                await request('bicycle', {id: 3});
            });
        });
    });

    describe('Transaction aborting', () => {
        it('Should not allow overlapping transactions if allowTransactionAbort=false (synchronous)', () => {
            eq(session.allowTransactionAbort, false);
            session(request => {
                throws(() => session(request => {}), Error, /previous.*transaction.*in.*progress/i);
            });
        });

        it('Should not allow overlapping transactions if allowTransactionAbort=false on the session overrides the Manager', () => {
            const manager = createManager(dispatcher, {allowTransactionAbort: true});
            try {
                const session = manager.createSession({allowTransactionAbort: false});

                eq(session.allowTransactionAbort, false);
                session(request => {
                    throws(() => session(request => {
                    }), Error, /previous.*transaction.*in.*progress/i);
                });
            }
            finally {
                manager.destroy();
            }
        });

        it('Should not allow overlapping transactions if allowTransactionAbort=false (asynchronous)', async () => {
            eq(session.allowTransactionAbort, false);
            await session(async request => {
                await delay(1);
                await isRejected(
                    Promise.resolve().then(() => session(async request => {})),
                    Error,
                    /previous.*transaction.*in.*progress/i,
                );
            });
        });

        it('Should abort the previous transaction if they overlap if allowTransactionAbort=true', () => {
            const manager = createManager(dispatcher, {allowTransactionAbort: true});
            manager.resource(userResource);
            const session = manager.createSession();
            eq(session.allowTransactionAbort, true);
            try {
                let milestones = 0;
                session(request0 => {
                    request0('user', {id: 0});
                    request0('user', {id: 100});
                    eq(userResource.fetch.callCount, 2);
                    eq(userResource.clear.callCount, 0);

                    session(request1 => {
                        throws(() => request0('user', {id: -1}), Error, /session.*aborted.*new.*session.*started/i);
                        request1('user', {id: 1});
                        eq(userResource.fetch.callCount, 3);
                        eq(userResource.clear.callCount, 0);

                        session(request2 => {
                            // this is the first transaction that completes successfully
                            // after this transaction user 0 and 1 should be cleared.
                            // 2 and 100 which are references here should not. 100 is also references in the first
                            // transaction so that we can verify it is not cleared in between
                            throws(() => request0('user', {id: -1}), Error, /session.*aborted.*new.*session.*started/i);
                            throws(() => request1('user', {id: -1}), Error, /session.*aborted.*new.*session.*started/i);
                            request2('user', {id: 2});
                            request2('user', {id: 100});
                            eq(userResource.fetch.callCount, 4);
                            eq(userResource.clear.callCount, 0);
                            ++milestones;
                        });
                        // should only do clears after a session has completed successfully
                        eq(userResource.fetch.callCount, 4);
                        eq(userResource.clear.callCount, 2);

                        throws(() => request1('user', {id: -1}), Error, /session.*aborted.*new.*session.*started/i);
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

        it('Should abort the previous transaction if they overlap if allowTransactionAbort=true on the session overrides Manager', () => {
            const manager = createManager(dispatcher, {allowTransactionAbort: false});
            manager.resource(userResource);
            const session = manager.createSession({allowTransactionAbort: true});
            eq(session.allowTransactionAbort, true);
            try {
                let milestones = 0;
                session(request0 => {
                    session(request1 => {
                    });

                    throws(() => request0('user', {id: -1}), Error, /session.*aborted.*new.*session.*started/i);

                    ++milestones;
                });
                eq(milestones, 1); // to verify that session() is not eating errors by accident
            }
            finally {
                session.destroy();
            }
        });

        it('Should abort the promise of a pending request', async () => {
            const manager = createManager(dispatcher, {allowTransactionAbort: true});
            manager.resource(commentResource);

            const session = manager.createSession();
            eq(session.allowTransactionAbort, true);
            try {
                await session(async request0 => {
                    const promise = request0('comment', {id: 123});

                    await session(async request1 => {
                        const err0 = throws(() => request0('user', {id: -1}), Error, /session.*aborted.*new.*session.*started/i);
                        const err1 = await isRejected(promise, Error, /session.*aborted.*new.*session.*started/i);
                        eq(err0.name, 'MeridviaTransactionAborted');
                        eq(err1.name, 'MeridviaTransactionAborted');

                        const comment = await request1('comment', {id: 123});
                        deq(comment, {dispatched: {type: 'FETCH_COMMENT', params: {id: 123}, result: {content: 'Hello Hello'}}});
                    });
                });
            }
            finally {
                session.destroy();
            }
        });

        it('Should abort a transaction if the session is destroyed', async () => {
            const manager = createManager(dispatcher, {allowTransactionAbort: true});
            manager.resource(commentResource);

            const session = manager.createSession();
            eq(session.allowTransactionAbort, true);
            try {
                await session(async request => {
                    const promise0 = request('comment', {id: 123});
                    const promise1 = request('comment', {id: 456});

                    session.destroy();
                    const err0 = throws(() => request('user', {id: -1}), Error, /session.*aborted.*because.*destroyed/i);
                    const err1 = await isRejected(promise0, Error, /session.*aborted.*because.*destroyed/i);
                    const err2 = await isRejected(promise1, Error, /session.*aborted.*because.*destroyed/i);
                    eq(err0.name, 'MeridviaTransactionAborted');
                    eq(err1.name, 'MeridviaTransactionAborted');
                    eq(err2.name, 'MeridviaTransactionAborted');
                });
            }
            finally {
                session.destroy();
            }
        });

        it('Should abort a transaction if the session is destroyed even if allowTransactionAbort is false', async () => {
            const manager = createManager(dispatcher, {allowTransactionAbort: false});
            manager.resource(commentResource);

            const session = manager.createSession();
            eq(session.allowTransactionAbort, false);
            try {
                await session(async request => {
                    const promise = request('comment', {id: 123});

                    session.destroy();
                    const err0 = throws(() => request('user', {id: -1}), Error, /session.*aborted.*because.*destroyed/i);
                    const err1 = await isRejected(promise, Error, /session.*aborted.*because.*destroyed/i);
                    eq(err0.name, 'MeridviaTransactionAborted');
                    eq(err1.name, 'MeridviaTransactionAborted');
                });
            }
            finally {
                session.destroy();
            }
        });

        it('Should abort a transaction if the manager is destroyed', async () => {
            const manager = createManager(dispatcher, {allowTransactionAbort: false});
            manager.resource(commentResource);

            const session = manager.createSession();
            eq(session.allowTransactionAbort, false);
            try {
                await session(async request => {
                    const promise = request('comment', {id: 123});

                    manager.destroy();
                    const err0 = throws(() => request('user', {id: -1}), Error, /session.*aborted.*because.*destroyed/i);
                    const err1 = await isRejected(promise, Error, /session.*aborted.*because.*destroyed/i);
                    eq(err0.name, 'MeridviaTransactionAborted');
                    eq(err1.name, 'MeridviaTransactionAborted');
                });
            }
            finally {
                session.destroy();
            }
        });
    });

    describe('Session destruction', () => {
        it('Should clear resources if a session is destroyed', () => {
            session2 = manager.createSession();
            session(request => {
                request('post', {id: 123});
                request('post', {id: 456});
            });
            session2(request => {
                request('post', {id: 123});
            });
            eq(postResource.fetch.callCount, 2);
            eq(postResource.clear.callCount, 0);

            session.destroy();
            eq(postResource.fetch.callCount, 2);
            eq(postResource.clear.callCount, 1);
            deq(postResource.clear.firstCall.args[0], {id: 456});
        });

        it('Should do nothing if destroyed twice', () => {
            session(request => {
                request('post', {id: 123});
            });

            session.destroy();
            session.destroy();
            eq(postResource.fetch.callCount, 1);
            eq(postResource.clear.callCount, 1);
            deq(postResource.clear.firstCall.args[0], {id: 123});
        });

        it('Should clear resources if a session is destroyed in the middle of a transaction', () => {
            session(request => {
                request('post', {id: 123});
            });

            session(request => {
                request('post', {id: 123}); // this one already existed
                request('post', {id: 456}); // newly introduced in a transaction that is destroyed in the middle of it
                session.destroy();
                throws(() => request('post', {id: 789}), Error, /session.*destroyed/i);
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
            throws(() => session(request => {}), Error, /session.*destroyed/);
        });
    });

    describe('manager.invalidate()', () => {
        it('Should throw if the resource name is unknown', () => {
            session(request => {
                request('post', {id: 123});
            });

            const error = throws(() => manager.invalidate('invalidxxx'), /resource name.*invalidxxx.*not.*registered/i);
            eq(error.name, 'ValueError');

            session(request => {
                request('post', {id: 123});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 1);
        });

        it('Should fetch again if all resources have been invalidated using manager.invalidate()', () => {
            session(request => {
                request('post', {id: 123});
                request('post', {id: 456});
                request('user', {id: 789});
            });

            const invalidationCount = manager.invalidate();
            eq(invalidationCount, 3);

            session(request => {
                request('post', {id: 123});
                request('post', {id: 456});
                request('user', {id: 789});
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
            session(request => {
                request('post', {id: 123});
                request('post', {id: 456});
                request('user', {id: 789});
            });

            const invalidationCount = manager.invalidate('post');
            eq(invalidationCount, 2);

            session(request => {
                request('post', {id: 123});
                request('post', {id: 456});
                request('user', {id: 789});
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
            session(request => {
                request('post', {id: 123});
                request('post', {id: 456});
                request('user', {id: 789});
            });

            const invalidationCount = manager.invalidate('post', {id: 456});
            eq(invalidationCount, 1);

            session(request => {
                request('post', {id: 123});
                request('post', {id: 456});
                request('user', {id: 789});
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
            session(request => {
                request('post', {id: 123});
                request('post', {id: 456});
                request('user', {id: 789});
            });

            const invalidationCount = manager.invalidate('post', {id: 9001});
            eq(invalidationCount, 0);

            session(request => {
                request('post', {id: 123});
                request('post', {id: 456});
                request('user', {id: 789});
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
            session(request => {
                doInvalidate = true;
                request('album', {id: 123});
                doInvalidate = false;
                request('album', {id: 456});
            });

            eq(albumResource.fetch.callCount, 2);
            deq(albumResource.fetch.firstCall.args[0], {id: 123});
            deq(albumResource.fetch.secondCall.args[0], {id: 456});

            session(request => {
                request('album', {id: 123});
                request('album', {id: 456});
            });

            eq(albumResource.fetch.callCount, 3);
            deq(albumResource.fetch.thirdCall.args[0], {id: 123});
        });

        it('Should fetch again if the most recent fetch action calls invalidate() asynchronously', () => {
            session(request => {
                request('album', {id: 123});
                request('album', {id: 456});
            });

            invalidateCallbacks[0]();

            eq(albumResource.fetch.callCount, 2);
            deq(albumResource.fetch.firstCall.args[0], {id: 123});
            deq(albumResource.fetch.secondCall.args[0], {id: 456});

            session(request => {
                request('album', {id: 123});
                request('album', {id: 456});
            });
            eq(albumResource.fetch.callCount, 3);
            deq(albumResource.fetch.thirdCall.args[0], {id: 123});

            session(request => {
                request('album', {id: 123});
                request('album', {id: 456});
            });
            eq(albumResource.fetch.callCount, 3);
        });

        it('Should not invalidate anything if invalidate() is used by an old fetch action', () => {
            session(request => {
                request('album', {id: 123});
            });

            eq(albumResource.fetch.callCount, 1);
            deq(albumResource.fetch.firstCall.args[0], {id: 123});

            manager.invalidate(); // so that we fetch again

            session(request => {
                request('album', {id: 123});
            });
            eq(albumResource.fetch.callCount, 2);
            deq(albumResource.fetch.secondCall.args[0], {id: 123});

            invalidateCallbacks[0](); // this invalidate() function belongs to the first fetch

            session(request => {
                request('album', {id: 123});
            });

            eq(albumResource.fetch.callCount, 2);
        });
    });

    describe('Maximum Staleness', () => {
        it('Should re-fetch stale resources if maximumStaleness is set and reached', () => {
            session(request => {
                request('user', {id: 123});
                request('post', {id: 123});
                request('post', {id: 456});
            });
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 2);

            clock.tick('15:00'); // +15 minutes
            session(request => {
                request('user', {id: 123});
                request('post', {id: 123});
                request('post', {id: 456});
            });
            // no changes yet, staleness is set to 15 minutes
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 2);

            clock.tick(1); // +1 ms to push over the staleness limit
            session(request => {
                request('user', {id: 123});
                request('post', {id: 123});
                request('post', {id: 456});
            });
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 4);
        });

        it('Should re-fetch stale throwing resources if maximumRejectedStaleness is set and reached', () => {
            throwFoodFetch = true;
            throwCandyFetch = true;

            session(request => {
                throws(() => request('food', {id: 123}));
                throws(() => request('candy', {id: 123}));
                throws(() => request('candy', {id: 456}));
            });
            eq(foodResource.clear.callCount, 0);
            eq(foodResource.fetch.callCount, 1);
            eq(candyResource.clear.callCount, 0);
            eq(candyResource.fetch.callCount, 2);

            clock.tick('15:00'); // +15 minutes
            session(request => {
                throws(() => request('food', {id: 123}));
                throws(() => request('candy', {id: 123}));
                throws(() => request('candy', {id: 456}));
            });
            // no changes yet, staleness is set to 15 minutes
            eq(candyResource.clear.callCount, 0);
            eq(candyResource.fetch.callCount, 2);

            clock.tick(1); // +1 ms to push over the staleness limit
            session(request => {
                throws(() => request('food', {id: 123}));
                throws(() => request('candy', {id: 123}));
                throws(() => request('candy', {id: 456}));
            });
            eq(foodResource.clear.callCount, 0);
            eq(foodResource.fetch.callCount, 1);
            eq(candyResource.clear.callCount, 0);
            eq(candyResource.fetch.callCount, 4);
        });

        it('Should re-fetch stale rejecting resources if maximumRejectedStaleness is set and reached', async () => {
            rejectPhotoFetch = true;
            rejectVideoFetch = true;

            await session(async request => {
                await isRejected(request('photo', {id: 123}));
                await isRejected(request('video', {id: 123}));
                await isRejected(request('video', {id: 456}));
            });
            eq(photoResource.clear.callCount, 0);
            eq(photoResource.fetch.callCount, 1);
            eq(videoResource.clear.callCount, 0);
            eq(videoResource.fetch.callCount, 2);

            clock.tick('15:00'); // +15 minutes
            await session(async request => {
                await isRejected(request('photo', {id: 123}));
                await isRejected(request('video', {id: 123}));
                await isRejected(request('video', {id: 456}));
            });
            // no changes yet, staleness is set to 15 minutes
            eq(videoResource.clear.callCount, 0);
            eq(videoResource.fetch.callCount, 2);

            clock.tick(1); // +1 ms to push over the staleness limit
            await session(async request => {
                await isRejected(request('photo', {id: 123}));
                await isRejected(request('video', {id: 123}));
                await isRejected(request('video', {id: 456}));
            });
            eq(photoResource.clear.callCount, 0);
            eq(photoResource.fetch.callCount, 1);
            eq(videoResource.clear.callCount, 0);
            eq(videoResource.fetch.callCount, 4);
        });

        it('Should set maximumRejectedStaleness to the same value as maximumStaleness by default', () => {
            const gameResource = {
                name: 'game',
                fetch: sinon.spy(params => {
                    throw Error('Error from test! gameResource.fetch()');
                }),
                clear: sinon.spy(params => {
                    return {type: 'CLEAR_GAME', params};
                }),
                maximumStaleness: '15m',
            };
            manager.resource(gameResource);

            session(request => {
                throws(() => request('game', {id: 123}));
            });
            eq(gameResource.clear.callCount, 0);
            eq(gameResource.fetch.callCount, 1);

            clock.tick('15:00'); // +15 minutes
            session(request => {
                throws(() => request('game', {id: 123}));
            });
            // no changes yet, staleness is set to 15 minutes
            eq(gameResource.clear.callCount, 0);
            eq(gameResource.fetch.callCount, 1);

            clock.tick(1); // +1 ms to push over the staleness limit
            session(request => {
                throws(() => request('game', {id: 123}));
            });
            eq(gameResource.clear.callCount, 0);
            eq(gameResource.fetch.callCount, 2);
        });

        it('Should not re-fetch resources if maximumStaleness is not set', () => {
            session(request => {
                request('user', {id: 123});
            });
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);

            clock.tick('12:00:00'); // +12 hours
            session(request => {
                request('user', {id: 123});
            });
            // maximum staleness is not set for user
            eq(userResource.clear.callCount, 0);
            eq(userResource.fetch.callCount, 1);
        });

        it('Should not re-fetch throwing resources if maximumRejectedStaleness is not set', () => {
            throwFoodFetch = true;
            let result0;
            session(request => {
                result0 = throws(() => request('food', {id: 456}), Error, 'Error from test! foodResource.fetch()');
            });
            eq(foodResource.clear.callCount, 0);
            eq(foodResource.fetch.callCount, 1);

            clock.tick('12:00:00'); // +12 hours
            let result1;
            session(request => {
                result1 = throws(() => request('food', {id: 456}), Error, 'Error from test! foodResource.fetch()');
            });
            // maximum staleness is not set for food
            eq(foodResource.clear.callCount, 0);
            eq(foodResource.fetch.callCount, 1);
            eq(result0, result1);
        });

        it('Should not re-fetch rejecting resources if maximumRejectedStaleness is not set', async () => {
            rejectPhotoFetch = true;
            let result0;
            await session(async request => {
                result0 = await isRejected(request('photo', {id: 987}), Error, 'Error from test! photoResource.fetch()');
            });
            eq(photoResource.clear.callCount, 0);
            eq(photoResource.fetch.callCount, 1);

            clock.tick('12:00:00'); // +12 hours
            let result1;
            await session(async request => {
                result1 = await isRejected(request('photo', {id: 987}), Error, 'Error from test! photoResource.fetch()');
            });
            // maximum staleness is not set for food
            eq(photoResource.clear.callCount, 0);
            eq(photoResource.fetch.callCount, 1);
            eq(result0, result1);
        });
    });

    describe('Caching', () => {
        it('Should clear resources after the cache age expires and not before', () => {
            session(request => {
                request('animal', {id: 1234});
                request('animal', {id: 2345});
            });
            eq(animalResource.fetch.callCount, 2);
            eq(animalResource.clear.callCount, 0);

            session(request => {
                request('animal', {id: 2345});
            });
            eq(animalResource.fetch.callCount, 2);
            eq(animalResource.clear.callCount, 0);

            clock.tick('05:00'); // (cache age is 5 minutes)
            session(request => {
                request('animal', {id: 2345});
            });
            eq(animalResource.fetch.callCount, 2);
            eq(animalResource.clear.callCount, 0);

            clock.tick(1); // 1ms to push over the cache age
            session(request => {
                request('animal', {id: 2345});
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
            session(request => {
                request('animal', {id: 1234});
            });
            eq(animalResource.fetch.callCount, 1);
            eq(animalResource.clear.callCount, 0);

            session(request => {});
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
            session(request => {
                request('animal', {id: 1234});
            });
            eq(animalResource.fetch.callCount, 1);
            eq(animalResource.clear.callCount, 0);

            session(request => {});
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
            let innerRequest;
            const returnValue = session(request => {
                innerRequest = request;
                return 123;
            });

            eq(returnValue, 123);
            throws(() => innerRequest('whatever', {}), Error, /request.*no.*longer.*valid/i);
        });

        it('Should end the transaction synchronously and forward the thrown value', () => {
            const error = Error('Error from test case');

            let innerRequest;
            const forwardedError = throws(() => {
                session(request => {
                    innerRequest = request;
                    throw error;
                });
            });

            eq(error, forwardedError);
            throws(() => innerRequest('whatever', {}), Error, /request.*no.*longer.*valid/i);
        });

        it('Should end the transaction after the fulfillment of any returned promise', async () => {
            let innerRequest;
            const returnValue = await session(async request => {
                innerRequest = request;
                request('post', {id: 123});

                await delay(10);

                const result1 = request('post', {id: 456});
                deq(result1, {dispatched: {type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}});

                return 123;
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 2);
            eq(returnValue, 123);
            throws(() => innerRequest('whatever', {}), Error, /request.*no.*longer.*valid/i);
        });

        it('Should end the transaction after the fulfillment of any returned promise (rejected)', async () => {
            const error = Error('Error from test case');

            let innerRequest;
            const promise = session(async request => {
                innerRequest = request;
                request('post', {id: 123});

                await delay(10);

                const result1 = request('post', {id: 456});
                deq(result1, {dispatched: {type: 'FETCH_POST', params: {id: 456}, result: {name: 'Post Foo'}}});

                throw error;
            });

            await promise.catch(forwardedError => eq(forwardedError, error));
            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 2);
            throws(() => innerRequest('whatever', {}), Error, /request.*no.*longer.*valid/i);
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

                    return await storage.subSession(async request => {
                        const app = await fetchApp(appId);
                        request('user', {userId: app.createdBy});
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
            session(request => {
                request('post', {id: 123});
                request('post', {id: 456});
            });
            eq(postResource.fetch.callCount, 2);
            deq(postResource.fetch.firstCall.args[1].storage, {});
            deq(postResource.fetch.secondCall.args[1].storage, {});

            // different instance, so different storage
            neq(postResource.fetch.firstCall.args[1].storage, postResource.fetch.secondCall.args[1].storage);

            session(request => {
                request('post', {id: 456});
            });

            // same instance, so same storage
            eq(postResource.fetch.firstCall.args[1].storage, postResource.clear.firstCall.args[1].storage);
        });

        it('Should support keeping track of sub sessions using the storage object', async () => {
            await session(async request => {
                await request('app', {appId: 1000});
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
            session(request => {
                request('train', {id: 123});
                request('train', {id: 456});
            });

            eq(trainResource.fetch.callCount, 2);
            eq(cancelCallbacks.length, 2);
            eq(cancelCallbacks[0].id, 123);
            eq(cancelCallbacks[0].callback.callCount, 0);
            eq(cancelCallbacks[1].id, 456);
            eq(cancelCallbacks[1].callback.callCount, 0);

            manager.invalidate('train', {id: 123});
            session(request => {
                request('train', {id: 123});
                request('train', {id: 456});
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
            session(request => {
                request('train', {id: 123});
                request('train', {id: 456});
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
            session(request => {
                request('train', {id: 123});
                request('train', {id: 456});
            });

            eq(trainResource.fetch.callCount, 2);
            eq(cancelCallbacks.length, 2);
            eq(cancelCallbacks[0].id, 123);
            eq(cancelCallbacks[0].callback.callCount, 0);
            eq(cancelCallbacks[1].id, 456);
            eq(cancelCallbacks[1].callback.callCount, 0);

            session(request => {
                request('train', {id: 456});
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
            session(request => {
                request('train', {id: 123});
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
            session(request => {
                const error = throws(() => request('train', {id: 123}), Error, /error.*occurred.*callbacks/i);
                eq(error.errors[0].message, 'Error from test! 2');
                eq(error.errors[1].message, 'Error from test! 0');
            });

            eq(callback0.callCount, 1);
            eq(callback1.callCount, 1);
            eq(callback2.callCount, 1);
        });
    });

    describe('Refreshing', () => {
        it('Should throw if manage.refresh(...) is called with an unknown resource', () => {
            session(request => {
                request('post', {id: 123});
            });

            const error = throws(() => manager.refresh('invalidxxx'), /resource name.*invalidxxx.*not.*registered/i);
            eq(error.name, 'ValueError');

            session(request => {
                request('post', {id: 123});
            });

            eq(postResource.clear.callCount, 0);
            eq(postResource.fetch.callCount, 1);
        });

        it('Should immediately refresh active resource instances if manage.refresh(...) is called', () => {
            session(request => {
                request('post', {id: 123});
                request('post', {id: 456});
                request('user', {id: 789});
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
            session(request => {
                request('animal', {id: 123});
                request('animal', {id: 456});
                request('animal', {id: 789});
            });

            session(request => {
                request('animal', {id: 123});
                // 456 is now cached
                request('animal', {id: 789});
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

            session(request => {
                request('dino', {id: 123});
            });

            clock.tick('02:00'); // +2 minutes = 02:00

            session(request => {
                request('dino', {id: 123});
                request('dino', {id: 456});
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
            session(request => {
                request('animal', {id: 123});
                request('food', {id: 456});
                request('animal', {id: 789});
                request('food', {id: 1011});
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
                '  Error: Error from test! foodResource.fetch()',
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

            session(request => {
                request('dino', {id: 123});
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
