/**
 * SMART Console — Billing & Subscription Center (SP-029 M6).
 *
 * Commercial control plane: Overview, Plans, Features, Subscriptions,
 * Invoices, Payments, Usage, Entitlements.
 *
 * Semua perhitungan finansial server-side (integer minor units).
 * @module console/pages/billing
 */

import { Modal, Input, Select, showToast } from "@smart/ui";
import {
    billingOverview,
    listPlans, createPlan, updatePlan,
    listFeatures, createFeature, updateFeature,
    listSubscriptions, createSubscription, subscriptionAction, listSubscriptionChanges,
    listEntitlements, overrideEntitlement, companyEntitlements,
    listUsage, recordUsage, usageAggregate,
    listInvoices, generateInvoice, generateCompanyInvoice, invoiceAction,
    listPayments, recordPayment, paymentAction,
    setEntitlementPrice
} from "../../services/billing.js";
import { listCompanies } from "../../services/companies.js";
import { pageHeader, loadingHTML, esc, mountPagination, formatDateTime } from "../_shared.js";

let currentTab = "overview";
let _companies = [];

const SUB_STATUS = {
    TRIAL: { cls: "smart-badge-info", label: "Trial" },
    ACTIVE: { cls: "smart-badge-success", label: "Active" },
    PAST_DUE: { cls: "smart-badge-warning", label: "Past Due" },
    SUSPENDED: { cls: "smart-badge-danger", label: "Suspended" },
    CANCELLED: { cls: "smart-badge-secondary", label: "Cancelled" },
    EXPIRED: { cls: "smart-badge-secondary", label: "Expired" }
};

const INV_STATUS = {
    DRAFT: { cls: "smart-badge-secondary", label: "Draft" },
    ISSUED: { cls: "smart-badge-info", label: "Issued" },
    PENDING: { cls: "smart-badge-warning", label: "Pending" },
    PAID: { cls: "smart-badge-success", label: "Paid" },
    OVERDUE: { cls: "smart-badge-danger", label: "Overdue" },
    VOID: { cls: "smart-badge-secondary", label: "Void" },
    CANCELLED: { cls: "smart-badge-secondary", label: "Cancelled" }
};

const PAY_STATUS = {
    PENDING: { cls: "smart-badge-warning", label: "Pending" },
    PAID: { cls: "smart-badge-success", label: "Paid" },
    FAILED: { cls: "smart-badge-danger", label: "Failed" },
    EXPIRED: { cls: "smart-badge-secondary", label: "Expired" },
    REFUNDED: { cls: "smart-badge-info", label: "Refunded" },
    CANCELLED: { cls: "smart-badge-secondary", label: "Cancelled" }
};

function statusChip(map, status) {
    const s = map[status] || { cls: "smart-badge-secondary", label: status || "—" };
    return `<span class="smart-badge ${s.cls}">${esc(s.label)}</span>`;
}

function formatIDR(n) {
    const v = Math.trunc(Number(n) || 0);
    return `Rp${v.toLocaleString("id-ID")}`;
}

function companyName(id) {
    const c = _companies.find(x => String(x._id) === String(id));
    return c ? esc(c.name) : esc(String(id).slice(0, 8));
}

async function loadCompanies() {
    const res = await listCompanies({ page: 1, limit: 999 });
    _companies = Array.isArray(res?.data) ? res.data : [];
    return _companies;
}

// ═══════════════════════════════ OVERVIEW ═══════════════════════════════

async function renderOverview(container) {
    const stats = await billingOverview();
    container.innerHTML = `
        <div class="dp-grid dp-grid-3">
            <div class="cn-card"><div class="cn-card-header"><span class="cn-card-title">Plans</span></div>
                <div class="cn-card-body dp-stat">${stats.plans}</div></div>
            <div class="cn-card"><div class="cn-card-header"><span class="cn-card-title">Features</span></div>
                <div class="cn-card-body dp-stat">${stats.features}</div></div>
            <div class="cn-card"><div class="cn-card-header"><span class="cn-card-title">Active Subscriptions</span></div>
                <div class="cn-card-body dp-stat">${stats.activeSubscriptions}</div></div>
        </div>
        <div class="dp-grid dp-grid-3">
            <div class="cn-card"><div class="cn-card-header"><span class="cn-card-title">Pending Invoices</span></div>
                <div class="cn-card-body dp-stat">${stats.pendingInvoices}</div></div>
            <div class="cn-card"><div class="cn-card-header"><span class="cn-card-title">Overdue Invoices</span></div>
                <div class="cn-card-body dp-stat ${stats.overdueInvoices > 0 ? "dp-stat-warn" : ""}">${stats.overdueInvoices}</div></div>
            <div class="cn-card"><div class="cn-card-header"><span class="cn-card-title">Paid Invoices</span></div>
                <div class="cn-card-body dp-stat">${stats.paidInvoices}</div></div>
        </div>
        <div class="dp-grid dp-grid-2">
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">MRR (Monthly Recurring Revenue)</span></div>
                <div class="cn-card-body dp-stat">${formatIDR(stats.mrr)}</div>
                <div class="cn-card-body cn-muted">Hanya dari subscription ACTIVE (tanpa data fiktif)</div>
            </div>
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">ARR (Annual Recurring Revenue)</span></div>
                <div class="cn-card-body dp-stat">${formatIDR(stats.arr)}</div>
                <div class="cn-card-body cn-muted">Hanya dari subscription ACTIVE (tanpa data fiktif)</div>
            </div>
        </div>
        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Alur Komersial Platform</span></div>
            <div class="cn-card-body cn-muted" style="line-height:1.9">
                Company → Plan → Subscription → Entitlement → Feature → Application Access<br>
                Invoice → Payment → Payment Verify → Access / Feature (server-side, audit, idempotent)
            </div>
        </div>
    `;
}

// ═══════════════════════════════ PLANS ═══════════════════════════════

