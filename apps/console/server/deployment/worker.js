/**
 * Deployment Worker — memproses job dari queue (SP-027 M5 §18).
 *
 * Console UI  →  Deployment API  →  Job/Queue  →  Worker
 *   (build / deploy / health-check)
 *
 * Worker TIDAK mengeksekusi input user — hanya trusted Application config
 * melalui pipeline controlled (lihat pipeline.js). Mode default simulate
 * untuk staging/production (aman); real execution hanya development saat
 * DEPLOYMENT_EXECUTION=real.
 *
 * @module console/server/deployment/worker
 */

import { ensureStarted, queueStats } from "./queue.js";
import { runCommand, runPipelineStep } from "./pipeline.js";
import { BuildRecord } from "../models/BuildRecord.js";
import { DeploymentRecord } from "../models/DeploymentRecord.js";
import { DeploymentEnvironment } from "../models/DeploymentEnvironment.js";
import { ReleaseRecord } from "../models/ReleaseRecord.js";
import { Application } from "../models/Application.js";
import path from "node:path";

/**
 * Proses satu job dari queue.
 * @param {object} job { id, type, payload }
 */
export async function processJob(job) {
    if (job.type === "build") {
        await processBuild(job);
    } else if (job.type === "deploy") {
        await processDeploy(job);
    } else {
        console.warn(`[Deployment Worker] Jenis job tidak dikenal: ${job.type}`);
    }
}

/** Jalankan langkah pipeline dengan update status di DB. */
async function runStepWithRecord(recordId, Model, stepName, fn) {
    await Model.updateOne(
        { _id: recordId, "steps.name": stepName },
        { $set: { "steps.$.status": "RUNNING", "steps.$.startedAt": new Date() } }
    );
    try {
        const result = await fn();
        const set = {
            "steps.$.status": result.ok ? "SUCCESS" : "FAILED",
            "steps.$.finishedAt": new Date(),
            "steps.$.log": result.output || ""
        };
        const update = { $set: set };
        // logs: array string (BuildRecord) — push aman; string (DeploymentRecord) — concat
        if (Model.modelName === "BuildRecord") {
            update.$push = { logs: `[${stepName}] ${result.ok ? "OK" : "FAIL"}: ${String(result.output || "").split("\n").filter(Boolean).slice(-3).join(" | ")}` };
        }
        await Model.updateOne({ _id: recordId, "steps.name": stepName }, update);
        return result;
    } catch (err) {
        await Model.updateOne(
            { _id: recordId, "steps.name": stepName },
            { $set: { "steps.$.status": "FAILED", "steps.$.finishedAt": new Date(), "steps.$.log": err.message } }
        );
        return { ok: false, output: err.message };
    }
}

/**
 * Proses job build: install → test → build → package.
 * Command dari Application config (trusted), bukan input user.
 */
async function processBuild(job) {
    const { buildId, app, environment } = job.payload;
    const startedAt = new Date();
    const cwd = path.resolve(process.env.DEPLOYMENT_WORKSPACE || "/srv");

    await BuildRecord.updateOne({ _id: buildId }, { $set: { status: "RUNNING", startedAt } });

    const install = await runStepWithRecord(buildId, BuildRecord, "install", () =>
        runCommand(app.installCommand || "npm install", cwd, { timeoutMs: 180000, environment }));
    if (!install.ok) {
        await failBuild(buildId, startedAt, install.output);
        return;
    }
    const test = await runStepWithRecord(buildId, BuildRecord, "test", () =>
        runCommand(app.testCommand || "npm test", cwd, { timeoutMs: 180000, environment }));
    const build = await runStepWithRecord(buildId, BuildRecord, "build", () =>
        runCommand(app.buildCommand || "npm run build", cwd, { timeoutMs: 240000, environment }));
    const pack = await runStepWithRecord(buildId, BuildRecord, "package", () =>
        runCommand("npm pack --dry-run", cwd, { timeoutMs: 60000, environment }));

    const ok = test.ok && build.ok && pack.ok;
    const finishedAt = new Date();
    await BuildRecord.updateOne(
        { _id: buildId },
        {
            $set: {
                status: ok ? "SUCCESS" : "FAILED",
                finishedAt,
                durationMs: finishedAt - startedAt,
                error: ok ? "" : "Salah satu langkah build gagal"
            }
        }
    );
    console.log(`[Deployment Worker] Build ${buildId} → ${ok ? "SUCCESS" : "FAILED"} (${app?.slug || "?"})`);
}

async function failBuild(buildId, startedAt, message) {
    const finishedAt = new Date();
    await BuildRecord.updateOne(
        { _id: buildId },
        {
            $set: {
                status: "FAILED",
                finishedAt,
                durationMs: finishedAt - startedAt,
                error: message
            },
            $push: { logs: `[fail] ${message}` }
        }
    );
}

/**
 * Proses job deploy: deploy → verify → health-check (M4).
 * Deployment SUCCESS hanya jika deploy selesai DAN health check lolos.
 */
async function processDeploy(job) {
    const { deploymentId, app, environment, release } = job.payload;
    const startedAt = new Date();

    try {
        await DeploymentRecord.updateOne({ _id: deploymentId }, { $set: { status: "RUNNING", startedAt } });

        const stepResult = await runPipelineStep({ app, environment, release });

        const finishedAt = new Date();
        const ok = stepResult.ok;
        await DeploymentRecord.updateOne(
            { _id: deploymentId },
            {
                $set: {
                    status: ok ? "SUCCESS" : "FAILED",
                    finishedAt,
                    durationMs: finishedAt - startedAt,
                    logs: stepResult.log,
                    healthCheck: stepResult.health || { httpStatus: null, responseTimeMs: null, ok: false, message: "Tidak ada health check" },
                    error: ok ? "" : "Deployment atau health check gagal"
                }
            }
        );

        // Update environment state bila sukses
        if (ok) {
            await DeploymentEnvironment.updateOne(
                { applicationId: app._id, name: environment },
                {
                    $set: {
                        currentVersion: release?.version || "",
                        lastDeploymentAt: finishedAt,
                        lastDeploymentStatus: "SUCCESS"
                    }
                }
            );
            if (release?._id) {
                await ReleaseRecord.updateOne(
                    { _id: release._id },
                    { $set: { status: "deployed", deployedAt: finishedAt } }
                );
            }
        }

        console.log(`[Deployment Worker] Deploy ${deploymentId} → ${ok ? "SUCCESS" : "FAILED"} (${app?.slug || "?"} ${environment})`);
    } catch (err) {
        // Jangan biarkan record tertinggal RUNNING — tandai FAILED dengan alasan.
        const finishedAt = new Date();
        const logLine = `[worker] ERROR — ${err.message}`;
        try {
            const existing = await DeploymentRecord.findById(deploymentId).select("logs").lean();
            const logs = [existing?.logs, logLine].filter(Boolean).join("\n");
            await DeploymentRecord.updateOne(
                { _id: deploymentId },
                {
                    $set: {
                        status: "FAILED",
                        finishedAt,
                        durationMs: finishedAt - startedAt,
                        logs,
                        error: `Worker error: ${err.message}`
                    }
                }
            );
        } catch { /* best effort */ }
        console.error(`[Deployment Worker] Deploy ${deploymentId} error:`, err.message);
    }
}

/**
 * Init worker — panggil sekali saat server start.
 */
export function startDeploymentWorker() {
    ensureStarted(processJob);
    console.log("[Deployment Worker] siap — stats:", JSON.stringify(queueStats()));
}

export default { processJob, startDeploymentWorker };
