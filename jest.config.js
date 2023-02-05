'use strict';

module.exports = {
    collectCoverage: true,
    testEnvironment: 'node',
    testMatch:
        process.env.AOC_BOT_INTEGRATION_TESTS
            ? ['**/integration-tests/**/?(*.)+(spec|test).[jt]s?(x)']
            : ['**/unit-tests/**/?(*.)+(spec|test).[jt]s?(x)']
};