async function renderPlans(container) {
    const body = container.querySelector("#bl-body");
    body.innerHTML = `
        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Plans</span>
                <button class="smart-btn smart-btn-primary" id="bl-plan-new">+ Tambah Plan</button></div>
            <div class="cn-card-body dp-table-wrap">
                <table class="dp-table">
                    <thead><tr><th>Plan</th><th>Cycle</th><th>Harga (bulanan)</th><th>Features</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody id="bl-plans-body"></tbody>
                </table>
            </div>
        </div>`;
    container.querySelector("#bl-plan-new").addEventListener("click", () => openPlanModal(container, null));
    await renderPlansTable(container);
}

async function renderPlansTable(container) {
    const tbody = container.querySelector("#bl-plans-body");
    tbody.innerHTML = loadingHTML();
    const res = await listPlans({ limit: 100 });
    tbody.innerHTML = (res.data || []).map(p => `
        <tr>
            <td><strong>${esc(p.name)}</strong><br><span class="cn-mono">${esc(p.slug)}</span></td>
            <td>${esc(p.billingCycle)}</td>
            <td>${formatIDR(p.billingCycle === "YEARLY" ? Math.round(p.price / 12) : p.price)}<br>
                <span class="cn-muted">${formatIDR(p.price)}/${esc(p.billingCycle === "YEARLY" ? "tahun" : "bulan")}</span></td>
            <td class="cn-muted">${(p.features || []).length} fitur</td>
            <td>${p.status === "active" ? statusChip(SUB_STATUS, "ACTIVE") : statusChip(SUB_STATUS, "SUSPENDED")}</td>
            <td><button class="smart-btn smart-btn-secondary bl-edit-plan" data-id="${p._id}">Edit</button></td>
        </tr>`).join("");
    tbody.querySelectorAll(".bl-edit-plan").forEach(btn => {
        btn.addEventListener("click", async () => {
            const res2 = await listPlans({ limit: 100 });
            const p = (res2.data || []).find(x => String(x._id) === String(btn.dataset.id));
            if (p) openPlanModal(container, p);
        });
    });
}

async function openPlanModal(container, plan) {
    const features = await listFeatures({ limit: 100 });
    const featureOptions = (features.data || []).map(f =>
        `<label class="bl-check"><input type="checkbox" class="bl-plan-feature" value="${esc(f.slug)}" ${plan?.features?.includes(f.slug) ? "checked" : ""}> ${esc(f.name)}</label>`
    ).join("");

    const modal = new Modal({
        title: plan ? "Edit Plan" : "Tambah Plan",
        content: `
            <div class="bl-form">
                <label>Nama</label><input class="smart-input bl-p-name" value="${esc(plan?.name || "")}" />
                <label>Slug</label><input class="smart-input bl-p-slug" value="${esc(plan?.slug || "")}" ${plan ? "disabled" : ""} />
                <label>Deskripsi</label><input class="smart-input bl-p-desc" value="${esc(plan?.description || "")}" />
                <label>Billing Cycle</label>
                <select class="smart-input bl-p-cycle">
                    ${["MONTHLY", "YEARLY", "CUSTOM"].map(c => `<option ${plan?.billingCycle === c ? "selected" : ""}>${c}</option>`).join("")}
                </select>
                <label>Harga (Rp — integer)</label><input class="smart-input bl-p-price" type="number" min="0" step="1" value="${plan?.price ?? ""}" />
                <label>Features</label><div class="bl-features">${featureOptions || '<span class="cn-muted">Belum ada feature — buat di tab Features</span>'}</div>
            </div>
        `,
        footer: `
            <button class="smart-btn smart-btn-secondary" data-close>Batal</button>
            <button class="smart-btn smart-btn-primary" id="bl-plan-save">${plan ? "Simpan Perubahan" : "Buat Plan"}</button>
        `
    });
    modal.open();
    modal.onClose = () => {};

    container.querySelector("#bl-plan-save").addEventListener("click", async () => {
        const payload = {
            name: container.querySelector(".bl-p-name").value.trim(),
            slug: container.querySelector(".bl-p-slug").value.trim(),
            description: container.querySelector(".bl-p-desc").value.trim(),
            billingCycle: container.querySelector(".bl-p-cycle").value,
            price: Number(container.querySelector(".bl-p-price").value),
            features: Array.from(container.querySelectorAll(".bl-plan-feature:checked")).map(c => c.value)
        };
        try {
            if (plan) await updatePlan(plan._id, payload);
            else await createPlan(payload);
            showToast("success", "Plan disimpan");
            modal.close();
            renderPlansTable(container);
        } catch (e) {
            showToast("danger", e.message);
        }
    });
}

// ═══════════════════════════════ FEATURES ═══════════════════════════════

async function renderFeatures(container) {
    const body = container.querySelector("#bl-body");
    body.innerHTML = `
        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Feature Catalog</span>
                <button class="smart-btn smart-btn-primary" id="bl-feat-new">+ Tambah Feature</button></div>
            <div class="cn-card-body dp-table-wrap">
                <table class="dp-table">
                    <thead><tr><th>Feature</th><th>Kategori</th><th>Unit</th><th>Harga Katalog</th><th>Override</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody id="bl-features-body"></tbody>
                </table>
            </div>
        </div>`;
    container.querySelector("#bl-feat-new").addEventListener("click", () => openFeatureModal(container, null));
    await renderFeaturesTable(container);
}

async function renderFeaturesTable(container) {
    const tbody = container.querySelector("#bl-features-body");
    tbody.innerHTML = loadingHTML();
    const res = await listFeatures({ limit: 100 });
    tbody.innerHTML = (res.data || []).map(f => `
        <tr>
            <td><strong>${esc(f.name)}</strong><br><span class="cn-mono">${esc(f.slug)}</span></td>
            <td>${esc(f.category)}</td>
            <td>${esc(f.unit)}</td>
            <td>${f.price > 0 ? `<strong>${formatIDR(f.price)}</strong>` : `<span class="cn-muted">Gratis</span>`}</td>
            <td>${f.overrideCount > 0
                ? `<span class="smart-badge smart-badge-warning">${f.overrideCount} company override</span>`
                : `<span class="cn-muted">—</span>`}</td>
            <td>${f.status === "active" ? statusChip(SUB_STATUS, "ACTIVE") : statusChip(SUB_STATUS, "SUSPENDED")}</td>
            <td><button class="smart-btn smart-btn-secondary bl-edit-feat" data-id="${f._id}">Edit</button></td>
        </tr>`).join("");
    tbody.querySelectorAll(".bl-edit-feat").forEach(btn => {
        btn.addEventListener("click", async () => {
            const res2 = await listFeatures({ limit: 100 });
            const f = (res2.data || []).find(x => String(x._id) === String(btn.dataset.id));
            if (f) openFeatureModal(container, f);
        });
    });
}

