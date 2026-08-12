/**
 * Deployment Job Queue — queue in-memory sederhana (SP-027 M5 §18).
 *
 * Memisahkan Console UI dari Deployment Execution. Job di-antrikan oleh API,
 * diproses oleh worker secara asinkron — bukan synchronous HTTP deployment
 * yang rawan timeout.
 *
 * Catatan: queue ini in-memory (hilang saat server restart). Untuk produksi
 * enterprise gunakan queue persistent (BullMQ/Redis) — abstraction siap.
 *
 * @module console/server/deployment/queue
 */

const MAX_ACTIVE = 1;   // satu deployment aktif bersamaan (hindari race)
const POLL_MS = 300;

const jobs = [];        // antrian job
let active = 0;
let started = false;
let processor = null;   // handler job (diset saat startDeploymentWorker)

/**
 * Antrikan job untuk diproses worker.
 * Job aman di-antri sebelum worker start (diproses setelah handler diset).
 * @param {object} job { id, type, payload }
 * @returns {void}
 */
export function enqueue(job) {
    jobs.push(job);
    if (processor) {
        ensureStarted();
    }
}

/**
 * Daftarkan handler job + mulai loop worker (idempotent).
 * @param {Function} handler async (job) => void
 */
export function ensureStarted(handler) {
    if (handler) {
        processor = handler;
    }
    if (started) return;
    started = true;
    const loop = async () => {
        if (!started) return; // stopQueue() → hentikan loop
        if (active < MAX_ACTIVE && jobs.length > 0 && processor) {
            const job = jobs.shift();
            active += 1;
            try {
                await processor(job);
            } catch (err) {
                console.error("[Deployment Worker] Job gagal:", job?.id, err.message);
            } finally {
                active -= 1;
            }
        }
        setTimeout(loop, POLL_MS);
    };
    setTimeout(loop, POLL_MS);
    console.log("[Deployment Worker] Queue worker aktif (in-memory)");
}

/**
 * Hentikan worker (untuk test / shutdown) — loop berhenti di tick berikutnya.
 */
export function stopQueue() {
    started = false;
    jobs.length = 0;
}

/**
 * Status queue (untuk debugging/dashboard).
 * @returns {{ queued: number, active: number }}
 */
export function queueStats() {
    return { queued: jobs.length, active };
}

export default { enqueue, ensureStarted, stopQueue, queueStats };
