// ==========================================================
// Aumo Finance — Custom UI Interactions
// ==========================================================
//
// Menggantikan bootstrap.bundle.min.js sepenuhnya. Modul ini
// menangani perilaku modal, dropdown, dan toast yang sebelumnya
// disediakan oleh JavaScript Bootstrap, ditulis sendiri tanpa
// dependensi ke framework pihak ketiga.
//
// Atribut data-* (data-bs-toggle, data-bs-target, data-bs-dismiss)
// dipertahankan pada markup HTML hanya sebagai nama atribut biasa
// yang dibaca oleh skrip ini — bukan bagian dari library Bootstrap.
//

(function () {
    "use strict";

    function closeAllDropdowns(except) {
        document.querySelectorAll(".dropdown-menu.show").forEach(function (menu) {
            if (menu !== except) {
                menu.classList.remove("show");
            }
        });
    }

    function openModal(modalEl) {
        if (!modalEl) return;

        modalEl.classList.add("show");
        modalEl.style.display = "block";
        modalEl.setAttribute("aria-hidden", "false");

        var backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop fade show";
        backdrop.setAttribute("data-aumo-backdrop-for", modalEl.id || "");
        document.body.appendChild(backdrop);
        document.body.classList.add("modal-open");

        backdrop.addEventListener("click", function () {
            closeModal(modalEl);
        });
    }

    function closeModal(modalEl) {
        if (!modalEl) return;

        modalEl.classList.remove("show");
        modalEl.style.display = "none";
        modalEl.setAttribute("aria-hidden", "true");

        var selector = modalEl.id
            ? '.modal-backdrop[data-aumo-backdrop-for="' + modalEl.id + '"]'
            : ".modal-backdrop";
        document.querySelectorAll(selector).forEach(function (b) {
            b.remove();
        });

        if (!document.querySelector(".modal.show")) {
            document.body.classList.remove("modal-open");
        }
    }

    // Public API — dipakai dari Blazor (JS interop) menggantikan
    // pemanggilan bootstrap.Modal sebelumnya.
    window.aumoUI = {
        modal: {
            show: function (elementId) {
                openModal(document.getElementById(elementId));
            },
            hide: function (elementId) {
                closeModal(document.getElementById(elementId));
            }
        },
        toast: {
            show: function (elementId) {
                var el = document.getElementById(elementId);
                if (el) {
                    el.classList.add("show");
                }
            },
            hide: function (elementId) {
                var el = document.getElementById(elementId);
                if (el) {
                    el.classList.remove("show");
                }
            }
        }
    };

    document.addEventListener("click", function (event) {
        var toggleEl = event.target.closest("[data-bs-toggle]");

        if (toggleEl) {
            var toggleType = toggleEl.getAttribute("data-bs-toggle");

            if (toggleType === "modal") {
                var targetSelector = toggleEl.getAttribute("data-bs-target");
                if (targetSelector) {
                    openModal(document.querySelector(targetSelector));
                }
                event.preventDefault();
            }

            if (toggleType === "dropdown") {
                var menu = toggleEl.nextElementSibling;
                if (menu && menu.classList.contains("dropdown-menu")) {
                    var isOpen = menu.classList.contains("show");
                    closeAllDropdowns();
                    if (!isOpen) {
                        menu.classList.add("show");
                        toggleEl.setAttribute("aria-expanded", "true");
                    } else {
                        toggleEl.setAttribute("aria-expanded", "false");
                    }
                }
                event.preventDefault();
                event.stopPropagation();
            }
        } else {
            closeAllDropdowns();
        }

        var dismissEl = event.target.closest("[data-bs-dismiss]");
        if (dismissEl) {
            var dismissType = dismissEl.getAttribute("data-bs-dismiss");

            if (dismissType === "modal") {
                closeModal(dismissEl.closest(".modal"));
            }

            if (dismissType === "toast") {
                var toastEl = dismissEl.closest(".toast");
                if (toastEl) {
                    toastEl.classList.remove("show");
                }
            }
        }
    });

    // Tutup modal saat menekan tombol Escape.
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            var openModalEl = document.querySelector(".modal.show");
            if (openModalEl) {
                closeModal(openModalEl);
            }
            closeAllDropdowns();
        }
    });
})();
