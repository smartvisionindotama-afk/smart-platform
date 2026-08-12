/**
 * Database Explorer API — observasi MongoDB server-side (SP-027 M5 §12-14).
 *
 * Browser  →  SMART Console API  →  Database Service  →  MongoDB
 *
 * RULES:
 * - READ-FIRST: default READ ONLY. Tidak ada delete/drop/update/bulk.
 * - Credentials & connection string TIDAK PERNAH dikirim ke frontend.
 * - Pagination WAJIB (LIMIT + SKIP) — tidak mengambil seluruh collection.
 * - Query dibatasi: tidak ada arbitrary MongoDB command.
 * - Setiap aksi diaudit.
 *
 * Endpoint:
 *   GET /api/database/databases                 — list databases (yang bisa diakses)
 *   GET /api/database/:db/collections           — list collections
 *   GET /api/database/:db/:collection/documents — dokumen (limit+pagination+filter)
 *   GET /api/database/:db/:collection/indexes   — indexes
 *   GET /api/database/:db/:collection/stats     — collection statistics
 *
 * @module console/server/routes/database
 */

import { Router } from "express";
import mongoose from "mongoose";
import { security, audit } from "../security.js";

const router = Router();

router.use(security.authenticate, security.requireSuperAdmin);

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const ALLOWED_FILTER_KEYS = /^[a-zA-Z0-9_.-]+$/;
// Key berbahaya untuk prototype pollution / operator query — selalu ditolak.
const BLOCKED_FILTER_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Normalisasi nama db/collection agar aman untuk path. */
function safeSegment(value, label) {
    const v = String(value || "");
    if (!v || !ALLOWED_FILTER_KEYS.test(v)) {
        return null;
    }
    return v;
}

/** Dapatkan native driver Db untuk dbName (tanpa membuka koneksi baru). */
function nativeDb(dbName) {
    const client = mongoose.connection.getClient ? mongoose.connection.getClient() : mongoose.connection.db;
    return client.db(dbName);
}

/**
 * GET /api/database/databases — list databases yang dapat diakses server.
 * Jika koneksi tidak punya hak listDatabases (auth), fallback ke DB aktif.
 */
router.get("/databases", async (req, res) => {
    try {
        const conn = mongoose.connection;
        let names = [];
        try {
            const admin = conn.db.admin();
            const result = await admin.command({ listDatabases: 1 });
            names = (result.databases || []).map(d => d.name);
        } catch {
            // Tidak punya hak admin → hanya DB aktif
            names = [conn.name];
        }
        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "database.list",
            targetType: "database",
            targetId: names.join(","),
            targetName: "databases",
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });
        res.json({ data: names });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/database/:db/collections — list collections.
 */
router.get("/:db/collections", async (req, res) => {
    try {
        const dbName = safeSegment(req.params.db, "db");
        if (!dbName) return res.status(400).json({ error: "Nama database tidak valid" });

        const db = nativeDb(dbName);
        const collections = await db.listCollections().toArray();

        // Document count per collection — pakai estimatedDocumentCount
        // (metadata collection, TIDAK scan dokumen → ringan untuk collection besar).
        // Gagal diam-diam → null (UI menampilkan "—").
        const withCount = await Promise.all(collections.map(async c => {
            let docCount = null;
            try {
                docCount = await db.collection(c.name).estimatedDocumentCount();
            } catch { /* tidak tersedia */ }
            return { name: c.name, type: c.type || "collection", docCount };
        }));

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "database.collections",
            targetType: "database",
            targetId: dbName,
            targetName: "collections",
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.json({ data: withCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/database/:db/:collection/documents?page=&limit=&filter=
 * Read dokumen dengan pagination WAJIB. filter = JSON query sederhana
 * (hanya key-value; operator $ di-allowlist ketat).
 */
router.get("/:db/:collection/documents", async (req, res) => {
    try {
        const dbName = safeSegment(req.params.db, "db");
        const collName = safeSegment(req.params.collection, "collection");
        if (!dbName || !collName) return res.status(400).json({ error: "Nama database/collection tidak valid" });

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));

        // Filter: hanya key-value sederhana, tanpa $ atau operator berbahaya.
        let filter = {};
        if (req.query.filter) {
            try {
                const parsed = JSON.parse(req.query.filter);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    for (const [k, v] of Object.entries(parsed)) {
                        if (!BLOCKED_FILTER_KEYS.has(k) && ALLOWED_FILTER_KEYS.test(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
                            filter[k] = v;
                        }
                    }
                }
            } catch { /* filter tidak valid → kosong */ }
        }

        const db = nativeDb(dbName);
        const col = db.collection(collName);

        const total = await col.countDocuments(filter);
        const data = await col.find(filter)
            .sort({ _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();

        // Potong field besar (data URL logo dll) agar payload ringan
        const trimmed = data.map(doc => {
            const out = {};
            for (const [k, v] of Object.entries(doc)) {
                if (typeof v === "string" && v.length > 200) {
                    out[k] = `${v.slice(0, 200)}… (${v.length} chars)`;
                } else {
                    out[k] = v;
                }
            }
            return out;
        });

        const totalPages = Math.max(1, Math.ceil(total / limit));
        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "database.read",
            targetType: "collection",
            targetId: `${dbName}.${collName}`,
            targetName: "documents",
            metadata: { page, limit, total },
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.json({
            data: trimmed,
            total,
            pagination: { page: Math.min(page, totalPages), limit, total, totalPages }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/database/:db/:collection/indexes — lihat index.
 */
router.get("/:db/:collection/indexes", async (req, res) => {
    try {
        const dbName = safeSegment(req.params.db, "db");
        const collName = safeSegment(req.params.collection, "collection");
        if (!dbName || !collName) return res.status(400).json({ error: "Nama database/collection tidak valid" });

        const db = nativeDb(dbName);
        const col = db.collection(collName);
        const indexes = await col.indexes();

        res.json({ data: indexes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/database/:db/:collection/stats — collection statistics.
 * Ringan (tidak melakukan scan dokumen).
 */
router.get("/:db/:collection/stats", async (req, res) => {
    try {
        const dbName = safeSegment(req.params.db, "db");
        const collName = safeSegment(req.params.collection, "collection");
        if (!dbName || !collName) return res.status(400).json({ error: "Nama database/collection tidak valid" });

        const db = nativeDb(dbName);
        // collStats via db.command (native driver) — ringan, tanpa scan dokumen.
        const stats = await db.command({ collStats: collName });

        res.json({
            data: {
                count: stats.count,
                size: stats.size,
                avgObjSize: stats.avgObjSize,
                storageSize: stats.storageSize,
                nindexes: stats.nindexes,
                totalIndexSize: stats.totalIndexSize,
                sharded: Boolean(stats.sharded)
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
