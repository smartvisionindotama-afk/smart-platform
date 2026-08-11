/**
 * Unit tests — Kasir Page shell modes (SP-029 M3-FIX).
 *
 * Memverifikasi bahwa halaman kasir bisa dirender:
 *   - fullscreen (role kasir): class `pos-fullscreen`, tombol Logout sendiri
 *     (halaman standalone seperti mockup kasir.html)
 *   - in-shell (role admin): tanpa class fullscreen & tanpa tombol Logout
 *     (header mini di dalam AppShell)
 *
 * Catatan: assertion memeriksa MARKUP (class attribute elemen + id tombol),
 * bukan string mentah — CSS dalam <style> juga memuat kata yang sama.
 *
 * @module __tests__/kasir-page-shell
 */

import { describe, it, expect } from "vitest";
import { PosPage, configureKasirShell } from "../../src/pages/pos/index.js";

/** Ekstrak class pada root `.pos-page` (mengabaikan teks CSS). */
function pageRootClass(html) {
    const m = html.match(/<div class="pos-page ([^"]*)"/);
    return m ? m[1] : "";
}

describe("Kasir page shell mode", () => {
    it("mode fullscreen (role kasir): class pos-fullscreen + tombol Logout", () => {
        configureKasirShell({ fullscreen: true, onLogout: () => {} });
        const html = PosPage();
        expect(pageRootClass(html)).toContain("pos-fullscreen");
        // Tombol Logout adalah elemen dengan id, bukan sekadar string CSS
        expect(html).toContain('id="pos-logout"');
        // Hint halaman (untuk admin in-shell) tidak dirender di fullscreen
        expect(html).not.toContain('class="pos-header-hint"');
    });

    it("mode in-shell (admin): tanpa pos-fullscreen & tanpa Logout", () => {
        configureKasirShell({ fullscreen: false, onLogout: null });
        const html = PosPage();
        expect(pageRootClass(html)).not.toContain("pos-fullscreen");
        expect(html).not.toContain('id="pos-logout"');
        expect(html).toContain('class="pos-header-hint"');
    });

    it("default mode adalah in-shell (backward compatible)", () => {
        configureKasirShell();
        const html = PosPage();
        expect(pageRootClass(html)).not.toContain("pos-fullscreen");
        expect(html).not.toContain('id="pos-logout"');
    });
});
