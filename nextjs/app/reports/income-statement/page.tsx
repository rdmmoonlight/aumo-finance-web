'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  IconTrendingUp,
  IconAlertTriangle,
  IconEyeOff,
  IconCalendar,
  IconArrowRightCircle,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

export interface IncomeStatementLine { referenceNumber: number; accountName: string; amount: number; }
export interface IncomeStatementViewModel { asOfDate: string; revenues: IncomeStatementLine[]; operatingExpenses: IncomeStatementLine[]; otherIncome: IncomeStatementLine[]; otherExpenses: IncomeStatementLine[]; }

const formatNumber = (amount: number) => {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount < 0? `(${formatted})` : formatted;
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

export default function IncomeStatementReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<IncomeStatementViewModel>({ asOfDate: '', revenues: [], operatingExpenses: [], otherIncome: [], otherExpenses: [] });

  const fetchIncomeStatementData = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/reports/income-statement`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { setErrorMessage('Session expired or unauthorized. Please login again.'); setVm({ asOfDate: '', revenues: [], operatingExpenses: [], otherIncome: [], otherExpenses: [] }); return; }
      if (!res.ok) throw new Error('Failed to load Income Statement data.');
      const data = await res.json();
      if (data?.hasPeriodSelected === false) { setNoPeriodSelected(true); setVm({ asOfDate: '', revenues: [], operatingExpenses: [], otherIncome: [], otherExpenses: [] }); return; }
      const revenuesList = Array.isArray(data?.revenueAccounts)? data.revenueAccounts : Array.isArray(data?.revenues)? data.revenues : [];
      const operatingExpensesList = Array.isArray(data?.expenseAccounts)? data.expenseAccounts : Array.isArray(data?.operatingExpenses)? data.operatingExpenses : [];
      const otherIncomeList = Array.isArray(data?.otherIncomeAccounts)? data.otherIncomeAccounts : Array.isArray(data?.otherIncome)? data.otherIncome : [];
      const otherExpensesList = Array.isArray(data?.otherExpenseAccounts)? data.otherExpenseAccounts : Array.isArray(data?.otherExpenses)? data.otherExpenses : [];
      setNoPeriodSelected(false); setVm({ asOfDate: data?.asOfDate || '', revenues: revenuesList, operatingExpenses: operatingExpensesList, otherIncome: otherIncomeList, otherExpenses: otherExpensesList });
    } catch (err: any) { setErrorMessage(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchIncomeStatementData();
    const h = () => fetchIncomeStatementData();
    window.addEventListener('periodChanged', h);
    return () => window.removeEventListener('periodChanged', h);
  }, [fetchIncomeStatementData]);

  const totalRevenue = useMemo(() => vm.revenues.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.revenues]);
  const totalOperatingExpenses = useMemo(() => vm.operatingExpenses.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.operatingExpenses]);
  const operatingIncome = useMemo(() => totalRevenue - totalOperatingExpenses, [totalRevenue, totalOperatingExpenses]);
  const totalOtherIncome = useMemo(() => vm.otherIncome.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.otherIncome]);
  const totalOtherExpenses = useMemo(() => vm.otherExpenses.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.otherExpenses]);
  const netIncome = useMemo(() => operatingIncome + totalOtherIncome - totalOtherExpenses, [operatingIncome, totalOtherIncome, totalOtherExpenses]);

  if (loading) return <div className="mx-auto max-w-4xl p-6 flex justify-center gap-2 text-sm text-muted-foreground"><IconLoader2 className="h-4 w-4 animate-spin" /> Loading Income Statement...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      {errorMessage && (
        <Alert variant="destructive" className="flex items-center justify-between"><div className="flex items-center gap-2"><IconAlertTriangle className="h-4 w-4" /><AlertDescription>{errorMessage}</AlertDescription></div><Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>setErrorMessage(null)}><IconX className="h-4 w-4" /></Button></Alert>
      )}

      {noPeriodSelected? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted"><IconEyeOff className="h-6 w-6 text-muted-foreground" /></div>
          <h5 className="text-lg font-semibold">No Period Selected</h5>
          <p className="mb-4 text-sm text-muted-foreground">This report follows whichever period you're viewing.</p>
          <Button asChild><Link href="/periods"><IconCalendar className="h-4 w-4" /> Go to Periods</Link></Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><IconTrendingUp className="h-5 w-5" /></span> Income Statement</h2>
              <p className="max-w- text-sm text-muted-foreground">Statement of Profit or Loss (IAS 1) for the period ending {vm.asOfDate? new Date(vm.asOfDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'current period'} (In IDR, unless otherwise stated).</p>
            </div>
            <Button asChild variant="outline"><Link href="/reports/retained-earnings"><IconArrowRightCircle className="h-4 w-4" /> Retained Earnings</Link></Button>
          </div>

          <Card>
            <CardContent className="p-6">
              <Table>
                <TableBody>
                  <TableRow className="border-0"><TableCell colSpan={2} className="pb-2 pt-0 text- font-bold uppercase tracking-widest text-amber-500">Revenue</TableCell></TableRow>
                  {vm.revenues.length === 0? <TableRow className="border-0"><TableCell className="pl-4 text-sm italic text-muted-foreground">No revenue accounts recorded.</TableCell><TableCell className="text-right font-mono text-muted-foreground">-</TableCell></TableRow>
                  : vm.revenues.map((l, idx) => <TableRow key={`rev-${idx}`} className="border-0"><TableCell className="pl-4 py-1.5 text-sm"><code className="mr-2 rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">{l.referenceNumber}</code>{l.accountName}</TableCell><TableCell className="py-1.5 text-right font-mono text-sm">{formatNumber(l.amount)}</TableCell></TableRow>)}
                  <TableRow className="border-t font-semibold"><TableCell className="pl-4 pt-3">Total Revenue</TableCell><TableCell className="pt-3 text-right font-mono">{formatNumber(totalRevenue)}</TableCell></TableRow>

                  <TableRow className="border-0"><TableCell colSpan={2} className="pb-2 pt-6 text- font-bold uppercase tracking-widest text-amber-500">Operating Expenses</TableCell></TableRow>
                  {vm.operatingExpenses.length === 0? <TableRow className="border-0"><TableCell className="pl-4 text-sm italic text-muted-foreground">No operating expense accounts recorded.</TableCell><TableCell className="text-right font-mono text-muted-foreground">-</TableCell></TableRow>
                  : vm.operatingExpenses.map((l, idx) => <TableRow key={`opex-${idx}`} className="border-0"><TableCell className="pl-4 py-1.5 text-sm"><code className="mr-2 rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">{l.referenceNumber}</code>{l.accountName}</TableCell><TableCell className="py-1.5 text-right font-mono text-sm">({formatNumber(l.amount)})</TableCell></TableRow>)}
                  <TableRow className="border-t font-semibold"><TableCell className="pl-4 pt-3">Total Operating Expenses</TableCell><TableCell className="pt-3 text-right font-mono">({formatNumber(totalOperatingExpenses)})</TableCell></TableRow>

                  <TableRow className="border-y font-bold text-base"><TableCell className="py-4">Operating Income</TableCell><TableCell className={`py-4 text-right font-mono ${operatingIncome >= 0? 'text-emerald-500' : 'text-red-500'}`}>{formatNumber(operatingIncome)}</TableCell></TableRow>

                  {(vm.otherIncome.length > 0 || vm.otherExpenses.length > 0) && (
                    <>
                      <TableRow className="border-0"><TableCell colSpan={2} className="pb-2 pt-6 text- font-bold uppercase tracking-widest text-amber-500">Other Income & Expenses</TableCell></TableRow>
                      {vm.otherIncome.map((l, idx) => <TableRow key={`oth-inc-${idx}`} className="border-0"><TableCell className="pl-4 py-1.5 text-sm"><code className="mr-2 rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">{l.referenceNumber}</code>{l.accountName}</TableCell><TableCell className="py-1.5 text-right font-mono text-sm">{formatNumber(l.amount)}</TableCell></TableRow>)}
                      {vm.otherExpenses.map((l, idx) => <TableRow key={`oth-exp-${idx}`} className="border-0"><TableCell className="pl-4 py-1.5 text-sm"><code className="mr-2 rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">{l.referenceNumber}</code>{l.accountName}</TableCell><TableCell className="py-1.5 text-right font-mono text-sm">({formatNumber(l.amount)})</TableCell></TableRow>)}
                    </>
                  )}

                  <TableRow className="border-t- font-bold text-lg"><TableCell className="pt-4">Net Income</TableCell><TableCell className={`pt-4 text-right font-mono ${netIncome >= 0? 'text-emerald-500' : 'text-red-500'}`}>{formatNumber(netIncome)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}