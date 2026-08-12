/**
 * BarcodeScanner — SMART UI reusable inline barcode/QR scanner.
 *
 * Usage:
 *   const scanner = new BarcodeScanner("scanner-container", {
 *       onScan: (text) => { /* handle decoded text *\/ }
 *   });
 *   scanner.start();
 *   scanner.switchCamera();
 *   scanner.stop();
 *
 * @module @smart/ui/components/scanner
 */

import "./scanner.css";
import { Html5Qrcode } from "html5-qrcode";

// ── Supported formats (Html5QrcodeSupportedFormats numeric enum) ──
const SCAN_FORMATS_ALL = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Detect mobile device.
 * @returns {boolean}
 */
function _isMobileDevice() {
    const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
    const touchSmall = navigator.maxTouchPoints > 0 && window.innerWidth < 1024;
    return mobileUA || touchSmall;
}

/**
 * BarcodeScanner — inline barcode/QR scanner with camera switching.
 */
export class BarcodeScanner {
    /**
     * @param {string} containerId - ID of the container element for camera feed
     * @param {object} [options]
     * @param {function(string):void} [options.onScan] - Called when a barcode/QR is decoded
     * @param {boolean} [options.autoStart=false] - Whether to auto-start on construction
     * @param {number} [options.fps=10] - Frames per second for scanning
     */
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.onScan = options.onScan || (() => {});
        this.fps = options.fps || 10;

        /** @type {Html5Qrcode|null} */
        this._instance = null;
        /** @type {Array<{id:string, label:string}>} */
        this._cameras = [];
        /** @type {number} */
        this._cameraIndex = 0;
        /** @type {number} */
        this._decodeErrorCount = 0;
        /** @type {boolean} */
        this._running = false;
        /** @type {boolean} */
        this._startErrorLogged = false;
        // Anti double-read (M6-FIX): kode yang sama ter-decode di beberapa frame
        // beruntun (fps) sebelum kamera berhenti → tanpa dedupe produk masuk 2×.
        // Berlaku untuk SEMUA pemakai BarcodeScanner (kasir, master barang,
        // pembelian, penjualan/SO, transfer). Kode berbeda tetap diproses.
        this._lastCode = "";
        this._lastCodeAt = 0;
        this._dedupeMs = 1500;

