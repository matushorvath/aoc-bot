import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
    // When run with --mode integration-tests
    if (mode === 'integration-tests') {
        return {
            test: {
                ...configDefaults,
                include: ['./integration-tests/*.test.js'],

                hookTimeout: 90_000,
                testTimeout: 90_000
            }
        };
    }

    // Default for unit tests
    return {
        test: {
            ...configDefaults,
            include: ['./unit-tests/*.test.js'],

            coverage: {
                enabled: true,
                reporter: ['text', 'html', 'json-summary', 'json']
            }
        }
    };
});
