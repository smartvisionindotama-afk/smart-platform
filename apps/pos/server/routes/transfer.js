/**
 * Transfer Routes — Stock Transfer Antar Gudang.
 *
 * GET    /             — List transfers
 * GET    /:id          — Get single transfer
 * POST   /             — Create transfer (status=draft)
 * PUT    /:id          — Update transfer (only if draft)
 * DELETE /:id          — Delete transfer (only if draft)
 * PATCH  /:id/status   — Execute transfer (draft → transferred)
 *
 * @module server/routes/transfer
 */

import { Router } from "express";
import { Transfer } from "../models/Transfer.js";
import { Barang } from "../models/Barang.js";
import { formatError } from "../utils/format-error.js";
import { loadCompanyConfig, canTransfer, singleLocationTransferMessage } from "../services/company-limits.js";

const router = Router();

function checkCompany(item, req) {
    if (!item) return false;
    const companyCode = req.headers["x-company-code"];
    if (!companyCode) return true;
    return item.companyCode === companyCode;
}

/**
 * GET / — List transfers.
 */
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").toLowerCase().trim();
        const companyCode = req.headers["x-company-code"];

        const query = {};
        if (companyCode) query.companyCode = companyCode;
        if (search) {
            query.$or = [
                { nomor: { $regex: search, $options: "i" } },
                { gudangAsalNama: { $regex: search, $options: "i" } },
                { gudangTujuanNama: { $regex: search, $options: "i" } }
            ];
        }

        const total = await Transfer.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await Transfer.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /:id — Get single transfer.
 */
router.get("/:id", async (req, res) => {
    try {
        const item = await Transfer.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(item, req)) return res.status(404).json({ error: "Not found" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST / — Create transfer (draft).
 * SP-029 M2 (Rule 17): mode Single Lokasi (default) → transfer dinonaktifkan.
 */
router.post("/", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });

        const cfg = await loadCompanyConfig(companyCode);
        if (!canTransfer(cfg.lokasiMode)) {
            return res.status(403).json({ error: singleLocationTransferMessage() });
        }

        const { tanggal, gudangAsal, gudangAsalNama, gudangTujuan, gudangTujuanNama, items, catatan } = req.body;

        if (!gudangAsal || !gudangTujuan) {
            return res.status(400).json({ error: "Gudang asal dan tujuan wajib diisi" });
        }
        if (gudangAsal === gudangTujuan) {
            return res.status(400).json({ error: "Gudang asal dan tujuan harus berbeda" });
        }
        if (!items || items.length === 0) {
            return res.status(400).json({ error: "Minimal 1 item barang harus ditambahkan" });
        }

        for (const item of items) {
            const qty = Number(item.qty) || 0;
            if (qty <= 0) {
                return res.status(400).json({ error: `Qty untuk "${item.namaBarang || item.kodeBarang}" harus lebih dari 0` });
            }
        }

        const nomor = await Transfer.generateNomor(companyCode);

        const transfer = await Transfer.create({
            companyCode,
            nomor,
            tanggal: tanggal || new Date(),
            gudangAsal: gudangAsal.trim(),
            gudangAsalNama: gudangAsalNama || "",
            gudangTujuan: gudangTujuan.trim(),
            gudangTujuanNama: gudangTujuanNama || "",
            items: items.map(i => ({
                kodeBarang: i.kodeBarang?.trim() || "",
                namaBarang: i.namaBarang || "",
                qty: Number(i.qty) || 0,
                satuan: i.satuan || ""
            })),
            catatan: catatan || "",
            status: "draft",
            createdBy: req.headers["x-user-name"] || "System"
        });

        res.status(201).json(transfer);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Transfer") });
    }
});

/**
 * PUT /:id — Update draft transfer.
 */
router.put("/:id", async (req, res) => {
    try {
        const existing = await Transfer.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        if (existing.status !== "draft") {
            return res.status(400).json({ error: "Hanya transfer draft yang bisa diedit" });
        }

        const { tanggal, gudangAsal, gudangAsalNama, gudangTujuan, gudangTujuanNama, items, catatan } = req.body;

        const updateData = {};
        if (tanggal !== undefined) updateData.tanggal = tanggal;
        if (gudangAsal !== undefined) updateData.gudangAsal = gudangAsal.trim();
        if (gudangAsalNama !== undefined) updateData.gudangAsalNama = gudangAsalNama;
        if (gudangTujuan !== undefined) updateData.gudangTujuan = gudangTujuan.trim();
        if (gudangTujuanNama !== undefined) updateData.gudangTujuanNama = gudangTujuanNama;
        if (catatan !== undefined) updateData.catatan = catatan;
        updateData.updatedBy = req.headers["x-user-name"] || "System";

        if (items !== undefined) {
            if (items.length === 0) {
                return res.status(400).json({ error: "Minimal 1 item barang harus ditambahkan" });
            }
            updateData.items = items.map(i => ({
                kodeBarang: i.kodeBarang?.trim() || "",
                namaBarang: i.namaBarang || "",
                qty: Number(i.qty) || 0,
                satuan: i.satuan || ""
            }));
        }

        const updated = await Transfer.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        );

        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Transfer") });
    }
});

