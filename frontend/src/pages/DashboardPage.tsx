import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import {
  IconEyeOff, IconCalendar, IconAlertTriangle, IconPlus, IconReport, IconActivity,
  IconWallet, IconTrendingUp, IconTrendingDown, IconShieldCheck, IconCreditCard, IconChartPie, IconX,
} from '@tabler/icons-react';

import apiClient from '@/services/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

ChartJS.register(ArcElement, Tooltip, Legend);


const formatNumber = (amount: number) => {
  const formatted = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount < 0? `(${formatted})` : formatted;
};

export interface AccountBalanceItem { accountId: number; referenceNumber: string; accountName: string; balance: number; }
export interface DashboardViewModel {
  hasPeriodSelected: boolean; selectedPeriodName?: string; isPeriodClosed: boolean;
  totalAssets: number; totalLiabilities: number; totalEquity: number; totalRevenue: number; totalExpenses: number; netIncome: number;
  cashAccounts: AccountBalanceItem[]; totalCashOnHand: number; bankAccounts: AccountBalanceItem[]; totalBankBalance: number;
  expenseAccountsList?: AccountBalanceItem[]; recentEntries: any[];
}

function DashboardContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [periodType, setPeriodType] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<DashboardViewModel | null>(null);

  const fetchDashboardData = useCallback(async (type: string) => {
    setLoading(true); setErrorMessage(null);
    try {
      const { data: resData } = await apiClient.get(`/api/v1/dashboard?period=${type}`);
      if (resData?.hasPeriodSelected === false) {
        setData({ hasPeriodSelected: false, isPeriodClosed: false, totalAssets: 0, totalLiabilities: 0, totalEquity: 0, totalRevenue: 0, totalExpenses: 0, netIncome: 0, cashAccounts: [], totalCashOnHand: 0, bankAccounts: [], totalBankBalance: 0, expenseAccountsList: [], recentEntries: [] });
        return;
      }
      setData({
        hasPeriodSelected: true, selectedPeriodName: resData?.selectedPeriodName || 'Current Period', isPeriodClosed:!!resData?.isPeriodClosed,
        totalAssets: Number(resData?.totalAssets)||0, totalLiabilities: Number(resData?.totalLiabilities)||0, totalEquity: Number(resData?.totalEquity)||0,
        totalRevenue: Number(resData?.totalRevenue)||0, totalExpenses: Number(resData?.totalExpenses)||0, netIncome: Number(resData?.netIncome)||0,
        cashAccounts: resData?.cashAccounts||[], totalCashOnHand: Number(resData?.totalCashOnHand)||0,
        bankAccounts: resData?.bankAccounts||[], totalBankBalance: Number(resData?.totalBankBalance)||0,
        expenseAccountsList: resData?.expenseAccountsList||[], recentEntries: resData?.recentEntries||[],
      });
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err.message || 'Failed to connect');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const periodParam = searchParams.get('period');
    const active = periodParam?.toLowerCase()==='annual'? 'annual':'monthly';
    setPeriodType(active); fetchDashboardData(active);
  }, [searchParams, fetchDashboardData]);

  const handlePeriodSwitch = (type: string) => {
    if (periodType===type) return; setPeriodType(type); navigate(`/dashboard?period=${type}`);
  };

  const healthScore = useMemo(() => {
    if (!data) return 0; if (data.totalRevenue===0 && data.totalExpenses===0) return 100;
    const margin = data.totalRevenue>0? (data.netIncome/data.totalRevenue)*100 : 0;
    if (margin>=20) return 90; if (margin>=10) return 75; if (margin>=0) return 60; return 40;
  }, [data]);

  if (loading &&!data) {
    return <div className="space-y-4"><Skeleton className="h-24"/><Skeleton className="h-64"/></div>;
  }

  if (!data ||!data.hasPeriodSelected) {
    return (
      <Card className="py-16 text-center border-dashed">
        <CardContent className="space-y-3">
          <IconEyeOff size={40} className="mx-auto text-muted-foreground"/>
          <h3 className="font-semibold">No Period Selected</h3>
          <p className="text-sm text-muted-foreground">Go to Periods to select active accounting period.</p>
          <Button asChild><Link to="/periods"><IconCalendar size={16}/> Go to Periods</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const doughnutData = {
    labels: ['Cash on Hand', 'Bank Balance'],
    datasets: [{ data: [data.totalCashOnHand, data.totalBankBalance], backgroundColor: ['#6366f1','#06b6d4'], borderWidth: 0 }],
  };
  const expenseData = {
    labels: data.expenseAccountsList?.length? data.expenseAccountsList.map(i=>i.accountName): ['No Expenses'],
    datasets: [{ data: data.expenseAccountsList?.length? data.expenseAccountsList.map(i=>i.balance): [1], backgroundColor: ['#ef4444','#f59e0b','#f97316','#8b5cf6','#6b7280','#10b981','#ec4899'], borderWidth: 0 }],
  };

  return (
    <div className="space-y-6">
      {errorMessage && <Alert variant="destructive" className="flex justify-between"><AlertDescription className="flex gap-2 items-center"><IconAlertTriangle size={16}/>{errorMessage}</AlertDescription><button onClick={()=>setErrorMessage(null)}><IconX size={14}/></button></Alert>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Financial Overview</h1><p className="text-sm text-muted-foreground">Active Period: <span className="font-semibold text-foreground">{data.selectedPeriodName}</span> • In IDR</p></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-1 bg-muted">
            <Button variant={periodType==='monthly'?'secondary':'ghost'} size="sm" className="h-7 text-xs" onClick={()=>handlePeriodSwitch('monthly')}>Monthly</Button>
            <Button variant={periodType==='annual'?'secondary':'ghost'} size="sm" className="h-7 text-xs" onClick={()=>handlePeriodSwitch('annual')}>Annual</Button>
          </div>
          <Button asChild size="sm" className="h-8 gap-1"><Link to="/journal-entry"><IconPlus size={14}/> New Entry</Link></Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1"><Link to="/reports/income-statement"><IconReport size={14}/> Report</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardDescription>Financial Health Index</CardDescription><IconActivity size={18} className="text-primary"/></CardHeader><CardContent className="flex items-center gap-4"><div className="w-16 h-16 rounded-full border-4 border-primary grid place-items-center font-bold text-lg">{healthScore}</div><div><p className={cn('text-sm font-semibold', healthScore>=80?'text-emerald-500': healthScore>=60?'text-sky-500':'text-amber-500')}>{healthScore>=80?'Excellent Condition': healthScore>=60?'Stable Operations':'Attention Required'}</p><p className="text-xs text-muted-foreground">Based on net profit margin & liquidity</p></div></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardDescription>Total Cash & Bank Reserves</CardDescription><IconWallet size={18} className="text-amber-500"/></CardHeader><CardContent><div className="text-2xl font-bold font-mono">{formatNumber(data.totalAssets)}</div><div className="text-xs text-muted-foreground flex gap-4 mt-1"><span>Cash: <b className="text-foreground">{formatNumber(data.totalCashOnHand)}</b></span><span>Bank: <b className="text-foreground">{formatNumber(data.totalBankBalance)}</b></span></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardHeader className="flex-row items-center justify-between space-y-0 pb-1"><CardDescription>Revenue</CardDescription><div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-500 grid place-items-center"><IconTrendingUp size={16}/></div></CardHeader><CardContent><div className="text-xl font-bold font-mono">{formatNumber(data.totalRevenue)}</div><p className="text-xs text-muted-foreground">Total Operating Revenue</p></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between space-y-0 pb-1"><CardDescription>Expenses</CardDescription><div className="w-7 h-7 rounded-full bg-red-500/10 text-red-500 grid place-items-center"><IconTrendingDown size={16}/></div></CardHeader><CardContent><div className="text-xl font-bold font-mono">{formatNumber(data.totalExpenses)}</div><p className="text-xs text-muted-foreground">Total Operating Expenses</p></CardContent></Card>
        <Card className="bg-primary text-primary-foreground"><CardHeader className="flex-row items-center justify-between space-y-0 pb-1"><CardDescription className="text-primary-foreground/70">Net Income</CardDescription><IconShieldCheck size={18}/></CardHeader><CardContent><div className="text-xl font-bold font-mono">{formatNumber(data.netIncome)}</div><p className="text-xs text-primary-foreground/70">Net Income for Period</p></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between space-y-0 pb-1"><CardDescription>Liabilities</CardDescription><div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-500 grid place-items-center"><IconCreditCard size={16}/></div></CardHeader><CardContent><div className="text-xl font-bold font-mono">{formatNumber(data.totalLiabilities)}</div><p className="text-xs text-muted-foreground">Total Liabilities</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-sm">Asset Composition</CardTitle><CardDescription>Cash vs Bank</CardDescription></div><IconChartPie size={18} className="text-muted-foreground"/></CardHeader><CardContent className="h-64 flex justify-center"><Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#888', boxWidth: 10 } } } }} /></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-sm">Expense Composition</CardTitle><CardDescription>Operating Breakdown</CardDescription></div><IconChartPie size={18} className="text-muted-foreground"/></CardHeader><CardContent className="h-64 flex justify-center"><Doughnut data={expenseData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#888', boxWidth: 10 } } } }} /></CardContent></Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <Suspense fallback={<Skeleton className="h-"/>}><DashboardContent/></Suspense>;
}