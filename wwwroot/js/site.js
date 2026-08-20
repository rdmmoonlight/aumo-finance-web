// ==========================================
// Aumo Finance - Global Site JavaScript
// Cosmic / Nebula Theme
// ==========================================


// ==========================================
// Aumo Modal Helper
// ==========================================
//
// Helper ini digunakan oleh komponen Blazor untuk membuka dan
// menutup modal secara terprogram tanpa reload halaman. Logika
// tampil/sembunyi modal ditangani oleh js/aumo-ui.js (buatan
// sendiri, tanpa dependensi Bootstrap).
//

window.aumoModal = {

    /**
     * Show modal.
     *
     * @param {string} elementId
     */
    show: function (elementId) {
        if (typeof window.aumoUI === 'undefined') {
            console.error('[aumoModal] aumo-ui.js is not loaded.');
            return;
        }

        window.aumoUI.modal.show(elementId);
    },

    /**
     * Hide modal.
     *
     * @param {string} elementId
     */
    hide: function (elementId) {
        if (typeof window.aumoUI === 'undefined') {
            console.error('[aumoModal] aumo-ui.js is not loaded.');
            return;
        }

        window.aumoUI.modal.hide(elementId);
    }
};


// ==========================================
// Aumo Finance Theme Controller
// ==========================================
//
// Theme values:
//   dark  = Cosmic / Nebula Dark
//   light = Aumo Light
//
// Dark is always the fallback/default.
//

window.aumoTheme = {

    /**
     * Get the currently active theme.
     *
     * @returns {string}
     */
    get: function () {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        return currentTheme === 'light' ? 'light' : 'dark';
    },

    /**
     * Apply a theme.
     *
     * @param {string} themeName
     */
    set: function (themeName) {
        const theme = themeName === 'light' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('aumo_theme', theme);
    },

    /**
     * Toggle between dark and light theme.
     *
     * @returns {string}
     */
    toggle: function () {
        const currentTheme = this.get();
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

        this.set(nextTheme);
        return nextTheme;
    },

    /**
     * Restore the saved theme.
     *
     * Dark is used when no valid preference exists.
     *
     * @returns {string}
     */
    restore: function () {
        const savedTheme = localStorage.getItem('aumo_theme');
        const theme = (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';

        document.documentElement.setAttribute('data-bs-theme', theme);
        return theme;
    }
};


// ==========================================
// Device Local Timestamp Helper
// ==========================================
//
// Dipakai untuk mencatat CreatedAt jurnal berdasarkan waktu
// lokal PERANGKAT saat input, bukan waktu server saat data
// disimpan ke database.
//

window.aumoTime = {

    /**
     * Ambil waktu lokal perangkat saat ini sebagai string
     * "YYYY-MM-DDTHH:mm:ss" (tanpa konversi timezone apapun,
     * murni jam dinding perangkat).
     */
    getLocalTimestamp: function () {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
};


// ==========================================
// Date Picker Helper
// ==========================================
//
// Input tanggal asli (<input type="date">) disembunyikan dan
// hanya dipakai sebagai kalender native. Teks yang tampil ke user
// selalu diformat dd/MM/yyyy dari sisi Blazor, supaya formatnya
// konsisten di semua browser (format tampilan input type="date"
// bawaan browser tidak bisa dipaksa lewat CSS/HTML).
//
window.aumoDate = {

    /**
     * Buka kalender native dari input type="date" tersembunyi.
     *
     * @param {string} elementId
     */
    showPicker: function (elementId) {
        const el = document.getElementById(elementId);

        if (!el) {
            console.warn(`[aumoDate] Element with ID '${elementId}' not found.`);
            return;
        }

        if (typeof el.showPicker === 'function') {
            try {
                el.showPicker();
                return;
            } catch (error) {
                // Fallback di bawah kalau showPicker() ditolak browser
            }
        }

        el.focus();
        el.click();
    }
};


// ==========================================
// Initial Theme Restoration
// ==========================================

(function () {
    try {
        if (window.aumoTheme) {
            window.aumoTheme.restore();
        }
    } catch (error) {
        console.warn('Aumo Finance: Unable to restore theme.', error);
        document.documentElement.setAttribute('data-bs-theme', 'dark');
    }
})();
