/* begin_hidden */
const {createManager} = require('meridvia');

const manager = createManager();
const doApiCall = async () => ({thing: 123});
/* end_hidden */

manager.resource({
    name: 'thing',
    fetch: async (params) => {
        const payload = await doApiCall('/thing', params);
        return {type: 'FETCH_THING', params, payload};
    },
    clear: (params) => {
        return {type: 'CLEAR_THING', params};
    },
});

/* begin_hidden */
console.log('End of example');
/* end_hidden */