async function openFeatureModal(container, feature) {
    const modal = new Modal({
        title: feature ? "Edit Feature" : "Tambah Feature",
        content: `
            <div class="bl-form">
                <label>Nama</label><input class="smart-input bl-f-name" value="${esc(feature?.name || "")}" />
                <label>Slug</label><input class="smart-input bl-f-slug" value="${esc(feature?.slug || "")}" ${feature ? "disabled" : ""} />
                <label>Deskripsi</label><input class="smart-input bl-f-desc" value="${esc(feature?.description || "")}" />
                <label>Kategori</label><input class="smart-input bl-f-cat" value="${esc(feature?.category || "general")}" />
                <label>Unit</label>
                <select class="smart-input bl-f-unit">
                    ${["FEATURE", "USER", "TRANSACTION", "DOCUMENT", "STORAGE", "API_CALL", "AI_TOKEN"].map(u => `<option ${feature?.unit === u ? "selected" : ""}>${u}</option>`).join("")}
                </select>
                <label>Harga Katalog (Rp, 0 = gratis)</label><input class="smart-input bl-f-price" type="number" min="0" value="${feature?.price ?? 0}" />
                ${feature?.overrideCount > 0 ? `<p class="cn-muted">⚠️ ${feature.overrideCount} perusahaan meng-override harga fitur ini — perubahan katalog tidak mengubah harga override mereka.</p>` : ""}
            </div>
        `,
        footer: `
            <button class="smart-btn smart-btn-secondary" data-close>Batal</button>
            <button class="smart-btn smart-btn-primary" id="bl-feat-save">${feature ? "Simpan Perubahan" : "Buat Feature"}</button>
        `
    });
    modal.open();

    container.querySelector("#bl-feat-save").addEventListener("click", async () => {
        const payload = {
            name: container.querySelector(".bl-f-name").value.trim(),
            slug: container.querySelector(".bl-f-slug").value.trim(),
            description: container.querySelector(".bl-f-desc").value.trim(),
            category: container.querySelector(".bl-f-cat").value.trim(),
            unit: container.querySelector(".bl-f-unit").value,
            price: Number(container.querySelector(".bl-f-price").value || 0)
        };
        try {
            if (feature) await updateFeature(feature._id, payload);
            else await createFeature(payload);
            showToast("success", "Feature disimpan");
            modal.close();
            renderFeaturesTable(container);
        } catch (e) {
            showToast("danger", e.message);
        }
    });
}

// ═══════════════════════════════ SUBSCRIPTIONS ═══════════════════════════════

async function renderSubscriptions(container) {
    const body = container.querySelector("#bl-body");
    body.innerHTML = `
        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Subscriptions</span>
                <button class="smart-btn smart-btn-primary" id="bl-sub-new">+ Buat Subscription</button></div>
            <div class="cn-card-body dp-table-wrap">
                <table class="dp-table">
                    <thead><tr><th>Company</th><th>Plan</th><th>Status</th><th>Periode</th><th>Harga</th><th>Actions</th></tr></thead>
                    <tbody id="bl-subs-body"></tbody>
                </table>
            </div>
            <div class="cn-pagination-row" id="bl-subs-pagination"></div>
        </div>`;
    container.querySelector("#bl-sub-new").addEventListener("click", () => openSubModal(container));
    await renderSubsTable(container, 1);
}

async function renderSubsTable(container, page = 1) {
    const tbody = container.querySelector("#bl-subs-body");
    tbody.innerHTML = loadingHTML();
    const res = await listSubscriptions({ page, limit: 20 });
    tbody.innerHTML = (res.data || []).map(s => `
        <tr>
            <td>${companyName(s.companyId?._id || s.companyId)}</td>
            <td>${esc(s.planId?.name || s.planId?.slug || "—")}</td>
            <td>${statusChip(SUB_STATUS, s.status)}</td>
            <td class="cn-muted">${formatDateTime(s.startDate)} → ${formatDateTime(s.endDate)}</td>
            <td>${formatIDR(s.price)}</td>
            <td>
                <button class="smart-btn smart-btn-secondary bl-sub-act" data-id="${s._id}" data-act="activate">Activate</button>
                <button class="smart-btn smart-btn-secondary bl-sub-act" data-id="${s._id}" data-act="suspend">Suspend</button>
                <button class="smart-btn smart-btn-secondary bl-sub-act" data-id="${s._id}" data-act="cancel">Cancel</button>
                <button class="smart-btn smart-btn-secondary bl-sub-act" data-id="${s._id}" data-act="change-plan">Ganti Plan</button>
                <button class="smart-btn smart-btn-secondary bl-sub-hist" data-id="${s._id}">Riwayat</button>
            </td>
        </tr>`).join("");
    mountPagination(container.querySelector("#bl-subs-pagination"), res.pagination, p => renderSubsTable(container, p));

    tbody.querySelectorAll(".bl-sub-act").forEach(btn => {
        btn.addEventListener("click", async () => {
            const { id, act } = btn.dataset;
            try {
                if (act === "change-plan") {
                    openChangePlanModal(container, id);
                    return;
                }
                await subscriptionAction(id, act, { reason: `action ${act} via console` });
                showToast("success", `Subscription ${act} berhasil`);
                renderSubsTable(container, 1);
            } catch (e) {
                showToast("danger", e.message);
            }
        });
    });
    tbody.querySelectorAll(".bl-sub-hist").forEach(btn => {
        btn.addEventListener("click", async () => {
            const changes = await listSubscriptionChanges(btn.dataset.id);
            const rows = (changes.data || []).map(c => `
                <tr><td>${esc(c.changeType)}</td><td>${esc(c.oldStatus || "—")}</td><td>${esc(c.newStatus || "—")}</td>
                <td>${esc(c.oldPlanId?.slug || "—")}</td><td>${esc(c.newPlanId?.slug || "—")}</td>
                <td>${formatDateTime(c.createdAt)}</td><td class="cn-muted">${esc(c.reason || "")}</td></tr>`).join("");
            const modal = new Modal({
                title: "Riwayat Subscription",
                content: `<div class="dp-table-wrap"><table class="dp-table">
                    <thead><tr><th>Perubahan</th><th>Dari</th><th>Ke</th><th>Plan Lama</th><th>Plan Baru</th><th>Waktu</th><th>Alasan</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="7" class="cn-muted">Belum ada riwayat</td></tr>'}</tbody></table></div>`,
                footer: `<button class="smart-btn smart-btn-primary" data-close>Tutup</button>`
            });
            modal.open();
        });
    });
}

