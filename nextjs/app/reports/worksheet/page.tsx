'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  IconGridDots,
  IconTrendingUp,
  IconAlertTriangle,
  IconEyeOff,
  IconCalendar,
  IconInfoCircle,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

export interface WorksheetRow { accountId: number; referenceNumber: number; accountName: string; type: string; normalBalanceIsDebit: boolean; unadjustedDebit: number; unadjustedCredit: number; adjustmentDebit: number; adjustmentCredit: number; adjustedDebit: number; adjustedCredit: number; incomeStatementDebit: number; incomeStatementCredit: number; financialPositionDebit: number; financialPositionCredit: number; }
export interface WorksheetViewModel { rows: WorksheetRow[]; netIncome: number; }

const formatNumber = (amount: number) => {
  if (amount === 0) return '-';
  const f = new Intl.NumberFormat('id-ID', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount < 0? `(${f})` : f;
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

export default function WorksheetReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<WorksheetViewModel>({ rows: [], netIncome: 0 });

  const fetchWorksheetData = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/reports/worksheet`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { setErrorMessage('Session expired or unauthorized. Please login again.'); setVm({ rows: [], netIncome: 0 }); return; }
      if (!res.ok) throw new Error('Failed to load Worksheet data.');
      const data = await res.json();
      if (data?.hasPeriodSelected === false) { setNoPeriodSelected(true); setVm({ rows: [], netIncome: 0 }); return; }
      const rawRows = Array.isArray(data?.rows)? data.rows : [];
      const mappedRows: WorksheetRow[] = rawRows.map((r: any) => ({
        accountId: r.accountId, referenceNumber: r.referenceNumber, accountName: r.accountName, type: r.type, normalBalanceIsDebit: r.normalBalanceIsDebit?? true,
        unadjustedDebit: Number(r.tbDebit) || 0, unadjustedCredit: Number(r.tbCredit) || 0, adjustmentDebit: Number(r.adjDebit) || 0, adjustmentCredit: Number(r.adjCredit) || 0,
        adjustedDebit: Number(r.adjTbDebit) || 0, adjustedCredit: Number(r.adjTbCredit) || 0, incomeStatementDebit: Number(r.isDebit) || 0, incomeStatementCredit: Number(r.isCredit) || 0,
        financialPositionDebit: Number(r.bsDebit) || 0, financialPositionCredit: Number(r.bsCredit) || 0,
      }));
      setNoPeriodSelected(false); setVm({ rows: mappedRows, netIncome: Number(data?.totals?.netIncome) || 0 });
    } catch (err: any) { setErrorMessage(err.message); setVm({ rows: [], netIncome: 0 }); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchWorksheetData();
    const h = () => fetchWorksheetData();
    window.addEventListener('periodChanged', h);
    return () => window.removeEventListener('periodChanged', h);
  }, [fetchWorksheetData]);

  const totals = useMemo(() => {
    const safeRows = Array.isArray(vm.rows)? vm.rows : [];
    return safeRows.reduce((acc, r) => {
      acc.unadjustedDebit += r.unadjustedDebit || 0; acc.unadjustedCredit += r.unadjustedCredit || 0;
      acc.adjustmentDebit += r.adjustmentDebit || 0; acc.adjustmentCredit += r.adjustmentCredit || 0;
      acc.adjustedDebit += r.adjustedDebit || 0; acc.adjustedCredit += r.adjustedCredit || 0;
      acc.incomeStatementDebit += r.incomeStatementDebit || 0; acc.incomeStatementCredit += r.incomeStatementCredit || 0;
      acc.financialPositionDebit += r.financialPositionDebit || 0; acc.financialPositionCredit += r.financialPositionCredit || 0;
      return acc;
    }, { unadjustedDebit: 0, unadjustedCredit: 0, adjustmentDebit: 0, adjustmentCredit: 0, adjustedDebit: 0, adjustedCredit: 0, incomeStatementDebit: 0, incomeStatementCredit: 0, financialPositionDebit: 0, financialPositionCredit: 0 });
  }, [vm.rows]);

  if (loading) return <div className="mx-auto max-w- p-6 flex justify-center gap-2 text-sm text-muted-foreground"><IconLoader2 className="h-4 w-4 animate-spin" /> Loading 10-Column Worksheet...</div>;

  return (
    <div className="mx-auto max-w- space-y-4 p-4 md:p-6">
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
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500"><IconGridDots className="h-5 w-5" /></span> Worksheet</h2>
              <p className="max-w- text-sm text-muted-foreground">10-column worksheet: Trial Balance, Adjustments, Adjusted Trial Balance, Income Statement, and Balance Sheet (In IDR, unless otherwise stated).</p>
            </div>
            <Button asChild variant="outline"><Link href="/reports/income-statement"><IconTrendingUp className="h-4 w-4" /> Income Statement</Link></Button>
          </div>

          <Card>
            <CardContent className="p-0 overflow-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow><TableHead rowSpan={2} className="pl-6 min-w- align-middle">Account</TableHead><TableHead colSpan={2} className="text-center">Trial Balance</TableHead><TableHead colSpan={2} className="text-center">Adjustments</TableHead><TableHead colSpan={2} className="text-center">Adjusted Trial Balance</TableHead><TableHead colSpan={2} className="text-center">Income Statement</TableHead><TableHead colSpan={2} className="pr-6 text-center">Balance Sheet</TableHead></TableRow>
                  <TableRow><TableHead className="text-right">Dr</TableHead><TableHead className="text-right">Cr</TableHead><TableHead className="text-right">Dr</TableHead><TableHead className="text-right">Cr</TableHead><TableHead className="text-right">Dr</TableHead><TableHead className="text-right">Cr</TableHead><TableHead className="text-right">Dr</TableHead><TableHead className="text-right">Cr</TableHead><TableHead className="text-right">Dr</TableHead><TableHead className="pr-6 text-right">Cr</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {vm.rows.length > 0? vm.rows.map((row) => (
                    <TableRow key={row.accountId}>
                      <TableCell className="whitespace-nowrap pl-6"><code className="mr-2 rounded bg-muted px-1 py-0.5 font-mono text- font-bold text-amber-500">{row.referenceNumber}</code>{row.accountName}</TableCell>
                      <TableCell className="text-right font-mono">{row.unadjustedDebit > 0? formatNumber(row.unadjustedDebit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono">{row.unadjustedCredit > 0? formatNumber(row.unadjustedCredit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono text-amber-500">{row.adjustmentDebit > 0? formatNumber(row.adjustmentDebit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono text-amber-500">{row.adjustmentCredit > 0? formatNumber(row.adjustmentCredit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono">{row.adjustedDebit > 0? formatNumber(row.adjustedDebit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono">{row.adjustedCredit > 0? formatNumber(row.adjustedCredit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-500">{row.incomeStatementDebit > 0? formatNumber(row.incomeStatementDebit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-500">{row.incomeStatementCredit > 0? formatNumber(row.incomeStatementCredit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono text-sky-500">{row.financialPositionDebit > 0? formatNumber(row.financialPositionDebit) : '-'}</TableCell>
                      <TableCell className="pr-6 text-right font-mono text-sky-500">{row.financialPositionCredit > 0? formatNumber(row.financialPositionCredit) : '-'}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">No worksheet rows found for this period.</TableCell></TableRow>}
                </TableBody>
                <TableFooter>
                  <TableRow className="font-bold"><TableCell className="pl-6 text-right">Total</TableCell><TableCell className="text-right font-mono">{formatNumber(totals.unadjustedDebit)}</TableCell><TableCell className="text-right font-mono">{formatNumber(totals.unadjustedCredit)}</TableCell><TableCell className="text-right font-mono text-amber-500">{formatNumber(totals.adjustmentDebit)}</TableCell><TableCell className="text-right font-mono text-amber-500">{formatNumber(totals.adjustmentCredit)}</TableCell><TableCell className="text-right font-mono">{formatNumber(totals.adjustedDebit)}</TableCell><TableCell className="text-right font-mono">{formatNumber(totals.adjustedCredit)}</TableCell><TableCell className="text-right font-mono text-emerald-500">{formatNumber(totals.incomeStatementDebit)}</TableCell><TableCell className="text-right font-mono text-emerald-500">{formatNumber(totals.incomeStatementCredit)}</TableCell><TableCell className="text-right font-mono text-sky-500">{formatNumber(totals.financialPositionDebit)}</TableCell><TableCell className="pr-6 text-right font-mono text-sky-500">{formatNumber(totals.financialPositionCredit)}</TableCell></TableRow>
                  <TableRow className="font-bold">
                    <TableCell colSpan={7} className="pl-6 text-right">Net Income (plug IS → BS)</TableCell>
                    {vm.netIncome >= 0? <><TableCell className="text-right font-mono text-emerald-500">{formatNumber(vm.netIncome)}</TableCell><TableCell className="text-right">-</TableCell><TableCell className="text-right">-</TableCell><TableCell className="pr-6 text-right font-mono text-sky-500">{formatNumber(vm.netIncome)}</TableCell></>
                    : <><TableCell className="text-right">-</TableCell><TableCell className="text-right font-mono text-emerald-500">{formatNumber(Math.abs(vm.netIncome))}</TableCell><TableCell className="text-right font-mono text-sky-500">{formatNumber(Math.abs(vm.netIncome))}</TableCell><TableCell className="pr-6 text-right">-</TableCell></>}
                  </TableRow>
                  <TableRow className="border-t-2 font-bold">
                    <TableCell colSpan={7} className="pl-6 text-right">Total (after plug)</TableCell>
                    <TableCell className="text-right font-mono text-emerald-500">{formatNumber(totals.incomeStatementDebit + (vm.netIncome >= 0? vm.netIncome : 0))}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-500">{formatNumber(totals.incomeStatementCredit + (vm.netIncome < 0? Math.abs(vm.netIncome) : 0))}</TableCell>
                    <TableCell className="text-right font-mono text-sky-500">{formatNumber(totals.financialPositionDebit + (vm.netIncome < 0? Math.abs(vm.netIncome) : 0))}</TableCell>
                    <TableCell className="pr-6 text-right font-mono text-sky-500">{formatNumber(totals.financialPositionCredit + (vm.netIncome >= 0? vm.netIncome : 0))}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Alert className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"><IconInfoCircle className="h-4 w-4" /><AlertDescription>Net Income / (Loss): <strong>{formatNumber(vm.netIncome)}</strong> — plugged from the Income Statement column to the Balance Sheet column to balance both sections.</AlertDescription></Alert>
        </>
      )}
    </div>
  );
}