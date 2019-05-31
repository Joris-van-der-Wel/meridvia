/* eslint-env node */
/* eslint no-console: off */
'use strict';
const fs = require('fs').promises;
const {JSDOM} = require('jsdom');
const nodePath = require('path');
const util = require('util');
const {Script} = require('vm');

const meridvia = require('..');

const getScript = async (path, iife = false) => {
    const fullPath = nodePath.resolve(path);
    const scriptSource = await fs.readFile(fullPath, 'utf8');
    const content = iife ? `(function(require) { 'use strict'; ${scriptSource}\n })(snippetRequire)` : scriptSource;
    return {
        script: new Script(content, {filename: fullPath}),
        scriptSource,
    };
};

const reactScript = getScript(require.resolve('react/umd/react.development.js'));
const reactDomScript = getScript(require.resolve('react-dom/umd/react-dom.development.js'));
const reduxScript = getScript(require.resolve('redux/dist/redux.js'));
const reactReduxScript = getScript(require.resolve('react-redux/dist/react-redux.js'));

const runSnippet = async name => {
    const fileName = name + '.js';
    const fullPath = nodePath.join(__dirname, 'snippets', fileName);
    const {script, scriptSource} = await getScript(fullPath, true);
    let output = '';

    const dom = new JSDOM('', {
        url: `file://${fullPath}`,
        runScripts: 'dangerously',
    });
    const {window} = dom;

    dom.runVMScript((await reactScript).script);
    dom.runVMScript((await reactDomScript).script);
    dom.runVMScript((await reduxScript).script);
    dom.runVMScript((await reactReduxScript).script);

    window.snippetRequire = name => {
        if (name === 'meridvia') {
            return meridvia;
        }
        else if (name === 'react') {
            return dom.window.React;
        }
        else if (name === 'react-dom') {
            return dom.window.ReactDOM;
        }
        else if (name === 'redux') {
            return dom.window.Redux;
        }
        else if (name === 'react-redux') {
            return dom.window.ReactRedux;
        }
        else {
            // note, this does not work for relative paths, however we are not using those at the moment:
            // eslint-disable-next-line global-require
            return require(name);
        }
    };

    let resolveCompletion;
    const completionPromise = new Promise(resolve => {
        resolveCompletion = resolve;
    });

    const log = (...args) => {
        console.log('SNIPPET:', ...args);
        if (args && args[0] === 'Hidden end of example') {
            resolveCompletion();
            return;
        }

        const message = util.format(...args);
        output += `${message}\n`;

        if (args && args[0] === 'End of example') {
            resolveCompletion();
        }
    };
    window.console = {
        log,
        warn: log,
        error: log,
        info: log,
        debug: log,
    };

    const returnValue = dom.runVMScript(script);
    await completionPromise;

    return {
        name,
        fullPath,
        scriptSource: scriptSource.replace(/\/\*\s*begin_hidden\s*\*\/[\s\S]*?\/\*\s*end_hidden\s*\*\//g, '').trim(),
        output: `${output.trim()}`,
        returnValue,
    };
};

module.exports = {runSnippet};

if (require.main === module) {
    runSnippet(process.argv[2]).then(result => {
        console.log('\nReturn value:', result.returnValue);
    })
    .catch(err => {
        console.error(err);
        process.exitCode = 1;
    });
}
