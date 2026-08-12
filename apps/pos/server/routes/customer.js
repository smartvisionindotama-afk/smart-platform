import { Router } from "express";
import { Customer } from "../models/Customer.js";
import { formatError } from "../utils/format-error.js";

const router = Router();

function checkCompany(item, req) {
    if (!item) return false;
    const companyCode = req.headers["x-company-code"];
    if (!companyCode) return true;
    return item.companyCode === companyCode;
}

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
                { kode: { $regex: search, $options: "i" } },
                { kodeNfc: { $regex: search, $options: "i" } },
                { nama: { $regex: search, $options: "i" } },
                { kontak: { $regex: search, $options: "i" } }
            ];
        }

        const total = await Customer.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await Customer.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/check-kode/:kode", async (req, res) => {
    try {
        const kode = req.params.kode;
        const companyCode = req.headers["x-company-code"];
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rx = new RegExp("^" + esc(kode) + "$", "i");
        const query = { $or: [{ kode: rx }, { kodeNfc: rx }] };
        if (companyCode) query.companyCode = companyCode;
        // M3-FIX v20 — konsisten dgn validasi POST penjualan: hanya member AKTIF
        // yang valid (non-aktif/archived → exists:false agar kasir langsung ditolak).
        // M6-FIX — kode NFC member ikut dicocokkan (kartu NFC dibaca kasir).
        query.active = true;
        query.status = { $ne: "archived" };
        const item = await Customer.findOne(query);
        if (item) return res.json({ exists: true, nama: item.nama, id: item._id.toString(), kode: item.kode });
        res.json({ exists: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const item = await Customer.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(item, req)) return res.status(404).json({ error: "Not found" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const data = { ...req.body };
        const companyCode = req.headers["x-company-code"];
        if (companyCode && !data.companyCode) data.companyCode = companyCode;
        const item = await Customer.create(data);
        res.status(201).json(item);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Customer") });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const existing = await Customer.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        const item = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(item);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Customer") });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const existing = await Customer.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        await Customer.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
