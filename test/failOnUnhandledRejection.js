/* eslint-env node */
/* eslint-disable no-console */
'use strict';

let registered = false;

const registerListener = () => {
    if (registered) {
        return;
    }

    let overridingExitCode = false;

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection:', reason);

        if (!overridingExitCode) {
            // override mocha exit code

            overridingExitCode = true;
            process.on('exit', exitCode => {
                if (exitCode === 0) {
                    console.error('\nTest failed because of an unhandled rejection:', reason);
                    process.exit(1);
                }
            });
        }
    });

    registered = true;
};

module.exports = registerListener;
