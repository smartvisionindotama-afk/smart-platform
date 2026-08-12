// SMART Platform — Shared ESLint Configuration
// Flat config format (ESLint >= 9)
//
// Usage in app/package.json:
//   "eslintConfig": { "extends": ["@smart/config/eslint"] }

import globals from "globals";

const config = [
    {
        rules: {

            // Possible Problems
            "no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_" }
            ],
            "no-undef": "error",
            "no-duplicate-imports": "warn",

            // Suggestions
            "no-console": "off",
            "prefer-const": "warn",
            "no-var": "error",
            "eqeqeq": ["warn", "always"],
            "curly": ["warn", "multi-line"],
            "no-unused-expressions": "warn",

            // ES6+
            "arrow-body-style": ["warn", "as-needed"],
            "prefer-arrow-callback": "warn",
            "template-curly-spacing": ["warn", "never"]

        },

        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                google: "readonly"
            }
        }
    }
];

export default config;