/**
 * DELETE /:id — Delete transfer (any status).
 * Jika sudah transferred, reversal stok:
 *   - Kembalikan stok ke gudang asal
 *   - Kurangi stok dari gudang tujuan (hapus record jika stok <= 0)
 */
router.delete("/:id", async (req, res) => {
    try {
        const existing = await Transfer.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        const companyCode = existing.companyCode;
        const gudangAsalNama = existing.gudangAsalNama || existing.gudangAsal;
        const gudangTujuanNama = existing.gudangTujuanNama || existing.gudangTujuan;

        // Jika sudah ditransfer, reversal stok
        if (existing.status !== "draft") {
            for (const item of existing.items) {
                // 1. Kembalikan stok ke gudang asal
                await Barang.findOneAndUpdate(
                    { companyCode, kode: item.kodeBarang, gudang: gudangAsalNama },
                    { $inc: { stok: item.qty } }
                ).catch(err => {
                    console.warn(`[Transfer] Failed to restore stock for ${item.kodeBarang} at source:`, err.message);
                });

                // 2. Kurangi stok dari gudang tujuan
                const barangTujuan = await Barang.findOne({
                    companyCode, kode: item.kodeBarang, gudang: gudangTujuanNama
                });
                if (barangTujuan) {
                    const stokBaru = (barangTujuan.stok || 0) - item.qty;
                    if (stokBaru <= 0) {
                        // Stok habis — hapus record barang di gudang tujuan
                        await Barang.findByIdAndDelete(barangTujuan._id);
                    } else {
                        await Barang.findOneAndUpdate(
                            { _id: barangTujuan._id },
                            { $inc: { stok: -item.qty } }
                        );
                    }
                }
            }
        }

        await Transfer.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /:id/status — Execute transfer (draft → transferred).
 * Validasi stok dari barang.stok, lalu kurangi.
 * Tambah stok di gudang tujuan (buat record barang baru jika belum ada).
 * SP-029 M2 (Rule 17): mode Single Lokasi → eksekusi transfer diblokir.
 */
router.put("/:id/status", async (req, res) => {
    try {
        const existing = await Transfer.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        if (existing.status !== "draft") {
            return res.status(400).json({ error: "Transfer sudah dieksekusi" });
        }

        const cfg = await loadCompanyConfig(existing.companyCode);
        if (!canTransfer(cfg.lokasiMode)) {
            return res.status(403).json({ error: singleLocationTransferMessage() });
        }

        const companyCode = existing.companyCode;
        const newStatus = req.body.status || "transferred";
        const gudangTujuanNama = existing.gudangTujuanNama || existing.gudangTujuan;
        const gudangAsalNama = existing.gudangAsalNama || existing.gudangAsal;

        // Validasi stok untuk semua item
        for (const item of existing.items) {
            const barang = await Barang.findOne({ companyCode, kode: item.kodeBarang, gudang: gudangAsalNama });
            const stokTersedia = barang ? barang.stok : 0;
            if (stokTersedia < item.qty) {
                return res.status(400).json({
                    error: `Stok "${item.namaBarang || item.kodeBarang}" di ${gudangAsalNama} tidak mencukupi (tersedia: ${stokTersedia}, diminta: ${item.qty})`
                });
            }
        }

        // Eksekusi: kurangi stok di gudang asal, tambah di gudang tujuan
        for (const item of existing.items) {
            // 1. Kurangi stok dari gudang asal
            await Barang.findOneAndUpdate(
                { companyCode, kode: item.kodeBarang, gudang: gudangAsalNama },
                { $inc: { stok: -item.qty } }
            );

            // 2. Cari barang di gudang tujuan
            const barangTujuan = await Barang.findOne({
                companyCode, kode: item.kodeBarang, gudang: gudangTujuanNama
            });

            if (barangTujuan) {
                // Sudah ada — tambah stok
                await Barang.findOneAndUpdate(
                    { _id: barangTujuan._id },
                    { $inc: { stok: item.qty } }
                );
            } else {
                // Belum ada — buat record baru dengan data dari gudang asal
                const sumber = await Barang.findOne({
                    companyCode, kode: item.kodeBarang, gudang: gudangAsalNama
                });
                if (sumber) {
                    await Barang.create({
                        companyCode,
                        kode: sumber.kode,
                        nama: sumber.nama,
                        kategori: sumber.kategori || "",
                        satuan: sumber.satuan || item.satuan || "",
                        rak: "",
                        gudang: gudangTujuanNama,
                        stok: item.qty,
                        stok_minimum: sumber.stok_minimum || 0,
                        harga_beli: sumber.harga_beli || 0,
                        harga_jual: sumber.harga_jual || 0,
                        deskripsi: sumber.deskripsi || ""
                    });
                } else {
                    // Fallback: buat dengan data minimal
                    await Barang.create({
                        companyCode,
                        kode: item.kodeBarang,
                        nama: item.namaBarang || item.kodeBarang,
                        gudang: gudangTujuanNama,
                        stok: item.qty,
                        stok_minimum: 0,
                        harga_beli: 0,
                        harga_jual: 0
                    });
                }
            }
        }

        existing.status = newStatus;
        existing.updatedBy = req.headers["x-user-name"] || "System";
        await existing.save();

        res.json(existing);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
