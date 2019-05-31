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
{{{snippets.require_line.scriptSource}}}
```

or

```javascript
import {createManager} from 'meridvia';
```


How it works
------------
There are a few important concepts: The {{{resourceDefinition}}} which defines the behaviour of each {{{resource}}}. And the {{{session}}} by which you can begin a {{{transaction}}}.

For each asynchronous source of data that you have, a {{{resourceDefinition}}} should be created. At the very least it contains a unique {{{resourceName}}}, a {{{fetchCallback}}} and a {{{clearCallback}}}. It is also possible to configure if and when the data is cached and refreshed. A {{{resource}}} is requested using its {{{resourceName}}} and an a key/value map of {{{resourceParams}}}. These {{{resourceParams}}} can be represented using a plain javascript object, or as an [Immutable Map](https://immutable-js.github.io/immutable-js/) and are passed to the {{{fetchCallback}}} and the {{{clearCallback}}}. 

Each unique combination of {{{resourceName}}} and {{{resourceParams}}} is considered to be one specific {{{resource}}}. For example if you call the {{{requestFunction}}} multiple times with the same {{{resourceName}}} and {{{resourceParams}}}, the {{{fetchCallback}}} will only be called once. If a plain javascript object is passed as the {{{resourceParams}}}, it is compared to the {{{resourceParams}}} of other {{{resources}}} using a shallow equality check.

A {{{session}}} is used to manage which {{{resources}}} are in use. For each place in your codebase where you would normally perform an API call, a {{{session}}} should be created instead. A {{{session}}} object lets you start and end a {{{transaction}}}. 

The only time that a {{{resource}}} can be requested is between the start and end of such a {{{transaction}}}. When requesting data the {{{session}}} will figure out if any existing data can be re-used, if not the {{{fetchCallback}}} is called. 

When a  {{{transaction}}} ends, the session will compare all the {{{resources}}} that have been requested to the requested {{{resources}}} of the previous {{{transaction}}}. For all {{{resources}}} that are no longer in use, the {{{clearCallback}}} is called. This callback will not occur immediately if caching has been configured.

An example to demonstrate these concepts:

```javascript
{{{snippets.console_log.scriptSource}}}
```

Output:

```
{{{snippets.console_log.output}}}
```

--------------------------------------------------------------------------------

API Reference
-------------

### Top-Level Exports
* {{{exportCreateManager}}}

#### {{{exportCreateManager}}}
Create a new {{{manager}}} instance. See [Manager API](#manager-api)

| Argument                      | Type      | Default  |                                                               |
| ----------------------------- | ----------| -------- | ------------------------------------------------------------- |
| dispatcher                    | function  | `x => x` | The {{{dispatcherCallback}}}. This function will be called with the return value of any {{{fetchCallback}}} and any {{{clearCallback}}} |
| options.allowTransactionAbort | boolean   | `false`  | If `false`, overlapping transactions are not allowed. If `true` an overlapping {{{transaction}}} for a {{{session}}} will cause the previous {{{transaction}}} to be aborted. |

__Return value__: A new {{{manager}}} instance

```javascript
{{{snippets.create_manager.scriptSource}}}
```

--------------------------------------------------------------------------------

### Manager API
* {{{manager}}}
  * {{{managerResourceFunc}}}
  * {{{managerResourcesFunc}}}
  * {{{managerCreateSessionFunc}}}
  * {{{managerInvalidateFunc}}}
  * {{{managerRefreshFunc}}}
  * {{{managerDestroyFunc}}}

#### Manager

#### {{{managerResourceFunc}}}
| Argument                  | Type                      | Default      |                                                               |
| ------------------------- | ------------------------- | ------------ | ------------------------------------------------------------- |
| options.name              | string                    | __required__ | A unique {{{resourceName}}} for this {{{resource}}}. The same name can later be used to request this {{{resource}}}. |
| options.fetch             | function(params, options) | __required__ | The {{{fetchCallback}}} for this {{{resource}}}. Called whenever the asynchronous data should be retrieved. |
| options.clear             | function(params, options) | __required__ | The {{{clearCallback}}} for this {{{resource}}}. Called whenever asynchronous data that has been previously retrieved, is no longer in use. |
| options.initStorage       | function(params)          | () => ({})   | Called the first time a {{{resource}}} is fetched, the return value is available to the other actions of the same {{{resource}}}. |
| options.maximumStaleness  | {{{timeInterval}}}          | 0            | The maximum amount of time that the data of a fetched {{{resource}}} may be reused in a future {{{transaction}}}. A value of 0 means forever/infinite. |
| options.cacheMaxAge       | {{{timeInterval}}}          | 0            | The maximum amount of time that the data of a fetched {{{resource}}} may be cached if no {{{session}}} is using the {{{resource}}}. A value of 0 disables caching. |
| options.refreshInterval   | {{{timeInterval}}}          | 0            | How often to fetch the {{{resource}}} again, as long as there is a {{{session}}} using this {{{resource}}}. A value of 0 disables refreshing. |

__Return value__: `undefined` \
__Throws__: {{{IllegalStateError}}} if the {{{manager}}} has been destroyed \
__Throws__: {{{TypeError}}} if the any of the options has an invalid type \
__Throws__: {{{ValueError}}} if the given {{{resourceName}}} is already in use

Register a {{{resourceDefinition}}} with the given `options`. Each {{{resourceDefinition}}} is identified by its unique {{{resourceName}}} (`options.name`), the {{{resource}}} can be requested using this {{{resourceName}}} during a {{{transaction}}} using the {{{requestFunction}}}. The other options define the behaviour of the {{{resource}}}.

The `options.maximumStaleness` and `options.cacheMaxAge` values have very similar effects. They both define for how long the asynchronous data retrieved by the {{{fetchCallback}}} may be reused by a future {{{transaction}}}. The difference is that if `options.cacheMaxAge` is not set, the {{{resource}}} is always cleared if it is no longer in use by any {{{session}}}. If `options.cacheMaxAge` is set, the data may be reused even if there was a moment where the {{{resource}}} was not in use by any {{{session}}}.

If `options.refreshInterval` is set, the {{{fetchCallback}}} is called again periodically to refresh the data, but only if the {{{resource}}} is currently in use by a {{{session}}}.

##### "fetch" callback
| Argument                  | Type                    |                                                                |
| ------------------------- | ----------------------- | -------------------------------------------------------------- |
| params                    | object \| Immutable.Map | The {{{resourceParams}}} that were passed to the {{{requestFunction}}} during the {{{transaction}}}. |
| options.storage           | any                     | The value that was previously returned by the "initStorage"  callback. |
| options.invalidate        | function()              | May be called at any time to indicate that the data from this specific fetch should no longer be cached in any way. |
| options.onCancel          | function(callback)      | May be called to register a cancellation callback.             |

__Return value__: `object | Promise`

The {{{fetchCallback}}} function is called whenever the asynchronous data should be retrieved, either for the first time or to refresh existing data. For example, this is where you would perform an HTTP request. As its first argument the callback receives the {{{resourceParams}}} that were given during the {{{transaction}}}. The second argument is an `options` object containing optional utilities.

The `options.invalidate()` function may be called at any time to indicate that the data from this specific fetch should no longer be cached in any way. If a {{{transaction}}} requests this {{{resource}}} again it will always result in the {{{fetchCallback}}} being called again. This can be used to implement more advanced caching strategies

The `options.onCancel(callback)` function maybe called to register a cancellation callback. When a {{{resource}}} is no longer in use, or if a {{{fetchCallback}}} is superseded by a more recent {{{fetchCallback}}}, all cancellation callbacks will be called. This can be used for example to cancel a http request. 

The return value of the {{{fetchCallback}}} is passed to the {{{dispatcherCallback}}} of the {{{manager}}}. This allows for easy integration with state store frameworks such as redux.

##### "clear" callback
| Argument                  | Type                    |                                                                |
| ------------------------- | ----------------------- | -------------------------------------------------------------- |
| params                    | object \| Immutable.Map | The {{{resourceParams}}} that were passed to the {{{requestFunction}}} during the {{{transaction}}}. |
| options.storage           | any                     | The value that was previously returned by the "initStorage"  callback |

__Return value__: `object | Promise`

The {{{clearCallback}}} callback function is called whenever asynchronous data that has been previously retrieved, is no longer in use. 

When integration with a state store framework such as redux, this is where an action should be dispatched that causes the asynchronous data to be removed from the store.

The return value of the {{{clearCallback}}} is passed to the {{{dispatcherCallback}}} of the {{{manager}}}. 

##### "initStorage" callback
| Argument                  | Type                    |                                                               |
| ------------------------- | ----------------------- | ------------------------------------------------------------- |
| params                    | object \| Immutable.Map | The {{{resourceParams}}} that were given during the {{{transaction}}}. |

__Return value__: any

This callback function is called the first time a {{{resource}}} is fetched (for the specific combination of {{{resourceName}}} and {{{resourceParams}}}). The return value is passed to any subsequent {{{fetchCallback}}} and {{{clearCallback}}}. This feature is useful if you need to keep track of some sort of state between (re-)fetching and clearing the same {{{resource}}}. 

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
{{{snippets.resource_minimal.scriptSource}}}
```

