import { defineConfig } from "vite";

/**
 * SP-029 M6-FIX — code-splitting vendor: pecah node_modules + workspace
 * packages (@smart/* di /srv/packages) menjadi chunk terpisah agar:
 *   - bundle entry (index) mengecil drastis (1MB+ → ~260KB)
 *   - tiap vendor chunk jarang berubah → cache immutable nginx (1 tahun)
 *     efektif: deploy baru hanya mengunduh ulang chunk app yang kecil.
 */
function vendorChunks(id) {
    // Workspace packages ter-resolve ke /srv/packages/... (bukan node_modules)
    if (id.includes("/packages/")) {
        if (id.includes("/smart-core/")) return "vendor-core";
        if (id.includes("/smart-ui/")) return "vendor-ui";
        if (id.includes("/smart-inventory-ui/")) return "vendor-inv-ui";
        if (id.includes("/smart-api/") || id.includes("/smart-data/")) return "vendor-smart";
        return "vendor-pkg";
    }
    if (!id.includes("node_modules")) return;
    // Lib QR/scanner (html5-qrcode, jsqr, qrcode) dipisah — hanya dipakai
    // halaman tertentu, cache-nya stabil antar deploy.
    if (id.includes("html5-qrcode") || id.includes("jsqr") || id.includes("qrcode")) return "vendor-scan";
    return "vendor";
}

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
        outDir: "dist",
        rolldownOptions: {
            output: {
                manualChunks: vendorChunks
            }
        }
    }
});
