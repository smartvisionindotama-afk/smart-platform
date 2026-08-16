/* Generate PWA icons for apps/pos (bell on green rounded square). */
const fs = require("fs");
const path = require("path");
const { PNG } = require("/srv/node_modules/pngjs");

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function drawIcon(size, outPath) {
    const png = new PNG({ width: size, height: size });
    const radius = size * 0.22;
    const pad = size * 0.08;

    // Background: vertical gradient dark green (#064e3b) -> green (#059669)
    for (let y = 0; y < size; y++) {
        const t = y / size;
        const r = lerp(0x06, 0x05, t);
        const g = lerp(0x4e, 0x96, t);
        const b = lerp(0x3b, 0x69, t);
        for (let x = 0; x < size; x++) {
            const idx = (size * y + x) << 2;
            // rounded rect mask
            const dx = Math.min(x, size - 1 - x);
            const dy = Math.min(y, size - 1 - y);
            const inside = (dx >= radius && dy >= radius)
                || (dx < radius && dy >= radius && dx >= radius - Math.sqrt(Math.max(0, radius * radius - (radius - dy) * (radius - dy))))
                || (dy < radius && dx >= radius && dy >= radius - Math.sqrt(Math.max(0, radius * radius - (radius - dx) * (radius - dx))))
                || (dx < radius && dy < radius && Math.sqrt((radius - dx) ** 2 + (radius - dy) ** 2) <= radius);
            if (inside) {
                png.data[idx] = r; png.data[idx + 1] = g; png.data[idx + 2] = b; png.data[idx + 3] = 255;
            } else {
                png.data[idx] = 0; png.data[idx + 1] = 0; png.data[idx + 2] = 0; png.data[idx + 3] = 0;
            }
        }
    }

    // Bell glyph (white) — simple pixel-drawn bell
    const cx = size / 2;
    const bw = size * 0.34;   // bell width
    const bh = size * 0.42;   // bell body height
    const topY = size * 0.18; // top of bell arc
    const bottomY = size * 0.62;
    const half = bw / 2;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = (x - cx) / half;   // -1..1
            const dy = (y - topY) / bh;   // 0..1 (top..bottom)
            if (dy < 0 || dy > 1) continue;
            // dome: ellipse top
            const domeHalf = half;
            const inDome = dx >= -1 && dx <= 1 && dy <= 0.45
                && (dx * dx) / 1 + ((dy - 0.22) * (dy - 0.22)) / (0.3 * 0.3) <= 1;
            // straight body sides
            const inBody = dy > 0.22 && dy <= 0.92 && Math.abs(dx) <= 0.82;
            // bottom flare
            const inFlare = dy > 0.82 && dy <= 0.95 && Math.abs(dx) <= 0.92 && Math.abs(dx) > 0.78;
            if (inDome || inBody || inFlare) {
                const idx = (size * y + x) << 2;
                png.data[idx] = 255; png.data[idx + 1] = 255; png.data[idx + 2] = 255; png.data[idx + 3] = 255;
            }
        }
    }

    // Clapper dot below bell
    const clapR = size * 0.045;
    const clapY = Math.round(size * 0.80);
    const clapX = Math.round(cx);
    for (let y = clapY - clapR; y <= clapY + clapR; y++) {
        for (let x = clapX - clapR; x <= clapX + clapR; x++) {
            if (x < 0 || y < 0 || x >= size || y >= size) continue;
            if (Math.sqrt((x - clapX) ** 2 + (y - clapY) ** 2) <= clapR) {
                const idx = (size * y + x) << 2;
                png.data[idx] = 255; png.data[idx + 1] = 255; png.data[idx + 2] = 255; png.data[idx + 3] = 255;
            }
        }
    }

    fs.writeFileSync(outPath, PNG.sync.write(png));
    console.log("wrote", outPath);
}

const outDir = path.resolve(__dirname, "../apps/pos/public/icons");
fs.mkdirSync(outDir, { recursive: true });
drawIcon(192, path.join(outDir, "icon-192.png"));
drawIcon(512, path.join(outDir, "icon-512.png"));
