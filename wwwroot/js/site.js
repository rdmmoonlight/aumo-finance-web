// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// Write your JavaScript code.

// Helper kecil dipakai oleh komponen Blazor (Fase 1+) untuk menutup modal
// Bootstrap secara terprogram setelah submit form berhasil, tanpa reload
// halaman. Bootstrap sendiri tetap yang membuka modal via data-bs-toggle,
// jadi helper ini hanya perlu tahu cara menutup.
window.aumoModal = {
    hide: function (elementId) {
        var el = document.getElementById(elementId);
        if (!el) return;
        var instance = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
        instance.hide();
    },
    show: function (elementId) {
        var el = document.getElementById(elementId);
        if (!el) return;
        var instance = bootstrap.Modal.getOrCreateInstance(el);
        instance.show();
    }
};
