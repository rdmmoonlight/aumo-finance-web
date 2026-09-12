'use client';

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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
  IconChartPie,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const formatNumber = (amount: number) => {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount < 0? `(${formatted})` : formatted;
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
  expenseAccountsList?: AccountBalanceItem[];
  recentEntries: any[];
}

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [periodType, setPeriodType] = useState<string>('monthly');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<DashboardViewModel | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('commandPaletteModal')?.style.setProperty('display', 'block');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchDashboardData = useCallback(async (type: string) => {
    setLoading(true); setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/dashboard?period=${type}`, {
        method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      });
      if (res.status === 401) { setErrorMessage('Session expired or unauthorized. Please login again.'); setData(null); return; }
      if (!res.ok) throw new Error('Failed to load Dashboard data.');
      const resData = await res.json();
      if (resData?.hasPeriodSelected === false) {
        setData({ hasPeriodSelected: false, isPeriodClosed: false, totalAssets: 0, totalLiabilities: 0, totalEquity: 0, totalRevenue: 0, totalExpenses: 0, netIncome: 0, cashAccounts: [], totalCashOnHand: 0, bankAccounts: [], totalBankBalance: 0, expenseAccountsList: [], recentEntries: [] });
        return;
      }
      setData({
        hasPeriodSelected: true,
        selectedPeriodName: resData?.selectedPeriodName || 'Current Period',
        isPeriodClosed: Boolean(resData?.isPeriodClosed),
        totalAssets: Number(resData?.totalAssets) || 0,
        totalLiabilities: Number(resData?.totalLiabilities) || 0,
        totalEquity: Number(resData?.totalEquity) || 0,
        totalRevenue: Number(resData?.totalRevenue) || 0,
        totalExpenses: Number(resData?.totalExpenses) || 0,
        netIncome: Number(resData?.netIncome) || 0,
        cashAccounts: Array.isArray(resData?.cashAccounts)? resData.cashAccounts : [],
        totalCashOnHand: Number(resData?.totalCashOnHand) || 0,
        bankAccounts: Array.isArray(resData?.bankAccounts)? resData.bankAccounts : [],
        totalBankBalance: Number(resData?.totalBankBalance) || 0,
        expenseAccountsList: Array.isArray(resData?.expenseAccountsList)? resData.expenseAccountsList : [],
        recentEntries: Array.isArray(resData?.recentEntries)? resData.recentEntries : [],
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to backend.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const periodParam = searchParams.get('period');
    const active = periodParam?.toLowerCase() === 'annual'? 'annual' : 'monthly';
    setPeriodType(active);
    fetchDashboardData(active);
    const onChanged = () => fetchDashboardData(active);
    window.addEventListener('periodChanged', onChanged);
    return () => window.removeEventListener('periodChanged', onChanged);
  }, [searchParams, fetchDashboardData]);

  const handlePeriodSwitch = (type: string) => {
    if (periodType === type) return;
    setPeriodType(type);
    router.push(`/dashboard?period=${type}`);
  };

  const healthScore = useMemo(() => {
    if (!data) return 0;
    if (data.totalRevenue === 0 && data.totalExpenses === 0) return 100;
    const margin = data.totalRevenue > 0? (data.netIncome / data.totalRevenue) * 100 : 0;
    if (margin >= 20) return 90;
    if (margin >= 10) return 75;
    if (margin >= 0) return 60;
    return 40;
  }, [data]);

  if (loading &&!data) {
    return (
      <div className="grid gap-4 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Skeleton className="h-" /><Skeleton className="h-" /></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">{[1,2,3,4].map(i=><Skeleton key={i} className="h-" />)}</div>
      </div>
    );
  }

  if (!data ||!data.hasPeriodSelected) {
    return (
      <div className="flex min-h- items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted"><IconEyeOff className="h-6 w-6" /></div>
            <h4 className="text-lg font-semibold">No Period Selected</h4>
            <p className="mx-auto mt-2 max-w- text-sm text-muted-foreground">The Dashboard follows whichever period you're viewing. Go to <strong>Periods</strong> to view or select an active accounting period.</p>
            <Button asChild className="mt-6"><Link href="/periods"><IconCalendar className="h-4 w-4" /> Go to Periods</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const doughnutChartData = {
    labels: ['Cash on Hand', 'Bank Balance'],
    datasets: [{ data: [data.totalCashOnHand, data.totalBankBalance], backgroundColor: ['#0d6efd', '#0dcaf0'], borderWidth: 0 }],
  };
  const expenseChartLabels = data.expenseAccountsList?.length? data.expenseAccountsList.map(i=>i.accountName) : ['No Expenses'];
  const expenseChartValues = data.expenseAccountsList?.length? data.expenseAccountsList.map(i=>i.balance) : [1];
  const expenseColors = ['#dc3545', '#ffc107', '#fd7e14', '#6610f2', '#6c757d', '#20c997', '#e83e8c'];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {errorMessage && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <div className="flex items-center gap-2"><IconAlertTriangle className="h-4 w-4" /><AlertDescription>{errorMessage}</AlertDescription></div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>setErrorMessage(null)}><IconX className="h-4 w-4" /></Button>
        </Alert>
      )}

      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h4 className="text-2xl font-bold tracking-tight">Financial Overview</h4>
          <p className="text-sm text-muted-foreground">Active Period: <Badge variant="secondary" className="ml-1 font-mono">{data.selectedPeriodName}</Badge> <span className="text-xs">(In IDR)</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={periodType} onValueChange={handlePeriodSwitch} className="h-9">
            <TabsList className="rounded-full"><TabsTrigger value="monthly" className="rounded-full">Monthly</TabsTrigger><TabsTrigger value="annual" className="rounded-full">Annual</TabsTrigger></TabsList>
          </Tabs>
          <Button asChild className="bg-amber-500 text-black hover:bg-amber-600"><Link href="/journal-entries/create"><IconPlus className="h-4 w-4" /> New Entry</Link></Button>
          <Button asChild variant="outline"><Link href="/reports/income-statement"><IconReport className="h-4 w-4" /> Report</Link></Button>
        </div>
      </div>

      {/* HEALTH + RESERVE */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription>Financial Health Index</CardDescription><IconActivity className="h-5 w-5 text-primary" /></CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/5 text-2xl font-bold">{healthScore}</div>
            <div>
              <h6 className="font-semibold">
                {healthScore >= 80? <span className="text-emerald-500">Excellent Condition</span> : healthScore >= 60? <span className="text-sky-500">Stable Operations</span> : <span className="text-amber-500">Attention Required</span>}
              </h6>
              <p className="text-xs text-muted-foreground">Calculated based on net profit margin and liquidity position.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription>Total Cash & Bank Reserves</CardDescription><IconWallet className="h-5 w-5 text-amber-500" /></CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold">{formatNumber(data.totalAssets)}</div>
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">Cash: <span className="font-mono font-semibold text-foreground">{formatNumber(data.totalCashOnHand)}</span> Bank: <span className="font-mono font-semibold text-foreground">{formatNumber(data.totalBankBalance)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* 4 METRICS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription>Revenue</CardDescription><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><IconTrendingUp className="h-4 w-4" /></span></CardHeader><CardContent><div className="font-mono text-xl font-bold">{formatNumber(data.totalRevenue)}</div><p className="text-xs text-muted-foreground">Total Operating Revenue</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription>Expenses</CardDescription><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500"><IconTrendingDown className="h-4 w-4" /></span></CardHeader><CardContent><div className="font-mono text-xl font-bold">{formatNumber(data.totalExpenses)}</div><p className="text-xs text-muted-foreground">Total Operating Expenses</p></CardContent></Card>
        <Card className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-0"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription className="text-violet-100">Net Income</CardDescription><IconShieldCheck className="h-5 w-5 text-amber-300" /></CardHeader><CardContent><div className="font-mono text-xl font-bold">{formatNumber(data.netIncome)}</div><p className="text-xs text-violet-100">Net Income for Period</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription>Liabilities</CardDescription><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500"><IconCreditCard className="h-4 w-4" /></span></CardHeader><CardContent><div className="font-mono text-xl font-bold">{formatNumber(data.totalLiabilities)}</div><p className="text-xs text-muted-foreground">Total Liabilities</p></CardContent></Card>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">Asset Composition</CardTitle><CardDescription>Cash vs Bank Reserves</CardDescription></div><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500"><IconChartPie className="h-4 w-4" /></span></CardHeader>
          <CardContent><div className="h-"><Doughnut data={doughnutChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} /></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">Expense Composition</CardTitle><CardDescription>Operating Expense Breakdown</CardDescription></div><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500"><IconChartPie className="h-4 w-4" /></span></CardHeader>
          <CardContent><div className="h-"><Doughnut data={{ labels: expenseChartLabels, datasets: [{ data: expenseChartValues, backgroundColor: expenseColors.slice(0, expenseChartValues.length), borderWidth: 0 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} /></div></CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex h- items-center justify-center gap-2 text-sm text-muted-foreground"><IconLoader2 className="h-5 w-5 animate-spin" /> Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}