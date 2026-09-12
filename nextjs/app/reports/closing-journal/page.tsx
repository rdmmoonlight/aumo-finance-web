'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconLock,
  IconAlertTriangle,
  IconEyeOff,
  IconCalendar,
  IconArrowRightCircle,
  IconInfoCircle,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

export interface ClosingJournalLine { referenceNumber?: number; accountName: string; debit: number; credit: number; }
export interface ClosingJournalEntryGroup { description: string; lines: ClosingJournalLine[]; }
export interface ClosingJournalViewModel { netIncome: number; retainedEarningsAccountName: string; groups: ClosingJournalEntryGroup[]; }
export interface Period { id: number; periodName: string; startDate: string; endDate: string; isClosed: boolean; }

const formatNumber = (amount: number) => {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount < 0? `(${formatted})` : formatted;
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

export default function ClosingJournalReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<ClosingJournalViewModel>({ netIncome: 0, retainedEarningsAccountName: 'Retained Earnings', groups: [] });

  const fetchClosingJournalData = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/reports/closing-journal`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { setErrorMessage('Session expired or unauthorized. Please login again.'); setVm({ netIncome: 0, retainedEarningsAccountName: 'Retained Earnings', groups: [] }); return; }
      if (!res.ok) throw new Error('Failed to load Closing Journal data.');
      const data = await res.json();
      if (data?.hasPeriodSelected === false) { setNoPeriodSelected(true); setVm({ netIncome: 0, retainedEarningsAccountName: 'Retained Earnings', groups: [] }); return; }
      const cjData = data?.closingJournal || data;
      const rawGroups = Array.isArray(cjData?.groups)? cjData.groups : [];
      const safeGroups = rawGroups.map((g: any) => ({ description: g.description || 'Closing Entry', lines: Array.isArray(g.lines)? g.lines : [] }));
      setNoPeriodSelected(false);
      setVm({ netIncome: Number(cjData?.netIncome) || 0, retainedEarningsAccountName: cjData?.retainedEarningsAccountName || 'Retained Earnings', groups: safeGroups });
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchClosingJournalData();
    const handlePeriodChanged = () => fetchClosingJournalData();
    window.addEventListener('periodChanged', handlePeriodChanged);
    return () => window.removeEventListener('periodChanged', handlePeriodChanged);
  }, [fetchClosingJournalData]);

  const groupTotals = useMemo(() => {
    return vm.groups.map((group) => {
      const totalDebit = group.lines.reduce((s,l)=>s+(Number(l.debit)||0),0);
      const totalCredit = group.lines.reduce((s,l)=>s+(Number(l.credit)||0),0);
      return { totalDebit, totalCredit };
    });
  }, [vm.groups]);

  if (loading) {
    return <div className="mx-auto max-w-5xl space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h- w-full" /><Skeleton className="h- w-full" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      {errorMessage && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <div className="flex items-center gap-2"><IconAlertTriangle className="h-4 w-4" /><AlertDescription>{errorMessage}</AlertDescription></div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>setErrorMessage(null)}><IconX className="h-4 w-4" /></Button>
        </Alert>
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
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500"><IconLock className="h-5 w-5" /></span> Closing Journal</h2>
              <p className="max-w- text-sm text-muted-foreground">Closing entries are calculated automatically based on current nominal account balances — not yet posted to the General Journal (In IDR, unless otherwise stated).</p>
            </div>
            <Button asChild variant="outline"><Link href="/reports/post-closing-trial-balance"><IconArrowRightCircle className="h-4 w-4" /> Post-Closing Trial Balance</Link></Button>
          </div>

          {vm.groups.length === 0 && <Alert variant="default"><AlertDescription>There are no nominal accounts with balances to close.</AlertDescription></Alert>}

          {vm.groups.map((group, gIdx) => {
            const totals = groupTotals[gIdx];
            return (
              <Card key={`group-${gIdx}`}>
                <CardHeader className="py-3"><CardTitle className="text-sm font-semibold">{group.description}</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead className="w-[15%] pl-6 text-center">Ref.</TableHead><TableHead className="w-[45%]">Account</TableHead><TableHead className="w-[20%] text-right">Debit</TableHead><TableHead className="w-[20%] pr-6 text-right">Credit</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {group.lines.map((line, lIdx) => (
                        <TableRow key={`line-${gIdx}-${lIdx}`}>
                          <TableCell className="pl-6 text-center"><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold text-amber-500">{line.referenceNumber && line.referenceNumber > 0? line.referenceNumber.toString() : '-'}</code></TableCell>
                          <TableCell className={line.credit > 0? 'pl-8 text-muted-foreground' : 'font-semibold'}>{line.accountName}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-500">{line.debit > 0? formatNumber(line.debit) : '-'}</TableCell>
                          <TableCell className="pr-6 text-right font-mono text-red-500">{line.credit > 0? formatNumber(line.credit) : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter><TableRow className="font-bold"><TableCell colSpan={2} className="pl-6 text-right">Total</TableCell><TableCell className="text-right font-mono text-emerald-500">{formatNumber(totals?.totalDebit || 0)}</TableCell><TableCell className="pr-6 text-right font-mono text-red-500">{formatNumber(totals?.totalCredit || 0)}</TableCell></TableRow></TableFooter>
                  </Table>
                </CardContent>
              </Card>
            );
          })}

          {vm.groups.length > 0 && (
            <Alert className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300">
              <IconInfoCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">After closing entries are posted, all nominal accounts will have a zero balance and Net Income of <strong>{formatNumber(vm.netIncome)}</strong> will transfer to <strong>{vm.retainedEarningsAccountName}</strong>.</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}