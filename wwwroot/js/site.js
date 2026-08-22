// ==========================================
// Aumo Finance - Global Site JavaScript
// Cosmic / Matte Theme Interop
// ==========================================

// ==========================================
// 1. Aumo Modal Helper (Blazor Interop)
// ==========================================
window.aumoModal = {
    show: function (elementId) {
        if (typeof window.aumoUI === 'undefined') {
            console.error('[aumoModal] aumo-ui.js is not loaded.');
            return;
        }
        window.aumoUI.modal.show(elementId);
    },

    hide: function (elementId) {
        if (typeof window.aumoUI === 'undefined') {
            console.error('[aumoModal] aumo-ui.js is not loaded.');
            return;
        }
        window.aumoUI.modal.hide(elementId);
    }
};


// ==========================================
// 2. Aumo Finance Theme Controller
// ==========================================
window.aumoTheme = {
    get: function () {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        return currentTheme === 'light' ? 'light' : 'dark';
    },

    set: function (themeName) {
        const theme = themeName === 'light' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('aumo_theme', theme);
    },

    toggle: function () {
        const currentTheme = this.get();
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.set(nextTheme);
        return nextTheme;
    },

    restore: function () {
        const savedTheme = localStorage.getItem('aumo_theme');
        const theme = (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';
        document.documentElement.setAttribute('data-bs-theme', theme);
        return theme;
    }
};

// Global Alias agar kompatibel dengan inline onclick="setAppTheme('dark')" di TopBar/HTML
window.setAppTheme = function(themeName) {
    window.aumoTheme.set(themeName);
};


// ==========================================
// 3. Device Local Timestamp Helper
// ==========================================
window.aumoTime = {
    getLocalTimestamp: function () {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
};


// ==========================================
// 4. Date Picker Helper
// ==========================================
window.aumoDate = {
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
                // Fallback jika browser menolak showPicker()
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
