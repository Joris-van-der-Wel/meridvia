'use strict';
const {describe, it, beforeEach, afterEach} = require('mocha-sugar-free');

const  {deepEqual: deq, strictEqual: eq, isRejected} = require('../assert');
const {create: createApp} = require('../../test-generated/integration/reduxAndRouter5/lib/app');


describe('integration test: Example app with redux and router5', suite => {
    suite.slow(15000);
    let app;

    beforeEach(async () => {
        app = await createApp();
    });

    afterEach(() => {
        app.stop();
        app = null;
    });

    it('Should properly transitioning between redux states in response to navigation', async () => {
        deq(app.store.getState(), {
            commentsByPost: {},
            postsBySubreddit: {},
        });

        const firstNavigatePromise = app.navigate('subreddit', {subreddit: 'aww'});
        deq(app.store.getState(), {
            commentsByPost: {},
            postsBySubreddit: {
                aww: {
                    status: 'pending',
                },
            },
        });
        await firstNavigatePromise;
        deq(app.store.getState(), {
            commentsByPost: {},
            postsBySubreddit: {
                aww: {
                    error: undefined,
                    result: {
                        posts: [
                            {id: 1, title: 'Hello world'},
                            {id: 2, title: 'Foo bar'},
                        ],
                    },
                    status: 'success',
                },
            },
        });

        const secondNavigatePromise = app.navigate('subreddit', {subreddit: 'Eyebleach'});
        deq(app.store.getState(), {
            commentsByPost: {},
            postsBySubreddit: {
                aww: {
                    error: undefined,
                    result: {
                        posts: [
                            {id: 1, title: 'Hello world'},
                            {id: 2, title: 'Foo bar'},
                        ],
                    },
                    status: 'success',
                },
                Eyebleach: {
                    status: 'pending',
                },
            },
        });
        await secondNavigatePromise;
        deq(app.store.getState(), {
            commentsByPost: {},
            postsBySubreddit: {
                Eyebleach: {
                    error: undefined,
                    result: {
                        posts: [
                            {id: 35, title: 'A quick brown fox jumps over the lazy dog'},
                            {id: 37, title: 'good boy'},
                        ],
                    },
                    status: 'success',
                },
            },
        });

        const thirdNavigatePromise = app.navigate('home');
        deq(app.store.getState(), {
            commentsByPost: {},
            postsBySubreddit: {
                Eyebleach: {
                    error: undefined,
                    result: {
                        posts: [
                            {id: 35, title: 'A quick brown fox jumps over the lazy dog'},
                            {id: 37, title: 'good boy'},
                        ],
                    },
                    status: 'success',
                },
            },
        });
        await thirdNavigatePromise;
        deq(app.store.getState(), {
            commentsByPost: {},
            postsBySubreddit: {},
        });

        const fourthNavigatePromise = app.navigate('subreddit.post', {subreddit: 'Eyebleach', postId: 1});
        deq(app.store.getState(), {
            commentsByPost: {
                1: {
                    status: 'pending',
                },
            },
            postsBySubreddit: {
                Eyebleach: {
                    status: 'pending',
                },
            },
        });

        await fourthNavigatePromise;
        deq(app.store.getState(), {
            postsBySubreddit: {
                Eyebleach: {
                    status: 'success',
                    error: undefined,
                    result: {
                        posts: [
                            {id: 35, title: 'A quick brown fox jumps over the lazy dog'},
                            {id: 37, title: 'good boy'},
                        ],
                    },
                },
            },
            commentsByPost: {
                1: {
                    status: 'success',
                    error: undefined,
                    result: {
                        comments: [
                            {id: 100, body: 'frist'},
                            {id: 101, body: '+1'},
                        ],
                    },
                },
            },
        });
    });

    it('Should properly handle the user cancelling a navigation transition', async () => {
        deq(app.store.getState(), {
            commentsByPost: {},
            postsBySubreddit: {},
        });

        await app.navigate('subreddit', {subreddit: 'aww'});
        deq(app.store.getState(), {
            commentsByPost: {},
            postsBySubreddit: {
                aww: {
                    error: undefined,
                    result: {
                        posts: [
                            {id: 1, title: 'Hello world'},
                            {id: 2, title: 'Foo bar'},
                        ],
                    },
                    status: 'success',
                },
            },
        });

        const secondNavigatePromise = app.navigate('subreddit', {subreddit: 'Eyebleach'});
        deq(app.store.getState(), {
            commentsByPost: {},
            postsBySubreddit: {
                aww: {
                    error: undefined,
                    result: {
                        posts: [
                            {id: 1, title: 'Hello world'},
                            {id: 2, title: 'Foo bar'},
                        ],
                    },
                    status: 'success',
                },
                Eyebleach: {
                    status: 'pending',
                },
            },
        });

        const thirdNavigatePromise = app.navigate('subreddit', {subreddit: 'rarepuppers'});
        deq(app.store.getState(), {
            commentsByPost: {},
            postsBySubreddit: {
                aww: {
                    error: undefined,
                    result: {
                        posts: [
                            {id: 1, title: 'Hello world'},
                            {id: 2, title: 'Foo bar'},
                        ],
                    },
                    status: 'success',
                },
                Eyebleach: {
                    status: 'pending',
                },
                rarepuppers: {
                    status: 'pending',
                },
            },
        });

        const router5Error = await isRejected(secondNavigatePromise);
        eq(router5Error.code, 'CANCELLED');
        await thirdNavigatePromise;

        deq(app.store.getState(), {
            commentsByPost: {},
            postsBySubreddit: {
                rarepuppers: {
                    error: undefined,
                    result: {
                        posts: [
                            {id: 50, title: 'Hello fren'},
                            {id: 51, title: 'woofer'},
                        ],
                    },
                    status: 'success',
                },
            },
        });
    });
});
