import { defineConfig } from "vite";

/**
 * SP-029 M6-FIX — code-splitting vendor: pecah node_modules + workspace
 * packages (@smart/* di /srv/packages) menjadi chunk terpisah agar:
 *   - bundle entry (index) mengecil drastis
 *   - tiap vendor chunk jarang berubah → cache immutable nginx (1 tahun)
 *     efektif: deploy baru hanya mengunduh ulang chunk app yang kecil.
 */
function vendorChunks(id) {
    // Workspace packages ter-resolve ke /srv/packages/... (bukan node_modules)
    if (id.includes("/packages/")) {
        if (id.includes("/smart-core/")) return "vendor-core";
        if (id.includes("/smart-ui/")) return "vendor-ui";
        if (id.includes("/smart-api/") || id.includes("/smart-data/")) return "vendor-smart";
        return "vendor-pkg";
    }
    if (!id.includes("node_modules")) return;
    if (id.includes("html5-qrcode") || id.includes("jsqr") || id.includes("qrcode")) return "vendor-scan";
    return "vendor";
}

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
        outDir: "dist",
        rolldownOptions: {
            output: {
                manualChunks: vendorChunks
            }
        }
    }
});