async function openSubModal(container) {
    const plans = await listPlans({ limit: 100 });
    const companyOptions = _companies.map(c => `<option value="${c._id}">${esc(c.name)} (${esc(c.code)})</option>`).join("");
    const modal = new Modal({
        title: "Buat Subscription",
        content: `
            <div class="bl-form">
                <label>Company</label>
                <select class="smart-input bl-s-company">${companyOptions || "<option>Belum ada company</option>"}</select>
                <label>Plan</label>
                <select class="smart-input bl-s-plan">
                    ${(plans.data || []).map(p => `<option value="${p._id}">${esc(p.name)} — ${formatIDR(p.price)}</option>`).join("")}
                </select>
                <label>Status Awal</label>
                <select class="smart-input bl-s-status"><option value="TRIAL">TRIAL</option><option value="ACTIVE">ACTIVE</option></select>
                <label>Trial (hari, 0 = tanpa trial)</label><input class="smart-input bl-s-trial" type="number" min="0" value="14" />
                <label>Catatan</label><input class="smart-input bl-s-notes" value="Subscription dibuat via Console" />
            </div>
        `,
        footer: `
            <button class="smart-btn smart-btn-secondary" data-close>Batal</button>
            <button class="smart-btn smart-btn-primary" id="bl-sub-save">Buat Subscription</button>
        `
    });
    modal.open();

    container.querySelector("#bl-sub-save").addEventListener("click", async () => {
        try {
            await createSubscription({
                companyId: container.querySelector(".bl-s-company").value,
                planId: container.querySelector(".bl-s-plan").value,
                status: container.querySelector(".bl-s-status").value,
                trialDays: Number(container.querySelector(".bl-s-trial").value || 0),
                notes: container.querySelector(".bl-s-notes").value
            });
            showToast("success", "Subscription dibuat");
            modal.close();
            renderSubsTable(container, 1);
        } catch (e) {
            showToast("danger", e.message);
        }
    });
}

async function openChangePlanModal(container, subId) {
    const plans = await listPlans({ limit: 100 });
    const modal = new Modal({
        title: "Ganti Plan (Upgrade/Downgrade)",
        content: `
            <div class="bl-form">
                <label>Plan Baru</label>
                <select class="smart-input bl-cp-plan">
                    ${(plans.data || []).map(p => `<option value="${p._id}">${esc(p.name)} — ${formatIDR(p.price)}</option>`).join("")}
                </select>
                <label>Alasan</label><input class="smart-input bl-cp-reason" value="Perubahan plan via Console" />
            </div>
        `,
        footer: `
            <button class="smart-btn smart-btn-secondary" data-close>Batal</button>
            <button class="smart-btn smart-btn-primary" id="bl-cp-save">Simpan Perubahan</button>
        `
    });
    modal.open();
    container.querySelector("#bl-cp-save").addEventListener("click", async () => {
        try {
            await subscriptionAction(subId, "change-plan", {
                planId: container.querySelector(".bl-cp-plan").value,
                reason: container.querySelector(".bl-cp-reason").value
            });
            showToast("success", "Plan berhasil diganti");
            modal.close();
            renderSubsTable(container, 1);
        } catch (e) {
            showToast("danger", e.message);
        }
    });
}

// ═══════════════════════════════ INVOICES ═══════════════════════════════

async function renderInvoices(container) {
    const body = container.querySelector("#bl-body");
    body.innerHTML = `
        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Invoices</span>
                <button class="smart-btn smart-btn-secondary" id="bl-inv-new-company">+ Invoice by Company</button>
                <button class="smart-btn smart-btn-primary" id="bl-inv-new">+ Generate Invoice</button></div>
            <div class="cn-card-body dp-table-wrap">
                <table class="dp-table">
                    <thead><tr><th>No. Invoice</th><th>Company</th><th>Periode</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody id="bl-invoices-body"></tbody>
                </table>
            </div>
            <div class="cn-pagination-row" id="bl-invoices-pagination"></div>
        </div>`;
    container.querySelector("#bl-inv-new").addEventListener("click", () => openInvoiceModal(container));
    container.querySelector("#bl-inv-new-company").addEventListener("click", () => openCompanyInvoiceModal(container));
    await renderInvoicesTable(container, 1);
}

