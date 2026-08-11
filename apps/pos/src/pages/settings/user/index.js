/**
 * Settings — User Page.
 *
 * Thin wrapper around SMART Framework SettingsUserModule.
 * Inventory injects data services and company context.
 *
 * SP-029 M2-FIX: kuota kasir dari Master Platform (Company.jumlahKasir)
 * di-enforce di UI (createGuard) — tombol Tambah User dinonaktifkan saat
 * jumlah user role kasir sudah mencapai kuota. Server juga menolak
 * (defense in depth, routes/users.js).
 *
 * @module pos/pages/settings/user
 */

import { SettingsUserModule } from "@smart/ui/modules/settings";
import {
    listUsers, getUser, createUser, updateUser, deleteUser,
    getRoleOptions, listAllCompanies
} from "../../../data/index.js";
import { getCompanyConfig, refreshCompanyConfig } from "../../../config/company-config.js";

function _currentCompanyCode() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SMART) {
            return globalThis.SMART.Session.get("company.code") || globalThis.SMART.Company.getCode();
        }
    } catch {}
    return null;
}

function _currentCompanyName() {
    const code = _currentCompanyCode();
    if (!code) return "";
    try {
        // M3-FIX v27 — nama company SSOT = SMART.Company (di-set dari Master
        // Platform saat boot); didahulukan daripada Session.get (bisa stale
        // dari storage lama yg masih berisi branding aplikasi).
        const name = globalThis.SMART.Company.getName?.() || globalThis.SMART.Session.get("company.name");
        if (name) return name;
    } catch {}
    return code;
}

/**
 * Hitung jumlah user role kasir AKTIF pada perusahaan ini — untuk guard kuota
 * (sejalan dgn server: countDocuments { companyCode, role: kasir, active }).
 * @returns {Promise<number>}
 */
async function _countKasirUsers() {
    try {
        const code = _currentCompanyCode();
        const res = await listUsers({ page: 1, limit: 999, search: "", allCompanies: true });
        const data = Array.isArray(res?.data) ? res.data : [];
        return data.filter(u =>
            String(u.role || "").toLowerCase() === "kasir" &&
            u.active !== false &&
            (!code || String(u.companyCode || "") === String(code))
        ).length;
    } catch {
        return -1; // tidak bisa dihitung → biarkan server yang enforce
    }
}

const module = SettingsUserModule({
    listUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    getRoleOptions,
    listCompanies: listAllCompanies,
    // M3-FIX v25 — kirim FUNGSI (bukan nilai): module di-import eager oleh
    // router saat boot, sebelum company context di-set. Fungsi di-resolve
    // saat halaman dirender → pilihan Company tidak muncul utk owner tunggal.
    currentCompanyCode: () => _currentCompanyCode(),
    currentCompanyName: () => _currentCompanyName(),
    // M3-FIX v17 — kuota KASIR role-aware: tombol Tambah SELALU aktif, hanya
    // role "kasir" yang diblokir saat jumlahKasir penuh (admin/operator tetap
    // bisa dibuat). Server tetap menegakkan (defense in depth, users.js).
    createGuard: async () => {
        // Refresh dari server — Company doc ditulis Master Platform; cache
        // sessionStorage (saat login) bisa basi bila Company diubah di Console.
        await refreshCompanyConfig();
        const cfg = getCompanyConfig();
        const limit = cfg.jumlahKasir || 1;
        const current = await _countKasirUsers();
        if (current >= limit) {
            // Banner info saja — TIDAK menonaktifkan tombol (role lain tetap boleh)
            return {
                allowed: true,
                message: `Kuota kasir tercapai (${current}/${limit}). Role lain tetap bisa ditambahkan.`
            };
        }
        return { allowed: true };
    },
    roleGuard: async (role, ctx) => {
        if (String(role || "").toLowerCase() !== "kasir") return { allowed: true };
        // Edit user kasir yang SUDAH terhitung kuota (role tidak berubah) → izinkan,
        // sejalan dgn server (PUT exclude _id). Hanya blokir saat role BERUBAH ke kasir.
        if (ctx?.isEdit && String(ctx.currentRole || "").toLowerCase() === "kasir") {
            return { allowed: true };
        }
        await refreshCompanyConfig();
        const cfg = getCompanyConfig();
        const limit = cfg.jumlahKasir || 1;
        const current = await _countKasirUsers();
        if (current >= limit) {
            return { allowed: false, message: `Kuota kasir tercapai (${current}/${limit}).` };
        }
        return { allowed: true };
    }
});

export const UserSettingsPage = module.render;
export const initUserSettingsPage = module.init;
