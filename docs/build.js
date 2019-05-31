/* eslint-env node */
/* eslint no-console: off */
'use strict';
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');

const {runSnippet} = require('./runSnippet');

const snippetsDirectory = path.join(__dirname, 'snippets');

const TERMS = Object.freeze({
    resourceDefinition: '[__Resource Definition__](#managerresourceoptions)',
    resource: '__resource__',
    resources: '__resources__',
    session: '[__`Session`__](#session-api)',
    manager: '[__`Manager`__](#manager-api)',
    transaction: '__transaction__',
    resourceName: '__resource name__',
    resourceParams: '__params__',
    fetchCallback: '[__`fetch`__ callback](#fetch-callback)',
    clearCallback: '[__`clear`__ callback](#clear-callback)',
    dispatcherCallback: '[__`dispatcher`__ callback](#createmanagerdispatcher-options--manager)',
    requestFunction: '[__`request`__ function](#requestresourcename-params--any)',
    timeInterval: '[Time interval](#time-interval-values)',
    IllegalStateError: '`IllegalStateError`',
    TypeError: '`TypeError`',
    ValueError: '`ValueError`',
    CompositeError: '`CompositeError`',
    sessionApi: '[Session API](#session-api)',
    createManager: '[`createManager`](#createmanagerdispatcher-options--manager)',
    exportCreateManager: '[`createManager([dispatcher], [options]) ⇒ Manager`](#createmanagerdispatcher-options--manager)',
    managerResourceFunc: '[`manager.resource(options)`](#managerresourceoptions)',
    managerResourcesFunc: '[`manager.resources(options)`](#managerresourcesoptions)',
    managerCreateSessionFunc: '[`manager.createSession()` ⇒ `Session`](#managercreatesession--session)',
    managerInvalidateFunc: '[`manager.invalidate([resourceName], [params]) ⇒ number`](#managerinvalidateresourcename-params--number)',
    managerRefreshFunc: '[`manager.refresh([resourceName], [params]) ⇒ number`](#managerrefreshresourcename-params--number)',
    managerDestroyFunc: '[`manager.destroy()`](#managerdestroy)',
    sessionObjectFunc: '[session(callback) ⇒ any](#sessioncallback--any)',
    sessionDestroyFunc: '[session.destroy()](#sessiondestroy)',
});

const getAllSnippetNames = async () => {
    const files = await fs.readdir(snippetsDirectory);

    const result = [];
    for (const fileName of files) {
        const nameMatch = /^([\w_]+)\.js$/.exec(fileName);
        if (!nameMatch) {
            continue;
        }

        result.push(nameMatch[1]);
    }
    return result;
};

const runAllSnippets = async () => {
    const names = await getAllSnippetNames();

    const result = {};
    for (const name of names) {
        result[name] = await runSnippet(name);
    }
    return result;
};

const makeFile = async (inputPath, outputPath) => {
    const input = await fs.readFile(inputPath, 'utf8');
    const template = handlebars.compile(input);
    const context = Object.assign({
        snippets: await runAllSnippets(),
    }, TERMS);
    const output = template(context);
    await fs.writeFile(outputPath, output);
};

makeFile(
    path.resolve(__dirname, 'README.md'),
    path.resolve(__dirname, '..', 'README.md')
)
.catch(err => {
    console.error('\nFailed to build the README!', err);
    process.exitCode = 1;
});
