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
import {
  IconEyeOff,
  IconCalendar,
  IconAlertTriangle,
  IconPlus,
  IconReport,
  IconActivity,
  IconWallet,
  IconTrendingUp,
  IconTrendingDown,
  IconShieldCheck,
  IconCreditCard,
  IconChartLine,
  IconChartPie,
  IconX,
} from '@tabler/icons-react';

// Import CSS Terpisah
import './dashboard.css';

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
        if (cmdModalEl) {
          cmdModalEl.style.display = 'block';
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fetch Dashboard data dari Backend API Web Controller dengan query parameter period
  const fetchDashboardData = useCallback(async (type: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/web/dashboard?period=${type}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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

  // Membaca URL searchParams dan mere-fetch data sesuai tipe periode aktif
  useEffect(() => {
    const periodParam = searchParams.get('period');
    const activePeriod = (periodParam && periodParam.toLowerCase() === 'annual') ? 'annual' : 'monthly';
    setPeriodType(activePeriod);
    fetchDashboardData(activePeriod);

    const handlePeriodChanged = () => {
      fetchDashboardData(activePeriod);
    };

    window.addEventListener('periodChanged', handlePeriodChanged);

    return () => {
      window.removeEventListener('periodChanged', handlePeriodChanged);
    };
  }, [searchParams, fetchDashboardData]);

  // Handler perpindahan tab (Monthly / Annual)
  const handlePeriodSwitch = (type: string) => {
    if (periodType === type) return;
    setPeriodType(type);
    router.push(`/dashboard?period=${type}`);
    fetchDashboardData(type);
  };

  const healthScore = useMemo(() => {
    if (!data) return 0;
    if (data.totalRevenue === 0 && data.totalExpenses === 0) return 100;

    const margin = data.totalRevenue > 0 ? (data.netIncome / data.totalRevenue) * 100 : 0;
    if (margin >= 20) return 90;
    if (margin >= 10) return 75;
    if (margin >= 0) return 60;
    return 40;
  }, [data]);

  if (loading) {
    return (
      <div className="loader-box">
        <div className="spinner"></div>
        <p className="loading-text">Loading dashboard data...</p>
      </div>
    );
  }

  if (!data || !data.hasPeriodSelected) {
    return (
      <div className="empty-state-box">
        <IconEyeOff size={48} className="empty-icon" />
        <h4 className="empty-title">No Period Selected</h4>
        <p className="empty-desc">
          The Dashboard follows whichever period you&apos;re viewing.
          <br />
          Go to <strong>Periods</strong> to view or select an active accounting period.
        </p>
        <Link href="/periods" className="btn-action primary">
          <IconCalendar size={18} /> Go to Periods
        </Link>
      </div>
    );
  }

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
    <div className="dashboard-container">
      {errorMessage && (
        <div className="alert-banner danger">
          <div className="alert-content">
            <IconAlertTriangle size={20} className="alert-icon" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" className="close-btn" onClick={() => setErrorMessage(null)}>
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* 1. HEADER CONTROLS SECTION */}
      <div className="header-section">
        <div>
          <h4 className="header-title">Financial Overview</h4>
          <p className="header-subtitle">
            Active Period: <span className="period-highlight">{data.selectedPeriodName}</span>
            <span> (In IDR, unless otherwise stated)</span>
          </p>
        </div>

        <div className="header-actions">
          <div className="pill-toggle">
            <button
              type="button"
              onClick={() => handlePeriodSwitch('monthly')}
              className={`pill-btn ${periodType === 'monthly' ? 'active' : ''}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => handlePeriodSwitch('annual')}
              className={`pill-btn ${periodType === 'annual' ? 'active' : ''}`}
            >
              Annual
            </button>
          </div>

          <Link href="/journal-entries/create" className="btn-action warning">
            <IconPlus size={18} /> New Entry
          </Link>
          <Link href="/reports/income-statement" className="btn-action outline">
            <IconReport size={18} /> Report
          </Link>
        </div>
      </div>

      {/* 2. METRICS & FINANCIAL HEALTH GRID */}
      <div className="grid-2-col mb-16">
        {/* Financial Health Index */}
        <div className="dash-card">
          <div className="card-header-flex">
            <span className="card-label">Financial Health Index</span>
            <IconActivity size={20} className="text-primary" />
          </div>
          <div className="health-body">
            <div className="score-circle">
              <span className="score-num">{healthScore}</span>
            </div>
            <div>
              <h6 className="health-status">
                {healthScore >= 80 ? (
                  <span className="text-success">Excellent Condition</span>
                ) : healthScore >= 60 ? (
                  <span className="text-info">Stable Operations</span>
                ) : (
                  <span className="text-warning">Attention Required</span>
                )}
              </h6>
              <p className="health-desc">Calculated based on net profit margin and liquidity position.</p>
            </div>
          </div>
        </div>

        {/* Cash & Bank Summary */}
        <div className="dash-card">
          <div className="card-header-flex">
            <span className="card-label">Total Cash &amp; Bank Reserves</span>
            <IconWallet size={20} className="text-warning" />
          </div>
          <div className="reserve-amount font-mono">{formatNumber(data.totalAssets)}</div>
          <div className="reserve-breakdown">
            <span>
              Cash: <strong className="font-mono">{formatNumber(data.totalCashOnHand)}</strong>
            </span>
            <span>
              Bank: <strong className="font-mono">{formatNumber(data.totalBankBalance)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 4 CARDS: REVENUE, EXPENSES, NET INCOME, LIABILITIES */}
      <div className="grid-4-col mb-16">
        <div className="dash-card">
          <div className="card-header-flex">
            <span className="card-label">Revenue</span>
            <div className="icon-badge success">
              <IconTrendingUp size={20} />
            </div>
          </div>
          <div className="card-val font-mono">{formatNumber(data.totalRevenue)}</div>
          <div className="card-sub">Total Operating Revenue</div>
        </div>

        <div className="dash-card">
          <div className="card-header-flex">
            <span className="card-label">Expenses</span>
            <div className="icon-badge danger">
              <IconTrendingDown size={20} />
            </div>
          </div>
          <div className="card-val font-mono">{formatNumber(data.totalExpenses)}</div>
          <div className="card-sub">Total Operating Expenses</div>
        </div>

        <div className="dash-card primary-gradient">
          <div className="card-header-flex">
            <span className="card-label light">Net Income</span>
            <IconShieldCheck size={20} className="text-warning" />
          </div>
          <div className="card-val light font-mono">{formatNumber(data.netIncome)}</div>
          <div className="card-sub light">Net Income for Period</div>
        </div>

        <div className="dash-card">
          <div className="card-header-flex">
            <span className="card-label">Liabilities</span>
            <div className="icon-badge warning">
              <IconCreditCard size={20} />
            </div>
          </div>
          <div className="card-val font-mono">{formatNumber(data.totalLiabilities)}</div>
          <div className="card-sub">Total Liabilities</div>
        </div>
      </div>

      {/* 3. CHARTS SECTION */}
      <div className="grid-chart-col mb-16">
        <div className="dash-card">
          <div className="card-header-flex mb-12">
            <div>
              <h6 className="card-title">Financial Trend</h6>
              <span className="card-sub">Revenue vs Operating Expenses</span>
            </div>
            <div className="icon-badge primary">
              <IconChartLine size={20} />
            </div>
          </div>
          <div className="chart-wrapper">
            <Line data={lineChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        <div className="dash-card">
          <div className="card-header-flex mb-12">
            <div>
              <h6 className="card-title">Asset Composition</h6>
              <span className="card-sub">Cash vs Bank Reserves</span>
            </div>
            <div className="icon-badge info">
              <IconChartPie size={20} />
            </div>
          </div>
          <div className="chart-wrapper">
            <Doughnut data={doughnutChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* 4. RECENT TABLES SECTION */}
      <div className="grid-2-col">
        {/* Cash Accounts Breakdown */}
        <div className="dash-card">
          <div className="card-header-flex mb-12">
            <h6 className="card-title">Cash &amp; Bank Accounts</h6>
            <Link href="/chart-of-accounts" className="link-more">
              View All
            </Link>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>REF</th>
                  <th>ACCOUNT NAME</th>
                  <th className="text-right">BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {[...data.cashAccounts, ...data.bankAccounts].length > 0 ? (
                  [...data.cashAccounts, ...data.bankAccounts].map((item, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-muted bold">{item.referenceNumber}</td>
                      <td className="bold">{item.accountName}</td>
                      <td className="text-right font-mono bold">{formatNumber(item.balance)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="empty-table-cell">
                      No cash or bank accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Equity Breakdown */}
        <div className="dash-card">
          <div className="card-header-flex mb-12">
            <h6 className="card-title">Equity &amp; Capital Position</h6>
            <Link href="/reports/statement-of-financial-position" className="link-more">
              Balance Sheet
            </Link>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>COMPONENT</th>
                  <th className="text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-muted">Total Liabilities</td>
                  <td className="text-right font-mono bold text-warning">{formatNumber(data.totalLiabilities)}</td>
                </tr>
                <tr>
                  <td className="text-muted">Total Equity</td>
                  <td className="text-right font-mono bold text-info">{formatNumber(data.totalEquity)}</td>
                </tr>
                <tr className="border-top-line">
                  <td className="bold">Net Income (Current Period)</td>
                  <td className="text-right font-mono bold text-success">{formatNumber(data.netIncome)}</td>
                </tr>
              </tbody>
            </table>
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
        <div className="loader-box">
          <div className="spinner"></div>
          <span className="loading-text">Loading dashboard...</span>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
