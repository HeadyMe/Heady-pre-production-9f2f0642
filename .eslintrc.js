/**
 * HeadySystems™ ESLint Configuration
 * Enforces strict code quality standards across the monorepo.
 *
 * Rules target:
 *  - Consistent formatting (no-tabs, 2-space indent)
 *  - Error prevention (no-unused-vars, no-undef, strict equality)
 *  - Security (no-eval, no-implied-eval, no-new-func)
 *  - Documentation (valid-jsdoc-like via consistent comments)
 *  - Complexity limits (max cyclomatic = 15, max depth = 4)
 */

module.exports = {
    root: true,
    env: {
        node: true,
        es2022: true,
        jest: true,
    },
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    extends: ['eslint:recommended'],
    rules: {
        // ─── Errors ───────────────────────────────────────────────
        'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-undef': 'error',
        'no-unreachable': 'error',
        'no-constant-condition': 'error',
        'no-dupe-args': 'error',
        'no-dupe-keys': 'error',
        'no-duplicate-case': 'error',
        'no-empty': ['error', { allowEmptyCatch: true }],
        'no-extra-semi': 'error',
        'no-irregular-whitespace': 'error',

        // ─── Best Practices ──────────────────────────────────────
        'eqeqeq': ['error', 'always'],
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-return-await': 'warn',
        'no-self-compare': 'error',
        'no-throw-literal': 'error',
        'no-useless-catch': 'error',
        'prefer-promise-reject-errors': 'error',
        'require-await': 'warn',
        'curly': ['error', 'multi-line'],
        'default-case': 'warn',
        'no-fallthrough': 'error',

        // ─── Strict Mode ─────────────────────────────────────────
        'strict': ['error', 'safe'],

        // ─── Style ───────────────────────────────────────────────
        'indent': ['warn', 2, { SwitchCase: 1 }],
        'quotes': ['warn', 'single', { avoidEscape: true }],
        'semi': ['error', 'always'],
        'no-tabs': 'error',
        'no-trailing-spaces': 'warn',
        'eol-last': ['warn', 'always'],
        'comma-dangle': ['warn', 'always-multiline'],
        'no-multiple-empty-lines': ['warn', { max: 2 }],

        // ─── Complexity ──────────────────────────────────────────
        'complexity': ['warn', { max: 15 }],
        'max-depth': ['warn', { max: 4 }],
        'max-lines-per-function': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
        'max-params': ['warn', { max: 5 }],

        // ─── Security ────────────────────────────────────────────
        'no-new-wrappers': 'error',
        'no-octal': 'error',
        'no-with': 'error',
    },
    overrides: [
        {
            files: ['tests/**', '**/*.test.js', '**/*.spec.js'],
            rules: {
                'max-lines-per-function': 'off',
                'complexity': 'off',
            },
        },
        {
            files: ['bin/**'],
            rules: {
                'no-process-exit': 'off',
            },
        },
    ],
    ignorePatterns: [
        'node_modules/',
        '_archive/',
        'dist/',
        'coverage/',
        '*.d.ts',
        '*.d.ts.map',
    ],
};
