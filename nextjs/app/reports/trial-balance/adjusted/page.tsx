'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  IconListCheck,
  IconAlertTriangle,
  IconEyeOff,
  IconCalendar,
  IconList,
  IconNotes,
  IconCircleCheck,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

export interface TrialBalanceRow { accountId: number; referenceNumber: number; accountName: string; type: string; role?: string; normalBalanceIsDebit: boolean; netBalance: number; debit?: number; credit?: number; }

const formatNumber = (amount: number) => {
  if (amount === 0) return '-';
  const f = new Intl.NumberFormat('id-ID', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount < 0? `(${f})` : f;
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

export default function AdjustedTrialBalancePage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);

  const fetchTrialBalanceData = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/reports/trial-balance/adjusted`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { setErrorMessage('Session expired or unauthorized. Please login again.'); setRows([]); return; }
      if (!res.ok) throw new Error('Failed to load Adjusted Trial Balance data.');
      const rawData = await res.json();
      if (rawData?.hasPeriodSelected === false) { setNoPeriodSelected(true); setRows([]); return; }
      const rawRows: TrialBalanceRow[] = Array.isArray(rawData)? rawData : Array.isArray(rawData?.data)? rawData.data : Array.isArray(rawData?.rows)? rawData.rows : [];
      const computedRows = rawRows.map((r) => {
        const net = r.netBalance?? 0; const isDebitNormal = r.normalBalanceIsDebit; let debitVal = r.debit?? 0; let creditVal = r.credit?? 0;
        if (r.debit === undefined && r.credit === undefined) {
          if (isDebitNormal) { debitVal = net >= 0? net : 0; creditVal = net < 0? Math.abs(net) : 0; }
          else { creditVal = net >= 0? net : 0; debitVal = net < 0? Math.abs(net) : 0; }
        }
        return {...r, debit: debitVal, credit: creditVal };
      });
      setNoPeriodSelected(false); setRows(computedRows);
    } catch (err: any) { setErrorMessage(err.message); setRows([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchTrialBalanceData();
    const h = () => fetchTrialBalanceData();
    window.addEventListener('periodChanged', h);
    return () => window.removeEventListener('periodChanged', h);
  }, [fetchTrialBalanceData]);

  const totalDebit = useMemo(() => rows.reduce((s,r)=>s+(Number(r.debit)||0),0), [rows]);
  const totalCredit = useMemo(() => rows.reduce((s,r)=>s+(Number(r.credit)||0),0), [rows]);
  const isBalanced = useMemo(() => Math.abs(totalDebit - totalCredit) < 0.01, [totalDebit, totalCredit]);

  if (loading) return <div className="mx-auto max-w-6xl p-6 flex justify-center gap-2 text-sm text-muted-foreground"><IconLoader2 className="h-4 w-4 animate-spin" /> Loading Adjusted Trial Balance...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      {errorMessage && <Alert variant="destructive" className="flex items-center justify-between"><div className="flex items-center gap-2"><IconAlertTriangle className="h-4 w-4" /><AlertDescription>{errorMessage}</AlertDescription></div><Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>setErrorMessage(null)}><IconX className="h-4 w-4" /></Button></Alert>}

      {noPeriodSelected? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted"><IconEyeOff className="h-6 w-6 text-muted-foreground" /></div>
          <h5 className="text-lg font-semibold">No Period Selected</h5>
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">This report follows whichever period you're viewing. Select a period to view its adjusted trial balance.</p>
          <Button asChild><Link href="/periods"><IconCalendar className="h-4 w-4" /> Go to Periods</Link></Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500"><IconListCheck className="h-5 w-5" /></span> Adjusted Trial Balance</h2>
              <p className="text-sm text-muted-foreground">Account balances after reflecting adjusting entries — foundation for Income Statement and Balance Sheet.</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline"><Link href="/reports/trial-balance/unadjusted"><IconList className="h-4 w-4" /> Trial Balance</Link></Button>
              <Button asChild variant="outline"><Link href="/reports/adjusting-journal"><IconNotes className="h-4 w-4" /> Adjusting Journal</Link></Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead className="w-[10%] pl-6 text-center">Ref.</TableHead><TableHead className="w-[45%]">Account Name</TableHead><TableHead className="w-[15%]">Type</TableHead><TableHead className="w-[15%] text-right">Debit</TableHead><TableHead className="w-[15%] pr-6 text-right">Credit</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.length > 0? rows.map((row) => (
                    <TableRow key={row.accountId}>
                      <TableCell className="pl-6 text-center"><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold text-amber-500">{row.referenceNumber}</code></TableCell>
                      <TableCell className="font-semibold">{row.accountName}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-">{row.type}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-emerald-500">{(row.debit??0) > 0? formatNumber(row.debit!) : '-'}</TableCell>
                      <TableCell className="pr-6 text-right font-mono text-red-500">{(row.credit??0) > 0? formatNumber(row.credit!) : '-'}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No accounts with transaction history found for this period.</TableCell></TableRow>}
                </TableBody>
                <TableFooter><TableRow className="font-bold"><TableCell colSpan={3} className="pl-6 text-right">Total</TableCell><TableCell className="text-right font-mono text-emerald-500">{formatNumber(totalDebit)}</TableCell><TableCell className="pr-6 text-right font-mono text-red-500">{formatNumber(totalCredit)}</TableCell></TableRow></TableFooter>
              </Table>
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <Alert variant={isBalanced? 'default' : 'destructive'} className={isBalanced? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : ''}>
              {isBalanced? <IconCircleCheck className="h-4 w-4" /> : <IconAlertTriangle className="h-4 w-4" />}
              <AlertDescription>{isBalanced? 'Total Debit equals Total Credit. The adjusted trial balance is balanced.' : 'The adjusted trial balance is unbalanced. Please review your adjusting journal entries.'}</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}