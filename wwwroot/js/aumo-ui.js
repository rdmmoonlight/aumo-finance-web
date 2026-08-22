// ==========================================================
// Aumo Finance — Custom UI Interactions
// ==========================================================
//
// Menggantikan bootstrap.bundle.min.js sepenuhnya. Modul ini
// menangani perilaku modal, dropdown, toast, dan sync status.
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

    // Public API — dipanggil dari Blazor (JS interop / Inline Events)
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
        },
        // Integrasi Sync Status Handler
        triggerSync: function (isSuccess = true, queueTimeMs = 10000) {
            const syncBtn = document.getElementById('syncBtn');
            const syncIcon = document.getElementById('syncIcon');

            if (!syncBtn || !syncIcon) return;

            var ICONS = {
                spin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.933 13.041a8 8 0 1 1 -9.925 -8.788c3.899 -1 7.935 1.007 9.425 4.747" /><path d="M20 4v5h-5" /></svg>',
                check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15a4 4 0 0 1 -1.5 -7.708a5 5 0 0 1 9.207 -3.06a4.5 4.5 0 0 1 2.5 8.181" /><path d="M9.5 14.5l5 -5" /><path d="M9.5 9.5l5 5" /></svg>',
                error: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15a4 4 0 0 1 -1.5 -7.708a5 5 0 0 1 9.207 -3.06a4.5 4.5 0 0 1 2.5 8.181" /><path d="M12 10l0 4" /><path d="M12 17l.01 0" /></svg>'
            };

            syncBtn.style.color = '#d97706';
            syncBtn.title = "Syncing: In queue (10 seconds)...";
            syncIcon.innerHTML = ICONS.spin;
            syncIcon.classList.add('icon-spin');

            setTimeout(() => {
                syncIcon.classList.remove('icon-spin');

                if (isSuccess) {
                    syncBtn.style.color = 'var(--aumo-accent)';
                    syncBtn.title = "Sync: Saved to Database";
                    syncIcon.innerHTML = ICONS.check;
                } else {
                    syncBtn.style.color = 'var(--aumo-error)';
                    syncBtn.title = "Sync: Error saving data!";
                    syncIcon.innerHTML = ICONS.error;
                }
            }, queueTimeMs);
        }
    };

    // Backward compatibility alias (agar pemanggilan window.triggerSyncProcess lama tidak error)
    window.triggerSyncProcess = window.aumoUI.triggerSync;

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
