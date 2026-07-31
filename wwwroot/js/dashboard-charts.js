/**
 * Dashboard Charts Module - AumoFinance
 * Menangani inisialisasi Line Chart (Trend) & Doughnut Chart (Expense)
 */

function initDashboardCharts(config) {
    const colorPalette = [
        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
        '#858796', '#5a5c69', '#6f42c1', '#fd7e14', '#20c997'
    ];

    // Helper Format Rupiah
    const formatIDR = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(value);
    };

    // 1. Inisialisasi Line Chart (Financial Trend)
    const trendCanvas = document.getElementById('trendChart');
    if (trendCanvas && config.trendData) {
        new Chart(trendCanvas, {
            type: 'line',
            data: {
                labels: config.trendData.labels || [],
                datasets: [
                    {
                        label: 'Revenue',
                        data: config.trendData.revenue || [],
                        borderColor: '#1cc88a',
                        backgroundColor: 'rgba(28, 200, 138, 0.05)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Operating Expenses',
                        data: config.trendData.expenses || [],
                        borderColor: '#e74a3b',
                        backgroundColor: 'rgba(231, 74, 59, 0.05)',
                        fill: true,
                        tension: 0.3
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
                        ticks: {
                            callback: (val) => formatIDR(val)
                        }
                    }
                }
            }
        });
    }

    // 2. Inisialisasi Doughnut Chart (Expense Composition)
    const doughnutCanvas = document.getElementById('expenseDoughnut');
    if (doughnutCanvas && config.expenseData) {
        new Chart(doughnutCanvas, {
            type: 'doughnut',
            data: {
                labels: config.expenseData.labels || [],
                datasets: [{
                    data: config.expenseData.values || [],
                    backgroundColor: colorPalette.slice(0, config.expenseData.labels.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 15 }
                    },
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
