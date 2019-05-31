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
