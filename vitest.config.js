import { defineConfig } from "vitest/config";


export default defineConfig({

    test: {

        // Use jsdom for DOM-dependent tests
        environment: "jsdom",

        // Include test files matching these patterns
        include: [
            "packages/*/__tests__/**/*.test.js",
            "packages/*/src/**/*.test.js",
            "apps/*/server/**/*.test.js"
        ],

        // Exclude node_modules and dist
        exclude: [
            "**/node_modules/**",
            "**/dist/**"
        ],

        // Global test utilities
        globals: true,

        // Coverage configuration
        coverage: {
            provider: "v8",
            include: [
                "packages/*/src/**/*.js"
            ],
            exclude: [
                "**/node_modules/**",
                "**/dist/**"
            ]
        }

    }

});
