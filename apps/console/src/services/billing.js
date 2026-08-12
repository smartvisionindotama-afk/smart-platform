/**
 * SMART Console — Billing & Subscription Center Service (SP-029 M6).
 *
 * Client untuk API Billing:
 *   /api/plans, /api/features, /api/subscriptions, /api/entitlements,
 *   /api/usage, /api/invoices, /api/payments
 *
 * @module console/services/billing
 */

import { authorizedFetch } from "@smart/api";

const API = "/api";

async function request(path, options = {}) {
    const res = await authorizedFetch(`${API}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

// ── Plans ──
export async function listPlans(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/plans${qs ? `?${qs}` : ""}`);
}
export async function createPlan(data) {
    return request("/plans", { method: "POST", body: JSON.stringify(data) });
}
export async function updatePlan(id, data) {
    return request(`/plans/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

// ── Features ──
export async function listFeatures(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/features${qs ? `?${qs}` : ""}`);
}
export async function createFeature(data) {
    return request("/features", { method: "POST", body: JSON.stringify(data) });
}
export async function updateFeature(id, data) {
    return request(`/features/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

// ── Subscriptions ──
export async function listSubscriptions(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/subscriptions${qs ? `?${qs}` : ""}`);
}
export async function createSubscription(data) {
    return request("/subscriptions", { method: "POST", body: JSON.stringify(data) });
}
export async function subscriptionAction(id, action, data = {}) {
    return request(`/subscriptions/${id}/${action}`, { method: "POST", body: JSON.stringify(data) });
}
export async function listSubscriptionChanges(id) {
    return request(`/subscriptions/${id}/changes`);
}

// ── Entitlements ──
export async function listEntitlements(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/entitlements${qs ? `?${qs}` : ""}`);
}
export async function companyEntitlements(companyId) {
    return request(`/entitlements/company/${companyId}`);
}
export async function overrideEntitlement(data) {
    return request("/entitlements", { method: "POST", body: JSON.stringify(data) });
}

// ── Usage ──
export async function listUsage(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/usage${qs ? `?${qs}` : ""}`);
}
export async function usageAggregate(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/usage/aggregate${qs ? `?${qs}` : ""}`);
}
export async function recordUsage(data) {
    return request("/usage", { method: "POST", body: JSON.stringify(data) });
}
export async function usageStatus(companyId, featureId) {
    return request(`/usage/status/${companyId}/${featureId}`);
}

// ── Invoices ──
export async function listInvoices(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/invoices${qs ? `?${qs}` : ""}`);
}
export async function generateInvoice(data) {
    return request("/invoices/generate", { method: "POST", body: JSON.stringify(data) });
}

/** M6-FIX: invoice langsung per company + periode (idempotent, item per fitur). */
export async function generateCompanyInvoice(data) {
    return request("/invoices/generate-company", { method: "POST", body: JSON.stringify(data) });
}

/** M6-FIX: set harga per fitur per perusahaan (override Entitlement.price). */
export async function setEntitlementPrice(data) {
    return request("/entitlements/price", { method: "POST", body: JSON.stringify(data) });
}
export async function invoiceAction(id, action, data = {}) {
    return request(`/invoices/${id}/${action}`, { method: "POST", body: JSON.stringify(data) });
}

// ── Payments ──
export async function listPayments(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/payments${qs ? `?${qs}` : ""}`);
}
export async function recordPayment(data) {
    return request("/payments", { method: "POST", body: JSON.stringify(data) });
}
export async function paymentAction(id, action, data = {}) {
    return request(`/payments/${id}/${action}`, { method: "POST", body: JSON.stringify(data) });
}

// ── Billing Summary per company (M6-FIX Task 2) ──
export async function companyBillingSummary(companyId) {
    return request(`/billing/company/${companyId}`);
}

// ── Overview ──
export async function billingOverview() {
    const [plans, features, subs, invoices, payments] = await Promise.all([
        listPlans({ limit: 100 }),
        listFeatures({ limit: 100 }),
        listSubscriptions({ limit: 100 }),
        listInvoices({ limit: 100 }),
        listPayments({ limit: 100 })
    ]);
    const activeSubs = (subs.data || []).filter(s => s.status === "ACTIVE" || s.status === "TRIAL" || s.status === "PAST_DUE");
    const pendingInvoices = (invoices.data || []).filter(i => i.status === "PENDING" || i.status === "ISSUED");
    const overdueInvoices = (invoices.data || []).filter(i => i.status === "OVERDUE");
    const paidInvoices = (invoices.data || []).filter(i => i.status === "PAID");
    const paidPayments = (payments.data || []).filter(p => p.status === "PAID");

    // MRR/ARR: hanya dari subscription ACTIVE dengan billingCycle MONTHLY/YEARLY.
    let mrr = 0;
    let arr = 0;
    for (const s of activeSubs) {
        if (s.status !== "ACTIVE") continue;
        const price = Number(s.price) || 0;
        if (s.billingCycle === "YEARLY") { arr += price; mrr += Math.round(price / 12); }
        else if (s.billingCycle === "MONTHLY") { mrr += price; arr += price * 12; }
    }

    return {
        plans: (plans.data || []).length,
        features: (features.data || []).length,
        activeSubscriptions: activeSubs.length,
        pendingInvoices: pendingInvoices.length,
        overdueInvoices: overdueInvoices.length,
        paidInvoices: paidInvoices.length,
        paidPayments: paidPayments.length,
        mrr,
        arr
    };
}
