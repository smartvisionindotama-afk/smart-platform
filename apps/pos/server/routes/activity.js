import { Router } from "express";
import { ActivityLog } from "../models/ActivityLog.js";

const router = Router();

// List activity logs with pagination (newest first)
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const companyCode = req.headers["x-company-code"];
        const resource = req.query.resource; // optional filter

        let query = {};
        if (companyCode) query.companyCode = companyCode;
        if (resource) query.resource = resource;

        const total = await ActivityLog.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await ActivityLog.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
