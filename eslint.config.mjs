import js from '@eslint/js';
import jest from 'eslint-plugin-jest';
import globals from 'globals';

export default [
    js.configs.recommended,
    jest.configs['flat/recommended'],

    {
        files: ['**/*.js'],
        languageOptions: {
            sourceType: 'commonjs'
        }
    },

    {
        languageOptions: {
            ecmaVersion: 2024,
            globals: { ...globals.node, ...globals.commonjs, ...globals.es2024 }
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
