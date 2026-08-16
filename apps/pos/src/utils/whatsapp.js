/**
 * WhatsApp Checkout Helpers — QR Menu F&B (V2).
 *
 * Alur (sesuai keputusan user): customer scan QR → WEB menu (browse + cart
 * seperti biasa) → saat checkout klik "Kirim Pesanan via WhatsApp" → sistem
 * membuka wa.me nomor RESTORAN dengan pesan order otomatis (meja, ref, item,
 * total, nama) → customer tinggal tekan Send. Nomor WA customer otomatis
 * terlihat restoran dari chat masuk (customer_whatsapp) — restoran membalas
 * status order lewat chat tersebut.
 *
 * Fungsionalitas ini PURE (tanpa DOM) agar mudah di-unit-test.
 *
 * @module pos/utils/whatsapp
 */

/**
 * Normalisasi nomor HP Indonesia ke format internasional (wa.me tanpa +).
 *   "0812-3456-7890"        → "6281234567890"
 *   "+62 812-3456-7890"     → "6281234567890"
 *   "6281234567890"         → "6281234567890"
 *   "81234567890"           → "6281234567890"
 *   "" / non-digit          → ""
 * @param {string} [raw]
 * @returns {string}
 */
export function normalizeWaNumber(raw) {
    if (!raw) return "";
    const digits = String(raw).replace(/[^\d]/g, "");
    if (!digits) return "";
    if (digits.startsWith("0")) return "62" + digits.slice(1);
    if (digits.startsWith("8")) return "62" + digits;
    return digits;
}

/**
 * Normalisasi label meja utk pesan WA — hilangkan awalan "Meja" yang sudah
 * ada di nilai (mis. nomorMeja "Meja 001" → "001") agar pesan tidak menjadi
 * "Meja: Meja 001".
 *   "Meja 001" / "MEJA 001" / "meja 001" → "001"
 *   "001"                                → "001"
 *   ""                                   → "-"
 * @param {string} [raw]
 * @returns {string}
 */
export function normalizeMejaLabel(raw) {
    if (!raw) return "-";
    const s = String(raw).trim();
    const stripped = s.replace(/^meja\s*/i, "");
    return stripped || s;
}

/** Format Rupiah sederhana (pure — tanpa DOM). */
export function formatRupiah(n) {
    return "Rp " + (Number(n) || 0).toLocaleString("id-ID");
}

/**
 * Bangun pesan order WhatsApp (isi chat ke restoran).
 * @param {object} [company] { name, whatsapp }
 * @param {object} [table] { nomorMeja }
 * @param {Array} [items] [{ nama, qty, harga }] — harga SATUAN
 * @param {object} [opts]
 * @param {boolean} [opts.taxEnabled] Pajak 11% (sama dengan order web)
 * @param {string} [opts.nama] Nama customer (opsional)
 * @param {string} [opts.waPhone] No. WhatsApp customer (dipakai restoran
 *        utk mengirim status order — DITULIS di pesan sebagai rujukan)
 * @param {string} [opts.ref] Nomor order referensi (mis. "ORD-84123")
 * @returns {string}
 */
export function buildWaCheckoutMessage(_company = {}, table = {}, items = [], opts = {}) {
    const { taxEnabled = false, nama = "", waPhone = "", ref = "" } = opts;
    const meja = normalizeMejaLabel(table && table.nomorMeja);
    const subtotal = Math.round((items || []).reduce(
        (s, i) => s + (Number(i.qty) || 0) * (Number(i.harga) || 0), 0
    ) * 100) / 100;
    const tax = taxEnabled ? Math.round(subtotal * 0.11 * 100) / 100 : 0;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const lines = ["Halo, saya ingin memesan.", ""];
    lines.push(`Meja: ${meja}`);
    if (ref) lines.push(`Order: ${ref}`);
    lines.push("");
    for (const i of items || []) {
        const qty = Number(i.qty) || 0;
        lines.push(`${qty}x ${String(i.nama || "").trim()}  ${formatRupiah(qty * (Number(i.harga) || 0))}`);
    }
    lines.push("--------------------------");
    if (taxEnabled) {
        lines.push(`Subtotal  ${formatRupiah(subtotal)}`);
        lines.push(`Pajak (11%)  ${formatRupiah(tax)}`);
    }
    lines.push(`Total  ${formatRupiah(total)}`);
    if (String(nama || "").trim()) {
        lines.push("");
        lines.push(`Nama: ${String(nama).trim()}`);
    }
    if (String(waPhone || "").trim()) {
        lines.push(`No. WA: ${String(waPhone).trim()}`);
    }
    return lines.join("\n");
}

/**
 * Nomor WA restoran utk checkout (wa.me).
 * Prioritas: waSenderNumber (Settings → Konfigurasi WA → Nomor Pengirim),
 * fallback whatsapp (field lama Settings → Company — data lama tetap jalan).
 * @param {object} [company] { waSenderNumber, whatsapp }
 * @returns {string} "" bila tidak ada nomor valid
 */
export function waRestaurantNumber(company = {}) {
    return String((company && (company.waSenderNumber || company.whatsapp)) || "");
}

/**
 * Bangun URL wa.me utk checkout — wa.me nomor RESTORAN, pesan order otomatis.
 * Nomor WA customer otomatis terlihat restoran dari chat masuk.
 * @param {object} [company] { name, waSenderNumber, whatsapp }
 * @param {object} [table] { nomorMeja }
 * @param {Array} [items] [{ nama, qty, harga }]
 * @param {object} [opts] Lihat buildWaCheckoutMessage
 * @returns {string} "" bila nomor WA tidak valid — checkout WA tidak tersedia.
 */
export function buildWaCheckoutUrl(company = {}, table = {}, items = [], opts = {}) {
    const number = normalizeWaNumber(waRestaurantNumber(company));
    if (!number) return "";
    const message = buildWaCheckoutMessage(company, table, items, opts);
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
