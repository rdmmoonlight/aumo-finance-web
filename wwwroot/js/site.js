// ==========================================
// Aumo Finance - Global Site JavaScript
// Cosmic / Nebula Theme
// ==========================================


// ==========================================
// Bootstrap Modal Helper
// ==========================================
//
// Helper ini digunakan oleh komponen Blazor
// untuk membuka dan menutup Bootstrap Modal
// secara terprogram tanpa reload halaman.
//

window.aumoModal = {

    /**
     * Show Bootstrap modal.
     *
     * @param {string} elementId
     */
    show: function (elementId) {
        const element = document.getElementById(elementId);

        if (!element) {
            console.warn(`[aumoModal] Element with ID '${elementId}' not found.`);
            return;
        }

        if (typeof bootstrap === 'undefined') {
            console.error('[aumoModal] Bootstrap JS library is not loaded.');
            return;
        }

        const instance = bootstrap.Modal.getOrCreateInstance(element);
        instance.show();
    },

    /**
     * Hide Bootstrap modal.
     *
     * @param {string} elementId
     */
    hide: function (elementId) {
        const element = document.getElementById(elementId);

        if (!element) {
            console.warn(`[aumoModal] Element with ID '${elementId}' not found.`);
            return;
        }

        if (typeof bootstrap === 'undefined') {
            console.error('[aumoModal] Bootstrap JS library is not loaded.');
            return;
        }

        const instance = bootstrap.Modal.getInstance(element) || bootstrap.Modal.getOrCreateInstance(element);
        if (instance) {
            instance.hide();
        }

        // Cleanup tambahan untuk memastikan backdrop gelap terhapus jika tersisa
        setTimeout(() => {
            const backdrops = document.querySelectorAll('.modal-backdrop');
            if (backdrops.length > 0 && !document.querySelector('.modal.show')) {
                backdrops.forEach(b => b.remove());
                document.body.classList.remove('modal-open');
                document.body.style.removeProperty('overflow');
                document.body.style.removeProperty('padding-right');
            }
        }, 150);
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
