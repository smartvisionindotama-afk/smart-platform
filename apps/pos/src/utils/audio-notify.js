/**
 * Audio Notification Utility — F&B V1 (customer / kasir / kitchen).
 *
 * Semua notifikasi memakai audio:
 *   - speak(text)     — pesan SUARA via speechSynthesis (bahasa Indonesia)
 *   - playAlertTone() — nada pendek (Web Audio API, tanpa file eksternal)
 *
 * Browser memblokir autoplay audio sebelum ada interaksi pengguna; semua
 * pemanggilan terjadi SAAT ada interaksi (klik tombol, polling aktif di
 * halaman) — bila diblokir, diam (tidak error).
 *
 * PEMILIHAN SUARA (F&B V1-FIX v0.44):
 *   - Prefer suara PEREMPUAN Indonesia: "Google Bahasa Indonesia" (female)
 *     atau "Microsoft Gadis" (female) — bukan sekadar id-ID pertama
 *     (browser/OS bisa menaruh suara laki-laki lebih dulu di daftar).
 *   - Chrome memuat daftar voice ASINKRON (getVoices() kosong di panggilan
 *     pertama) — polling berkala sampai voice id-ID termuat, jangan langsung
 *     jatuh ke default system voice (laki-laki logat Eropa).
 *   - Fallback terakhir: tetap ucapkan dengan u.lang="id-ID" agar browser
 *     memilih suara terdekat, alih-alih default logat asing.
 *
 * @module pos/utils/audio-notify
 */

/* Cache suara Indonesia — getVoices() termuat ASINKRON di Chrome (kosong
   pada panggilan pertama, baru penuh setelah voiceschanged). Di-cache di
   module level + di-refresh via listener voiceschanged + polling berkala. */
let cachedIdVoice = null;

/**
 * Pilih suara Indonesia (prefer PEREMPUAN). Urutan prioritas:
 *   1. Voice id-ID dengan nama perempuan (Google/Gadis/Female/Perempuan/Wanita)
 *   2. Voice id-ID apa pun (pertama di daftar)
 *   3. Voice dengan nama mengandung "indonesia" (lang tidak konsisten)
 *   4. null (tidak ada suara Indonesia terpasang)
 * @returns {SpeechSynthesisVoice|null}
 */
function pickIndonesianVoice() {
    try {
        const voices = window.speechSynthesis.getVoices();
        if (!voices || !voices.length) return null;
        const idVoices = voices.filter(v => /^id[-_]ID/i.test(v.lang));
        const female = idVoices.find(v =>
            /gadis|female|perempuan|wanita|google/i.test(v.name || "")
        );
        if (female) return female;
        if (idVoices.length) return idVoices[0];
        return voices.find(v => /indonesia/i.test(v.name || "")) || null;
    } catch {
        return null;
    }
}

function refreshVoiceCache() {
    cachedIdVoice = pickIndonesianVoice();
    return cachedIdVoice;
}

try {
    if ("speechSynthesis" in window) {
        refreshVoiceCache();
        window.speechSynthesis.addEventListener("voiceschanged", refreshVoiceCache);
        // Chrome/Android: getVoices() kosong sampai voiceschanged — polling
        // ringan (150ms, maks 3 dtk) supaya cache terisi walau event tidak
        // pernah terpicu (beberapa browser/kondisi).
        if (!cachedIdVoice) {
            const pollStart = Date.now();
            const poll = setInterval(() => {
                if (refreshVoiceCache() || Date.now() - pollStart > 3000) {
                    clearInterval(poll);
                }
            }, 150);
        }
    }
} catch { /* speech tidak didukung — diam */ }

/**
 * Pesan suara (speechSynthesis) — suara perempuan Indonesia bila tersedia.
 *
 * PERBAIKAN (F&B V1-FIX): bila voice id-ID belum termuat saat dipanggil
 * (getVoices() masih kosong — termuat asinkron), speak DITUNDA sebentar
 * (maks 1,5 dtk) sambil polling, daripada langsung memakai DEFAULT system
 * voice (laki-laki logat Eropa). Bila tetap belum ada → fallback u.lang
 * "id-ID" (browser memilih suara terdekat).
 */
export function speak(text) {
    try {
        if (!("speechSynthesis" in window) || !text) return;
        const id = cachedIdVoice || pickIndonesianVoice();
        if (id) {
            doSpeak(text, id);
            return;
        }
        // Voice id-ID belum termuat — JANGAN langsung pakai default (pria
        // logat Eropa). Tunggu getVoices() TERISI (voice benar-benar selesai
        // dimuat, maks ~4 dtk) sambil polling; baru speak dengan voice id-ID.
        // Fallback ke default HANYA bila getVoices() sudah terisi tapi tidak
        // ada suara id-ID sama sekali di perangkat (bukan karena masih loading).
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            try { window.speechSynthesis.removeEventListener("voiceschanged", onChanged); } catch { /* ignore */ }
            doSpeak(text, refreshVoiceCache() || null);
        };
        const onChanged = () => finish();
        const started = Date.now();
        const retry = setInterval(() => {
            const voices = window.speechSynthesis.getVoices();
            const v = refreshVoiceCache();
            if (v) {
                clearInterval(retry);
                finish();
            } else if (voices && voices.length > 0) {
                // Voices sudah TERMUAT penuh tapi tidak ada id-ID di perangkat
                // → tidak akan berubah lagi; pakai default (lebih baik dari diam).
                clearInterval(retry);
                finish();
            } else if (Date.now() - started > 4000) {
                clearInterval(retry);
                finish();
            }
        }, 150);
        try {
            window.speechSynthesis.addEventListener("voiceschanged", onChanged);
        } catch { /* fallback polling di atas */ }
    } catch { /* speech tidak didukung — diam */ }
}

/** Ucapkan teks dengan voice tertentu (atau default bila null). */
function doSpeak(text, voice) {
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(String(text));
        u.lang = "id-ID";
        u.rate = 1.02;
        u.pitch = 1;
        u.volume = 1;
        if (voice) u.voice = voice;
        window.speechSynthesis.speak(u);
    } catch { /* speech tidak didukung — diam */ }
}

/** Nada alert pendek (Web Audio API) — tidak butuh file audio. */
export function playAlertTone() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const now = ctx.currentTime;
        // Nada naik dua-tahap (alert): 880 → 1174 Hz
        [880, 1174].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            const t = now + i * 0.16;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.24);
        });
        // Selesai → tutup context (jangan bocor)
        setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, 700);
    } catch { /* audio tidak didukung — diam */ }
}

export default { speak, playAlertTone };
