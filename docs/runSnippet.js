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
    const script = new Script(content, {filename: fullPath});

    return {
        script,
        scriptSource,
    };
};

const nodeModulesPath = nodePath.resolve(__dirname, '..', 'node_modules');
const reactScript = getScript(nodePath.resolve(nodeModulesPath, 'react', 'umd', 'react.development.js'));
const reactDomScript = getScript(nodePath.resolve(nodeModulesPath, 'react-dom', 'umd/react-dom.development.js'));
const reduxScript = getScript(nodePath.resolve(nodeModulesPath, 'redux', 'dist', 'redux.js'));
const reactReduxScript = getScript(nodePath.resolve(nodeModulesPath, 'react-redux', 'dist', 'react-redux.js'));

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
    const vmContext = dom.getInternalVMContext();

    (await reactScript).script.runInContext(vmContext);
    (await reactDomScript).script.runInContext(vmContext);
    (await reduxScript).script.runInContext(vmContext);
    (await reactReduxScript).script.runInContext(vmContext);

    window.snippetRequire = name => {
        if (name === 'meridvia') {
            return meridvia;
        }
        else if (name === 'react') {
            return dom.window.React;
        }
        else if (name === 'react-dom/client') {
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

    const returnValue = script.runInContext(vmContext);

    try {
        await completionPromise;
    }
    catch (err) {
        throw err;
    }

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
