import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';

export default [
    js.configs.recommended,

    {
        files: ['unit-tests/**'],
        plugins: { vitest },
        rules: vitest.configs.recommended.rules
    },

    {
        languageOptions: {
            ecmaVersion: 2025,
            globals: { ...globals.nodeBuiltin, ...globals.es2025 }
        },

        rules: {
            'comma-dangle': 'error',
            'indent': ['error', 4],
            'max-len': ['error', 120, { ignoreStrings: true, ignoreTemplateLiterals: true }],
            'no-constant-condition': ['error', { checkLoops: false }],
            'no-multi-spaces': ['error', { ignoreEOLComments: true }],
            'no-multiple-empty-lines': 'error',
            'no-shadow': 'error',
            'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
            'object-curly-spacing': ['error', 'always'],
            'quotes': ['error', 'single', { avoidEscape: true }],
            'semi': 'error',
            'strict': 'error'
        }
    }
];
