/**
 * SMART Console — Platform Services.
 *
 * Logo platform & logo per-aplikasi disimpan di server (file-based)
 * sehingga bisa diakses dari seluruh subdomain e-profit.id.
 *
 * @module console/services/platform
 */

/**
 * Upload logo platform ke server.
 * @param {string} dataUrl Data URL logo
 */
export async function uploadLogoToServer(dataUrl) {
    const res = await fetch("/api/platform/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: dataUrl })
    });
    if (!res.ok) throw new Error((await res.json()).error || "Gagal menyimpan logo");
}

/**
 * Hapus logo platform dari server.
 */
export async function removeLogoFromServer() {
    await fetch("/api/platform/logo", { method: "DELETE" });
}

/**
 * Upload logo aplikasi ke server.
 * @param {string} slug App slug (mis. "inventory")
 * @param {string} dataUrl Data URL logo
 */
export async function uploadAppLogoToServer(slug, dataUrl) {
    const res = await fetch(`/api/platform/app-logo/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: dataUrl })
    });
    if (!res.ok) throw new Error((await res.json()).error || "Gagal menyimpan logo aplikasi");
}

/**
 * Hapus logo aplikasi dari server.
 * @param {string} slug App slug
 */
export async function removeAppLogoFromServer(slug) {
    await fetch(`/api/platform/app-logo/${slug}`, { method: "DELETE" });
}
