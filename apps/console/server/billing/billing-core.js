/**
 * Billing Core — pure functions (SP-029 M6).
 *
 * Semua perhitungan keuangan SERVER-SIDE dengan integer minor units
 * (untuk IDR = rupiah). Tidak ada floating-point untuk uang.
 *
 * @module console/server/billing/billing-core
 */

/** Status yang valid untuk subscription. */
export const SUBSCRIPTION_STATUS = ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"];

/** Transition yang diizinkan (state machine). */
export const SUBSCRIPTION_TRANSITIONS = {
    TRIAL: ["ACTIVE", "EXPIRED", "CANCELLED"],
    ACTIVE: ["PAST_DUE", "CANCELLED", "SUSPENDED", "EXPIRED"],
    PAST_DUE: ["ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"],
    SUSPENDED: ["ACTIVE", "CANCELLED", "EXPIRED"],
    CANCELLED: [],          // terminal
    EXPIRED: []             // terminal
};

/**
 * Validasi transition status subscription.
 * @param {string} from
 * @param {string} to
 * @returns {{ ok: boolean, error?: string }}
 */
export function canTransition(from, to) {
    if (!SUBSCRIPTION_STATUS.includes(from) || !SUBSCRIPTION_STATUS.includes(to)) {
        return { ok: false, error: `Status tidak dikenal: ${from} → ${to}` };
    }
    if (from === to) return { ok: false, error: `Status sudah ${from}` };
    const allowed = SUBSCRIPTION_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
        return { ok: false, error: `Transisi tidak valid: ${from} → ${to}` };
    }
    return { ok: true };
}

/**
 * Format angka sebagai rupiah (minor units → string tampilan).
 * @param {number} amount Integer minor units
 * @returns {string}
 */
export function formatIDR(amount) {
    const n = Math.trunc(Number(amount) || 0);
    return `Rp${n.toLocaleString("id-ID")}`;
}

/**
 * Hitung total invoice server-side (integer, tidak ada float).
 * subtotal + addon - discount + tax.
 * @param {object} params
 * @param {number} params.subtotal
 * @param {number} [params.addons=0]
 * @param {number} [params.discount=0]
 * @param {number} [params.taxRate=0] persen (0..100)
 * @returns {{ subtotal: number, addons: number, discount: number, taxableBase: number, tax: number, total: number }}
 */
export function calculateInvoiceTotal({ subtotal, addons = 0, discount = 0, taxRate = 0 }) {
    const sub = Math.trunc(Number(subtotal) || 0);
    const add = Math.trunc(Number(addons) || 0);
    const disc = Math.trunc(Number(discount) || 0);
    const base = sub + add - disc;
    const safeBase = Math.max(0, base);
    const rate = Math.min(100, Math.max(0, Number(taxRate) || 0));
    const tax = Math.trunc((safeBase * rate) / 100);
    const total = safeBase + tax;
    return { subtotal: sub, addons: add, discount: disc, taxableBase: safeBase, tax, total };
}

/**
 * Hitung invoice number reproducible: INV/YYYY/MM/sequence.
 * @param {number} seq Sequence per bulan
 * @param {Date} [date]
 * @returns {string}
 */
export function buildInvoiceNumber(seq, date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `INV/${y}/${m}/${String(seq).padStart(6, "0")}`;
}

/**
 * Bulan period berikutnya (untuk auto-renew).
 * @param {Date} date
 * @returns {Date}
 */
export function addMonth(date) {
    const d = new Date(date);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
}

/**
 * Format period label "YYYY-MM" dari Date.
 * @param {Date} date
 * @returns {string}
 */
export function periodKey(date) {
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Tambah satu billing cycle ke tanggal (M6-FIX v2).
 * Sumber tunggal renewal: MONTHLY = kalender (addMonth), YEARLY = 365 hari.
 * Dipakai settlePostPayment DAN route /renew agar tidak drift.
 * @param {Date} date
 * @param {string} cycle MONTHLY | YEARLY
 * @returns {Date}
 */
export function addBillingCycle(date, cycle = "MONTHLY") {
    const base = new Date(date);
    if (cycle === "YEARLY") {
        base.setUTCFullYear(base.getUTCFullYear() + 1);
    } else {
        base.setUTCMonth(base.getUTCMonth() + 1);
    }
    return base;
}

/**
 * Resolusi harga per fitur (M6-FIX "harga per fitur per perusahaan"):
 * override Entitlement.price ?? harga katalog Feature.price.
 * Integer minor units, anti float.
 * @param {object} ent Entitlement lean { price }
 * @param {object} [feature] Feature lean { price }
 * @returns {number}
 */
export function resolveFeaturePrice(ent = {}, feature = {}) {
    const p = ent.price != null ? Number(ent.price) : Number(feature.price || 0);
    const n = Math.trunc(p);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Bangun item invoice dari entitlement ENABLED (harga per fitur).
 * Fitur dengan harga efektif <= 0 (gratis) TIDAK ditagih.
 * @param {Array} ents Entitlements lean { featureSlug, featureId, price, enabled }
 * @param {Array} features Features lean { slug, name, price }
 * @returns {Array<{kind,label,amount,quantity,unitPrice,refType,refId}>}
 */
export function buildCompanyItems(ents = [], features = []) {
    const featBySlug = new Map(features.map(f => [f.slug, f]));
    const items = [];
    for (const ent of ents) {
        if (!ent.enabled) continue;
        const feat = featBySlug.get(ent.featureSlug);
        const unitPrice = resolveFeaturePrice(ent, feat);
        if (unitPrice <= 0) continue;
        items.push({
            kind: "feature",
            label: feat?.name || ent.featureSlug,
            amount: unitPrice,
            quantity: 1,
            unitPrice,
            refType: "feature",
            refId: String(ent.featureId || "")
        });
    }
    return items;
}

export default {
    SUBSCRIPTION_STATUS,
    SUBSCRIPTION_TRANSITIONS,
    canTransition,
    formatIDR,
    calculateInvoiceTotal,
    buildInvoiceNumber,
    addMonth,
    periodKey,
    resolveFeaturePrice,
    buildCompanyItems,
    addBillingCycle
};
