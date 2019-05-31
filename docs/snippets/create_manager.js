const {createManager} = require('meridvia');

const manager = createManager();
/* begin_hidden */
if (typeof manager !== 'object') {
    throw Error('manager is not an object');
}
console.log('End of example');
/* end_hidden */
