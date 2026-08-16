/* Generate PWA icons from the COMPANY LOGO (Settings → Company).
 *
 * Logo dibaca dari file data URI (diekstrak dari DB via mongosh) lalu
 * di-resize ke ukuran PWA (512/192) dengan jimp. Background diisi putih
 * agar ikon terlihat jelas di theme-color gelap & terang.
 *
 * Usage: node scripts/gen-company-icons.cjs <file-data-uri> [outDir]
 */
const fs = require("fs");
const path = require("path");
const { Jimp } = require("jimp");

const SRC_FILE = process.argv[2] || "/tmp/company-logo-datauri.txt";
const OUT_DIR = path.resolve(__dirname, process.argv[3] || "../apps/pos/public/icons");
const SIZES = [192, 512];

async function main() {
    const logo = fs.readFileSync(SRC_FILE, "utf-8").trim();
    if (!logo.startsWith("data:image/")) {
        throw new Error("File bukan data URI (data:image/...)");
    }
    const comma = logo.indexOf(",");
    const mime = logo.slice(5, comma).split(";")[0]; // image/jpeg, image/png, ...
    const buf = Buffer.from(logo.slice(comma + 1), "base64");
    const ext = mime === "image/png" ? "png" : (mime === "image/webp" ? "webp" : "jpeg");

    let img = await Jimp.read(buf);
    // Hapus alpha → putih: composite di atas kanvas putih (jimp v1 tidak
    // punya background() instance — flatten manual via composite).
    const flat = new Jimp({ width: img.bitmap.width, height: img.bitmap.height, color: 0xffffffff });
    flat.composite(img, 0, 0);
    img = flat;

    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const size of SIZES) {
        const canvas = new Jimp({ width: size, height: size, color: 0xffffffff });
        const inner = img.clone().contain({ w: Math.round(size * 0.88), h: Math.round(size * 0.88) });
        canvas.composite(inner, Math.round((size - inner.bitmap.width) / 2), Math.round((size - inner.bitmap.height) / 2));
        const outPath = path.join(OUT_DIR, `icon-${size}.png`);
        await new Promise((res, rej) => canvas.write(outPath, e => (e ? rej(e) : res())));
        console.log(`wrote ${outPath} (${size}x${size})`);
    }
    console.log("logo source:", `${mime} (${buf.length} bytes)`);
}

main().catch(err => {
    console.error("GAGAL:", err.message);
    process.exit(1);
});
