import globals from "globals";

export default [
    {
        files: ["src/**/*.js"],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "commonjs",
            globals: {
                ...globals.node,
            },
        },
        rules: {
            "no-console": "warn",
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-undef": "error",
            "eqeqeq": ["error", "always"],
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-new-func": "error",
            "prefer-const": "warn",
            "no-var": "warn",
            "no-throw-literal": "error",
            "no-return-await": "warn",
            "require-await": "warn",
        },
    },
    {
        ignores: [
            "node_modules/",
            "src/ui/**/node_modules/",
            "data/",
            "coverage/",
            ".bfg-report/",
        ],
    },
];
