/* begin_hidden */
const {createManager} = require('meridvia');

const manager = createManager();
/* end_hidden */

manager.resource({
    name: 'thing',
    initStorage: (params) => {
        return {
            fetchCount: 0,
        };
    },
    fetch: async (params, {storage, invalidate, onCancel}) => {
        ++storage.fetchCount;

        const controller = new AbortController();
        onCancel(() => controller.abort());

        const url = '/thing/' + encodeURIComponent(params.thingId);
        const response = await fetch(url, {
            signal: controller.signal,
        });
        const payload = await response.json();

        if (payload.maximumCacheDurationMs) {
            setTimeout(() => invalidate(), payload.maximumCacheDurationMs);
        }

        return {type: 'FETCH_THING', params, payload};
    },
    clear: (params, {storage}) => {
        console.log('This resource was fetched', storage.fetchCount, 'times!');
        return {type: 'CLEAR_THING', params};
    },
    maximumStaleness: '10m',
    cacheMaxAge: '5m',
    refreshInterval: '30s',
});

/* begin_hidden */
console.log('End of example');
/* end_hidden */
