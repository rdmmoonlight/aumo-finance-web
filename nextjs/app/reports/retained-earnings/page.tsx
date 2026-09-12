'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  IconPiggyBank,
  IconAlertTriangle,
  IconEyeOff,
  IconCalendar,
  IconArrowRightCircle,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

export interface RetainedEarningsViewModel { accountName: string; startDate: string; endDate: string; beginningBalance: number; netIncome: number; dividends: number; }

const formatNumber = (amount: number) => {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount < 0? `(${formatted})` : formatted;
};
const formatDateDisplay = (dateString?: string) => {
  if (!dateString) return '';
  const d = new Date(dateString); if (isNaN(d.getTime())) return dateString;
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

export default function RetainedEarningsReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<RetainedEarningsViewModel>({ accountName: 'Retained Earnings', startDate: '', endDate: '', beginningBalance: 0, netIncome: 0, dividends: 0 });

  const fetchReportData = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/reports/retained-earnings`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { setErrorMessage('Session expired or unauthorized. Please login again.'); return; }
      if (!res.ok) throw new Error('Failed to load Retained Earnings data.');
      const data = await res.json();
      if (data?.hasPeriodSelected === false) { setNoPeriodSelected(true); setVm({ accountName: 'Retained Earnings', startDate: '', endDate: '', beginningBalance: 0, netIncome: 0, dividends: 0 }); return; }
      setNoPeriodSelected(false);
      setVm({
        accountName: data?.accountName || 'Retained Earnings',
        startDate: data?.startDate || '',
        endDate: data?.endDate || '',
        beginningBalance: Number(data?.beginningRetainedEarnings?? data?.beginningBalance) || 0,
        netIncome: Number(data?.netIncome) || 0,
        dividends: Number(data?.dividendsOrDraws?? data?.dividends) || 0,
      });
    } catch (err: any) { setErrorMessage(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchReportData();
    const h = () => fetchReportData();
    window.addEventListener('periodChanged', h);
    return () => window.removeEventListener('periodChanged', h);
  }, [fetchReportData]);

  const endingBalance = useMemo(() => vm.beginningBalance + vm.netIncome - vm.dividends, [vm.beginningBalance, vm.netIncome, vm.dividends]);

  if (loading) return <div className="mx-auto max-w-3xl p-6 flex justify-center gap-2 text-sm text-muted-foreground"><IconLoader2 className="h-4 w-4 animate-spin" /> Loading Retained Earnings Statement...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
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
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><IconPiggyBank className="h-5 w-5" /></span> Retained Earnings Statement</h2>
              <p className="max-w- text-sm text-muted-foreground">Bridges the Income Statement and the Equity section on the Balance Sheet (In IDR, unless otherwise stated).</p>
            </div>
            <Button asChild variant="outline"><Link href="/reports/statement-of-financial-position"><IconArrowRightCircle className="h-4 w-4" /> Balance Sheet</Link></Button>
          </div>

          <Card className="max-w-">
            <CardContent className="p-6">
              <h5 className="mb-4 font-bold">{vm.accountName}</h5>
              <Table>
                <TableBody>
                  <TableRow className="border-0"><TableCell className="py-2 pl-0 text-sm">Retained earnings, {formatDateDisplay(vm.startDate) || 'start of period'}</TableCell><TableCell className="py-2 pr-0 text-right font-mono text-sm">{formatNumber(vm.beginningBalance)}</TableCell></TableRow>
                  <TableRow className="border-0"><TableCell className="py-2 pl-6 text-sm text-muted-foreground">Add: Net Income for the Period</TableCell><TableCell className={`py-2 pr-0 text-right font-mono text-sm ${vm.netIncome >= 0? 'text-emerald-500' : 'text-red-500'}`}>{formatNumber(vm.netIncome)}</TableCell></TableRow>
                  {vm.dividends!== 0 && <TableRow className="border-0"><TableCell className="py-2 pl-6 text-sm text-muted-foreground">Less: Dividends / Withdrawals</TableCell><TableCell className="py-2 pr-0 text-right font-mono text-sm text-red-500">({formatNumber(vm.dividends)})</TableCell></TableRow>}
                  <TableRow className="border-t- font-bold text-base"><TableCell className="pt-4 pl-0">Retained earnings, {formatDateDisplay(vm.endDate) || 'end of period'}</TableCell><TableCell className="pt-4 pr-0 text-right font-mono text-emerald-500">{formatNumber(endingBalance)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}