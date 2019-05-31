/* begin_hidden */
const {createManager} = require('meridvia');

const manager = createManager();
const doApiCall = async () => ({thing: 123});
/* end_hidden */

manager.resources([
    {
        name: 'thing',
        fetch: async (params) => {
            const payload = await doApiCall('/thing', params);
            return {type: 'FETCH_THING', params, payload};
        },
        clear: (params) => {
            return {type: 'CLEAR_THING', params};
        },
    },
    {
        name: 'otherThing',
        fetch: async (params) => {
            const payload = await doApiCall('/otherThing', params);
            return {type: 'FETCH_OTHER_THING', params, payload};
        },
        clear: (params) => {
            return {type: 'CLEAR_OTHER_THING', params};
        },
    },
]);

/* begin_hidden */
console.log('End of example');
/* end_hidden */
