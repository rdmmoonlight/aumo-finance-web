/**
 * Dashboard Module - AumoFinance
 * Menangani Command Palette Keyboard Shortcut & Inisialisasi Chart.js (Line + Doughnut).
 *
 * initCommandPalette(): dipanggil SEKALI saat komponen Dashboard pertama kali
 * dirender (attach keydown listener sekali saja, tidak boleh dobel).
 *
 * renderDashboardCharts(config): boleh dipanggil BERULANG KALI (mis. saat
 * toggle Monthly/Annual tanpa reload halaman). Instance Chart.js lama selalu
 * dihancurkan dulu sebelum membuat yang baru, supaya canvas tidak konflik.
 */

window.aumoCharts = window.aumoCharts || { trend: null, doughnut: null };

function initCommandPalette() {
    const cmdModalEl = document.getElementById('commandPaletteModal');
    if (cmdModalEl && typeof bootstrap !== 'undefined' && !cmdModalEl.dataset.aumoBound) {
        cmdModalEl.dataset.aumoBound = 'true';
        const cmdModal = new bootstrap.Modal(cmdModalEl);
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                cmdModal.show();
            }
        });
    }
}

function renderDashboardCharts(config) {
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const textColor = isDark ? '#adb5bd' : '#6c757d';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

    if (typeof Chart !== 'undefined') {
        Chart.defaults.color = textColor;
        Chart.defaults.borderColor = gridColor;
    }

    const formatIDR = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(value);
    };

    // 1. Line Chart (Financial Trend)
    if (window.aumoCharts.trend) {
        window.aumoCharts.trend.destroy();
        window.aumoCharts.trend = null;
    }
    const trendCanvas = document.getElementById('trendChart');
    if (trendCanvas && config.trendData) {
        window.aumoCharts.trend = new Chart(trendCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: config.trendData.labels || [],
                datasets: [
                    {
                        label: 'Revenue',
                        data: config.trendData.revenue || [],
                        borderColor: '#0d6efd',
                        backgroundColor: 'rgba(13,110,253,0.12)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Expenses',
                        data: config.trendData.expenses || [],
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220,53,69,0.08)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatIDR(ctx.parsed.y)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (v) => formatIDR(v)
                        }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 2. Doughnut Chart (Expense Composition)
    if (window.aumoCharts.doughnut) {
        window.aumoCharts.doughnut.destroy();
        window.aumoCharts.doughnut = null;
    }
    const doughnutCanvas = document.getElementById('expenseDoughnut');
    if (doughnutCanvas && config.expenseData) {
        window.aumoCharts.doughnut = new Chart(doughnutCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: config.expenseData.labels || [],
                datasets: [{
                    data: config.expenseData.values || [],
                    backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#0dcaf0', '#fd7e14'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${formatIDR(ctx.parsed)}`
                        }
                    }
                }
            }
        });
    }
}

// Kompatibilitas mundur: nama lama initDashboard() dipertahankan untuk
// dipanggil dari halaman MVC lama mana pun yang mungkin masih memakainya.
function initDashboard(config) {
    initCommandPalette();
    renderDashboardCharts(config);
}
