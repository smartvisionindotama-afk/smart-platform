/**
 * pos-gudang Service — Gudang-Kasir (M3-FIX v21, PRD V1 §X).
 *
 * Fungsi murni (testable) untuk mengatur & menyelesaikan gudang yang
 * terhubung dengan kasir:
 *   - jumlahGudang == 1  → default single lokasi (tanpa konfigurasi)
 *   - gudang > 1          → mapping fleksibel baris [gudang][kasir]
 *     (1 gudang boleh dipakai banyak kasir; 1 kasir boleh terhubung ke
 *      lebih dari 1 gudang — komposisi diatur Admin, M3-FIX v24)
 *
 * Konsekuensi stok (keputusan PO 2026-08-10): kasir HANYA melihat & menjual
 * stok dari gudang terhubung — kasir-data difilter dan decrement stok
 * diarahkan ke dokumen Barang pada gudang tersebut.
 *
 * @module server/services/pos-gudang
 */

/**
 * Normalisasi payload pengaturan gudang-kasir dari Admin.
 * Kode gudang yang tidak dikenal / tidak aktif diabaikan (clean).
 * @param {object} payload { gudangTerkoneksi?: string[], gudangKasir?: Array<{kasir,kodeGudang,namaKasir}> }
 * @param {Array} warehouses Daftar { kode, nama } gudang valid (aktif)
 * @returns {{ gudangTerkoneksi: string[], gudangKasir: Array<{kasir,namaKasir,kodeGudang,namaGudang}> }}
 */
export function normalizeGudangPayload(payload = {}, warehouses = []) {
    const src = payload || {};
    const ws = Array.isArray(warehouses) ? warehouses : [];
    const validKodes = new Set(ws.map(w => w && w.kode).filter(Boolean));

    const gudangTerkoneksi = Array.isArray(src.gudangTerkoneksi)
        ? [...new Set(
            src.gudangTerkoneksi
                .map(k => String(k || "").trim())
                .filter(k => validKodes.has(k))
        )]
        : [];

    const gudangKasir = Array.isArray(src.gudangKasir)
        ? src.gudangKasir
            .filter(e => e && String(e.kasir || "").trim() && validKodes.has(String(e.kodeGudang || "").trim()))
            .map(e => {
                const kasir = String(e.kasir).trim();
                const kodeGudang = String(e.kodeGudang).trim();
                const w = ws.find(x => x.kode === kodeGudang);
                return {
                    kasir,
                    namaKasir: String(e.namaKasir || "").trim(),
                    kodeGudang,
                    namaGudang: w ? (w.nama || kodeGudang) : kodeGudang
                };
            })
        : [];

    return { gudangTerkoneksi, gudangKasir };
}

/**
 * Resolve gudang terhubung untuk kasir yang sedang login.
 * Prioritas: mapping per-kasir (gudangKasir — 1 kasir bisa punya >1 gudang,
 * semua digabung) → gudangTerkoneksi → null (null = tanpa scoping; kasir
 * melihat seluruh stok — default kompatibel).
 *
 * @param {object} opts { setting, user, warehouses }
 * @param {object|null} opts.setting Dokumen Setting (boleh null)
 * @param {object|null} opts.user   req.user ({ username, ... }) — boleh null
 * @param {Array} opts.warehouses   Daftar { kode, nama } gudang aktif
 * @returns {null|{kodeGudang:string, namaGudang:string, kodeList:string[], gudangValues:string[]}}
 */
export function resolveKasirGudang({ setting, user, warehouses } = {}) {
    const ws = Array.isArray(warehouses) ? warehouses : [];
    if (!setting) return null;

    let kodes = [];
    const kasirUsername = user && user.username ? String(user.username) : "";
    if (kasirUsername && Array.isArray(setting.gudangKasir)) {
        // M3-FIX v24 — mapping fleksibel: gabungkan SEMUA gudang milik kasir ini.
        kodes = setting.gudangKasir
            .filter(e => e && String(e.kasir || "").toLowerCase() === kasirUsername.toLowerCase())
            .map(e => String(e.kodeGudang || "").trim())
            .filter(Boolean);
    }

    if (!kodes.length && Array.isArray(setting.gudangTerkoneksi) && setting.gudangTerkoneksi.length) {
        kodes = setting.gudangTerkoneksi;
    }
    if (!kodes.length) return null;

    const valid = [...new Set(kodes.filter(k => ws.some(w => w && w.kode === k)))];
    if (!valid.length) return null;

    // Nilai `gudang` pada dokumen Barang bisa berupa kode ATAU nama gudang
    // (data legacy). Barang tanpa gudang ("") = stok umum — tetap terlihat.
    const gudangValues = [""];
    for (const k of valid) {
        gudangValues.push(k);
        const w = ws.find(x => x.kode === k);
        if (w && w.nama) gudangValues.push(w.nama);
    }

    const primary = ws.find(w => w.kode === valid[0]);
    return {
        kodeGudang: valid[0],
        namaGudang: primary ? (primary.nama || valid[0]) : valid[0],
        kodeList: valid,
        gudangValues: [...new Set(gudangValues)]
    };
}

export default { normalizeGudangPayload, resolveKasirGudang };
