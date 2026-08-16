/**
 * Qr Public Route — Customer QR Menu (F&B V1) — endpoint PUBLIK.
 *
 * Customer scan https://pos.e-profit.id/m/{qrIdentifier} → halaman mobile
 * (disajikan index.js di path /m/:identifier) memanggil endpoint ini:
 *
 *   GET  /api/qr/menu/:identifier   — resolve meja + menu produk + payment info
 *   POST /api/qr/orders             — create order (payment PENDING)
 *   GET  /api/qr/orders/:orderToken — status order customer
 *
 * Keamanan multi-tenant (server-side):
 *   - Customer TIDAK mengirim company/table — semua di-resolve dari
 *     qrIdentifier di server (company → lokasi → table).
 *   - Harga item dihitung SERVER dari master Barang/Recipe/SKU — harga yang
 *     dikirim client TIDAK dipercaya.
 *   - Order discope companyCode + lokasiId + tableId dari resolve.
 *   - Menu hanya menampilkan product type: trading, recipe (simple), recipe-fnb.
 *     Jasa (service) TIDAK tampil. Barang dijual=false TIDAK tampil.
 *
 * Endpoint publik via PUBLIC_RULES (index.js) — method-aware.
 *
 * @module server/routes/qr-public
 */

import { Router } from "express";
import { QrTable } from "../models/QrTable.js";
import { Barang } from "../models/Barang.js";
import { Warehouse } from "../models/Warehouse.js";
import { Kategori } from "../models/Kategori.js";
import { Recipe } from "../models/Recipe.js";
import { Company } from "../models/Company.js";
import { CompanyQris } from "../models/CompanyQris.js";
import { BankAccount } from "../models/BankAccount.js";
import { TableOrder } from "../models/TableOrder.js";
import { Setting } from "../models/Setting.js";
import { PaymentProof } from "../models/PaymentProof.js";
import { Notification } from "../models/Notification.js";
import { resolveOrderItems, nextOrderNumber, formatOrderId, generateToken } from "../services/qr-menu.js";
import { getCompanyTransactionTypes } from "../services/transaction-capability.js";
import { parseProofDataUri, sanitizeProof } from "../services/payment-proof.js";
import { buildKitchenOrderNotification, buildPaymentProofNotification } from "../services/notification.js";
import { notifyOrderWhatsapp } from "../services/wa-notify.js";
import { audit } from "../security.js";

/**
 * Simpan notifikasi bell (role-based) — best effort, TIDAK pernah
 * menggagalkan alur utama order/upload.
 * @param {object} order Dokumen TableOrder
 * @param {"kitchen"|"cashier"} targetRole
 * @param {"order_new"|"payment_proof"} type
 */
async function pushRoleNotification(order, targetRole, type) {
    try {
        const n = type === "payment_proof"
            ? buildPaymentProofNotification(order)
            : buildKitchenOrderNotification(order);
        await Notification.create({
            companyCode: order.companyCode,
            locationId: order.lokasiId || "",
            tableId: order.tableId || "",
            orderId: String(order._id),
            orderNumber: order.orderNumber || 0,
            nomorMeja: order.nomorMeja || "",
            targetRole: n.targetRole || targetRole,
            type: n.type || type,
            title: n.title || "",
            message: n.message || "",
            payload: n.payload || {},
            read: false
        });
    } catch (err) {
        console.warn(`[QR-Public] Gagal buat notifikasi ${targetRole}/${type}:`, err?.message);
    }
}

const router = Router();

/** Resolve table dari identifier (company scope implisit). */
async function resolveTable(identifier) {
    if (!identifier) return null;
    return QrTable.findOne({ qrIdentifier: identifier }).lean();
}

/**
 * GET /menu/:identifier — menu mobile customer.
 * Response: { company, table, lokasi, produk[], kategori[], kategoriIcons,
 *             payment: { qris, bankAccounts }, taxEnabled }
 */
