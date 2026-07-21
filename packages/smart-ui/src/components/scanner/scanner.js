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
     * Start scanning with device-appropriate camera.
     * Camera priority: HP → environment (back) → user (front) → deviceId
     *                 Laptop → user (front) → environment (back) → deviceId
     */
    async start() {
        if (this._running) return;

        const container = document.getElementById(this.containerId);
        if (!container) return;

        this._running = true;
        this._decodeErrorCount = 0;

        try {
            const html5QrCode = new Html5Qrcode(this.containerId, {});
            this._instance = html5QrCode;

            const config = { fps: this.fps, qrbox: { width: 280, height: 180 } };

            // Enumerate cameras
            this._cameras = await Html5Qrcode.getCameras().catch(() => []);

            const isMobile = _isMobileDevice();

            if (isMobile) {
                if (await this._tryStartCamera(config, { facingMode: "environment" })) {
                    // back camera
                } else if (await this._tryStartCamera(config, { facingMode: "user" })) {
                    // front camera fallback
                } else {
                    await this._tryDeviceIdCameras(config);
                }
            } else {
                if (await this._tryStartCamera(config, { facingMode: "user" })) {
                    // front camera
                } else if (await this._tryStartCamera(config, { facingMode: "environment" })) {
                    // back camera fallback
                } else {
                    await this._tryDeviceIdCameras(config);
                }
            }
        } catch (err) {
            this._running = false;
            throw err;
        }
    }

    /**
     * Try starting a specific camera.
     * @param {object} config
     * @param {object} constraint - facingMode or deviceId constraint
     * @returns {Promise<boolean>}
     */
    async _tryStartCamera(config, constraint) {
        if (!this._instance) return false;
        try {
            await this._instance.start(constraint, config, (text) => {
                this.onScan(text);
            }, (err) => {
                this._decodeErrorCount++;
                if (this._decodeErrorCount % 100 === 0) {
                    console.warn("[Scanner] Decode error (x" + this._decodeErrorCount + "):", err);
                }
            });
            return true;
        } catch (err) {
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
