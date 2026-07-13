// SMART Platform — Shared Vite Configuration
//
// Usage in app/vite.config.js:
//   import { defineConfig } from "vite";
//   import smartVite from "@smart/config/vite";
//   export default defineConfig({
//       ...smartVite,
//       // app-specific overrides
//   });

import { defineConfig } from "vite";

export default defineConfig({
    // Base build configuration
    build: {
        target: "es2020",
        sourcemap: false,
        minify: "esbuild",
        cssMinify: true,
    },

    // Development server
    server: {
        port: 3000,
        open: false,
    },

    // CSS handling
    css: {
        devSourcemap: true,
    },

    // ESBuild options
    esbuild: {
        target: "es2020",
        legalComments: "none",
    },
});
