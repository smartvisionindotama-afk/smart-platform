/**
 * SMART Console — Deployment Center Service (SP-027 M5).
 *
 * Client untuk API Deployment Center:
 *   /api/environments, /api/builds, /api/releases, /api/deployments,
 *   /api/database (Database Explorer read-only).
 *
 * @module console/services/deployment
 */

import { authorizedFetch } from "@smart/api";

const API = "/api";

async function request(path, options = {}) {
    const res = await authorizedFetch(`${API}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

// ── Environments ──

export async function listEnvironments(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/environments${qs ? `?${qs}` : ""}`);
}

export async function createEnvironment(data) {
    return request("/environments", { method: "POST", body: JSON.stringify(data) });
}

export async function updateEnvironment(id, data) {
    return request(`/environments/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

// ── Builds ──

export async function listBuilds(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/builds${qs ? `?${qs}` : ""}`);
}

export async function getBuild(id) {
    return request(`/builds/${id}`);
}

export async function triggerBuild(data) {
    return request("/builds", { method: "POST", body: JSON.stringify(data) });
}

// ── Releases ──

export async function listReleases(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/releases${qs ? `?${qs}` : ""}`);
}

export async function getRelease(id) {
    return request(`/releases/${id}`);
}

export async function createRelease(data) {
    return request("/releases", { method: "POST", body: JSON.stringify(data) });
}

// ── Deployments ──

export async function listDeployments(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/deployments${qs ? `?${qs}` : ""}`);
}

export async function getDeployment(id) {
    return request(`/deployments/${id}`);
}

export async function triggerDeployment(data) {
    return request("/deployments", { method: "POST", body: JSON.stringify(data) });
}

export async function rollbackDeployment(id) {
    return request(`/deployments/${id}/rollback`, { method: "POST", body: "{}" });
}

// ── Database Explorer (READ-ONLY) ──

export async function listDatabases() {
    return request("/database/databases");
}

export async function listCollections(db) {
    return request(`/database/${encodeURIComponent(db)}/collections`);
}

export async function listDocuments(db, collection, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/database/${encodeURIComponent(db)}/${encodeURIComponent(collection)}/documents${qs ? `?${qs}` : ""}`);
}

export async function listIndexes(db, collection) {
    return request(`/database/${encodeURIComponent(db)}/${encodeURIComponent(collection)}/indexes`);
}

export async function getCollectionStats(db, collection) {
    return request(`/database/${encodeURIComponent(db)}/${encodeURIComponent(collection)}/stats`);
}
