/**
 * BankAccount Model — Rekening Bank Company (F&B Payment V1).
 *
 * Company dapat memiliki MAKSIMAL 3 rekening AKTIF (enforcement di route).
 * Field: bank_name, account_number, account_name, active, company_id.
 * Multi-tenant: semua operasi wajib discope companyCode.
 *
 * @module server/models/BankAccount
 */

import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema({
    companyCode:   { type: String, required: true, index: true },
    bankName:      { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    accountName:   { type: String, required: true, trim: true },
    active:        { type: Boolean, default: true },
    createdBy:     { type: String, default: null },
    updatedBy:     { type: String, default: null }
}, { timestamps: true });

// Satu nomor rekening per bank per company unik.
bankAccountSchema.index({ companyCode: 1, bankName: 1, accountNumber: 1 }, { unique: true });

export const BankAccount = mongoose.model("BankAccount", bankAccountSchema);
