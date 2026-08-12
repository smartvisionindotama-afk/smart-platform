/**
 * Scanner Helpers — HTML & lifecycle helper untuk barcode/QR scanner.
 *
 * Dikonsumsi oleh @smart/inventory-ui (pembelian, penjualan, transfer).
 * Merupakan restorasi export yang sempat hilang saat ekstraksi domain (SP-025).
 *
 * @module @smart/ui/components/scanner/helpers
 */

import { BarcodeScanner } from "./scanner.js";

/**
 * HTML untuk section scanner inline.
 *
 * @param {string} containerId ID elemen kontainer video kamera
 * @param {string} switchBtnId ID tombol ganti kamera
 * @param {string} flashId ID elemen flash (animasi saat scan sukses)
 * @returns {string} HTML
 */
export function scannerSectionHTML(containerId, switchBtnId, flashId) {
    return `
        <div id="scanner-section-${containerId}" class="sm-scanner-section" style="display:none">
            <div id="${containerId}" class="sm-scanner-container"></div>
            <div class="sm-scanner-frame">
                <span class="sm-scanner-corner sm-scanner-corner-tl"></span>
                <span class="sm-scanner-corner sm-scanner-corner-tr"></span>
                <span class="sm-scanner-corner sm-scanner-corner-bl"></span>
                <span class="sm-scanner-corner sm-scanner-corner-br"></span>
            </div>
            <div class="sm-scanner-ripple"></div>
            <div class="sm-scanner-dot"></div>
            <div class="sm-scanner-scan-line"><span class="sm-scanner-line-glow"></span><span class="sm-scanner-line-tail"></span></div>
            <div class="sm-scanner-msg">Arahkan kamera ke barcode / QR</div>
            <div id="${flashId}" class="sm-scanner-flash"></div>
            <div class="sm-scanner-hint-bar">
                <span class="sm-scanner-hint-left">📷 Scan barcode / QR</span>
                <button type="button" id="${switchBtnId}" class="sm-scanner-hint-switch" title="Ganti kamera">🔄 Kamera</button>
            </div>
        </div>
    `;
}

/**
 * HTML untuk tombol scan pada baris item.
 *
 * @param {string} [attrs] Atribut tambahan (mis. `data-scan-index="2"`)
 * @returns {string} HTML
 */
export function scanButtonHTML(attrs = "") {
    return `<button type="button" class="btn-scan" ${attrs} title="Scan barcode">📷</button>`;
}

/**
 * Attach lifecycle scanner ke section scanner + tombol scan.
 *
 * @param {object} options
 * @param {string} options.containerId ID kontainer video
 * @param {string} options.switchBtnId ID tombol ganti kamera
 * @param {string} options.flashId ID elemen flash
 * @param {string} [options.scanBtnSel="[data-scan-index]"] Selektor tombol scan
 * @param {function(number,string):void} [options.onScanDecoded] Callback (index, decodedText)
 * @returns {{ start: Function, stop: Function, destroy: Function }}
 */
export function attachScanner({
    containerId,
    switchBtnId,
    flashId,
    scanBtnSel = "[data-scan-index]",
    // M6-FIX — atribut indeks tombol scan (default data-scan-index; kasir
    // member memakai data-scan-member agar tidak bentrok dengan scanner produk).
    scanIndexAttr = "data-scan-index",
    onScanDecoded = () => {}
} = {}) {
    let scannerInstance = null;
    let activeScanIndex = -1;

    function getSection() {
        return document.getElementById(`scanner-section-${containerId}`);
    }

    function show() {
        const section = getSection();
        if (section) {
            section.style.display = "block";
            section.classList.add("active");
        }
    }

    function hide() {
        const section = getSection();
        if (section) {
            section.classList.remove("active");
            section.style.display = "none";
        }
    }

    function triggerFlash() {
        const flash = document.getElementById(flashId);
        if (!flash) return;
        flash.classList.remove("active");
        void flash.offsetWidth;
        flash.classList.add("active");
        setTimeout(() => flash.classList.remove("active"), 600);
    }

    function playBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 1200;
            osc.type = "sine";
            gain.gain.value = 0.15;
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
            setTimeout(() => ctx.close(), 300);
        } catch {
            /* audio tidak tersedia — abaikan */
        }
    }

    // Anti double-read ditangani di BarcodeScanner (scanner.js) — berlaku untuk
    // SEMUA pemakai (attachScanner ini, master barang, pembelian, penjualan/SO,
    // transfer). Di sini cukup teruskan kode hasil dedupe ke callback.
    function handleScan(decodedText) {
        triggerFlash();
        playBeep();
        if (activeScanIndex >= 0) {
            onScanDecoded(activeScanIndex, decodedText.trim());
        }
        setTimeout(() => stop(), 400);
    }

    async function start(index = 0) {
        const section = getSection();
        if (!section) return;
        activeScanIndex = index;
        show();
        try {
            scannerInstance = new BarcodeScanner(containerId, {
                onScan: handleScan,
                fps: 10
            });
            await scannerInstance.start();
        } catch {
            stop();
            console.warn("[Scanner] Kamera tidak tersedia — silakan ketik kode manual.");
        }
    }

    function stop() {
        if (scannerInstance) {
            scannerInstance.destroy();
            scannerInstance = null;
        }
        hide();
        activeScanIndex = -1;
    }

    function toggleScanner(index) {
        const section = getSection();
        if (!section) return;
        const isHidden = !section.style.display || section.style.display === "none";
        if (isHidden) start(index);
        else stop();
    }

    async function switchCamera() {
        if (scannerInstance) {
            try { await scannerInstance.switchCamera(); } catch { /* abaikan */ }
        }
    }

    // Delegasi klik tombol scan (bekerja untuk item yang ditambah dinamis)
    function onDocClick(e) {
        const btn = e.target.closest(scanBtnSel);
        if (!btn) return;
        const section = getSection();
        if (!section) return;
        e.preventDefault();
        const idx = parseInt(btn.getAttribute(scanIndexAttr), 10);
        if (!isNaN(idx)) toggleScanner(idx);
    }

    document.addEventListener("click", onDocClick);
    document.getElementById(switchBtnId)?.addEventListener("click", (e) => {
        e.preventDefault();
        switchCamera();
    });

    return {
        start,
        stop,
        destroy() {
            document.removeEventListener("click", onDocClick);
            stop();
        }
    };
}