async function renderInvoicesTable(container, page = 1) {
    const tbody = container.querySelector("#bl-invoices-body");
    tbody.innerHTML = loadingHTML();
    const res = await listInvoices({ page, limit: 20 });
    tbody.innerHTML = (res.data || []).map(i => `
        <tr>
            <td class="cn-mono">${esc(i.invoiceNumber)}</td>
            <td>${companyName(i.companyId?._id || i.companyId)}</td>
            <td class="cn-muted">${formatDateTime(i.periodStart)} → ${formatDateTime(i.periodEnd)}</td>
            <td><strong>${formatIDR(i.total)}</strong></td>
            <td>${statusChip(INV_STATUS, i.status)}</td>
            <td>
                <button class="smart-btn smart-btn-secondary bl-inv-detail" data-id="${i._id}">Detail</button>
                ${!["PAID", "VOID", "CANCELLED"].includes(i.status) ? `
                <button class="smart-btn smart-btn-secondary bl-inv-act" data-id="${i._id}" data-act="issue">Issue</button>
                <button class="smart-btn smart-btn-secondary bl-inv-act" data-id="${i._id}" data-act="transition" data-status="PENDING">Pending</button>
                <button class="smart-btn smart-btn-secondary bl-inv-act" data-id="${i._id}" data-act="transition" data-status="OVERDUE">Overdue</button>
                <button class="smart-btn smart-btn-secondary bl-inv-act" data-id="${i._id}" data-act="void">Void</button>` : ""}
            </td>
        </tr>`).join("");
    mountPagination(container.querySelector("#bl-invoices-pagination"), res.pagination, p => renderInvoicesTable(container, p));

    tbody.querySelectorAll(".bl-inv-detail").forEach(btn => {
        btn.addEventListener("click", async () => {
            const res2 = await listInvoices({ limit: 100 });
            const inv = (res2.data || []).find(x => String(x._id) === String(btn.dataset.id));
            if (!inv) return;
            const itemRows = (inv.items || []).map(it => `
                <tr><td>${esc(it.kind)}</td><td>${esc(it.label)}</td><td>${it.quantity}</td><td>${formatIDR(it.amount)}</td></tr>`).join("");
            const modal = new Modal({
                title: `Invoice ${inv.invoiceNumber}`,
                content: `
                    <div class="bl-form">
                        <p><strong>Company:</strong> ${esc(inv.companyId?.name || "—")}</p>
                        <p><strong>Status:</strong> ${statusChip(INV_STATUS, inv.status)}</p>
                        <div class="dp-table-wrap"><table class="dp-table">
                            <thead><tr><th>Item</th><th>Label</th><th>Qty</th><th>Amount</th></tr></thead>
                            <tbody>${itemRows}</tbody>
                            <tfoot>
                                <tr><td colspan="3"><strong>Subtotal</strong></td><td><strong>${formatIDR(inv.subtotal)}</strong></td></tr>
                                ${inv.discount ? `<tr><td colspan="3">Discount</td><td>-${formatIDR(inv.discount)}</td></tr>` : ""}
                                ${inv.tax ? `<tr><td colspan="3">Tax (${inv.taxRate}%)</td><td>${formatIDR(inv.tax)}</td></tr>` : ""}
                                <tr><td colspan="3"><strong>TOTAL</strong></td><td><strong>${formatIDR(inv.total)}</strong></td></tr>
                            </tfoot>
                        </table></div>
                    </div>
                `,
                footer: `<button class="smart-btn smart-btn-primary" data-close>Tutup</button>`
            });
            modal.open();
        });
    });
    tbody.querySelectorAll(".bl-inv-act").forEach(btn => {
        btn.addEventListener("click", async () => {
            const { id, act, status } = btn.dataset;
            try {
                if (act === "transition") await invoiceAction(id, "transition", { status });
                else await invoiceAction(id, act, {});
                showToast("success", "Invoice diperbarui");
                renderInvoicesTable(container, 1);
            } catch (e) {
                showToast("danger", e.message);
            }
        });
    });
}

async function openInvoiceModal(container) {
    const subs = await listSubscriptions({ limit: 100 });
    const options = (subs.data || []).filter(s => ["ACTIVE", "TRIAL", "PAST_DUE"].includes(s.status))
        .map(s => `<option value="${s._id}">${esc(s.companyId?.name || s.companyId || "?")} — ${esc(s.planId?.name || "?")}</option>`).join("");
    const modal = new Modal({
        title: "Generate Invoice (server-side, idempotent)",
        content: `
            <div class="bl-form">
                <label>Subscription</label>
                <select class="smart-input bl-g-sub">${options || "<option>Belum ada subscription aktif</option>"}</select>
                <label>Periode Mulai</label><input class="smart-input bl-g-start" type="date" />
                <label>Periode Selesai</label><input class="smart-input bl-g-end" type="date" />
                <label>Discount (Rp)</label><input class="smart-input bl-g-disc" type="number" min="0" value="0" />
                <label>Tax Rate (%)</label><input class="smart-input bl-g-tax" type="number" min="0" max="100" value="0" />
            </div>
        `,
        footer: `
            <button class="smart-btn smart-btn-secondary" data-close>Batal</button>
            <button class="smart-btn smart-btn-primary" id="bl-g-save">Generate Invoice</button>
        `
    });
    modal.open();
    container.querySelector("#bl-g-save").addEventListener("click", async () => {
        try {
            const r = await generateInvoice({
                subscriptionId: container.querySelector(".bl-g-sub").value,
                periodStart: container.querySelector(".bl-g-start").value,
                periodEnd: container.querySelector(".bl-g-end").value,
                discount: Number(container.querySelector(".bl-g-disc").value || 0),
                taxRate: Number(container.querySelector(".bl-g-tax").value || 0)
            });
            showToast(r.duplicate ? "warning" : "success", r.duplicate ? "Invoice sudah ada untuk periode ini (idempotent)" : `Invoice ${r.invoiceNumber} dibuat`);
            modal.close();
            renderInvoicesTable(container, 1);
        } catch (e) {
            showToast("danger", e.message);
        }
    });
}

/** M6-FIX: Invoice by Company — pilih company + periode, server hitung item per fitur. */
async function openCompanyInvoiceModal(container) {
    if (!_companies.length) {
        const res = await listCompanies({ limit: 100 });
        _companies = res.data || [];
    }
    const options = _companies.map(c => `<option value="${c._id}">${esc(c.code)} — ${esc(c.name)}</option>`).join("");
    const modal = new Modal({
        title: "Invoice by Company (server-side, per fitur)",
        content: `
            <div class="bl-form">
                <label>Company</label>
                <select class="smart-input bl-cg-company">${options || "<option>Belum ada company</option>"}</select>
                <label>Periode Mulai</label><input class="smart-input bl-cg-start" type="date" />
                <label>Periode Selesai</label><input class="smart-input bl-cg-end" type="date" />
                <label>Discount (Rp)</label><input class="smart-input bl-cg-disc" type="number" min="0" value="0" />
                <label>Tax Rate (%)</label><input class="smart-input bl-cg-tax" type="number" min="0" max="100" value="0" />
                <label>Catatan</label><input class="smart-input bl-cg-notes" type="text" />
                <p class="cn-muted">Item dihitung server-side dari fitur ENABLED dengan harga
                    (override perusahaan ?? harga katalog). Fitur gratis tidak ditagih. Idempotent per periode.</p>
            </div>
        `,
        footer: `
            <button class="smart-btn smart-btn-secondary" data-close>Batal</button>
            <button class="smart-btn smart-btn-primary" id="bl-cg-save">Generate Invoice</button>
        `
    });
    modal.open();
    container.querySelector("#bl-cg-save").addEventListener("click", async () => {
        try {
            const r = await generateCompanyInvoice({
                companyId: container.querySelector(".bl-cg-company").value,
                periodStart: container.querySelector(".bl-cg-start").value,
                periodEnd: container.querySelector(".bl-cg-end").value,
                discount: Number(container.querySelector(".bl-cg-disc").value || 0),
                taxRate: Number(container.querySelector(".bl-cg-tax").value || 0),
                notes: container.querySelector(".bl-cg-notes").value || ""
            });
            showToast(r.duplicate ? "warning" : "success", r.duplicate ? "Invoice sudah ada untuk periode ini (idempotent)" : `Invoice ${r.invoiceNumber} dibuat`);
            modal.close();
            renderInvoicesTable(container, 1);
        } catch (e) {
            showToast("danger", e.message);
        }
    });
}

