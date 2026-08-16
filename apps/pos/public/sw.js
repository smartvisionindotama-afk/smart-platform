/**
 * Service Worker — Customer Ready Notification (F&B V1).
 *
 * Menangani Web Push "Pesanan Anda sudah siap" dari backend. Push event
 * menampilkan notifikasi (visual + vibrate + sound bila didukung OS/browser).
 * notificationclick membawa customer kembali ke status order-nya.
 *
 * Tidak ada fetch handler — halaman aplikasi tetap berjalan normal.
 */

/* F&B V1-FIX v0.44 — pilih suara Indonesia PEREMPUAN utk speechSynthesis di
   service worker (sama persis dgn audio-notify.js in-page): prefer
   Google/Gadis/Female id-ID, polling getVoices() (asinkron di Chrome),
   fallback u.lang id-ID. Tanpa ini browser memakai DEFAULT system voice
   (sering laki-laki logat Eropa). */
let cachedIdVoice = null;
function pickIndonesianVoice() {
    try {
        const voices = self.speechSynthesis ? self.speechSynthesis.getVoices() : [];
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
    if (self.speechSynthesis) {
        refreshVoiceCache();
        self.speechSynthesis.addEventListener("voiceschanged", refreshVoiceCache);
        if (!cachedIdVoice) {
            const pollStart = Date.now();
            const poll = setInterval(() => {
                if (refreshVoiceCache() || Date.now() - pollStart > 3000) {
                    clearInterval(poll);
                }
            }, 150);
        }
    }
} catch { /* speech tidak didukung — notifikasi visual tetap tampil */ }

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        try {
            payload = { body: event.data ? event.data.text() : "" };
        } catch { /* payload kosong */ }
    }

    const title = payload.title || "Pesanan Anda sudah siap 🍽️";
    const options = {
        body: payload.body || "Silakan mengambil pesanan di kasir.",
        icon: payload.icon || "",
        badge: payload.badge || "",
        vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : [200, 100, 200],
        // sound: didukung beberapa browser/OS; yang lain fallback vibrate +
        // suara default sistem (ikuti capability, jangan buat error).
        sound: payload.sound || "",
        data: payload.data || {},
        tag: payload.data && payload.data.orderId ? `ready-${payload.data.orderId}` : "order-ready",
        renotify: true,
        requireInteraction: false
    };

    event.waitUntil((async () => {
        await self.registration.showNotification(title, options);
        // F&B V1 — pesan SUARA utk notifikasi penting (order siap /
        // pembayaran dikonfirmasi) walau browser sedang ditutup/di background.
        try {
            const speakText = (payload && payload.speakText) || title || "";
            if (speakText && self.speechSynthesis) {
                self.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(String(speakText));
                u.lang = "id-ID";
                u.rate = 1.02;
                // Pilih suara Indonesia PEREMPUAN (konsisten dgn audio-notify.js
                // in-page); polling refresh bila cache belum termuat.
                const voice = cachedIdVoice || refreshVoiceCache();
                if (voice) u.voice = voice;
                self.speechSynthesis.speak(u);
            }
        } catch { /* speech tidak didukung — notifikasi visual tetap tampil */ }
    })());
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || "/m/";
    event.waitUntil((async () => {
        const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of allClients) {
            if ("focus" in client) {
                try {
                    await client.navigate(url);
                    await client.focus();
                    return;
                } catch { /* coba client lain */ }
            }
        }
        if (self.clients.openWindow) {
            await self.clients.openWindow(url);
        }
    })());
});
