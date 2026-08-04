import { defineConfig } from "vite";

export default defineConfig({
    server: {
        port: 5174,
        host: true, // Allow access via network IP
        allowedHosts: [
            'master.e-profit.id',
            '.e-profit.id' // Allow all subdomains of e-profit.id
        ],
        proxy: {
            "/api": {
                target: "http://localhost:3001",
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: "dist"
    }
});