/** M6-FIX: Set Harga per fitur per perusahaan. */
async function openPriceModal(container, companyId, featureSlug) {
    const features = await listFeatures({ limit: 100 });
    const feature = (features.data || []).find(f => f.slug === featureSlug);
    const modal = new Modal({
        title: `Set Harga — ${esc(feature?.name || featureSlug)}`,
        content: `
            <div class="bl-form">
                <p><strong>Feature:</strong> <span class="cn-mono">${esc(featureSlug)}</span></p>
                <label>Harga Katalog (default)</label><input class="smart-input" type="text" value="Rp ${(feature?.price || 0).toLocaleString("id-ID")}" disabled />
                <label>Harga Perusahaan (Rp)</label><input class="smart-input bl-p-price" type="number" min="0" placeholder="kosongkan = pakai harga katalog · 0 = gratis" />
                <label>Alasan (wajib, min 5 karakter)</label><textarea class="smart-input bl-p-reason" rows="2"></textarea>
            </div>
        `,
        footer: `
            <button class="smart-btn smart-btn-secondary" data-close>Batal</button>
            <button class="smart-btn smart-btn-primary" id="bl-p-save">Simpan Harga</button>
        `
    });
    modal.open();
    container.querySelector("#bl-p-save").addEventListener("click", async () => {
        try {
            const priceInput = container.querySelector(".bl-p-price").value;
            await setEntitlementPrice({
                companyId,
                featureId: feature?._id || featureSlug,
                price: priceInput === "" ? null : Number(priceInput),
                reason: container.querySelector(".bl-p-reason").value
            });
            showToast("success", "Harga fitur disimpan (audited)");
            modal.close();
            renderEntsTable(container);
        } catch (e) { showToast("danger", e.message); }
    });
}

// ═══════════════════════════════ PAYMENTS ═══════════════════════════════

async function renderPayments(container) {
    const body = container.querySelector("#bl-body");
    body.innerHTML = `
        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Payments (mode simulasi)</span>
                <button class="smart-btn smart-btn-primary" id="bl-pay-new">+ Catat Pembayaran</button></div>
            <div class="cn-card-body dp-table-wrap">
                <table class="dp-table">
                    <thead><tr><th>Ref</th><th>Invoice</th><th>Company</th><th>Amount</th><th>Method</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody id="bl-payments-body"></tbody>
                </table>
            </div>
            <div class="cn-pagination-row" id="bl-payments-pagination"></div>
        </div>`;
    container.querySelector("#bl-pay-new").addEventListener("click", () => openPaymentModal(container));
    await renderPaymentsTable(container, 1);
}

async function renderPaymentsTable(container, page = 1) {
    const tbody = container.querySelector("#bl-payments-body");
    tbody.innerHTML = loadingHTML();
    const res = await listPayments({ page, limit: 20 });
    tbody.innerHTML = (res.data || []).map(p => `
        <tr>
            <td class="cn-mono">${esc(p.transactionReference)}</td>
            <td class="cn-mono">${esc(p.invoiceId?.invoiceNumber || "—")}</td>
            <td>${companyName(p.companyId?._id || p.companyId)}</td>
            <td>${formatIDR(p.amount)}</td>
            <td>${esc(p.method)}</td>
            <td>${statusChip(PAY_STATUS, p.status)}</td>
            <td>
                ${p.status === "PENDING" ? `<button class="smart-btn smart-btn-secondary bl-pay-verify" data-id="${p._id}">Verify</button>` : ""}
                ${p.status === "PAID" ? `<button class="smart-btn smart-btn-secondary bl-pay-refund" data-id="${p._id}">Refund</button>` : ""}
            </td>
        </tr>`).join("");
    mountPagination(container.querySelector("#bl-payments-pagination"), res.pagination, p => renderPaymentsTable(container, p));

    tbody.querySelectorAll(".bl-pay-verify").forEach(btn => {
        btn.addEventListener("click", async () => {
            try {
                await paymentAction(btn.dataset.id, "verify");
                showToast("success", "Payment diverifikasi (simulasi)");
                renderPaymentsTable(container, 1);
            } catch (e) { showToast("danger", e.message); }
        });
    });
    tbody.querySelectorAll(".bl-pay-refund").forEach(btn => {
        btn.addEventListener("click", async () => {
            const modal = new Modal({
                title: "Refund Payment",
                content: `<div class="bl-form"><label>Alasan (min 5 karakter)</label><input class="smart-input bl-refund-reason" /></div>`,
                footer: `<button class="smart-btn smart-btn-secondary" data-close>Batal</button>
                    <button class="smart-btn smart-btn-primary" id="bl-refund-save">Refund</button>`
            });
            modal.open();
            container.querySelector("#bl-refund-save").addEventListener("click", async () => {
                try {
                    await paymentAction(btn.dataset.id, "refund", { reason: container.querySelector(".bl-refund-reason").value });
                    showToast("success", "Payment direfund");
                    modal.close();
                    renderPaymentsTable(container, 1);
                } catch (e) { showToast("danger", e.message); }
            });
        });
    });
}

