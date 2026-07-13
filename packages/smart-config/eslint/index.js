// SMART Platform — Shared ESLint Configuration
// Flat config format (ESLint >= 9)
//
// Usage in app/package.json:
//   "eslintConfig": { "extends": ["@smart/config/eslint"] }

const config = [
    {
        rules: {
            // Possible Problems
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-undef": "error",
            "no-duplicate-imports": "warn",

            // Suggestions
            "no-console": "off", // Allow console for now
            "prefer-const": "warn",
            "no-var": "error",
            "eqeqeq": ["warn", "always"],
            "curly": ["warn", "multi-line"],
            "no-unused-expressions": "warn",

            // ES6+
            "arrow-body-style": ["warn", "as-needed"],
            "prefer-arrow-callback": "warn",
            "template-curly-spacing": ["warn", "never"],

            // Import
            "import/no-unresolved": "warn",
            "import/no-duplicates": "warn",
        },

        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                // Browser globals
                window: "readonly",
                document: "readonly",
                console: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                fetch: "readonly",
                localStorage: "readonly",
                sessionStorage: "readonly",
                URL: "readonly",
                IntersectionObserver: "readonly",
            },
        },
    },
];

export default config;
