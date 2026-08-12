/**
 * Application Registry — sumber konfigurasi aplikasi yang dipantau (SP-027 M4 §6).
 *
 * JANGAN hardcode daftar aplikasi di halaman Dashboard. Registry ini adalah
 * source of truth: tambahkan aplikasi baru (SmartWMS, e-Profit, Santri Pintar,
 * SITAMPAN, Desa Insight, dll) dengan satu entri baru — tanpa mengubah core
 * monitoring. Bisa juga dioverride/diperluas via env `MONITORING_APPS_JSON`.
 *
 * Field:
 *   id               — slug unik aplikasi
 *   name             — nama tampilan
 *   domain           — domain produksi ("" jika belum live)
 *   environment      — production / staging / development
 *   healthEndpoint   — endpoint health ringan (TIDAK boleh business API)
 *   apiEndpoint      — base API (untuk referensi, bukan untuk health)
 *   status           — status registry ("active"/"inactive")
 *   monitoringEnabled— apakah dicek oleh monitoring
 *
 * @module console/server/monitoring/apps.config
 */

export const MONITORING_APPS = [
    {
        id: "console",
        name: "SMART Console",
        domain: "https://master.e-profit.id",
        environment: "production",
        healthEndpoint: "http://127.0.0.1:3002/api/health",
        apiEndpoint: "http://127.0.0.1:3002/api",
        status: "active",
        monitoringEnabled: true
    },
    {
        id: "inventory",
        name: "SMART Inventory",
        domain: "https://inv.e-profit.id",
        environment: "production",
        healthEndpoint: "http://127.0.0.1:3001/api/health",
        apiEndpoint: "http://127.0.0.1:3001/api",
        status: "active",
        monitoringEnabled: true
    },
    {
        // SMART Kasir (SP-029 M2) — server 3003 sudah live; monitoring
        // masih off — aktifkan (status active) bila Monitoring Center dipakai.
        id: "pos",
        name: "SMART Kasir",
        domain: "https://pos.e-profit.id",
        environment: "production",
        healthEndpoint: "http://127.0.0.1:3003/api/health",
        apiEndpoint: "http://127.0.0.1:3003/api",
        status: "active",
        monitoringEnabled: false
    },
    // ── Aplikasi mendatang (monitoringEnabled: false) ──
    // Aktifkan dengan set monitoringEnabled: true + isi healthEndpoint.
    {
        id: "wms",
        name: "SmartWMS",
        domain: "",
        environment: "staging",
        healthEndpoint: "",
        apiEndpoint: "",
        status: "inactive",
        monitoringEnabled: false
    },
    {
        id: "eprofit",
        name: "e-Profit",
        domain: "",
        environment: "staging",
        healthEndpoint: "",
        apiEndpoint: "",
        status: "inactive",
        monitoringEnabled: false
    },
    {
        id: "santripintar",
        name: "Santri Pintar",
        domain: "",
        environment: "staging",
        healthEndpoint: "",
        apiEndpoint: "",
        status: "inactive",
        monitoringEnabled: false
    },
    {
        id: "sitampan",
        name: "SITAMPAN",
        domain: "",
        environment: "staging",
        healthEndpoint: "",
        apiEndpoint: "",
        status: "inactive",
        monitoringEnabled: false
    },
    {
        id: "desainsight",
        name: "Desa Insight",
        domain: "",
        environment: "staging",
        healthEndpoint: "",
        apiEndpoint: "",
        status: "inactive",
        monitoringEnabled: false
    }
];

export default MONITORING_APPS;
