/**
 * Audit Logging — jejak keamanan untuk aktivitas sensitif.
 *
 * SP-027 M3: minimal mencatat login, logout, failed login, password change,
 * role change, company switch, dan aktivitas Super Admin. Ditulis ke
 * collection `security_auditlogs` (model di-inject per server agar memakai
 * mongoose instance yang sama dengan server tersebut).
 *
 * @module @smart/security/audit
 */

/**
 * Buat audit logger yang menulis ke model SecurityAuditLog.
 * @param {object} model Mongoose model (SecurityAuditLog)
 * @returns {object} Logger dengan method convenience
 */
export function createAuditLogger(model) {
    async function log(entry = {}) {
        const doc = {
            actorId: entry.actorId || null,
            actorName: entry.actorName || "System",
            actorType: entry.actorType || "system",
            action: entry.action || "unknown",
            category: entry.category || "general",
            targetType: entry.targetType || null,
            targetId: entry.targetId || null,
            targetName: entry.targetName || "",
            result: entry.result || "success",
            ip: entry.ip || "",
            userAgent: (entry.userAgent || "").slice(0, 300),
            metadata: entry.metadata || {},
            createdAt: new Date()
        };
        try {
            await model.create(doc);
        } catch (err) {
            console.warn("[Audit] gagal menulis log:", err.message);
        }
    }

    return {
        log,
        login: entry => log({ ...entry, action: "login", category: "auth" }),
        logout: entry => log({ ...entry, action: "logout", category: "auth" }),
        failedLogin: entry => log({ ...entry, action: "login.failed", category: "auth", result: "failed" }),
        passwordChange: entry => log({ ...entry, action: "password.change", category: "account" }),
        roleChange: entry => log({ ...entry, action: "role.change", category: "permission" }),
        companySwitch: entry => log({ ...entry, action: "company.switch", category: "company" }),
        superadminActivity: entry => log({ ...entry, category: "superadmin.activity" })
    };
}

export default createAuditLogger;