router.get("/menu/:identifier", async (req, res) => {
    try {
        const table = await resolveTable(req.params.identifier);
        if (!table) {
            return res.status(404).json({ error: "QR Menu tidak aktif. Silakan hubungi kasir." });
        }
        if (table.active === false) {
            return res.status(410).json({ error: "QR Menu tidak aktif. Silakan hubungi kasir." });
        }
        const companyCode = table.companyCode;

        // F&B capability gate — QR Menu hanya untuk company dengan fnb aktif.
        const enabled = await getCompanyTransactionTypes(companyCode);
        if (!enabled.includes("fnb")) {
            return res.status(410).json({ error: "QR Menu tidak aktif. Silakan hubungi kasir." });
        }

        // ── Produk: trading + recipe + recipe-fnb (JASA TIDAK tampil) ──
        // M6-FIX — menu discope ke GUDANG MEJA: meja terikat ke satu lokasi
        // (Warehouse) saat didaftarkan → hanya produk di gudang itu yang
        // tampil. `Barang.gudang` bisa berisi kode ATAU nama (data legacy),
        // jadi dicocokkan dua-duanya + stok umum (gudang "" / field gudang
        // tidak ada) — pola sama dengan layar kasir (kasir-data). Bila meja
        // tidak punya lokasi / gudang tidak ditemukan → tampilkan semua
        // (fallback kompatibel, perilaku lama).
        const productQuery = {
            companyCode,
            active: true,
            status: { $ne: "archived" },
            dijual: { $ne: false },
            behavior: { $in: ["trading", "recipe", "recipe-fnb"] }
        };
        const gudangValues = [""];
        if (table.lokasiId) {
            try {
                const w = await Warehouse.findOne({ companyCode, _id: table.lokasiId }).select("kode nama").lean();
                if (w) {
                    gudangValues.push(w.kode);
                    if (w.nama) gudangValues.push(w.nama);
                }
            } catch { /* gudang tidak ter-resolve → tanpa filter gudang */ }
        }
        if (gudangValues.length > 1) {
            productQuery.$or = [
                { gudang: { $in: gudangValues } },
                { gudang: { $exists: false } }
            ];
        }
        const barangs = await Barang.find(productQuery)
            .sort({ nama: 1 })
            .limit(500)
            .lean();

        // Varian Recipe F&B (produk boleh punya beberapa varian aktif)
        const varianByProduct = {};
        try {
            const recipes = await Recipe.find({ companyCode, status: "active" })
                .select("productId name harga")
                .sort({ name: 1 })
                .lean();
            for (const r of recipes) {
                const pid = String(r.productId || "");
                if (!pid) continue;
                if (!varianByProduct[pid]) varianByProduct[pid] = [];
                varianByProduct[pid].push({
                    recipeId: String(r._id),
                    nama: r.name || "",
                    harga: Math.max(0, Number(r.harga) || 0)
                });
            }
        } catch { /* produk tanpa varian tetap tampil */ }

        const produk = barangs
            .filter(b => (Number(b.harga_jual) || 0) > 0 || (Array.isArray(b.skus) && b.skus.length))
            .map(b => {
                const productHarga = Number(b.harga_jual) || 0;
                const variants = (varianByProduct[String(b._id)] || []).map(v => ({
                    ...v,
                    harga: v.harga > 0 ? v.harga : productHarga
                }));
                const skus = Array.isArray(b.skus) && b.skus.length
                    ? b.skus.map(s => ({
                        kode: s.kode || "",
                        label: s.label || "",
                        foto: s.foto || "",
                        harga: Math.max(0, Number(s.harga) || 0),
                        stok: Math.max(0, Number(s.stok) || 0)
                    }))
                    : [];
                return {
                    id: String(b._id),
                    kode: b.kode,
                    nama: b.nama,
                    kategori: b.kategori || "",
                    satuan: b.satuan || "",
                    harga: productHarga,
                    stok: Number(b.stok) || 0,
                    behavior: b.behavior || "trading",
                    foto: b.foto || "",
                    variants,
                    skus,
                    varianDef: Array.isArray(b.varianDef) ? b.varianDef : [],
                    deskripsi: b.deskripsi || ""
                };
            });

        // Kategori = Master Kategori (SSOT)
        let kategori = [];
        const kategoriIcons = {};
        try {
            const kats = await Kategori.find({ companyCode, active: true, status: { $ne: "archived" } })
                .select("nama icon")
                .sort({ nama: 1 })
                .lean();
            for (const k of kats) {
                const nama = String(k.nama || "").trim();
                if (!nama) continue;
                kategori.push(nama);
                if (k.icon) kategoriIcons[nama] = k.icon;
            }
        } catch { /* fallback dari produk */ }
        if (!kategori.length) {
            kategori = [...new Set(produk.map(p => (p.kategori || "").trim()).filter(Boolean))];
        }

        // ── Payment info (QRIS company + rekening aktif) ──
        let qris = null;
        let bankAccounts = [];
        try {
            const qrisDoc = await CompanyQris.findOne({ companyCode, active: true }).select("qrisImage").lean();
            if (qrisDoc && qrisDoc.qrisImage) qris = qrisDoc.qrisImage;
        } catch { /* tanpa QRIS tetap tampil */ }
        try {
            bankAccounts = await BankAccount.find({ companyCode, active: true })
                .select("bankName accountNumber accountName")
                .sort({ createdAt: 1 })
                .lean();
        } catch { /* tanpa rekening tetap tampil */ }

        let company = null;
        try {
            // waSenderNumber (Settings → Konfigurasi WA → Nomor Pengirim)
            // dipakai halaman /m/ utk checkout via wa.me; whatsapp = fallback
            // field lama (Settings → Company). Kosong keduanya → alur web.
            company = await Company.findOne({ code: companyCode }).select("name logo whatsapp waSenderNumber").lean();
        } catch { /* nama fallback */ }

        let taxEnabled = true;
        try {
            const setting = await Setting.findOne({ companyCode }).lean();
            if (setting) taxEnabled = setting.taxEnabled !== false;
        } catch { /* default aktif */ }

        res.json({
            company: {
                name: (company && (company.name || company.companyName)) || companyCode,
                logo: (company && company.logo) || "",
                // F&B QR Menu — nomor restoran utk checkout wa.me (Nomor
                // Pengirim dari Konfigurasi WA; fallback field lama whatsapp)
                whatsapp: (company && company.whatsapp) || "",
                waSenderNumber: (company && company.waSenderNumber) || ""
            },
            table: {
                tableId: String(table._id),
                nomorMeja: table.nomorMeja,
                lokasiId: table.lokasiId || "",
                lokasiNama: table.lokasiNama || ""
            },
            produk,
            kategori,
            kategoriIcons,
            payment: { qris, bankAccounts },
            taxEnabled
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /orders — create order customer.
 * Body: { qrIdentifier, items: [{ productId, qty, recipeId?, skuKode?, catatan? }],
 *         paymentMethod: "cash"|"qris"|"transfer", catatanOrder? }
 * Semua harga dihitung server. Order dibuat paymentStatus PENDING (TIDAK
 * otomatis PAID), kitchenStatus NEW (masuk kitchen langsung).
 */
router.post("/orders", async (req, res) => {
    try {
        const identifier = String(req.body?.qrIdentifier || "").trim();
        const table = await resolveTable(identifier);
        if (!table || table.active === false) {
            return res.status(404).json({ error: "QR Menu tidak aktif. Silakan hubungi kasir." });
        }
        const companyCode = table.companyCode;

        const enabled = await getCompanyTransactionTypes(companyCode);
        if (!enabled.includes("fnb")) {
            return res.status(410).json({ error: "QR Menu tidak aktif. Silakan hubungi kasir." });
        }

        const paymentMethod = String(req.body?.paymentMethod || "").trim().toLowerCase();
        if (!["cash", "qris", "transfer"].includes(paymentMethod)) {
            return res.status(400).json({ error: "Metode pembayaran tidak valid (pilih: cash, qris, transfer)" });
        }
        // Validasi payment method tersedia:
        //   - qris   → company harus punya QRIS aktif
        //   - transfer → company harus punya ≥1 rekening aktif
        if (paymentMethod === "qris") {
            const qris = await CompanyQris.findOne({ companyCode, active: true }).lean();
            if (!qris || !qris.qrisImage) {
                return res.status(400).json({ error: "QRIS belum tersedia — silakan pilih metode lain atau bayar di kasir" });
            }
        }
        if (paymentMethod === "transfer") {
            const count = await BankAccount.countDocuments({ companyCode, active: true });
            if (count === 0) {
                return res.status(400).json({ error: "Rekening transfer belum tersedia — silakan pilih metode lain atau bayar di kasir" });
            }
        }

        // ── Resolve item + harga dari master (server-side pricing) ──
        const barangs = await Barang.find({ companyCode, active: true }).lean();
        const productMap = new Map(barangs.map(b => [String(b._id), b]));
        let recipeMap = new Map();
        try {
            const recipes = await Recipe.find({ companyCode, status: "active" }).lean();
            recipeMap = new Map(recipes.map(r => [String(r._id), r]));
        } catch { /* tanpa recipe */ }

        const check = resolveOrderItems(req.body?.items, productMap, recipeMap);
        if (!check.ok) return res.status(400).json({ error: check.error });

        // ── Nomor order sequential per company ──
        const orderNumber = await nextOrderNumber(
            async (cc) => {
                const last = await TableOrder.findOne({ companyCode: cc }).sort({ orderNumber: -1 }).select("orderNumber").lean();
                return last ? last.orderNumber : null;
            },
            companyCode
        );

        // F&B V1 — itemId per baris (dipakai pembatalan PER-ITEM oleh kitchen):
        // "<orderNumber>-<idx>". Baris items & kitchenItems memakai id yang SAMA
        // (kitchenItems = subset dari items yang sama).
        const itemsWithId = check.items.map((it, idx) => ({
            ...it,
            itemId: `${orderNumber}-${idx + 1}`
        }));

        // Pajak mengikuti setting company (sama dengan kasir)
        let taxEnabled = true;
        try {
            const setting = await Setting.findOne({ companyCode }).lean();
            if (setting) taxEnabled = setting.taxEnabled !== false;
        } catch { /* default aktif */ }
        const TAX_RATE = taxEnabled ? 0.11 : 0;
        const subtotal = check.subtotal;
        const pajak = Math.round(subtotal * TAX_RATE * 100) / 100;
        const total = Math.round((subtotal + pajak) * 100) / 100;

        // F&B V1 — nomor WhatsApp customer (opsional): dipakai kirim notifikasi
        // status order via WhatsApp (Sidobe). Dinormalisasi ringan (digit + '+'
        // saja, maks 20) — format E.164 final dilakukan service wa-notify.
        const customerWhatsapp = String(req.body?.customerWhatsapp || "")
            .replace(/[^\d+]/g, "")
            .slice(0, 20);

        const orderToken = generateToken(18);

        // ── Kitchen items (F&B V1): HANYA produk behavior recipe / recipe-fnb
        // yang dikerjakan DAPUR. Barang dagangan (trading) & jasa (service)
        // disiapkan/diserahkan kasir bersamaan saat item resep selesai — TIDAK
        // masuk kitchen & TIDAK memicu notifikasi kitchen.
        const KITCHEN_BEHAVIORS = new Set(["recipe", "recipe-fnb"]);
        const kitchenItems = itemsWithId.filter(i => {
            const b = productMap.get(String(i.productId || ""));
            return b && KITCHEN_BEHAVIORS.has(String(b.behavior || ""));
        });
        const hasKitchenItems = kitchenItems.length > 0;

        const order = await TableOrder.create({
            companyCode,
            lokasiId: table.lokasiId || "",
            lokasiNama: table.lokasiNama || "",
            tableId: String(table._id),
            nomorMeja: table.nomorMeja,
            orderNumber,
            orderId: formatOrderId(orderNumber),
            orderSource: "qr_table",
            qrIdentifier: identifier,
            items: itemsWithId,
            kitchenItems,
            hasKitchenItems,
            subtotal,
            pajak,
            diskon: 0,
            total,
            paymentMethod,
            paymentStatus: "pending",
            // Order resep → kitchen (NEW). Order trading/jasa SAJA → langsung
            // READY (disiapkan kasir, customer lihat "pesanan siap").
            kitchenStatus: hasKitchenItems ? "new" : "ready",
            orderToken,
            catatanOrder: String(req.body?.catatanOrder || "").slice(0, 300),
            customerWhatsapp
        });

        // ── Role-based notification: KITCHEN bell "Order baru masuk" (§1) ──
        // HANYA order yang mengandung item resep — kitchen tidak terganggu
        // oleh order barang dagangan/jasa murni.
        if (hasKitchenItems) {
            await pushRoleNotification(order, "kitchen", "order_new");
        }

        // ── F&B V1 — WA CUSTOMER "Pesanan Anda telah diterima" (Sidobe) ──
        // Bila customer mengisi nomor WA saat checkout → kirim konfirmasi
        // via WA. Fire and forget — gagal tidak menggagalkan create.
        if (customerWhatsapp) {
            notifyOrderWhatsapp(order, "received").catch(err => {
                console.warn("[QR-Public] Gagal kirim WA diterima:", err?.message);
            });
        }

        res.status(201).json({
            order: {
                orderId: order.orderId,
                orderNumber: order.orderNumber,
                orderToken: order.orderToken,
                nomorMeja: order.nomorMeja,
                items: order.items,
                subtotal: order.subtotal,
                pajak: order.pajak,
                total: order.total,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                kitchenStatus: order.kitchenStatus,
                hasKitchenItems: order.hasKitchenItems,
                createdAt: order.createdAt
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /orders/:orderToken — status order utk halaman customer
 * (polling + setelah order dibuat). Mengembalikan info payment yang relevan
 * + riwayat bukti pembayaran (status/verified — TANPA dataUri) +
 * canUploadProof (boleh upload ulang / belum pernah upload).
 */
router.get("/orders/:orderToken", async (req, res) => {
    try {
        const order = await TableOrder.findOne({ orderToken: req.params.orderToken }).lean();
        if (!order) return res.status(404).json({ error: "Order tidak ditemukan" });

        // Riwayat bukti pembayaran (history tidak pernah dihapus — audit §12).
        let proofs = [];
        let canUploadProof = false;
        try {
            const docs = await PaymentProof.find({
                companyCode: order.companyCode,
                orderId: String(order._id)
            })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();
            proofs = docs.map(sanitizeProof);
            // Boleh upload bila: payment belum lunas, metode qris/transfer, dan
            // TIDAK ada bukti berstatus pending (tunggu verifikasi kasir).
            // Order yang DIBATALKAN (kitchen) tidak boleh upload bukti lagi.
            const hasPending = docs.some(d => d.status === "pending");
            canUploadProof = order.paymentStatus !== "paid"
                && order.kitchenStatus !== "cancelled"
                && ["qris", "transfer"].includes(order.paymentMethod)
                && !hasPending;
        } catch { /* tanpa riwayat bukti tetap valid */ }

        res.json({
            order: {
                orderId: order.orderId,
                orderNumber: order.orderNumber,
                nomorMeja: order.nomorMeja,
                items: order.items,
                subtotal: order.subtotal,
                pajak: order.pajak,
                total: order.total,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                kitchenStatus: order.kitchenStatus,
                hasKitchenItems: order.hasKitchenItems,
                confirmedAt: order.confirmedAt || null,
                readyAt: order.readyAt || null,
                // F&B V1 — order dibatalkan / refund (dari kitchen & kasir)
                cancelledAt: order.cancelledAt || null,
                cancelledBy: order.cancelledBy || "",
                refundStatus: order.refundStatus || "none",
                refundAmount: Number(order.refundAmount) || 0,
                refundedAt: order.refundedAt || null,
                createdAt: order.createdAt,
                proofs,
                canUploadProof
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /orders/:orderToken/proof — UPLOAD BUKTI PEMBAYARAN (customer, PUBLIK).
 * Body: { dataUri: "data:image/jpeg;base64,...", fileName?, mimeType? }
 *
 * Keamanan (§16): bukti di-resolve server dari orderToken → companyCode +
 * orderId (customer hanya bisa upload utk order miliknya — token tidak
 * diketahui orang lain). Upload TIDAK mengubah paymentStatus (PENDING tetap
 * PENDING — §13; PAID HANYA setelah kasir verifikasi manual).
 *
 * Aturan (duplicate upload §12): bila sudah ada bukti PENDING → 409
 * (tunggu verifikasi); setelah REJECTED / belum pernah → boleh upload ulang
 * (history lama TIDAK dihapus).
 */
router.post("/orders/:orderToken/proof", async (req, res) => {
    try {
        const orderToken = String(req.params.orderToken || "").trim();
        const order = await TableOrder.findOne({ orderToken }).lean();
        if (!order) return res.status(404).json({ error: "Order tidak ditemukan — token tidak valid" });

        if (order.paymentStatus === "paid") {
            return res.status(409).json({ error: "Pembayaran sudah dikonfirmasi kasir" });
        }
        if (order.kitchenStatus === "cancelled") {
            return res.status(409).json({ error: "Order sudah dibatalkan — pembayaran tidak perlu di-upload" });
        }
        if (!["qris", "transfer"].includes(order.paymentMethod)) {
            return res.status(400).json({ error: "Metode pembayaran ini tidak memerlukan bukti (pilih QRIS/Transfer)" });
        }

        // Duplicate upload: satu bukti PENDING aktif per order.
        const hasPending = await PaymentProof.exists({
            companyCode: order.companyCode,
            orderId: String(order._id),
            status: "pending"
        });
        if (hasPending) {
            return res.status(409).json({ error: "Bukti sebelumnya masih menunggu verifikasi kasir — silakan tunggu" });
        }

        // Validasi data URI (tipe JPG/PNG/WEBP + ukuran).
        const parse = parseProofDataUri(req.body?.dataUri);
        if (!parse.ok) return res.status(400).json({ error: parse.error });

        const proof = await PaymentProof.create({
            companyCode: order.companyCode,
            orderId: String(order._id),
            orderToken,
            orderNumber: order.orderNumber,
            nomorMeja: order.nomorMeja,
            mimeType: parse.mimeType,
            dataUri: parse.dataUri,
            status: "pending",
            uploadedBy: "customer"
        });

        // ── Role-based notification: CASHIER bell "Pembayaran baru menunggu
        // verifikasi" (§2) — best effort, tidak menggagalkan upload.
        await pushRoleNotification(order, "cashier", "payment_proof");

        try {
            await audit.log({
                actorId: null,
                actorName: "customer",
                actorType: "customer",
                ip: req.ip || "",
                userAgent: req.headers["user-agent"] || "",
                action: "payment.proof_uploaded",
                category: "payment",
                companyCode: order.companyCode,
                targetType: "order",
                targetId: String(order._id),
                targetName: order.orderId || ""
            });
        } catch { /* audit best effort */ }

        res.status(201).json({
            ok: true,
            message: "Bukti transaksi telah dikirim — silakan tunggu konfirmasi dari kasir",
            proof: sanitizeProof(proof)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
