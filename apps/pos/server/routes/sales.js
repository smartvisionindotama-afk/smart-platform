import { Router } from "express";
import { Sales } from "../models/Sales.js";
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
        let query = {};
        if (companyCode) query.companyCode = companyCode;
        if (search) {
            query.$or = [
                { kode: { $regex: search, $options: "i" } },
                { nama: { $regex: search, $options: "i" } },
                { kontak: { $regex: search, $options: "i" } }
            ];
        }
        const total = await Sales.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await Sales.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/check-kode/:kode", async (req, res) => {
    try {
        const kode = req.params.kode;
        const companyCode = req.headers["x-company-code"];
        let query = { kode: { $regex: new RegExp("^" + kode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") } };
        if (companyCode) query.companyCode = companyCode;
        const item = await Sales.findOne(query);
        if (item) return res.json({ exists: true, nama: item.nama, id: item._id.toString() });
        res.json({ exists: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const item = await Sales.findById(req.params.id);
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
        const item = await Sales.create(data);
        res.status(201).json(item);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Sales") });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const existing = await Sales.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        const item = await Sales.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(item);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Sales") });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const existing = await Sales.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        await Sales.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
