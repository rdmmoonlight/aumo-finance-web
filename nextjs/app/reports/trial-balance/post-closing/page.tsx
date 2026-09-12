'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  IconShieldCheck,
  IconAlertTriangle,
  IconEyeOff,
  IconCalendar,
  IconListCheck,
  IconCash,
  IconCircleCheck,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

export interface FinancialPositionLine { referenceNumber: number; accountName: string; amount: number; }
export interface PostClosingTrialBalanceViewModel { asOfDate: string; assets: FinancialPositionLine[]; liabilities: FinancialPositionLine[]; equityExcludingRetainedEarnings: FinancialPositionLine[]; retainedEarningsEnding: number; }

const formatNumber = (amount: number) => {
  const f = new Intl.NumberFormat('id-ID', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount < 0? `(${f})` : f;
};
const formatDateDisplay = (dateString?: string) => {
  if (!dateString) return '';
  const d = new Date(dateString); if (isNaN(d.getTime())) return dateString;
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

export default function PostClosingTrialBalanceReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<PostClosingTrialBalanceViewModel>({ asOfDate: '', assets: [], liabilities: [], equityExcludingRetainedEarnings: [], retainedEarningsEnding: 0 });

  const fetchReportData = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/reports/statement-of-financial-position?isPostClosing=true`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { setErrorMessage('Session expired or unauthorized. Please login again.'); return; }
      if (!res.ok) throw new Error('Failed to load Post-Closing Trial Balance data.');
      const data = await res.json();
      if (data?.hasPeriodSelected === false) { setNoPeriodSelected(true); return; }
      const assetsList = Array.isArray(data?.assetAccounts)? data.assetAccounts : Array.isArray(data?.assets)? data.assets : [];
      const liabilitiesList = Array.isArray(data?.liabilityAccounts)? data.liabilityAccounts : Array.isArray(data?.liabilities)? data.liabilities : [];
      const rawEquityList = Array.isArray(data?.equityAccounts)? data.equityAccounts : Array.isArray(data?.equityExcludingRetainedEarnings)? data.equityExcludingRetainedEarnings : [];
      const equityExcludingRE = rawEquityList.filter((e: any) => e.accountName!== 'Retained Earnings' && e.referenceNumber!== 0);
      const reItem = rawEquityList.find((e: any) => e.accountName === 'Retained Earnings' || e.referenceNumber === 0);
      const reEndingValue = reItem? Number(reItem.amount) || 0 : Number(data?.retainedEarningsEnding) || 0;
      setNoPeriodSelected(false);
      setVm({ asOfDate: data?.asOfDate || '', assets: assetsList, liabilities: liabilitiesList, equityExcludingRetainedEarnings: equityExcludingRE, retainedEarningsEnding: reEndingValue });
    } catch (err: any) { setErrorMessage(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchReportData();
    const h = () => fetchReportData();
    window.addEventListener('periodChanged', h);
    return () => window.removeEventListener('periodChanged', h);
  }, [fetchReportData]);

  const totalAssets = useMemo(() => vm.assets.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.assets]);
  const totalLiabilitiesAndEquity = useMemo(() => {
    const totalLiab = vm.liabilities.reduce((s,i)=>s+(Number(i.amount)||0),0);
    const totalEquity = vm.equityExcludingRetainedEarnings.reduce((s,i)=>s+(Number(i.amount)||0),0);
    return totalLiab + totalEquity + vm.retainedEarningsEnding;
  }, [vm.liabilities, vm.equityExcludingRetainedEarnings, vm.retainedEarningsEnding]);
  const isBalanced = useMemo(() => Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01, [totalAssets, totalLiabilitiesAndEquity]);

  if (loading) return <div className="mx-auto max-w-6xl p-6 flex justify-center gap-2 text-sm text-muted-foreground"><IconLoader2 className="h-4 w-4 animate-spin" /> Loading Post-Closing Trial Balance...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      {errorMessage && <Alert variant="destructive" className="flex items-center justify-between"><div className="flex items-center gap-2"><IconAlertTriangle className="h-4 w-4" /><AlertDescription>{errorMessage}</AlertDescription></div><Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>setErrorMessage(null)}><IconX className="h-4 w-4" /></Button></Alert>}

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
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500"><IconShieldCheck className="h-5 w-5" /></span> Post-Closing Trial Balance</h2>
              <p className="max-w- text-sm text-muted-foreground">Displays permanent accounts (Assets, Liabilities, Equity) after closing entries as of <strong>{formatDateDisplay(vm.asOfDate) || 'current period'}</strong> (In IDR) — all nominal accounts have zero balances.</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline"><Link href="/reports/trial-balance/adjusted"><IconListCheck className="h-4 w-4" /> Adjusted TB</Link></Button>
              <Button asChild variant="outline"><Link href="/reports/cash-flow"><IconCash className="h-4 w-4" /> Cash Flow</Link></Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead className="w-[10%] pl-6 text-center">Ref.</TableHead><TableHead className="w-[45%]">Account Name</TableHead><TableHead className="w-[15%]">Type</TableHead><TableHead className="w-[15%] text-right">Debit</TableHead><TableHead className="w-[15%] pr-6 text-right">Credit</TableHead></TableRow></TableHeader>
                <TableBody>
                  {vm.assets.map((a, idx) => <TableRow key={`asset-${idx}`}><TableCell className="pl-6 text-center"><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold text-amber-500">{a.referenceNumber}</code></TableCell><TableCell className="font-semibold">{a.accountName}</TableCell><TableCell><Badge variant="secondary" className="text-">Assets</Badge></TableCell><TableCell className="text-right font-mono text-emerald-500">{formatNumber(a.amount)}</TableCell><TableCell className="pr-6 text-right font-mono">-</TableCell></TableRow>)}
                  {vm.liabilities.map((l, idx) => <TableRow key={`liab-${idx}`}><TableCell className="pl-6 text-center"><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold text-amber-500">{l.referenceNumber}</code></TableCell><TableCell className="font-semibold">{l.accountName}</TableCell><TableCell><Badge variant="secondary" className="text-">Liabilities</Badge></TableCell><TableCell className="text-right font-mono">-</TableCell><TableCell className="pr-6 text-right font-mono text-red-500">{formatNumber(l.amount)}</TableCell></TableRow>)}
                  {vm.equityExcludingRetainedEarnings.map((e, idx) => <TableRow key={`eq-${idx}`}><TableCell className="pl-6 text-center"><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold text-amber-500">{e.referenceNumber}</code></TableCell><TableCell className="font-semibold">{e.accountName}</TableCell><TableCell><Badge variant="secondary" className="text-">Equity</Badge></TableCell><TableCell className="text-right font-mono">-</TableCell><TableCell className="pr-6 text-right font-mono text-red-500">{formatNumber(e.amount)}</TableCell></TableRow>)}
                  <TableRow>
                    <TableCell className="pl-6 text-center"><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">-</code></TableCell>
                    <TableCell className="font-semibold">Retained earnings, {formatDateDisplay(vm.asOfDate) || 'as of date'}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-">Equity</Badge></TableCell>
                    <TableCell className="text-right font-mono">{vm.retainedEarningsEnding < 0? formatNumber(vm.retainedEarningsEnding) : '-'}</TableCell>
                    <TableCell className="pr-6 text-right font-mono text-red-500">{vm.retainedEarningsEnding >= 0? formatNumber(vm.retainedEarningsEnding) : '-'}</TableCell>
                  </TableRow>
                </TableBody>
                <TableFooter><TableRow className="font-bold"><TableCell colSpan={3} className="pl-6 text-right">Total</TableCell><TableCell className="text-right font-mono text-emerald-500">{formatNumber(totalAssets)}</TableCell><TableCell className="pr-6 text-right font-mono text-red-500">{formatNumber(totalLiabilitiesAndEquity)}</TableCell></TableRow></TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Alert variant={isBalanced? 'default' : 'destructive'} className={isBalanced? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : ''}>
            {isBalanced? <IconCircleCheck className="h-4 w-4" /> : <IconAlertTriangle className="h-4 w-4" />}
            <AlertDescription>{isBalanced? 'Total Debit = Total Credit. Post-closing trial balance is in balance; books are ready for the next period.' : 'Post-closing trial balance is out of balance. Please check your closing journal entries.'}</AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}