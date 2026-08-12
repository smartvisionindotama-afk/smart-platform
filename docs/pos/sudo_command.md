# Sudo Command — Terapkan Config Nginx Favicon Dinamis

> **Tujuan:** Menerapkan config nginx (favicon dinamis per aplikasi) ke `/etc/nginx` dan reload.
> **Kapan:** Satu kali saja, setelah perubahan favicon (SP-029 M6-FIX).
> **Butuh:** Password sudo Anda (yang baru).

## Langkah 1 — Copy config & reload nginx

Jalankan blok berikut di terminal server (dari direktori `/srv`):

```bash
cd /srv
sudo cp platform/config/nginx/master.e-profit.id.conf /etc/nginx/sites-available/
sudo cp platform/config/nginx/inv.e-profit.id.conf /etc/nginx/sites-available/
sudo cp platform/config/nginx/pos.e-profit.id.conf /etc/nginx/sites-available/
sudo nginx -t && sudo systemctl reload nginx
```

- `nginx -t` harus menampilkan `syntax is ok` + `test is successful`.
- Warning `duplicate MIME type` bersifat kosmetik (pra-existing) — aman diabaikan.

## Langkah 2 — Verifikasi hasil

Jalankan blok ini untuk memastikan tiap domain kini mengirim logo (JPEG), bukan HTML:

```bash
for d in master inv pos; do
  curl -s -o /dev/null -w "$d: %{http_code} %{content_type} %{size_download}B\n" "https://$d.e-profit.id/favicon.svg"
done
```

**Hasil yang diharapkan:**

| Domain | Status | Tipe | Ukuran (kira-kira) |
|--------|--------|------|---------------------|
| master | 200 | image/jpeg | ~24.500 B (logo platform) |
| inv | 200 | image/jpeg | ~92.000 B (logo inventory) |
| pos | 200 | image/jpeg | ~68.000 B (logo kasir) |

Jika masih `text/html`, berarti reload belum jalan — ulangi Langkah 1.

## Langkah 3 — Cek di browser

1. Buka salah satu domain (mis. `pos.e-profit.id`).
2. Tab browser harus langsung menampilkan logo aplikasi (bukan icon flash ungu), bahkan sebelum form login muncul.
3. Jika masih tampak icon lama: **hard refresh** sekali (Ctrl+Shift+R) — favicon lama tersimpan di cache browser.

---

## Referensi singkat perubahan (untuk dokumentasi)

- **`apps/console/server/routes/platform.js`** — `serveFavicon`: endpoint `/favicon.svg` & `/favicon.ico` memilih logo berdasarkan `Host` (pos → logo POS, inv → logo inventory, master → logo platform), cache 1 jam.
- **`apps/console/server/index.js`** — mount kedua route tersebut.
- **`platform/config/nginx/*.e-profit.id.conf`** — `location = /favicon.svg` & `/favicon.ico` di-proxy ke console-api (port 3002).
- **`apps/*/index.html`** — `<link rel="icon" href="/favicon.svg" />` (tanpa `type`).
- File favicon flash statis (`public/favicon.svg` & `.ico`, `src/assets/favicon.svg`) dihapus — dead code.
