# SMART Inventory MongoDB Migration Report
## Migrasi mongodb-memory-server → MongoDB Community Server

**Date:** 2026-07-28
**Author:** FreeBuff AI (Buffy)
**Status:** ✅ SUCCESS

---

## 1. Kondisi Sebelum Migrasi

| Item | Detail |
|------|--------|
| **Database Engine** | mongodb-memory-server (embedded) |
| **Storage** | Persistent WiredTiger di `local/data/mongodb/` |
| **MongoDB Version** | 7.0.24 (embedded via mongodb-memory-server) |
| **Connection** | Auto-start via `MongoMemoryServer.create()` |
| **DB Name** | `smart_inventory` |
| **Package** | `mongodb-memory-server: ^10.1.0` |
| **Seed System** | Otomatis di `connectDB()` — skip jika data sudah ada |
| **Data** | 18 collections, 169 documents |
| **OS** | Ubuntu 24.04.4 LTS |
| **Node.js** | v24.18.0 |
| **PM2** | Running — inventory-api (online) |

---

## 2. Kondisi Sesudah Migrasi

| Item | Detail |
|------|--------|
| **Database Engine** | MongoDB Community Server 8.0.28 |
| **Storage** | System directory `/var/lib/mongodb` |
| **Service** | `mongod.service` — active (running), enabled |
| **Connection** | `mongoose.connect(MONGO_URI)` via `.env` |
| **DB Name** | `smart_inventory` |
| **Package** | `mongodb-memory-server` removed ✅ |
| **URI** | `mongodb://127.0.0.1:27017/smart_inventory` |
| **Data** | 18 collections, 169 documents — fully migrated ✅ |

---

## 3. File yang Berubah

| File | Perubahan |
|------|-----------|
| **`server/db.js`** | Hapus `MongoMemoryServer`, ganti dengan `mongoose.connect(process.env.MONGO_URI)` |
| **`server/.env`** | Tambah `MONGO_URI=mongodb://127.0.0.1:27017/smart_inventory` |
| **`server/package.json`** | Hapus dependency `mongodb-memory-server: ^10.1.0` |
| **`server/package-lock.json`** | Regenerated — 42 packages removed |
| **`~/.cache/mongodb-binaries/`** | Dihapus (184MB mongod binary) |

---

## 4. Migration Details

| Langkah | Status | Detail |
|---------|--------|--------|
| Backup data lama | ✅ | `/srv/backup/inventory-migration/inventory-before-mongodb-migration-20260728_203239/` |
| Install MongoDB 8.0 | ✅ | `apt-get install mongodb-org` — version 8.0.28 |
| Buat database | ✅ | `smart_inventory` via mongosh |
| Export data lama | ✅ | `mongodump` dari temporary mongod port 27018 |
| Import ke MongoDB baru | ✅ | `mongorestore` — 169 documents, 0 failures |
| Update db.js | ✅ | Koneksi via `MONGO_URI` environment |
| Update .env | ✅ | `MONGO_URI=mongodb://127.0.0.1:27017/smart_inventory` |
| Hapus mongodb-memory-server | ✅ | Dari package.json + npm install |
| Cleanup cache | ✅ | `~/.cache/mongodb-binaries/` dihapus (184MB) |

---

## 5. Status Services

| Service | Status |
|---------|--------|
| **MongoDB (mongod)** | ✅ **active (running)** — enabled at boot |
| **PM2 (inventory-api)** | ✅ **online** — PID 14537 |
| **PM2 Autostart** | ✅ **enabled** — pm2-smartvision.service |
| **API Health** | ✅ `{"status":"ok"}` — http://localhost:3001/api/health |
| **Login (admin)** | ✅ `operator/operator123` — role: operator |
| **Login (owner)** | ✅ `fejsingtop/Nadazalfa00!` — role: owner |

---

## 6. Data Collections

| Collection | Documents |
|-----------|-----------|
| activitylogs | 60 |
| barangs | 25 |
| satuans | 21 |
| kategoris | 17 |
| users | 10 |
| customers | 8 |
| permissions | 5 |
| raks | 4 |
| roles | 4 |
| warehouses | 3 |
| companies | 3 |
| transfers | 2 |
| pembelians | 2 |
| penjualans | 2 |
| sales | 1 |
| suppliers | 1 |
| superadmins | 1 |
| baranggudangs | 0 |
| **Total** | **169 documents** |

---

## 7. Backup Location

```
/srv/backup/inventory-migration/inventory-before-mongodb-migration-20260728_203239/
├── .env
├── config/
├── data/              # 77 WiredTiger files dari old database
├── db.js
├── index.js
├── package.json
└── seed.js
```

---

## 8. Validation Checklist

| # | Item | Status |
|---|------|--------|
| ✅ | MongoDB service running | ✅ `active` |
| ✅ | API running | ✅ `{"status":"ok"}` |
| ✅ | PM2 running | ✅ `online` |
| ✅ | Login berhasil | ✅ operator + fejsingtop |
| ✅ | Data lama aman | ✅ Backup di `/srv/backup/` |
| ✅ | Tidak ada mongodb-memory-server | ✅ Removed from packages + source |
| ✅ | Backup tersedia | ✅ 77 data files + 6 config files |

---

## 9. Potensi Masalah

1. **Rollback**: Jika diperlukan, backup ada di `/srv/backup/inventory-migration/`. Cukup restore `db.js`, `package.json` lama, install ulang `mongodb-memory-server`, dan start temporary mongod dengan data backup.

2. **MongoDB Upgrade**: Data WiredTiger dari mongodb-memory-server 7.0 sukses di-restore ke MongoDB 8.0 tanpa issue. Ini menunjukkan kompatibilitas mundur yang baik.

3. **Security**: MongoDB saat ini berjalan tanpa autentikasi (default bind to 127.0.0.1). Untuk production, disarankan mengaktifkan auth.

4. **Monitoring**: Disarankan memonitor `/var/log/mongodb/mongod.log` untuk deteksi dini masalah.

---

## 10. MongoDB Config

**Config file:** `/etc/mongod.conf`
**Data directory:** `/var/lib/mongodb`
**Log file:** `/var/log/mongodb/mongod.log`
**Port:** 27017
**Bind IP:** 127.0.0.1

---

*Report generated by FreeBuff AI (Buffy)*