        if (options.autoStart) {
            this.start();
        }
    }

    /**
     * Get scanner config.
     * @returns {object}
     */
    getConfig() {
        return {
            fps: 15,
            disableFlip: false,
            formatsToSupport: SCAN_FORMATS_ALL,
            qrbox: { width: 280, height: 180 }
        };
    }

    /**
     * Pilih kamera belakang dari daftar hasil enumerasi (label back/rear/
     * environment/belakang), fallback kamera terakhir.
     * @returns {{ id: string, label: string }|null}
     */
    _findBackCamera() {
        if (!this._cameras || this._cameras.length === 0) return null;
        const back = this._cameras.find(c => /back|rear|environment|belakang/i.test(c.label || ""));
        return back || this._cameras[this._cameras.length - 1] || null;
    }

    /**
     * Enumerasi kamera via `enumerateDevices()` POLOS — TANPA membuka stream.
     *
     * M6-FIX v4b: `Html5Qrcode.getCameras()` memanggil `getUserMedia` (membuka
     * lalu menutup stream kamera). Di Android, stream yang baru ditutup sering
     * masih "terkunci" beberapa saat → `start()` berikutnya gagal
     * NotReadableError → semua fallback ikut gagal. enumerateDevices() murni
     * daftar device tanpa menyentuh kamera (label bisa kosong tanpa izin).
     * @returns {Promise<Array<{id:string, label:string}>>}
     */
    async _enumerateCameras() {
        try {
            // window.navigator (bukan navigator) agar tidak kena no-undef
            // di env lint paket (pola sama dengan compressImage di barang module)
            const md = (typeof window !== "undefined" && window.navigator && window.navigator.mediaDevices) || null;
            if (!md || typeof md.enumerateDevices !== "function") return [];
            const devices = await md.enumerateDevices();
            return devices
                .filter(d => d.kind === "videoinput")
                .map(d => ({ id: d.deviceId || "", label: d.label || "" }));
        } catch {
            return [];
        }
    }

    /** @param {number} ms */
    _sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    /**
     * Reset instance Html5Qrcode — WAJIB setelah percobaan start gagal,
     * karena html5-qrcode tidak bisa start ulang pada instance yang sama
     * tanpa clear(). Tanpa reset ini, fallback kamera berikutnya di HP
     * selalu gagal ("Cannot start, already started") — M6-FIX v4.
     */
    _resetInstance() {
        if (!this._instance) return;
        try { this._instance.clear(); } catch { /* ignore */ }
        this._instance = null;
        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = "";
    }

    /**
     * Start scanning with device-appropriate camera.
     *
     * M6-FIX v4b (HP): urutan KAMERA BELAKANG paling andal:
     *   1. facingMode "environment" — browser memilih kamera belakang secara
     *      native (tanpa perlu enumerasi/label, tanpa membuka stream dulu)
     *   2. deviceId kamera belakang dari enumerateDevices (label back/rear)
     *   3. facingMode "user" (kamera depan)
     *   4. semua deviceId hasil enumerasi
     * Laptop: user (depan) → environment → semua deviceId.
     * Setiap kegagalan → instance di-reset + jeda kecil (kamera butuh waktu
     * dilepas sebelum dipakai ulang).
     */
    async start() {
        if (this._running) return;

        const container = document.getElementById(this.containerId);
        if (!container) return;

        this._running = true;
        this._decodeErrorCount = 0;
        this._startErrorLogged = false;

        try {
            this._instance = new Html5Qrcode(this.containerId, {});

            const config = { fps: this.fps, qrbox: { width: 280, height: 180 } };

            // Enumerasi TANPA getUserMedia (tidak mengunci kamera)
            this._cameras = await this._enumerateCameras();

            const isMobile = _isMobileDevice();

            if (isMobile) {
                if (await this._tryStartCamera(config, { facingMode: "environment" })) return;
                await this._afterFail();
                const backCam = this._findBackCamera();
                if (backCam) {
                    if (await this._tryStartCamera(config, { deviceId: backCam.id })) return;
                    await this._afterFail();
                }
                if (await this._tryStartCamera(config, { facingMode: "user" })) return;
                await this._afterFail();
                await this._tryDeviceIdCameras(config);
            } else {
                if (await this._tryStartCamera(config, { facingMode: "user" })) return;
                await this._afterFail();
                if (await this._tryStartCamera(config, { facingMode: "environment" })) return;
                await this._afterFail();
                await this._tryDeviceIdCameras(config);
            }
        } catch (err) {
            this._running = false;
            throw err;
        }
    }

    /** Reset instance + jeda agar kamera dilepas sebelum percobaan berikutnya. */
    async _afterFail() {
        this._resetInstance();
        await this._sleep(250);
    }

    /**
     * Try starting a specific camera.
     * @param {object} config
     * @param {object} constraint - facingMode or deviceId constraint
     * @returns {Promise<boolean>}
     */
    async _tryStartCamera(config, constraint) {
        if (!this._instance) {
            // Setelah reset, buat instance baru sebelum mencoba lagi
            this._instance = new Html5Qrcode(this.containerId, {});
        }
        try {
            await this._instance.start(constraint, config, (text) => {
                const code = String(text || "").trim();
                const now = Date.now();
                if (code && code === this._lastCode && now - this._lastCodeAt < this._dedupeMs) {
                    return;
                }
                this._lastCode = code;
                this._lastCodeAt = now;
                this.onScan(code);
            }, (err) => {
                this._decodeErrorCount++;
                if (this._decodeErrorCount % 100 === 0) {
                    console.warn("[Scanner] Decode error (x" + this._decodeErrorCount + "):", err);
                }
            });
            return true;
        } catch (err) {
            // Log error asli SEKALI per start — supaya diagnosa jelas kalau
            // kamera tetap tidak bisa diakses (izin ditolak / dipakai app lain).
            if (!this._startErrorLogged) {
                this._startErrorLogged = true;
                const msg = typeof err === "string" ? err : (err && err.message) || String(err);
                console.warn("[Scanner] Gagal mulai kamera", constraint, ":", msg);
            }
            return false;
        }
    }

    /**
     * Try each enumerated camera by deviceId.
     * @param {object} config
     */
    async _tryDeviceIdCameras(config) {
        if (this._cameras.length === 0) throw new Error("No cameras found");
        for (let i = 0; i < this._cameras.length; i++) {
            const cam = this._cameras[i];
            if (await this._tryStartCamera(config, { deviceId: cam.id })) {
                this._cameraIndex = i;
                return;
            }
            // Instance kotor setelah gagal — reset sebelum deviceId berikutnya
            await this._afterFail();
        }
        throw new Error("No camera could be started");
    }

    /**
     * Switch to the next available camera.
     */
    async switchCamera() {
        if (this._cameras.length < 2) {
            // Refresh camera list
            this._cameras = await Html5Qrcode.getCameras().catch(() => []);
        }
        if (this._cameras.length < 2) return;

        // Stop current
        if (this._instance) {
            try { await this._instance.stop().catch(() => {}); } catch {}
        }

        // Clear container
        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = "";

        await new Promise(r => setTimeout(r, 50));

        // Create new instance
        const html5QrCode = new Html5Qrcode(this.containerId, {});
        this._instance = html5QrCode;

        const config = { fps: 15 };

        const startIdx = (this._cameraIndex + 1) % this._cameras.length;
        for (let attempt = 0; attempt < this._cameras.length; attempt++) {
            const idx = (startIdx + attempt) % this._cameras.length;
            const cam = this._cameras[idx];
            if (await this._tryStartCamera(config, { deviceId: cam.id })) {
                this._cameraIndex = idx;
                return;
            }
        }

        throw new Error("No camera could be started on switch");
    }

    /**
     * Get current camera index.
     * @returns {number}
     */
    getCameraIndex() {
        return this._cameraIndex;
    }

    /**
     * Whether scanner is currently running.
     * @returns {boolean}
     */
    isRunning() {
        return this._running;
    }

    /**
     * Stop scanning and release camera.
     */
    stop() {
        this._running = false;
        if (this._instance) {
            try { this._instance.stop().catch(() => {}); } catch {}
            this._instance = null;
        }
        this._cameras = [];
    }

    /**
     * Clean up and destroy scanner.
     */
    destroy() {
        this.stop();
    }
}
