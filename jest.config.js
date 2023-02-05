'use strict';

const isIt = process.env.AOC_BOT_INTEGRATION_TESTS ? true : false;

module.exports = {
    collectCoverage: !isIt,
    testEnvironment: 'node',
    testMatch:
        isIt ? ['**/integration-tests/**/?(*.)+(spec|test).[jt]s?(x)']
            : ['**/unit-tests/**/?(*.)+(spec|test).[jt]s?(x)']
};
