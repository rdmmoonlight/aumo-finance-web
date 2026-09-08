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

  useEffect(() => {
    fetchDashboardData();

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
      <div>
        <div></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  if (!data || !data.hasPeriodSelected) {
    return (
      <div>
        <IconEyeOff size={48} />
        <h4>No Period Selected</h4>
        <p>
          The Dashboard follows whichever period you&apos;re viewing.
          <br />
          Go to <strong>Periods</strong> to view or select an active accounting period.
        </p>
        <Link href="/periods">
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
    <div>
      {errorMessage && (
        <div>
          <div>
            <IconAlertTriangle size={20} />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)}>
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* 1. HEADER CONTROLS SECTION */}
      <div>
        <div>
          <h4>Financial Overview</h4>
          <p>
            Active Period: <span>{data.selectedPeriodName}</span>
            <span> (In IDR, unless otherwise stated)</span>
          </p>
        </div>

        <div>
          <div>
            <button
              type="button"
              onClick={() => handlePeriodSwitch('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => handlePeriodSwitch('annual')}
            >
              Annual
            </button>
          </div>

          <Link href="/journal-entries/create">
            <IconPlus size={18} /> New Entry
          </Link>
          <Link href="/reports/income-statement">
            <IconReport size={18} /> Report
          </Link>
        </div>
      </div>

      {/* 2. METRICS & FINANCIAL HEALTH GRID */}
      <div>
        {/* Financial Health Index */}
        <div>
          <div>
            <span>Financial Health Index</span>
            <IconActivity size={20} />
          </div>
          <div>
            <div>
              <span>{healthScore}</span>
            </div>
            <div>
              <h6>
                {healthScore >= 80 ? (
                  <span>Excellent Condition</span>
                ) : healthScore >= 60 ? (
                  <span>Stable Operations</span>
                ) : (
                  <span>Attention Required</span>
                )}
              </h6>
              <p>Calculated based on net profit margin and liquidity position.</p>
            </div>
          </div>
        </div>

        {/* Cash & Bank Summary */}
        <div>
          <div>
            <span>Total Cash &amp; Bank Reserves</span>
            <IconWallet size={20} />
          </div>
          <div>{formatNumber(data.totalAssets)}</div>
          <div>
            <span>
              Cash: <strong>{formatNumber(data.totalCashOnHand)}</strong>
            </span>
            <span>
              Bank: <strong>{formatNumber(data.totalBankBalance)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 4 CARDS: REVENUE, EXPENSES, NET INCOME, LIABILITIES */}
      <div>
        <div>
          <div>
            <span>Revenue</span>
            <div>
              <IconTrendingUp size={20} />
            </div>
          </div>
          <div>{formatNumber(data.totalRevenue)}</div>
          <div>Total Operating Revenue</div>
        </div>

        <div>
          <div>
            <span>Expenses</span>
            <div>
              <IconTrendingDown size={20} />
            </div>
          </div>
          <div>{formatNumber(data.totalExpenses)}</div>
          <div>Total Operating Expenses</div>
        </div>

        <div>
          <div>
            <span>Net Income</span>
            <IconShieldCheck size={20} />
          </div>
          <div>{formatNumber(data.netIncome)}</div>
          <div>Net Income for Period</div>
        </div>

        <div>
          <div>
            <span>Liabilities</span>
            <div>
              <IconCreditCard size={20} />
            </div>
          </div>
          <div>{formatNumber(data.totalLiabilities)}</div>
          <div>Total Liabilities</div>
        </div>
      </div>

      {/* 3. CHARTS SECTION */}
      <div>
        <div>
          <div>
            <div>
              <h6>Financial Trend</h6>
              <span>Revenue vs Operating Expenses</span>
            </div>
            <div>
              <IconChartLine size={20} />
            </div>
          </div>
          <div>
            <Line data={lineChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        <div>
          <div>
            <div>
              <h6>Asset Composition</h6>
              <span>Cash vs Bank Reserves</span>
            </div>
            <div>
              <IconChartPie size={20} />
            </div>
          </div>
          <div>
            <Doughnut data={doughnutChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* 4. RECENT TABLES SECTION */}
      <div>
        {/* Cash Accounts Breakdown */}
        <div>
          <div>
            <h6>Cash &amp; Bank Accounts</h6>
            <Link href="/chart-of-accounts">
              View All
            </Link>
          </div>
          <div>
            <table>
              <thead>
                <tr>
                  <th>REF</th>
                  <th>ACCOUNT NAME</th>
                  <th>BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {[...data.cashAccounts, ...data.bankAccounts].length > 0 ? (
                  [...data.cashAccounts, ...data.bankAccounts].map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.referenceNumber}</td>
                      <td>{item.accountName}</td>
                      <td>{formatNumber(item.balance)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>
                      No cash or bank accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Equity Breakdown */}
        <div>
          <div>
            <h6>Equity &amp; Capital Position</h6>
            <Link href="/reports/statement-of-financial-position">
              Balance Sheet
            </Link>
          </div>
          <div>
            <table>
              <thead>
                <tr>
                  <th>COMPONENT</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total Liabilities</td>
                  <td>{formatNumber(data.totalLiabilities)}</td>
                </tr>
                <tr>
                  <td>Total Equity</td>
                  <td>{formatNumber(data.totalEquity)}</td>
                </tr>
                <tr>
                  <td>Net Income (Current Period)</td>
                  <td>{formatNumber(data.netIncome)}</td>
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
        <div>
          <div></div>
          <span>Loading dashboard...</span>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