A more exhaustive example:
```javascript
{{{snippets.resource_exhaustive.scriptSource}}}
```

#### {{{managerResourcesFunc}}}
This function is a simple shorthand that lets you register multiple {{{resources}}} in a single call. It accepts an array for which every item is registered as a {{{resource}}} in exactly the same way as {{{managerResourceFunc}}}.

__Return value__: `undefined` \
__Throws__: See {{{managerResourceFunc}}}

Example:
```javascript
{{{snippets.resources.scriptSource}}}
```

#### {{{managerCreateSessionFunc}}}
Creates a new {{{session}}} object, which is used to manage which {{{resources}}} are actually in use. See {{{sessionApi}}}.

__Return value__: {{{session}}} object \
__Throws__: {{{IllegalStateError}}} if the {{{manager}}} has been destroyed

#### {{{managerInvalidateFunc}}}
| Argument                  | Type                     |                                                               |
| ------------------------- | ------------------------ | ------------------------------------------------------------- |
| resourceName              | string                   | The {{{resourceName}}} that was previously given to the {{{requestFunction}}}. |
| params                    | object \| Immutable.Map  | The {{{resourceParams}}} that was previously given to the {{{requestFunction}}}. |

__Return value__: `number` : The number of resources that have actually been invalidated \
__Throws__: No

