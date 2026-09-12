'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  IconBuildingBank,
  IconAlertTriangle,
  IconEyeOff,
  IconCalendar,
  IconArrowRightCircle,
  IconCircleCheck,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

export interface FinancialPositionLine { referenceNumber: number; accountName: string; amount: number; }
export interface StatementOfFinancialPositionViewModel {
  asOfDate: string; isPostClosing: boolean; assets: FinancialPositionLine[]; liabilities: FinancialPositionLine[];
  equityExcludingRetainedEarnings: FinancialPositionLine[]; retainedEarningsEnding: number;
}

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

export default function StatementOfFinancialPositionReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<StatementOfFinancialPositionViewModel>({ asOfDate: '', isPostClosing: false, assets: [], liabilities: [], equityExcludingRetainedEarnings: [], retainedEarningsEnding: 0 });

  const fetchReportData = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/reports/statement-of-financial-position`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { setErrorMessage('Session expired or unauthorized. Please login again.'); return; }
      if (!res.ok) throw new Error('Failed to load Statement of Financial Position data.');
      const data = await res.json();
      if (data?.hasPeriodSelected === false) { setNoPeriodSelected(true); return; }
      const assetsList = Array.isArray(data?.assetAccounts)? data.assetAccounts : Array.isArray(data?.assets)? data.assets : [];
      const liabilitiesList = Array.isArray(data?.liabilityAccounts)? data.liabilityAccounts : Array.isArray(data?.liabilities)? data.liabilities : [];
      const rawEquityList = Array.isArray(data?.equityAccounts)? data.equityAccounts : Array.isArray(data?.equityExcludingRetainedEarnings)? data.equityExcludingRetainedEarnings : [];
      const equityExcludingRE = rawEquityList.filter((e: any) => e.accountName!== 'Retained Earnings' && e.referenceNumber!== 0);
      const reItem = rawEquityList.find((e: any) => e.accountName === 'Retained Earnings' || e.referenceNumber === 0);
      const reEndingValue = reItem? Number(reItem.amount) || 0 : Number(data?.retainedEarningsEnding) || 0;
      setNoPeriodSelected(false);
      setVm({ asOfDate: data?.asOfDate || '', isPostClosing: Boolean(data?.isPostClosing), assets: assetsList, liabilities: liabilitiesList, equityExcludingRetainedEarnings: equityExcludingRE, retainedEarningsEnding: reEndingValue });
    } catch (err: any) { setErrorMessage(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchReportData();
    const h = () => fetchReportData();
    window.addEventListener('periodChanged', h);
    return () => window.removeEventListener('periodChanged', h);
  }, [fetchReportData]);

  const totalAssets = useMemo(() => vm.assets.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.assets]);
  const totalLiabilities = useMemo(() => vm.liabilities.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.liabilities]);
  const totalEquity = useMemo(() => vm.equityExcludingRetainedEarnings.reduce((s,i)=>s+(Number(i.amount)||0),0) + vm.retainedEarningsEnding, [vm.equityExcludingRetainedEarnings, vm.retainedEarningsEnding]);
  const totalLiabilitiesAndEquity = useMemo(() => totalLiabilities + totalEquity, [totalLiabilities, totalEquity]);
  const isBalanced = useMemo(() => Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01, [totalAssets, totalLiabilitiesAndEquity]);

  if (loading) return <div className="mx-auto max-w-6xl p-6 flex justify-center gap-2 text-sm text-muted-foreground"><IconLoader2 className="h-4 w-4 animate-spin" /> Loading Statement of Financial Position...</div>;

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
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500"><IconBuildingBank className="h-5 w-5" /></span> Statement of Financial Position</h2>
              <p className="text-sm text-muted-foreground">In accordance with IAS 1, as of <strong>{formatDateDisplay(vm.asOfDate) || 'current period'}</strong> (In IDR, unless otherwise stated).</p>
            </div>
            <Button asChild variant="outline"><Link href="/reports/closing-journal"><IconArrowRightCircle className="h-4 w-4" /> Closing Journal</Link></Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader className="py-3"><CardTitle className="text- font-bold uppercase tracking-widest text-amber-500">Assets</CardTitle></CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between p-6 pt-0">
                <Table><TableBody>
                  {vm.assets.length === 0? <TableRow className="border-0"><TableCell colSpan={2} className="pl-0 text-sm italic text-muted-foreground">No asset accounts recorded.</TableCell></TableRow>
                  : vm.assets.map((l, idx) => <TableRow key={`asset-${idx}`} className="border-0"><TableCell className="pl-0 py-1.5 text-sm"><code className="mr-2 rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">{l.referenceNumber}</code>{l.accountName}</TableCell><TableCell className="pr-0 py-1.5 text-right font-mono text-sm">{formatNumber(l.amount)}</TableCell></TableRow>)}
                </TableBody></Table>
                <div className="mt-4 flex justify-between border-t pt-3 text-base font-bold"><span>Total Assets</span><span className="font-mono text-sky-500">{formatNumber(totalAssets)}</span></div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader className="py-3"><CardTitle className="text- font-bold uppercase tracking-widest text-amber-500">Liabilities</CardTitle></CardHeader>
                <CardContent className="p-6 pt-0">
                  <Table><TableBody>
                    {vm.liabilities.length === 0? <TableRow className="border-0"><TableCell colSpan={2} className="pl-0 text-sm italic text-muted-foreground">No liability accounts recorded.</TableCell></TableRow>
                    : vm.liabilities.map((l, idx) => <TableRow key={`liab-${idx}`} className="border-0"><TableCell className="pl-0 py-1.5 text-sm"><code className="mr-2 rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">{l.referenceNumber}</code>{l.accountName}</TableCell><TableCell className="pr-0 py-1.5 text-right font-mono text-sm">{formatNumber(l.amount)}</TableCell></TableRow>)}
                    <TableRow className="border-t font-semibold"><TableCell className="pl-0 pt-3">Total Liabilities</TableCell><TableCell className="pr-0 pt-3 text-right font-mono">{formatNumber(totalLiabilities)}</TableCell></TableRow>
                  </TableBody></Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3"><CardTitle className="text- font-bold uppercase tracking-widest text-amber-500">Equity</CardTitle></CardHeader>
                <CardContent className="p-6 pt-0">
                  <Table><TableBody>
                    {vm.equityExcludingRetainedEarnings.map((l, idx) => <TableRow key={`eq-${idx}`} className="border-0"><TableCell className="pl-0 py-1.5 text-sm"><code className="mr-2 rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">{l.referenceNumber}</code>{l.accountName}</TableCell><TableCell className="pr-0 py-1.5 text-right font-mono text-sm">{formatNumber(l.amount)}</TableCell></TableRow>)}
                    <TableRow className="border-0"><TableCell className="pl-0 py-1.5 text-sm">Retained earnings, {formatDateDisplay(vm.asOfDate) || 'as of date'}</TableCell><TableCell className="pr-0 py-1.5 text-right font-mono text-sm">{formatNumber(vm.retainedEarningsEnding)}</TableCell></TableRow>
                    <TableRow className="border-t font-semibold"><TableCell className="pl-0 pt-3">Total Equity</TableCell><TableCell className="pr-0 pt-3 text-right font-mono">{formatNumber(totalEquity)}</TableCell></TableRow>
                  </TableBody></Table>
                </CardContent>
              </Card>

              <Card><CardContent className="flex justify-between py-3 font-bold text-base"><span>Total Liabilities & Equity</span><span className="font-mono text-sky-500">{formatNumber(totalLiabilitiesAndEquity)}</span></CardContent></Card>
            </div>
          </div>

          <Alert variant={isBalanced? 'default' : 'destructive'} className={isBalanced? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : ''}>
            {isBalanced? <IconCircleCheck className="h-4 w-4" /> : <IconAlertTriangle className="h-4 w-4" />}
            <AlertDescription>{isBalanced? 'Total Assets = Total Liabilities + Equity. The Statement of Financial Position is balanced.' : 'Total Assets does not equal Total Liabilities + Equity. Please check your journal entries.'}</AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}