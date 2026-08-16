import { describe, it, expect } from "vitest";
import {
    parseProofDataUri,
    normalizeImageMime,
    sanitizeProof,
    ALLOWED_IMAGE_TYPES,
    MAX_PROOF_DATA_URI_LENGTH
} from "../services/payment-proof.js";

/**
 * F&B Payment Proof V1 — validasi bukti pembayaran (pure helpers).
 * Format minimal: JPG/JPEG/PNG/WEBP. Upload TIDAK otomatis PAID (kasir verifikasi).
 */

function dataUriOf(mime, bytes) {
    const b64 = "A".repeat(bytes || 100);
    return `data:${mime};base64,${b64}`;
}

describe("normalizeImageMime — whitelist tipe gambar", () => {
    it("mengenal JPG/JPEG/PNG/WEBP", () => {
        expect(normalizeImageMime("data:image/jpeg;base64,AAAA")).toEqual({ mimeType: "image/jpeg" });
        expect(normalizeImageMime("data:image/png;base64,AAAA")).toEqual({ mimeType: "image/png" });
        expect(normalizeImageMime("data:image/webp;base64,AAAA")).toEqual({ mimeType: "image/webp" });
    });

    it("jpg dinormalisasi ke jpeg", () => {
        expect(normalizeImageMime("data:image/jpg;base64,AAAA")).toEqual({ mimeType: "image/jpeg" });
    });

    it("tipe di luar whitelist (gif/pdf/txt) ditolak", () => {
        expect(normalizeImageMime("data:image/gif;base64,AAAA")).toBeNull();
        expect(normalizeImageMime("data:application/pdf;base64,AAAA")).toBeNull();
        expect(normalizeImageMime("data:text/plain;base64,AAAA")).toBeNull();
    });

    it("bukan data URI / bukan string → null", () => {
        expect(normalizeImageMime("http://x/y.jpg")).toBeNull();
        expect(normalizeImageMime(null)).toBeNull();
        expect(normalizeImageMime(123)).toBeNull();
        expect(normalizeImageMime("data:image/jpeg;base64")).toBeNull();
    });
});

describe("parseProofDataUri — validasi lengkap (tipe + ukuran)", () => {
    it("data URI valid → ok + mimeType + dataUri dipertahankan", () => {
        const uri = dataUriOf("image/jpeg");
        const r = parseProofDataUri(uri);
        expect(r.ok).toBe(true);
        expect(r.mimeType).toBe("image/jpeg");
        expect(r.dataUri).toBe(uri);
    });

    it("kosong / bukan string → error jelas", () => {
        expect(parseProofDataUri("").ok).toBe(false);
        expect(parseProofDataUri(undefined).ok).toBe(false);
        expect(parseProofDataUri(null).ok).toBe(false);
    });

    it("tipe tidak didukung → error format", () => {
        const r = parseProofDataUri("data:image/gif;base64,AAAA");
        expect(r.ok).toBe(false);
        expect(r.error).toContain("JPG");
    });

    it("ukuran melebihi batas (1,5MB) → ditolak", () => {
        const r = parseProofDataUri(dataUriOf("image/png", MAX_PROOF_DATA_URI_LENGTH + 1));
        expect(r.ok).toBe(false);
        expect(r.error).toContain("1,5 MB");
    });

    it("ukuran di batas → diterima (total data URI = batas)", () => {
        const prefix = "data:image/png;base64,";
        const uri = dataUriOf("image/png", MAX_PROOF_DATA_URI_LENGTH - prefix.length);
        expect(uri.length).toBe(MAX_PROOF_DATA_URI_LENGTH);
        expect(parseProofDataUri(uri).ok).toBe(true);
    });
});

describe("sanitizeProof — response customer TANPA dataUri (security §16)", () => {
    it("membuang dataUri, menyimpan status & audit timestamps", () => {
        const p = {
            _id: "proof-1",
            status: "rejected",
            mimeType: "image/jpeg",
            dataUri: "data:image/jpeg;base64,SECRET",
            createdAt: new Date("2026-08-15T00:00:00Z"),
            verifiedAt: new Date("2026-08-15T00:05:00Z"),
            verifiedBy: "Kasir A",
            rejectionReason: "nominal tidak sesuai"
        };
        const out = sanitizeProof(p);
        expect(out.id).toBe("proof-1");
        expect(out.status).toBe("rejected");
        expect(out.uploadedAt).toBe(p.createdAt);
        expect(out.verifiedAt).toBe(p.verifiedAt);
        expect(out.verifiedBy).toBe("Kasir A");
        expect(out.dataUri).toBeUndefined();
        expect(JSON.stringify(out)).not.toContain("SECRET");
    });

    it("null → null", () => {
        expect(sanitizeProof(null)).toBeNull();
        expect(sanitizeProof(undefined)).toBeNull();
    });
});

describe("konstanta whitelist", () => {
    it("hanya JPG/PNG/WEBP yang diizinkan", () => {
        expect(ALLOWED_IMAGE_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
    });
});