Invalidate all matching {{{resources}}}. If a matching {{{resource}}} is currently in-use by a {{{session}}}, the next time the {{{resource}}} is requested the {{{fetchCallback}}} will be called again. If a matching {{{resource}}} is not currently in-use by any {{{session}}} the {{{clearCallback}}} will be called immediately.

If 0 arguments are passed to this function, all {{{resources}}} will be invalidated. If 1 argument is passed, all resources with the given {{{resourceName}}} are invalidated. If 2 arguments are passed, only one specific resource is invalidated.

#### {{{managerRefreshFunc}}}
| Argument                  | Type                     |                                                               |
| ------------------------- | ------------------------ | ------------------------------------------------------------- |
| resourceName              | string                   | The {{{resourceName}}} that was previously given to the {{{requestFunction}}}. |
| params                    | object \| Immutable.Map  | The {{{resourceParams}}} that was previously given to the {{{requestFunction}}}. |

__Return value__: `number` \
__Throws__: {{{IllegalStateError}}} if the {{{manager}}} has been destroyed \
__Throws__: {{{CompositeError}}} containing further errors in the "errors" property, if the {{{dispatcherCallback}}} has thrown for any {{{resource}}}.

Refresh all matching {{{resources}}}. If a matching {{{resource}}} is currently in-use by a {{{session}}}, the {{{fetchCallback}}} is immediately called again. If a matching {{{resource}}} is not currently in-use by any {{{session}}} the {{{clearCallback}}} will be called immediately.

If 0 arguments are passed to this function, all {{{resources}}} will be refreshed. If 1 argument is passed, all resources with the given {{{resourceName}}} are refreshed. If 2 arguments are passed, only one specific resource is refreshed.

#### {{{managerDestroyFunc}}}
__Return value__: `undefined` \
__Throws__: No

Destroy the {{{manager}}} instance. All {{{resources}}} are cleared, all sessions are destroyed and the {{{manager}}} is no longer allowed to be used.

--------------------------------------------------------------------------------

### Session API
A {{{session}}} object is used to request {{{resources}}} from the {{{manager}}}. If multiple {{{session}}} objects request the same {{{resources}}}, the {{{manager}}} will make sure that the same {{{resource}}} is only fetched once. The {{{session}}} object will remember which {{{resources}}} you are currently using. A {{{resource}}} that is in-use will never be cleared.

