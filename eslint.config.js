// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: eslint.config.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// ESLint configuration for Heady ecosystem
const tsEslint = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tsEslint
    },
    rules: {
      ...tsEslint.configs.recommended.rules,
      // Additional TypeScript rules
    }
  },
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value="localhost"], Literal[value="127.0.0.1"]',
          message: 'Use internal.headyio.com or api.headyio.com instead of localhost/127.0.0.1'
        }
      ]
    }
  },
  {
    ignores: [
      "!.*",
      "dist",
      "node_modules"
    ]
  }
];
