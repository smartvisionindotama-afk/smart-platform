import { Router } from "express";
import { Warehouse } from "../models/Warehouse.js";
import { formatError } from "../utils/format-error.js";
import { loadCompanyConfig, checkGudangLimit } from "../services/company-limits.js";

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
                { nama: { $regex: search, $options: "i" } }
            ];
        }

        const total = await Warehouse.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await Warehouse.find(query)
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
        const query = { kode: { $regex: new RegExp("^" + kode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") } };
        if (companyCode) query.companyCode = companyCode;
        const item = await Warehouse.findOne(query);
        if (item) return res.json({ exists: true, nama: item.nama, id: item._id.toString() });
        res.json({ exists: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const item = await Warehouse.findById(req.params.id);
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

        // SP-029 M2 (Rule 17): kuota gudang dari Master Platform (Company.jumlahGudang).
        // POS hanya membaca konfigurasi — pembatasan di-enforce di server (defense in depth).
        if (companyCode) {
            const cfg = await loadCompanyConfig(companyCode);
            const activeCount = await Warehouse.countDocuments({
                companyCode,
                status: { $ne: "archived" }
            });
            const check = checkGudangLimit(cfg, activeCount);
            if (!check.allowed) {
                return res.status(400).json({ error: check.message, limit: check.limit, current: check.current });
            }
        }

        const item = await Warehouse.create(data);
        res.status(201).json(item);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Warehouse") });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const existing = await Warehouse.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        const item = await Warehouse.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(item);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Warehouse") });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const existing = await Warehouse.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        await Warehouse.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