A {{{transaction}}} is used to change which {{{resources}}} are in-use by a {{{session}}}. Such a {{{transaction}}} has an explicit beginning and end. A {{{transaction}}} from the same {{{session}}} object is not allowed to overlap with a different {{{transaction}}} that is still active. While the {{{transaction}}} is active a {{{requestFunction}}} is available which should be called to request a specific {{{resource}}}. Doing so marks a specific {{{resource}}} as being in-use in the {{{session}}}. When the {{{transaction}}} ends, all of the requested {{{resources}}} are compared to those requested in the previous {{{transaction}}}, the {{{resources}}} that have not been requested again are then no longer marked as in-use.

* {{{sessionObjectFunc}}}
  * {{{sessionDestroyFunc}}}

#### {{{sessionObjectFunc}}}
| Argument                  | Type                  |                                                               |
| ------------------------- | --------------------- | ------------------------------------------------------------- |
| callback                  | function(request)     | The callback function that determines the lifetime of the {{{transaction}}}. The {{{requestFunction}}} is passed as the first argument to this callback. |

__Return value__: Same as the return value of the called "callback" \
__Throws__: {{{TypeError}}} if callback is not a function \
__Throws__: {{{IllegalStateError}}} if the {{{session}}} has been destroyed \
__Throws__: {{{IllegalStateError}}} if another {{{transaction}}} is still in progress (can only occur if `allowTransactionAbort` is `false`) \
__Throws__: Any thrown value from the called callback function

By calling the {{{session}}} object as a function, a new {{{transaction}}} begins. The given "callback" argument is then immediately called, with the {{{requestFunction}}} as an argument. This {{{requestFunction}}} is used to request {{{resources}}} with. When the "callback" function returns, the {{{transaction}}} ends. If a `Promise` is returned the {{{transaction}}} will end after the promise has settled.

If the `allowTransactionAbort` option passed to {{{createManager}}} was set to `false` (the default), an overlapping {{{transaction}}} will result in an error to be thrown by this function. If the option was set to `true`, the previous {{{transaction}}} will be aborted if they overlap. If an {{{transaction}}} is aborted, the {{{requestFunction}}} will throw an error any time it is used.

##### request(resourceName, params) ⇒ any
| Argument                  | Type                     |                                                               |
| ------------------------- | ------------------------ | ------------------------------------------------------------- |
| resourceName              | string                   | A {{{resourceName}}} belonging to a previously registered {{{resourceDefinition}}} |
| params                    | object \| Immutable.Map  | The {{{resourceParams}}} to pass on to the {{{fetchCallback}}} |

__Return value__: The value returned by the {{{dispatcherCallback}}} \
__Throws__: `MeridviaTransactionAborted` if the {{{transaction}}} has been aborted (can only occur if `allowTransactionAbort` is `true`) \
__Throws__: {{{IllegalStateError}}} if the {{{transaction}}} has been aborted \
__Throws__: {{{IllegalStateError}}} if the {{{transaction}}} has ended \
__Throws__: {{{ValueError}}} if the given {{{resourceName}}} has not been registered \
__Throws__: Any thrown value from the {{{dispatcherCallback}}}

Request a specific {{{resource}}} and mark it as in-use for the {{{session}}}. The {{{resourceName}}} must be belong to a registered {{{resourceDefinition}}}. The {{{manager}}} will determine if the combination of {{{resourceName}}} and {{{resourceParams}}} (a {{{resource}}}) has been requested previously and is allowed to be cached. 

If the {{{resource}}} is not cached: the {{{fetchCallback}}} of the {{{resourceDefinition}}} will be called, and the return value of this callback is passed to the {{{dispatcherCallback}}} of the {{{manager}}}. The return value of the {{{dispatcherCallback}}} is then returned from the {{{requestFunction}}}. If the {{{resource}}} is cached then the {{{requestFunction}}} will simply return the same value as it did the first time the {{{resource}}} was requested.

Conceptually, the implementation of the {{{requestFunction}}} looks a bit like this:

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

Example of a {{{transaction}}}
```javascript
{{{snippets.session_transaction.scriptSource}}}
```

Example of a {{{transaction}}} with promises
```javascript
{{{snippets.session_transaction_promise.scriptSource}}}
```

#### {{{sessionDestroyFunc}}}
Destroy the session. All {{{resources}}} that were marked as in-use for this {{{session}}} are unmarked as such. Attempting to use the {{{session}}} again will result in an error.

__Return value__: `undefined` \
__Throws__: No

--------------------------------------------------------------------------------

Example: React Lifecycle methods
--------------------------------
```javascript
{{{snippets.react.scriptSource}}}
```

Output:

```
{{{snippets.react.output}}}
```
