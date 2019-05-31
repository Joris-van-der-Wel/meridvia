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
    name: 'comments',
    fetch: async ({postId}) => {
        return {type: 'FETCH_COMMENTS', postId, payload: {title: 'foo!'}};
    },
    clear: ({postId}) => {
        return {type: 'CLEAR_COMMENTS', postId};
    },
});

const session = manager.createSession();
/* end_hidden */

session(request => {
    request('post', {postId: 1});
    request('post', {postId: 2});
    request('comments', {postId: 2});
});

/* begin_hidden */
console.log('End of example');
/* end_hidden */
