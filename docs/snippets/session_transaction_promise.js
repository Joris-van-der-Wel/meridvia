/* begin_hidden */
const {createManager} = require('meridvia');

const manager = createManager();
manager.resource({
    name: 'post',
    fetch: async ({postId}) => {
        return {type: 'FETCH_POST', postId, payload: {title: 'foo!'}};
    },
    clear: ({postId}) => {
        return {type: 'CLEAR_POST', postId};
    },
});
manager.resource({
    name: 'user',
    fetch: async ({userId}) => {
        return {type: 'FETCH_USER', userId, payload: {name: 'bar!'}};
    },
    clear: ({userId}) => {
        return {type: 'CLEAR_USER', userId};
    },
});

const session = manager.createSession();
/* end_hidden */

async function example() {
    await session(async request => {
        const post = await request('post', {postId: 1});
        request('user', {userId: post.authorId});
    });
}

example().then(() => console.log('End of example'));
