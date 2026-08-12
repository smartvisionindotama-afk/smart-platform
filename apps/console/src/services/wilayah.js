/**
 * SMART Console — Wilayah Data Service.
 *
 * Master data wilayah (provinsi → kabupaten → kecamatan → desa) diambil
 * langsung dari shared/data/wilayah.json — bukan via /api/wilayah/*.
 *
 * File 7MB di-load secara lazy (dynamic import → chunk terpisah) sehingga
 * hanya dimuat sekali saat dropdown wilayah pertama kali dibuka, tanpa
 * membebani bundle utama aplikasi.
 *
 * Struktur sumber (kode BPS):
 *   { [kodeProv]: { nama, kabupaten: { [kodeKab]: { nama, kecamatan:
 *       { [kodeKec]: { nama, desa: { [kodeDesa]: { nama } } } } } } } }
 *
 * Setiap fungsi mengembalikan array [{ code, name }] — format yang sama
 * dengan response /api/wilayah/* lama agar konsumen tidak berubah.
 *
 * @module console/services/wilayah
 */

let wilayahDataPromise = null;

/**
 * Muat shared/data/wilayah.json (sekali) & kembalikan objek hierarki BPS.
 * @returns {Promise<object>}
 */
async function loadWilayahData() {
    if (!wilayahDataPromise) {
        wilayahDataPromise = import("../../../../shared/data/wilayah.json")
            .then((mod) => {
                const raw = mod.default;
                return typeof raw === "string" ? JSON.parse(raw) : raw;
            })
            .catch((err) => {
                wilayahDataPromise = null; // izinkan retry pada panggilan berikutnya
                throw err;
            });
    }
    return wilayahDataPromise;
}

/**
 * Konversi child-object (key → { nama }) menjadi daftar { code, name }.
 * @param {object} entries
 * @returns {Array<{code: string, name: string}>}
 */
function toOptions(entries) {
    return Object.entries(entries || {}).map(([code, item]) => ({ code, name: item.nama }));
}

/** Daftar seluruh provinsi [{ code, name }]. */
export async function listProvinces() {
    return toOptions(await loadWilayahData());
}

/** Daftar kabupaten/kota untuk suatu provinsi [{ code, name }]. */
export async function listRegencies(provCode) {
    const data = await loadWilayahData();
    return toOptions(data[provCode]?.kabupaten);
}

/** Daftar kecamatan untuk provinsi + kabupaten [{ code, name }]. */
export async function listDistricts(provCode, kabCode) {
    const data = await loadWilayahData();
    return toOptions(data[provCode]?.kabupaten?.[kabCode]?.kecamatan);
}

/** Daftar desa/kelurahan untuk provinsi + kabupaten + kecamatan [{ code, name }]. */
export async function listVillages(provCode, kabCode, kecCode) {
    const data = await loadWilayahData();
    return toOptions(data[provCode]?.kabupaten?.[kabCode]?.kecamatan?.[kecCode]?.desa);
}
