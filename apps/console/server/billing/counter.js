/**
 * Atomic sequence counter (SP-029 M6 §19, §25).
 *
 * Nomor invoice harus unique + reproducible + tidak dari frontend.
 * countDocuments+1 tidak atomik → dua generate konkuren bisa dapat seq sama.
 * Counter ini memakai findOneAndUpdate $inc (atomik) pada collection `counters`
 * — tanpa model baru, aman untuk race.
 *
 * @module console/server/billing/counter
 */

import mongoose from "mongoose";

/**
 * Ambil nilai sequence berikutnya secara atomik.
 * @param {string} key Contoh: "invoice:2026-08"
 * @param {object} [col] Collection injeksi (untuk unit test tanpa DB).
 * @returns {Promise<number>}
 */
export async function nextSequence(key, col = null) {
    const c = col || mongoose.connection.collection("counters");
    const doc = await c.findOneAndUpdate(
        { _id: key },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" }
    );
    // Driver MongoDB v4+ mengembalikan dokumen LANGSUNG (bukan {value}).
    // Dukung keduanya agar seq benar-benar ter-increment (anti nomor duplikat).
    const seq = doc?.value?.seq ?? doc?.seq ?? 1;
    return Number.isFinite(seq) ? seq : 1;
}

/**
 * Sinkronkan counter dari invoice existing (M6-FIX).
 *
 * Jika counter belum ada untuk bulan berjalan (mis. data invoice diimpor
 * dari sistem lain / counter pernah di-reset), inisialisasi counter dari
 * nomor invoice terbesar yang sudah ada bulan itu — sehingga nomor baru
 * TIDAK bertabrakan dengan nomor yang sudah dipakai.
 *
 * @param {string} key Contoh: "invoice:2026-08"
 * @param {string} invoicePrefix Contoh: "INV/2026/08/"
 * @param {object} [opts] { col, findLast } — injeksi untuk unit test.
 * @returns {Promise<number>} Nilai counter saat ini (sebelum increment berikutnya).
 */
export async function syncCounterFromExisting(key, invoicePrefix, opts = {}) {
    const col = opts.col || mongoose.connection.collection("counters");
    const findLast = opts.findLast || (async () => {
        const doc = await mongoose.connection.collection("invoices").findOne(
            { invoiceNumber: { $regex: `^${invoicePrefix}` } },
            { sort: { invoiceNumber: -1 }, projection: { invoiceNumber: 1, _id: 0 } }
        );
        return doc?.invoiceNumber || null;
    });

    const existing = await col.findOne({ _id: key });
    if (existing && Number.isFinite(existing.seq) && existing.seq > 0) {
        return existing.seq;
    }

    const lastInvoice = await findLast();
    if (lastInvoice) {
        const seq = parseInt(String(lastInvoice).split("/").pop(), 10) || 0;
        if (seq > 0) {
            await col.updateOne(
                { _id: key },
                { $setOnInsert: { seq } },
                { upsert: true }
            );
            return seq;
        }
    }
    // Tidak ada invoice existing → biarkan counter mulai dari 0 (next → 1).
    await col.updateOne({ _id: key }, { $setOnInsert: { seq: 0 } }, { upsert: true });
    return 0;
}

export default { nextSequence, syncCounterFromExisting };