async function openPaymentModal(container) {
    const invoices = await listInvoices({ limit: 100 });
    const options = (invoices.data || []).filter(i => !["PAID", "VOID", "CANCELLED"].includes(i.status))
        .map(i => `<option value="${i._id}">${esc(i.invoiceNumber)} — ${formatIDR(i.total)}</option>`).join("");
    const modal = new Modal({
        title: "Catat Pembayaran (simulasi)",
        content: `
            <div class="bl-form">
                <label>Invoice</label>
                <select class="smart-input bl-p-inv">${options || "<option>Belum ada invoice yang bisa dibayar</option>"}</select>
                <label>Amount (Rp)</label><input class="smart-input bl-p-amount" type="number" min="1" step="1" />
                <label>Method</label>
                <select class="smart-input bl-p-method">
                    ${["BANK_TRANSFER", "VIRTUAL_ACCOUNT", "EWALLET", "CARD", "SIMULATION"].map(m => `<option>${m}</option>`).join("")}
                </select>
            </div>
        `,
        footer: `
            <button class="smart-btn smart-btn-secondary" data-close>Batal</button>
            <button class="smart-btn smart-btn-primary" id="bl-p-save">Catat Pembayaran</button>
        `
    });
    modal.open();
    container.querySelector("#bl-p-save").addEventListener("click", async () => {
        try {
            const r = await recordPayment({
                invoiceId: container.querySelector(".bl-p-inv").value,
                amount: Number(container.querySelector(".bl-p-amount").value),
                method: container.querySelector(".bl-p-method").value
            });
            showToast(r.duplicate ? "warning" : "success", r.duplicate ? "Payment sudah ada (idempotent)" : "Pembayaran dicatat (simulasi)");
            modal.close();
            renderPaymentsTable(container, 1);
        } catch (e) { showToast("danger", e.message); }
    });
}

// ═══════════════════════════════ USAGE ═══════════════════════════════

async function renderUsage(container) {
    const body = container.querySelector("#bl-body");
    body.innerHTML = `
        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Usage Metering</span>
                <button class="smart-btn smart-btn-primary" id="bl-use-new">+ Record Usage</button></div>
            <div class="cn-card-body dp-table-wrap">
                <table class="dp-table">
                    <thead><tr><th>Company</th><th>Feature</th><th>Metric</th><th>Qty</th><th>Period</th><th>Source</th><th>Waktu</th></tr></thead>
                    <tbody id="bl-usage-body"></tbody>
                </table>
            </div>
            <div class="cn-pagination-row" id="bl-usage-pagination"></div>
        </div>`;
    container.querySelector("#bl-use-new").addEventListener("click", () => openUsageModal(container));
    await renderUsageTable(container, 1);
}

async function renderUsageTable(container, page = 1) {
    const tbody = container.querySelector("#bl-usage-body");
    tbody.innerHTML = loadingHTML();
    const res = await listUsage({ page, limit: 20 });
    tbody.innerHTML = (res.data || []).map(u => `
        <tr>
            <td>${companyName(u.companyId)}</td>
            <td class="cn-mono">${esc(u.featureSlug)}</td>
            <td>${esc(u.metric)}</td>
            <td>${u.quantity}</td>
            <td class="cn-mono">${esc(u.period)}</td>
            <td>${esc(u.source)}</td>
            <td class="cn-muted">${formatDateTime(u.createdAt)}</td>
        </tr>`).join("");
    mountPagination(container.querySelector("#bl-usage-pagination"), res.pagination, p => renderUsageTable(container, p));
}

async function openUsageModal(container) {
    const features = await listFeatures({ limit: 100 });
    const companyOptions = _companies.map(c => `<option value="${c._id}">${esc(c.name)}</option>`).join("");
    const modal = new Modal({
        title: "Record Usage (source trusted)",
        content: `
            <div class="bl-form">
                <label>Company</label>
                <select class="smart-input bl-u-company">${companyOptions}</select>
                <label>Feature</label>
                <select class="smart-input bl-u-feature">
                    ${(features.data || []).map(f => `<option value="${f._id}">${esc(f.name)} (${esc(f.slug)})</option>`).join("")}
                </select>
                <label>Metric</label><input class="smart-input bl-u-metric" value="transactions" />
                <label>Quantity</label><input class="smart-input bl-u-qty" type="number" min="0" value="1" />
                <label>Source</label>
                <select class="smart-input bl-u-source">
                    ${["APPLICATION", "API", "WORKER", "AI", "MANUAL"].map(s => `<option>${s}</option>`).join("")}
                </select>
            </div>
        `,
        footer: `
            <button class="smart-btn smart-btn-secondary" data-close>Batal</button>
            <button class="smart-btn smart-btn-primary" id="bl-u-save">Record Usage</button>
        `
    });
    modal.open();
    container.querySelector("#bl-u-save").addEventListener("click", async () => {
        try {
            await recordUsage({
                companyId: container.querySelector(".bl-u-company").value,
                featureId: container.querySelector(".bl-u-feature").value,
                metric: container.querySelector(".bl-u-metric").value,
                quantity: Number(container.querySelector(".bl-u-qty").value),
                source: container.querySelector(".bl-u-source").value
            });
            showToast("success", "Usage dicatat");
            modal.close();
            renderUsageTable(container, 1);
        } catch (e) { showToast("danger", e.message); }
    });
}

// ═══════════════════════════════ ENTITLEMENTS ═══════════════════════════════

async function renderEntitlements(container) {
    const body = container.querySelector("#bl-body");
    body.innerHTML = `
        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Entitlements</span></div>
            <div class="cn-card-body">
                <div class="bl-filter-row">
                    <select class="smart-input" id="bl-ent-company" style="max-width:300px">
                        <option value="">Semua Company</option>
                        ${_companies.map(c => `<option value="${c._id}">${esc(c.name)}</option>`).join("")}
                    </select>
                </div>
            </div>
            <div class="cn-card-body dp-table-wrap">
                <table class="dp-table">
                    <thead><tr><th>Company</th><th>Feature</th><th>Enabled</th><th>Harga</th><th>Limit</th><th>Used</th><th>Remaining</th><th>Source</th><th>Action</th></tr></thead>
                    <tbody id="bl-ents-body"></tbody>
                </table>
            </div>
        </div>`;
    container.querySelector("#bl-ent-company").addEventListener("change", () => renderEntsTable(container));
    await renderEntsTable(container);
}

