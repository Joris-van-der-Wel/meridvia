Meridvia
========
[![Build Status](https://travis-ci.org/Joris-van-der-Wel/meridvia.svg?branch=master)](https://travis-ci.org/Joris-van-der-Wel/meridvia) [![Coverage Status](https://coveralls.io/repos/github/Joris-van-der-Wel/meridvia/badge.svg?branch=master)](https://coveralls.io/github/Joris-van-der-Wel/meridvia?branch=master)

* [Installation](#installation)
* [How it works](#how-it-works)
* [API Reference](#api-reference)
* [Example: React Lifecycle methods](#example-react-lifecycle-methods)

This library helps with managing the lifecycle of data fetched from a resource. For example when there is a HTTP resource that you need data from, this library will tell you when to to perform the actual request to fetch the data and when to clear/cleanup the data. 

Originally this library was created to make it easier to manage asynchronous actions in [redux](https://redux.js.org). The "standard" way of performing async actions in redux ([described in its documentation](https://redux.js.org/advanced/async-actions)) has many advantages, however it also has a few disadvantages:

* Data that is no longer needed is never cleared out of the state store
* Pending API calls are not [aborted](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) if they are no longer needed
* Periodically refreshing data is difficult

This library was created to help with these disadvantages. However it does not actually depend on redux and is generic enough to be used in many other situations.

Installation
------------
```bash
npm install meridvia
```

And then you can include it in your project using `import` or `require()`, assuming you are using something like webpack or browserify:

```javascript
const {createManager} = require('meridvia');
```

or

```javascript
import {createManager} from 'meridvia';
```


How it works
------------
There are a few important concepts: The [__Resource Definition__](#managerresourceoptions) which defines the behaviour of each __resource__. And the [__`Session`__](#session-api) by which you can begin a __transaction__.

For each asynchronous source of data that you have, a [__Resource Definition__](#managerresourceoptions) should be created. At the very least it contains a unique __resource name__, a [__`fetch`__ callback](#fetch-callback) and a [__`clear`__ callback](#clear-callback). It is also possible to configure if and when the data is cached and refreshed. A __resource__ is requested using its __resource name__ and an a key/value map of __params__. These __params__ can be represented using a plain javascript object, or as an [Immutable Map](https://immutable-js.github.io/immutable-js/) and are passed to the [__`fetch`__ callback](#fetch-callback) and the [__`clear`__ callback](#clear-callback). 

Each unique combination of __resource name__ and __params__ is considered to be one specific __resource__. For example if you call the [__`request`__ function](#requestresourcename-params--any) multiple times with the same __resource name__ and __params__, the [__`fetch`__ callback](#fetch-callback) will only be called once. If a plain javascript object is passed as the __params__, it is compared to the __params__ of other __resources__ using a shallow equality check.

A [__`Session`__](#session-api) is used to manage which __resources__ are in use. For each place in your codebase where you would normally perform an API call, a [__`Session`__](#session-api) should be created instead. A [__`Session`__](#session-api) object lets you start and end a __transaction__. 

The only time that a __resource__ can be requested is between the start and end of such a __transaction__. When requesting data the [__`Session`__](#session-api) will figure out if any existing data can be re-used, if not the [__`fetch`__ callback](#fetch-callback) is called. 

When a  __transaction__ ends, the session will compare all the __resources__ that have been requested to the requested __resources__ of the previous __transaction__. For all __resources__ that are no longer in use, the [__`clear`__ callback](#clear-callback) is called. This callback will not occur immediately if caching has been configured.

An example to demonstrate these concepts:

```javascript
const {createManager} = require('meridvia');

// Create a new instance of this library by calling
// createManager(), this is usually only done once
// in your codebase
const manager = createManager();

// Register a new Resource Definition by calling
// manager.resource(...)
manager.resource({
    name: 'example',
    fetch: async (params) => {
        console.log('Fetch the example resource with params', params);
        // This is where you would normally fetch data using an
        // actual API call and store the result in your state store
    },
    clear: (params) => {
        console.log('Clear the example resource with params', params);
        // This is where you would normally remove the previously
        // fetched data from your state store
    },
});

// Create a new session
const session = manager.createSession();

console.log('\nLets begin the first transaction!');
// The session transaction begins now:
session(request => {
    // Fetch two resources for the first time:
    request('example', {exampleId: 1});
    request('example', {exampleId: 2});
});
// The session transaction has ended

console.log('\nThe second transaction!');
// The session transaction begins now:
session(request => {
    // This resource we had already fetched before,
    // so it is reused:
    request('example', {exampleId: 1});
    // This resource is fetched for the first time:
    request('example', {exampleId: 9001});
});
// The session transaction has ended,
// The resource with {exampleId: 2} was no longer
// used, so it is cleared

console.log('\nAll done, lets destroy the session');
// All resources will be cleared now:
session.destroy();

console.log('End of example');
```

Output:

```
Lets begin the first transaction!
Fetch the example resource with params { exampleId: 1 }
Fetch the example resource with params { exampleId: 2 }

The second transaction!
Fetch the example resource with params { exampleId: 9001 }
Clear the example resource with params { exampleId: 2 }

All done, lets destroy the session
Clear the example resource with params { exampleId: 1 }
Clear the example resource with params { exampleId: 9001 }
End of example
```

--------------------------------------------------------------------------------

API Reference
-------------

### Top-Level Exports
* [`createManager([dispatcher], [options]) ⇒ Manager`](#createmanagerdispatcher-options--manager)

#### [`createManager([dispatcher], [options]) ⇒ Manager`](#createmanagerdispatcher-options--manager)
Create a new [__`Manager`__](#manager-api) instance. See [Manager API](#manager-api)

| Argument                      | Type      | Default  |                                                               |
| ----------------------------- | ----------| -------- | ------------------------------------------------------------- |
| dispatcher                    | function  | `x => x` | The [__`dispatcher`__ callback](#createmanagerdispatcher-options--manager). This function will be called with the return value of any [__`fetch`__ callback](#fetch-callback) and any [__`clear`__ callback](#clear-callback) |
| options.allowTransactionAbort | boolean   | `false`  | If `false`, overlapping transactions are not allowed. If `true` an overlapping __transaction__ for a [__`Session`__](#session-api) will cause the previous __transaction__ to be aborted. |

__Return value__: A new [__`Manager`__](#manager-api) instance

```javascript
const {createManager} = require('meridvia');

const manager = createManager();
```

--------------------------------------------------------------------------------

### Manager API
* [__`Manager`__](#manager-api)
  * [`manager.resource(options)`](#managerresourceoptions)
  * [`manager.resources(options)`](#managerresourcesoptions)
  * [`manager.createSession()` ⇒ `Session`](#managercreatesession--session)
  * [`manager.invalidate([resourceName], [params]) ⇒ number`](#managerinvalidateresourcename-params--number)
  * [`manager.refresh([resourceName], [params]) ⇒ number`](#managerrefreshresourcename-params--number)
  * [`manager.destroy()`](#managerdestroy)

#### Manager

#### [`manager.resource(options)`](#managerresourceoptions)
| Argument                  | Type                      | Default      |                                                               |
| ------------------------- | ------------------------- | ------------ | ------------------------------------------------------------- |
| options.name              | string                    | __required__ | A unique __resource name__ for this __resource__. The same name can later be used to request this __resource__. |
| options.fetch             | function(params, options) | __required__ | The [__`fetch`__ callback](#fetch-callback) for this __resource__. Called whenever the asynchronous data should be retrieved. |
| options.clear             | function(params, options) | `null`       | The [__`clear`__ callback](#clear-callback) for this __resource__. Called whenever asynchronous data that has been previously retrieved, is no longer in use. |
| options.initStorage       | function(params)          | () => ({})   | Called the first time a __resource__ is fetched, the return value is available to the other actions of the same __resource__. |
| options.maximumStaleness  | [Time interval](#time-interval-values)        | 0            | The maximum amount of time that the data of a fetched __resource__ may be reused in a future __transaction__. A value of 0 means forever/infinite. |
| options.cacheMaxAge       | [Time interval](#time-interval-values)        | 0            | The maximum amount of time that the data of a fetched __resource__ may be cached if no [__`Session`__](#session-api) is using the __resource__. A value of 0 disables caching. |
| options.refreshInterval   | [Time interval](#time-interval-values)        | 0            | How often to fetch the __resource__ again, as long as there is a [__`Session`__](#session-api) using this __resource__. A value of 0 disables refreshing. |

__Return value__: `undefined` \
__Throws__: `IllegalStateError` if the [__`Manager`__](#manager-api) has been destroyed \
__Throws__: `TypeError` if the any of the options has an invalid type \
__Throws__: `ValueError` if the given __resource name__ is already in use

Register a [__Resource Definition__](#managerresourceoptions) with the given `options`. Each [__Resource Definition__](#managerresourceoptions) is identified by its unique __resource name__ (`options.name`), the __resource__ can be requested using this __resource name__ during a __transaction__ using the [__`request`__ function](#requestresourcename-params--any). The other options define the behaviour of the __resource__.

The `options.maximumStaleness` and `options.cacheMaxAge` values have very similar effects. They both define for how long the asynchronous data retrieved by the [__`fetch`__ callback](#fetch-callback) may be reused by a future __transaction__. The difference is that if `options.cacheMaxAge` is not set, the __resource__ is always cleared if it is no longer in use by any [__`Session`__](#session-api). If `options.cacheMaxAge` is set, the data may be reused even if there was a moment where the __resource__ was not in use by any [__`Session`__](#session-api).

If `options.refreshInterval` is set, the [__`fetch`__ callback](#fetch-callback) is called again periodically to refresh the data, but only if the __resource__ is currently in use by a [__`Session`__](#session-api).

##### "fetch" callback
| Argument                  | Type                    |                                                                |
| ------------------------- | ----------------------- | -------------------------------------------------------------- |
| params                    | object \| Immutable.Map | The __params__ that were passed to the [__`request`__ function](#requestresourcename-params--any) during the __transaction__. |
| options.storage           | any                     | The value that was previously returned by the "initStorage"  callback. |
| options.invalidate        | function()              | May be called at any time to indicate that the data from this specific fetch should no longer be cached in any way. |
| options.onCancel          | function(callback)      | May be called to register a cancellation callback.             |

__Return value__: `object | Promise`

The [__`fetch`__ callback](#fetch-callback) function is called whenever the asynchronous data should be retrieved, either for the first time or to refresh existing data. For example, this is where you would perform an HTTP request. As its first argument the callback receives the __params__ that were given during the __transaction__. The second argument is an `options` object containing optional utilities.

The `options.invalidate()` function may be called at any time to indicate that the data from this specific fetch should no longer be cached in any way. If a __transaction__ requests this __resource__ again it will always result in the [__`fetch`__ callback](#fetch-callback) being called again. This can be used to implement more advanced caching strategies

The `options.onCancel(callback)` function maybe called to register a cancellation callback. When a __resource__ is no longer in use, or if a [__`fetch`__ callback](#fetch-callback) is superseded by a more recent [__`fetch`__ callback](#fetch-callback), all cancellation callbacks will be called. This can be used for example to cancel a http request. 

The return value of the [__`fetch`__ callback](#fetch-callback) is passed to the [__`dispatcher`__ callback](#createmanagerdispatcher-options--manager) of the [__`Manager`__](#manager-api). This allows for easy integration with state store frameworks such as redux.

##### "clear" callback
| Argument                  | Type                    |                                                                |
| ------------------------- | ----------------------- | -------------------------------------------------------------- |
| params                    | object \| Immutable.Map | The __params__ that were passed to the [__`request`__ function](#requestresourcename-params--any) during the __transaction__. |
| options.storage           | any                     | The value that was previously returned by the "initStorage"  callback |

__Return value__: `object | Promise`

The [__`clear`__ callback](#clear-callback) callback function is called whenever asynchronous data that has been previously retrieved, is no longer in use. 

When integration with a state store framework such as redux, this is where an action should be dispatched that causes the asynchronous data to be removed from the store.

The return value of the [__`clear`__ callback](#clear-callback) is passed to the [__`dispatcher`__ callback](#createmanagerdispatcher-options--manager) of the [__`Manager`__](#manager-api). 

##### "initStorage" callback
| Argument                  | Type                    |                                                               |
| ------------------------- | ----------------------- | ------------------------------------------------------------- |
| params                    | object \| Immutable.Map | The __params__ that were given during the __transaction__. |

__Return value__: any

This callback function is called the first time a __resource__ is fetched (for the specific combination of __resource name__ and __params__). The return value is passed to any subsequent [__`fetch`__ callback](#fetch-callback) and [__`clear`__ callback](#clear-callback). This feature is useful if you need to keep track of some sort of state between (re-)fetching and clearing the same __resource__. 

##### Time interval values
Time intervals, such as "cacheMaxAge", can be expressed in two ways. If the value is a javascript number, it specifies the amount of milliseconds. If the value is a string, it must consist of a (floating point / rational) number and a suffix to indicate if the number indicates milliseconds ("ms"), seconds ("s"), minutes ("m"), hours ("h") or days ("d"). Here are some examples:

| Input Value | Milliseconds  | Description             |
| ----------- | ------------- | ----------------------- |
| `10`        | 10            | 10 Milliseconds         |
| `"10ms"`    | 10            | 10 Milliseconds         |
| `"10s"`     | 10000         | 10 Seconds              |
| `"10m"`     | 600000        | 10 Minutes              |
| `"10h"`     | 36000000      | 10 Hours                |
| `"10d"`     | 864000000     | 10 Days (10 * 24 hours) |

---

A minimal example
```javascript
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
```

A more exhaustive example:
```javascript
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
```

#### [`manager.resources(options)`](#managerresourcesoptions)
This function is a simple shorthand that lets you register multiple __resources__ in a single call. It accepts an array for which every item is registered as a __resource__ in exactly the same way as [`manager.resource(options)`](#managerresourceoptions).

__Return value__: `undefined` \
__Throws__: See [`manager.resource(options)`](#managerresourceoptions)

Example:
```javascript
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
```

#### [`manager.createSession()` ⇒ `Session`](#managercreatesession--session)
Creates a new [__`Session`__](#session-api) object, which is used to manage which __resources__ are actually in use. See [Session API](#session-api).

__Return value__: [__`Session`__](#session-api) object \
__Throws__: `IllegalStateError` if the [__`Manager`__](#manager-api) has been destroyed

#### [`manager.invalidate([resourceName], [params]) ⇒ number`](#managerinvalidateresourcename-params--number)
| Argument                  | Type                     |                                                               |
| ------------------------- | ------------------------ | ------------------------------------------------------------- |
| resourceName              | string                   | The __resource name__ that was previously given to the [__`request`__ function](#requestresourcename-params--any). |
| params                    | object \| Immutable.Map  | The __params__ that was previously given to the [__`request`__ function](#requestresourcename-params--any). |

__Return value__: `number` : The number of resources that have actually been invalidated \
__Throws__: No

Invalidate all matching __resources__. If a matching __resource__ is currently in-use by a [__`Session`__](#session-api), the next time the __resource__ is requested the [__`fetch`__ callback](#fetch-callback) will be called again. If a matching __resource__ is not currently in-use by any [__`Session`__](#session-api) the [__`clear`__ callback](#clear-callback) will be called immediately.

If 0 arguments are passed to this function, all __resources__ will be invalidated. If 1 argument is passed, all resources with the given __resource name__ are invalidated. If 2 arguments are passed, only one specific resource is invalidated.

#### [`manager.refresh([resourceName], [params]) ⇒ number`](#managerrefreshresourcename-params--number)
| Argument                  | Type                     |                                                               |
| ------------------------- | ------------------------ | ------------------------------------------------------------- |
| resourceName              | string                   | The __resource name__ that was previously given to the [__`request`__ function](#requestresourcename-params--any). |
| params                    | object \| Immutable.Map  | The __params__ that was previously given to the [__`request`__ function](#requestresourcename-params--any). |

__Return value__: `number` \
__Throws__: `IllegalStateError` if the [__`Manager`__](#manager-api) has been destroyed \
__Throws__: `CompositeError` containing further errors in the "errors" property, if the [__`dispatcher`__ callback](#createmanagerdispatcher-options--manager) has thrown for any __resource__.

Refresh all matching __resources__. If a matching __resource__ is currently in-use by a [__`Session`__](#session-api), the [__`fetch`__ callback](#fetch-callback) is immediately called again. If a matching __resource__ is not currently in-use by any [__`Session`__](#session-api) the [__`clear`__ callback](#clear-callback) will be called immediately.

If 0 arguments are passed to this function, all __resources__ will be refreshed. If 1 argument is passed, all resources with the given __resource name__ are refreshed. If 2 arguments are passed, only one specific resource is refreshed.

#### [`manager.destroy()`](#managerdestroy)
__Return value__: `undefined` \
__Throws__: No

Destroy the [__`Manager`__](#manager-api) instance. All __resources__ are cleared, all sessions are destroyed and the [__`Manager`__](#manager-api) is no longer allowed to be used.

--------------------------------------------------------------------------------

### Session API
A [__`Session`__](#session-api) object is used to request __resources__ from the [__`Manager`__](#manager-api). If multiple [__`Session`__](#session-api) objects request the same __resources__, the [__`Manager`__](#manager-api) will make sure that the same __resource__ is only fetched once. The [__`Session`__](#session-api) object will remember which __resources__ you are currently using. A __resource__ that is in-use will never be cleared.

A __transaction__ is used to change which __resources__ are in-use by a [__`Session`__](#session-api). Such a __transaction__ has an explicit beginning and end. A __transaction__ from the same [__`Session`__](#session-api) object is not allowed to overlap with a different __transaction__ that is still active. While the __transaction__ is active a [__`request`__ function](#requestresourcename-params--any) is available which should be called to request a specific __resource__. Doing so marks a specific __resource__ as being in-use in the [__`Session`__](#session-api). When the __transaction__ ends, all of the requested __resources__ are compared to those requested in the previous __transaction__, the __resources__ that have not been requested again are then no longer marked as in-use.

* [session(callback) ⇒ any](#sessioncallback--any)
  * [session.destroy()](#sessiondestroy)

#### [session(callback) ⇒ any](#sessioncallback--any)
| Argument                  | Type                  |                                                               |
| ------------------------- | --------------------- | ------------------------------------------------------------- |
| callback                  | function(request)     | The callback function that determines the lifetime of the __transaction__. The [__`request`__ function](#requestresourcename-params--any) is passed as the first argument to this callback. |

__Return value__: Same as the return value of the called "callback" \
__Throws__: `TypeError` if callback is not a function \
__Throws__: `IllegalStateError` if the [__`Session`__](#session-api) has been destroyed \
__Throws__: `IllegalStateError` if another __transaction__ is still in progress (can only occur if `allowTransactionAbort` is `false`) \
__Throws__: Any thrown value from the called callback function

By calling the [__`Session`__](#session-api) object as a function, a new __transaction__ begins. The given "callback" argument is then immediately called, with the [__`request`__ function](#requestresourcename-params--any) as an argument. This [__`request`__ function](#requestresourcename-params--any) is used to request __resources__ with. When the "callback" function returns, the __transaction__ ends. If a `Promise` is returned the __transaction__ will end after the promise has settled.

If the `allowTransactionAbort` option passed to [`createManager`](#createmanagerdispatcher-options--manager) was set to `false` (the default), an overlapping __transaction__ will result in an error to be thrown by this function. If the option was set to `true`, the previous __transaction__ will be aborted if they overlap. If an __transaction__ is aborted, the [__`request`__ function](#requestresourcename-params--any) will throw an error any time it is used.

##### request(resourceName, params) ⇒ any
| Argument                  | Type                     |                                                               |
| ------------------------- | ------------------------ | ------------------------------------------------------------- |
| resourceName              | string                   | A __resource name__ belonging to a previously registered [__Resource Definition__](#managerresourceoptions) |
| params                    | object \| Immutable.Map  | The __params__ to pass on to the [__`fetch`__ callback](#fetch-callback) |

__Return value__: The value returned by the [__`dispatcher`__ callback](#createmanagerdispatcher-options--manager) \
__Throws__: `MeridviaTransactionAborted` if the __transaction__ has been aborted (can only occur if `allowTransactionAbort` is `true`) \
__Throws__: `IllegalStateError` if the __transaction__ has been aborted \
__Throws__: `IllegalStateError` if the __transaction__ has ended \
__Throws__: `ValueError` if the given __resource name__ has not been registered \
__Throws__: Any thrown value from the [__`dispatcher`__ callback](#createmanagerdispatcher-options--manager)

Request a specific __resource__ and mark it as in-use for the [__`Session`__](#session-api). The __resource name__ must be belong to a registered [__Resource Definition__](#managerresourceoptions). The [__`Manager`__](#manager-api) will determine if the combination of __resource name__ and __params__ (a __resource__) has been requested previously and is allowed to be cached. 

If the __resource__ is not cached: the [__`fetch`__ callback](#fetch-callback) of the [__Resource Definition__](#managerresourceoptions) will be called, and the return value of this callback is passed to the [__`dispatcher`__ callback](#createmanagerdispatcher-options--manager) of the [__`Manager`__](#manager-api). The return value of the [__`dispatcher`__ callback](#createmanagerdispatcher-options--manager) is then returned from the [__`request`__ function](#requestresourcename-params--any). If the __resource__ is cached then the [__`request`__ function](#requestresourcename-params--any) will simply return the same value as it did the first time the __resource__ was requested.

Conceptually, the implementation of the [__`request`__ function](#requestresourcename-params--any) looks a bit like this:

```javascript
function request(resourceName, params) {
    const resourceDefinition = getResourceDefinition(resourceName);
    const resource = getResource(resourceName, params);

    if (resource.isCached()) {
        return resource.cachedValue;
    }
    else {
        return resource.cachedValue = dispatcher(resourceDefinition.fetch(params));
    }
}
```

Example of a __transaction__
```javascript
session(request => {
    request('post', {postId: 1});
    request('post', {postId: 2});
    request('comments', {postId: 2});
});
```

Example of a __transaction__ with promises
```javascript
async function example() {
    await session(async request => {
        const post = await request('post', {postId: 1});
        request('user', {userId: post.authorId});
    });
}

example().then(() => console.log('End of example'));
```

#### [session.destroy()](#sessiondestroy)
Destroy the session. All __resources__ that were marked as in-use for this [__`Session`__](#session-api) are unmarked as such. Attempting to use the [__`Session`__](#session-api) again will result in an error.

__Return value__: `undefined` \
__Throws__: No

--------------------------------------------------------------------------------

Example: React Lifecycle methods
--------------------------------
```javascript
/*
This example demonstrates how this library could be used to fetch and
display the details of a "user account" using redux and the react
lifecycle methods componentDidMount, componentWillUnmount and
componentDidUpdate.

This example includes:
* A fake API which pretends to fetch details of a user
  account using a http request
* A redux store which stores the user account details
* A reducer for the redux store that handles fetch and clear
  actions for the details of a specific user account
* A meridvia resource manager on which we register a resource for
  the user account details
* A react component which lets the resource manager know which
  resources it needs using a meridvia session.
* A react-redux container which passes the user details from the
  state store to the component.
* Some logging to demonstrate what is going on

This is a trivial example to demonstrate one way to integrate this
library with react and redux. It has been kept simple on purpose,
however the strength of this library becomes most apparent in more
complex code bases, for example: When the same resource is used in
multiple places in the code base; When resources should be cached;
When data has to be refreshed periodically; Et cetera.
*/

const {Component, createElement} = require('react');
const ReactDOM = require('react-dom');
const {createStore, combineReducers, applyMiddleware} = require('redux');
const {Provider: ReduxProvider, connect} = require('react-redux');
const {default: promiseMiddleware} = require('redux-promise');
const {createManager} = require('meridvia');

const myApi = {
    // Perform a http request to fetch the user details for the
    // given userId
    userDetails: async (userId) => {
        // This is where we would normally perform a real http
        // request. For example:
        //   const response = await fetch(`/user/${encodeURIComponent(userId)}`);
        //   if (!response.ok) {
        //     throw Error(`Request failed: ${response.status}`);
        //   }
        //   return await response.json();
        // however to keep this example simple, we only pretend.
        await new Promise(resolve => setTimeout(resolve, 10));
        if (userId === 4) {
            return {name: 'Jack O\'Neill', email: 'jack@example.com'};
        }
        else if (userId === 5) {
            return {name: 'Isaac Clarke', email: 'iclarke@unitology.gov'};
        }
        throw Error(`Unknown userId ${userId}`);
    },
};

// In the state store, userDetailsById contains the
// details of a user, indexed by the userId:
//   userDetailsById[userId] = {name: ..., email: ...}
const userDetailsByIdReducer = (state = {}, action) => {
    if (action.type === 'FETCH_USER_DETAILS') {
        // In this example we only store the resolved
        // value of the api call. However you could also
        // store an error message if the api call fails,
        // or an explicit flag to indicate an api call is
        // in progress.
        const newState = Object.assign({}, state);
        newState[action.userId] = action.result;
        return newState;
    }
    else if (action.type === 'CLEAR_USER_DETAILS') {
        // Completely remove the data from the state store.
        // `delete` must be used to avoid memory leaks.
        const newState = Object.assign({}, state);
        delete newState[action.userId];
        return newState;
    }
    return state;
};

// The reducer used by our redux store
const rootReducer = combineReducers({
    userDetailsById: userDetailsByIdReducer,
});

const setupResourceManager = (dispatch) => {
    // The resource manager will pass on the return value of `fetch`
    // and `clear` to the `dispatch` callback here
    const resourceManager = createManager(dispatch);

    resourceManager.resource({
        name: 'userDetails',
        fetch: async (params) => {
            // This function returns a promise. In this example
            // we are using the redux-promise middleware. Which
            // will resolve the promise before passing the action
            // on to our reducers.

            console.log('Resource userDetails: fetch', params);
            const {userId} = params;
            const result = await myApi.userDetails(userId);
            return {
                type: 'FETCH_USER_DETAILS',
                userId,
                result,
            };
        },
        clear: (params) => {
            console.log('Resource userDetails: clear', params);
            const {userId} = params;
            return {
                type: 'CLEAR_USER_DETAILS',
                userId,
            };
        },
    });

    return resourceManager;
};

class Hello extends Component {
    componentDidMount() {
        console.log('<Hello/> componentDidMount');
        // Component is now present in the DOM. Create a new
        // meridvia session which will represent the resources
        // in use by this component. The resource manager will
        // combine the state of all active sessions to make
        // its decisions.
        this.session = this.props.resourceManager.createSession();
        this.updateResources();
    }
    componentWillUnmount() {
        console.log('<Hello/> componentWillUnmount');
        // The component is going to be removed from the DOM.
        // Destroy the meridvia session to indicate that we
        // no longer need any resources. Attempting to use
        // the session again will result in an error.
        this.session.destroy();
    }
    componentDidUpdate() {
        console.log('<Hello/> componentDidUpdate');
        // The props have changed.
        // In this example the specific resource that we need is based
        // on the "userId" prop, so we have to update our meridvia
        // session
        this.updateResources();
    }

    updateResources() {
        this.session(request => {
            request('userDetails', {userId: this.props.userId});
        });
    }

    render() {
        const {user} = this.props;
        return createElement('div', {className: 'Hello'},
            user ? `Hello ${user.name}` : 'Loading...'
        );
        /* If you prefer JSX, this is what it would look like:
        return <div className="Hello">
            {user ? `Hello ${user.name}` : 'Loading...'}
        </div>
        */
    }
}
// A react-redux container component
const HelloContainer = connect((state, props) => ({
    user: state.userDetailsById[props.userId],
}))(Hello);


const example = () => {
    const store = createStore(rootReducer, applyMiddleware(promiseMiddleware));
    const resourceManager = setupResourceManager(store.dispatch);

    // Create the container element used by react:
    const container = document.createElement('div');
    document.body.appendChild(container);

    // create a DOM MutationObserver so that we can log
    // what the effects of the rendering are during this example
    const observer = new MutationObserver(() => {
        console.log('Render result:', container.innerHTML);
    });
    observer.observe(container, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
    });

    const renderMyApp = userId => {
        const element = createElement(ReduxProvider, {store},
            createElement(HelloContainer, {resourceManager, userId}, null)
        );
        /* If you prefer JSX, this is what it would look like:
        const element = <ReduxProvider store={store}>
            <HelloContainer resourceManager={resourceManager}, userId={userId} />
        </ReduxProvider>
        */
        ReactDOM.render(element, container);
    };

    console.log('First render...');
    renderMyApp(4);

    setTimeout(() => {
        console.log('Second render...');
        renderMyApp(5);
    }, 100);
};

example();
```

Output:

```
First render...
<Hello/> componentDidMount
Resource userDetails: fetch { userId: 4 }
Render result: <div class="Hello">Loading...</div>
<Hello/> componentDidUpdate
Render result: <div class="Hello">Hello Jack O'Neill</div>
Second render...
<Hello/> componentDidUpdate
Resource userDetails: fetch { userId: 5 }
Resource userDetails: clear { userId: 4 }
<Hello/> componentDidUpdate
Render result: <div class="Hello">Loading...</div>
<Hello/> componentDidUpdate
Render result: <div class="Hello">Hello Isaac Clarke</div>
```
