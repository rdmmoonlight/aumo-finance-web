// wwwroot/js/quran-banner.js

document.addEventListener('DOMContentLoaded', function () {
    
    // 17 batas waktu dalam menit dari 00:00 (Sesuai tabel waktu yang Mas berikan)
    const timeSlots = [
        0,     // Slot 1  : 00:00 (0m)
        85,    // Slot 2  : 01:25 (85m)
        169,   // Slot 3  : 02:49 (169m)
        254,   // Slot 4  : 04:14 (254m)
        339,   // Slot 5  : 05:39 (339m)
        424,   // Slot 6  : 07:04 (424m)
        508,   // Slot 7  : 08:28 (508m)
        593,   // Slot 8  : 09:53 (593m)
        678,   // Slot 9  : 11:18 (678m)
        762,   // Slot 10 : 12:42 (762m)
        847,   // Slot 11 : 14:07 (847m)
        932,   // Slot 12 : 15:32 (932m)
        1016,  // Slot 13 : 16:56 (1016m)
        1101,  // Slot 14 : 18:21 (1101m)
        1186,  // Slot 15 : 19:46 (1186m)
        1271,  // Slot 16 : 21:11 (1271m)
        1355   // Slot 17 : 22:35 (1355m)
    ];

    // Fungsi menghitung Slot Ayat (1 - 6236) berdasarkan Hari & Waktu
    function calculateAyahNumber() {
        const now = new Date();
        
        // A. Hitung Hari ke-n dalam Tahun (1 - 365/366)
        const startOfYear = new Date(now.getFullYear(), 0, 0);
        const diff = now - startOfYear;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay); // Hari ke-1 s/d 365

        // B. Hitung Slot Jam berdasarkan menit saat ini
        const currentMinutes = (now.getHours() * 60) + now.getMinutes();
        let slotIndex = 0; // 0 s/d 16
        
        for (let i = timeSlots.length - 1; i >= 0; i--) {
            if (currentMinutes >= timeSlots[i]) {
                slotIndex = i;
                break;
            }
        }

        // C. Formula Utama: Index Ayat sekuensial (1 - 6236)
        // (Hari-1 * 17) + Slot + 1
        let ayahNumber = ((dayOfYear - 1) * 17) + slotIndex + 1;

        // Bounding agar tidak melebih total 6236 ayat Al-Qur'an
        if (ayahNumber > 6236) {
            ayahNumber = ((ayahNumber - 1) % 6236) + 1;
        }

        return ayahNumber;
    }

    // Fungsi Fetch API Ayat ke-n
    async function loadQuranVerse() {
        const textElem = document.getElementById('quranVerseText');
        const refElem = document.getElementById('quranVerseRef');

        if (!textElem || !refElem) return;

        const ayahNumber = calculateAyahNumber();

        try {
            // Memanggil API publik Alquran Cloud (Edition: en.sahih / Sahih International US English)
            const response = await fetch(`https://api.alquran.cloud/v1/ayah/${ayahNumber}/en.sahih`);
            const data = await response.json();

            if (data.code === 200 && data.status === "OK") {
                const verse = data.data;
                
                // Set Teks Terjemah
                textElem.textContent = `"${verse.text}"`;
                
                // Set Referensi (Contoh: QS. Al-Baqarah 2:255)
                refElem.textContent = `QS. ${verse.surah.englishName} ${verse.surah.number}:${verse.numberInSurah}`;
            } else {
                throw new Error("Gagal memuat ayat");
            }
        } catch (error) {
            // Fallback jika offline / API bermasalah
            textElem.textContent = `"Allah does not charge a soul except with that which He has given it."`;
            refElem.textContent = `QS. At-Talaq 65:7`;
        }
    }

    // Jalankan pertama kali saat halaman dimuat
    loadQuranVerse();

    // Cek setiap 1 menit. Jika slot waktu berganti, otomatis re-fetch ayat baru
    let currentCalculatedAyah = calculateAyahNumber();
    setInterval(() => {
        const newAyahNumber = calculateAyahNumber();
        if (newAyahNumber !== currentCalculatedAyah) {
            currentCalculatedAyah = newAyahNumber;
            loadQuranVerse();
        }
    }, 60000);
});