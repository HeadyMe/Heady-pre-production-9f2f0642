module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:mozilla/recommended'
    ],
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: [
        'react',
        'mozilla'
    ],
    rules: {
        // 🧹 HeadyMaid Strict Directives
        'mozilla/no-unsanitized': 'error', // Prevent XSS DOM manipulation
        'no-unused-vars': 'warn',
        'no-unhandled-promise-rejections': 'error', // Catch async leaks
        'require-await': 'error'
    },
};