async function renderEntsTable(container) {
    const tbody = container.querySelector("#bl-ents-body");
    tbody.innerHTML = loadingHTML();
    const companyFilter = container.querySelector("#bl-ent-company")?.value || "";
    const params = companyFilter ? { companyId: companyFilter } : {};
    const res = await listEntitlements({ ...params, limit: 500 });
    tbody.innerHTML = (res.data || []).map(e => {
        const defaultPrice = e.featureId?.price || 0;
        const effectivePrice = e.price ?? defaultPrice;
        const priceLabel = effectivePrice > 0
            ? `<strong>${formatIDR(effectivePrice)}</strong>${e.price != null ? `<br><span class="cn-muted" style="font-size:11px">katalog ${formatIDR(defaultPrice)}</span>` : ""}`
            : `<span class="cn-muted">Gratis</span>`;
        return `
        <tr>
            <td>${companyName(e.companyId)}</td>
            <td class="cn-mono">${esc(e.featureSlug)}</td>
            <td>${e.enabled ? statusChip(SUB_STATUS, "ACTIVE") : statusChip(SUB_STATUS, "CANCELLED")}</td>
            <td>${priceLabel}</td>
            <td>${e.limit ?? "∞"}</td>
            <td>${e.used ?? 0}</td>
            <td>${e.limit == null ? "∞" : Math.max(0, e.limit - (e.used || 0))}</td>
            <td>${esc(e.source)}</td>
            <td>
                <button class="smart-btn smart-btn-secondary bl-ent-price" data-company="${e.companyId}" data-feature="${e.featureSlug}">Set Harga</button>
                <button class="smart-btn smart-btn-secondary bl-ent-ovr" data-company="${e.companyId}" data-feature="${e.featureSlug}">Override</button>
            </td>
        </tr>`;
    }).join("") || '<tr><td colspan="9" class="cn-muted">Belum ada entitlement (buat subscription dulu)</td></tr>';

    tbody.querySelectorAll(".bl-ent-ovr").forEach(btn => {
        btn.addEventListener("click", () => openOverrideModal(container, btn.dataset.company, btn.dataset.feature));
    });
    tbody.querySelectorAll(".bl-ent-price").forEach(btn => {
        btn.addEventListener("click", () => openPriceModal(container, btn.dataset.company, btn.dataset.feature));
    });
}

async function openOverrideModal(container, companyId, featureSlug) {
    const features = await listFeatures({ limit: 100 });
    const feature = (features.data || []).find(f => f.slug === featureSlug);
    const modal = new Modal({
        title: "Manual Override Entitlement",
        content: `
            <div class="bl-form">
                <p><strong>Feature:</strong> <span class="cn-mono">${esc(featureSlug)}</span></p>
                <label>Enabled</label>
                <select class="smart-input bl-o-enabled"><option value="true">Enabled</option><option value="false">Disabled</option></select>
                <label>Limit (kosong = unlimited)</label><input class="smart-input bl-o-limit" type="number" min="0" />
                <label>Berlaku sampai (optional)</label><input class="smart-input bl-o-until" type="date" />
                <label>Alasan (wajib, min 5 karakter)</label><textarea class="smart-input bl-o-reason" rows="2"></textarea>
            </div>
        `,
        footer: `
            <button class="smart-btn smart-btn-secondary" data-close>Batal</button>
            <button class="smart-btn smart-btn-primary" id="bl-o-save">Simpan Override</button>
        `
    });
    modal.open();
    container.querySelector("#bl-o-save").addEventListener("click", async () => {
        try {
            await overrideEntitlement({
                companyId,
                featureId: feature?._id || featureSlug,
                enabled: container.querySelector(".bl-o-enabled").value === "true",
                limit: container.querySelector(".bl-o-limit").value || undefined,
                effectiveUntil: container.querySelector(".bl-o-until").value || undefined,
                reason: container.querySelector(".bl-o-reason").value
            });
            showToast("success", "Override disimpan (audited)");
            modal.close();
            renderEntsTable(container);
        } catch (e) { showToast("danger", e.message); }
    });
}

// ═══════════════════════════════ TAB ROUTER ═══════════════════════════════

const TABS = ["overview", "plans", "features", "subscriptions", "invoices", "payments", "usage", "entitlements"];

async function renderTab(container, tab) {
    currentTab = tab;
    container.querySelectorAll(".bl-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    const body = container.querySelector("#bl-body");
    body.innerHTML = loadingHTML();
    try {
        if (tab === "overview") await renderOverview(container);
        else if (tab === "plans") await renderPlans(container);
        else if (tab === "features") await renderFeatures(container);
        else if (tab === "subscriptions") await renderSubscriptions(container);
        else if (tab === "invoices") await renderInvoices(container);
        else if (tab === "payments") await renderPayments(container);
        else if (tab === "usage") await renderUsage(container);
        else if (tab === "entitlements") await renderEntitlements(container);
    } catch (e) {
        body.innerHTML = `<div class="cn-card"><div class="cn-card-body"><div class="cn-empty">Gagal memuat: ${esc(e.message)}</div></div></div>`;
    }
}

/**
 * Render & init halaman Billing Center.
 * @param {HTMLElement} container
 */
export async function renderBilling(container) {
    currentTab = "overview";
    await loadCompanies();

    container.innerHTML = `
        ${pageHeader("Billing & Subscription Center", "Commercial control plane — plans, features, subscriptions, entitlement, usage, invoice & payment")}
        <div class="dp-tabs">
            ${TABS.map((t, i) => `<button class="smart-btn smart-btn-secondary dp-tab bl-tab ${i === 0 ? "active" : ""}" data-tab="${t}">${t[0].toUpperCase()}${t.slice(1)}</button>`).join("")}
        </div>
        <div id="bl-body"></div>
    `;

    container.querySelectorAll(".bl-tab").forEach(btn => {
        btn.addEventListener("click", () => renderTab(container, btn.dataset.tab));
    });

    await renderTab(container, "overview");
}
