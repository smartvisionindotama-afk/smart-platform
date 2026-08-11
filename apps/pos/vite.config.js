import { defineConfig } from "vite";

export default defineConfig({
    server: {
        port: 5175,
        host: true, // Allow access via network IP (e.g. 101.50.2.10)
        allowedHosts: [
            'pos.e-profit.id',
            '.e-profit.id' // Allow all subdomains of e-profit.id
        ],
        proxy: {
            "/api": {
                target: "http://localhost:3003",
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: "dist"
    }
});
