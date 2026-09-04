'use client';

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

// Registrasi modul Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Format angka standar tanpa simbol mata uang
const formatNumber = (amount: number) => {
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

  return amount < 0 ? `(${formatted})` : formatted;
};

export interface AccountBalanceItem {
  accountId: number;
  referenceNumber: string;
  accountName: string;
  balance: number;
}

export interface DashboardViewModel {
  hasPeriodSelected: boolean;
  selectedPeriodName?: string;
  isPeriodClosed: boolean;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  cashAccounts: AccountBalanceItem[];
  totalCashOnHand: number;
  bankAccounts: AccountBalanceItem[];
  totalBankBalance: number;
  recentEntries: any[];
}

// Sanitasi URL API
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [periodType, setPeriodType] = useState<string>('monthly');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<DashboardViewModel | null>(null);

  // Inisialisasi Command Palette Shortcut (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const cmdModalEl = document.getElementById('commandPaletteModal');
        if (cmdModalEl && typeof window !== 'undefined' && (window as any).bootstrap) {
          const modalInstance = new (window as any).bootstrap.Modal(cmdModalEl);
          modalInstance.show();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const periodParam = searchParams.get('period');
    if (periodParam && periodParam.toLowerCase() === 'annual') {
      setPeriodType('annual');
    }
  }, [searchParams]);

  // Fetch Dashboard data dari Backend API Web Controller
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/web/dashboard`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Untuk Identity Cookie Session
      });

      if (response.status === 401) {
        setErrorMessage('Session expired or unauthorized. Please login again.');
        setData(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load Dashboard data from the server.');
      }

      const resData = await response.json();

      if (resData?.hasPeriodSelected === false) {
        setData({
          hasPeriodSelected: false,
          isPeriodClosed: false,
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
          totalRevenue: 0,
          totalExpenses: 0,
          netIncome: 0,
          cashAccounts: [],
          totalCashOnHand: 0,
          bankAccounts: [],
          totalBankBalance: 0,
          recentEntries: [],
        });
        return;
      }

      // Safe extraction DTO dari DashboardWebController
      const safeData: DashboardViewModel = {
        hasPeriodSelected: true,
        selectedPeriodName: resData?.selectedPeriodName || 'Current Period',
        isPeriodClosed: Boolean(resData?.isPeriodClosed),
        totalAssets: Number(resData?.totalAssets) || 0,
        totalLiabilities: Number(resData?.totalLiabilities) || 0,
        totalEquity: Number(resData?.totalEquity) || 0,
        totalRevenue: Number(resData?.totalRevenue) || 0,
        totalExpenses: Number(resData?.totalExpenses) || 0,
        netIncome: Number(resData?.netIncome) || 0,
        cashAccounts: Array.isArray(resData?.cashAccounts) ? resData.cashAccounts : [],
        totalCashOnHand: Number(resData?.totalCashOnHand) || 0,
        bankAccounts: Array.isArray(resData?.bankAccounts) ? resData.bankAccounts : [],
        totalBankBalance: Number(resData?.totalBankBalance) || 0,
        recentEntries: Array.isArray(resData?.recentEntries) ? resData.recentEntries : [],
      };

      setData(safeData);
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      setErrorMessage(error.message || 'Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Listener otomatis saat periode diganti lewat navbar/topbar
    const handlePeriodChanged = () => {
      fetchDashboardData();
    };

    window.addEventListener('periodChanged', handlePeriodChanged);

    return () => {
      window.removeEventListener('periodChanged', handlePeriodChanged);
    };
  }, [fetchDashboardData]);

  const handlePeriodSwitch = (type: string) => {
    if (periodType === type) return;
    setPeriodType(type);
    router.push(`/dashboard?period=${type}`);
  };

  // Kalkulasi Skor Kesehatan Keuangan (Financial Health Score)
  const healthScore = useMemo(() => {
    if (!data) return 0;
    if (data.totalRevenue === 0 && data.totalExpenses === 0) return 100;
    
    // Profit margin ratio calculation
    const margin = data.totalRevenue > 0 ? (data.netIncome / data.totalRevenue) * 100 : 0;
    if (margin >= 20) return 90;
    if (margin >= 10) return 75;
    if (margin >= 0) return 60;
    return 40;
  }, [data]);

  if (loading) {
    return (
      <div className="text-center py-5 my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="text-white-50 mt-3">Loading dashboard data...</p>
      </div>
    );
  }

  if (!data || !data.hasPeriodSelected) {
    return (
      <div className="text-center py-5 my-5">
        <i className="ti ti-eye-off text-secondary mb-3 d-block mx-auto" style={{ fontSize: '3rem' }}></i>
        <h4 className="fw-bold text-white mb-2">No Period Selected</h4>
        <p className="text-white-50 mb-4">
          The Dashboard follows whichever period you&apos;re viewing.
          <br />
          Go to <strong>Periods</strong> to view or select an active accounting period.
        </p>
        <Link href="/periods" className="btn btn-primary fw-semibold shadow-sm px-4">
          <i className="ti ti-calendar me-1"></i> Go to Periods
        </Link>
      </div>
    );
  }

  // Visualisasi Line Chart (Trend Pendapatan vs Beban)
  const lineChartData = {
    labels: ['Overview'],
    datasets: [
      {
        label: 'Revenue',
        data: [data.totalRevenue],
        borderColor: '#198754',
        backgroundColor: 'rgba(25, 135, 84, 0.15)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Expenses',
        data: [data.totalExpenses],
        borderColor: '#dc3545',
        backgroundColor: 'rgba(220, 53, 69, 0.15)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Visualisasi Doughnut Chart (Aset: Cash vs Bank)
  const doughnutChartData = {
    labels: ['Cash on Hand', 'Bank Balance'],
    datasets: [
      {
        data: [data.totalCashOnHand, data.totalBankBalance],
        backgroundColor: ['#0d6efd', '#0dcaf0'],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="container-fluid px-0 text-white">
      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm py-2 mb-4 d-flex align-items-center justify-content-between" role="alert">
          <div className="d-flex align-items-center">
            <i className="ti ti-alert-triangle-filled me-2 fs-5 flex-shrink-0"></i>
            <span>{errorMessage}</span>
          </div>
          <button type="button" className="btn-close ms-auto" onClick={() => setErrorMessage(null)}></button>
        </div>
      )}

      {/* 1. HEADER CONTROLS SECTION */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h4 className="fw-bold mb-0 text-white">Financial Overview</h4>
          </div>
          <p className="text-white-50 small mb-0">
            Active Period: <span className="fw-semibold text-white">{data.selectedPeriodName}</span>
            <span className="ms-1"> (In IDR, unless otherwise stated)</span>
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <div
            className="btn-group btn-group-sm p-1 bg-dark border border-secondary border-opacity-25 rounded-pill shadow-sm"
            role="group"
          >
            <button
              type="button"
              onClick={() => handlePeriodSwitch('monthly')}
              className={`btn btn-sm rounded-pill px-3 fw-semibold transition-all ${
                periodType === 'monthly' ? 'btn-primary shadow-sm' : 'btn-link text-white text-decoration-none opacity-75'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => handlePeriodSwitch('annual')}
              className={`btn btn-sm rounded-pill px-3 fw-semibold transition-all ${
                periodType === 'annual' ? 'btn-primary shadow-sm' : 'btn-link text-white text-decoration-none opacity-75'
              }`}
            >
              Annual
            </button>
          </div>

          <Link
            href="/journal-entries/create"
            className="btn btn-warning btn-sm fw-semibold shadow-sm d-flex align-items-center gap-2 px-3 rounded-3"
          >
            <i className="ti ti-plus"></i> New Entry
          </Link>
          <Link
            href="/reports/income-statement"
            className="btn btn-outline-light btn-sm d-flex align-items-center gap-2 px-3 rounded-3"
          >
            <i className="ti ti-report"></i> Report
          </Link>
        </div>
      </div>

      {/* 2. METRICS & FINANCIAL HEALTH GRID */}
      <div className="row g-3 mb-4">
        {/* Financial Health Index */}
        <div className="col-12 col-md-6">
          <div className="card bg-dark border-secondary text-white shadow-sm border border-opacity-25 rounded-4 h-100 p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-white-50 small fw-semibold text-uppercase tracking-wider">
                Financial Health Index
              </span>
              <i className="ti ti-activity text-primary fs-5"></i>
            </div>
            <div className="d-flex align-items-center gap-3">
              <div className="position-relative d-inline-flex align-items-center justify-content-center">
                <div
                  className="rounded-circle border border-3 border-primary d-flex align-items-center justify-content-center"
                  style={{ width: '60px', height: '60px' }}
                >
                  <span className="fw-bold fs-4 text-white">{healthScore}</span>
                </div>
              </div>
              <div>
                <h6 className="fw-bold mb-1">
                  {healthScore >= 80 ? (
                    <span className="text-success">Excellent Condition</span>
                  ) : healthScore >= 60 ? (
                    <span className="text-info">Stable Operations</span>
                  ) : (
                    <span className="text-warning">Attention Required</span>
                  )}
                </h6>
                <p className="text-white-50 fs-8 mb-0">Calculated based on net profit margin and liquidity position.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cash & Bank Summary */}
        <div className="col-12 col-md-6">
          <div className="card bg-dark border-secondary text-white shadow-sm border border-opacity-25 rounded-4 h-100 p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-white-50 small fw-semibold text-uppercase tracking-wider">
                Total Cash &amp; Bank Reserves
              </span>
              <i className="ti ti-wallet text-warning fs-5"></i>
            </div>
            <div className="d-flex justify-content-between align-items-baseline mb-2">
              <h4 className="fw-bold mb-0 text-white font-monospace">
                {formatNumber(data.totalAssets)}
              </h4>
            </div>
            <div className="d-flex gap-3 small text-white-50">
              <span>Cash: <strong className="text-white font-monospace">{formatNumber(data.totalCashOnHand)}</strong></span>
              <span>Bank: <strong className="text-white font-monospace">{formatNumber(data.totalBankBalance)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 CARDS: REVENUE, EXPENSES, NET INCOME, LIABILITIES */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card bg-dark border-secondary text-white shadow-sm h-100 rounded-4 p-3 border border-opacity-25">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-white-50 small fw-semibold text-uppercase tracking-wider">Revenue</span>
              <div className="bg-success bg-opacity-10 text-success rounded-3 p-2">
                <i className="ti ti-trending-up fs-5"></i>
              </div>
            </div>
            <h4 className="fw-bold text-white mb-1 font-monospace">{formatNumber(data.totalRevenue)}</h4>
            <div className="small text-white-50 fs-8">Total Operating Revenue</div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card bg-dark border-secondary text-white shadow-sm h-100 rounded-4 p-3 border border-opacity-25">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-white-50 small fw-semibold text-uppercase tracking-wider">Expenses</span>
              <div className="bg-danger bg-opacity-10 text-danger rounded-3 p-2">
                <i className="ti ti-trending-down fs-5"></i>
              </div>
            </div>
            <h4 className="fw-bold text-white mb-1 font-monospace">{formatNumber(data.totalExpenses)}</h4>
            <div className="small text-white-50 fs-8">Total Operating Expenses</div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card bg-primary bg-gradient text-white shadow-sm h-100 rounded-4 p-3 border-0">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold text-white-50 text-uppercase tracking-wider">Net Income</span>
              <i className="ti ti-shield-check text-warning fs-5"></i>
            </div>
            <h4 className="fw-bold mb-1 text-white font-monospace">{formatNumber(data.netIncome)}</h4>
            <div className="small text-white-50 fs-8">Net Income for Period</div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card bg-dark border-secondary text-white shadow-sm h-100 rounded-4 p-3 border border-opacity-25">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-white-50 small fw-semibold text-uppercase tracking-wider">Liabilities</span>
              <div className="bg-warning bg-opacity-10 text-warning rounded-3 p-2">
                <i className="ti ti-credit-card fs-5"></i>
              </div>
            </div>
            <h4 className="fw-bold text-white mb-1 font-monospace">{formatNumber(data.totalLiabilities)}</h4>
            <div className="small text-white-50 fs-8">Total Liabilities</div>
          </div>
        </div>
      </div>

      {/* 3. CHARTS SECTION */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-8">
          <div className="card bg-dark border-secondary text-white shadow-sm rounded-4 h-100 p-3 border border-opacity-25">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h6 className="fw-bold mb-0 text-white">Financial Trend</h6>
                <span className="text-white-50 fs-8">Revenue vs Operating Expenses</span>
              </div>
              <div className="bg-primary bg-opacity-10 text-primary rounded-3 p-2">
                <i className="ti ti-chart-line fs-5"></i>
              </div>
            </div>
            <div className="chart-container" style={{ position: 'relative', height: '280px' }}>
              <Line data={lineChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="card bg-dark border-secondary text-white shadow-sm rounded-4 h-100 p-3 border border-opacity-25">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h6 className="fw-bold mb-0 text-white">Asset Composition</h6>
                <span className="text-white-50 fs-8">Cash vs Bank Reserves</span>
              </div>
              <div className="bg-info bg-opacity-10 text-info rounded-3 p-2">
                <i className="ti ti-chart-pie fs-5"></i>
              </div>
            </div>

            <div className="chart-container" style={{ position: 'relative', height: '280px' }}>
              <Doughnut data={doughnutChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. RECENT TABLES SECTION */}
      <div className="row g-3">
        {/* Cash Accounts Breakdown */}
        <div className="col-12 col-xl-6">
          <div className="card bg-dark border-secondary text-white shadow-sm rounded-4 h-100 p-3 border border-opacity-25">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="fw-bold mb-0 text-white">Cash &amp; Bank Accounts</h6>
              <Link href="/chart-of-accounts" className="btn btn-link btn-sm text-decoration-none p-0 fs-8 fw-semibold text-info">
                View All
              </Link>
            </div>
            <div className="table-responsive">
              <table className="table table-dark table-hover table-borderless align-middle mb-0 text-white">
                <thead className="text-white-50 fs-8 border-bottom border-secondary">
                  <tr>
                    <th>REF</th>
                    <th>ACCOUNT NAME</th>
                    <th className="text-end">BALANCE</th>
                  </tr>
                </thead>
                <tbody className="small">
                  {[...data.cashAccounts, ...data.bankAccounts].length > 0 ? (
                    [...data.cashAccounts, ...data.bankAccounts].map((item, idx) => (
                      <tr key={idx}>
                        <td className="fw-bold text-white-50 font-monospace">{item.referenceNumber}</td>
                        <td className="fw-semibold text-white">{item.accountName}</td>
                        <td className="text-end fw-bold text-white font-monospace">{formatNumber(item.balance)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-center text-white-50 py-3">
                        No cash or bank accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Equity Breakdown */}
        <div className="col-12 col-xl-6">
          <div className="card bg-dark border-secondary text-white shadow-sm rounded-4 h-100 p-3 border border-opacity-25">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="fw-bold mb-0 text-white">Equity &amp; Capital Position</h6>
              <Link href="/reports/statement-of-financial-position" className="btn btn-link btn-sm text-decoration-none p-0 fs-8 fw-semibold text-info">
                Balance Sheet
              </Link>
            </div>
            <div className="table-responsive">
              <table className="table table-dark table-hover table-borderless align-middle mb-0 text-white">
                <thead className="text-white-50 fs-8 border-bottom border-secondary">
                  <tr>
                    <th>COMPONENT</th>
                    <th className="text-end">AMOUNT</th>
                  </tr>
                </thead>
                <tbody className="small">
                  <tr>
                    <td className="text-white-50">Total Liabilities</td>
                    <td className="text-end fw-bold text-warning font-monospace">{formatNumber(data.totalLiabilities)}</td>
                  </tr>
                  <tr>
                    <td className="text-white-50">Total Equity</td>
                    <td className="text-end fw-bold text-info font-monospace">{formatNumber(data.totalEquity)}</td>
                  </tr>
                  <tr className="border-top border-secondary">
                    <td className="fw-bold text-white">Net Income (Current Period)</td>
                    <td className="text-end fw-bold text-success font-monospace">{formatNumber(data.netIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-5 my-5 text-white-50">
          <div className="spinner-border text-primary me-2" role="status"></div>
          <span>Loading dashboard...</span>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}