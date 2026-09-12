'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  IconCalculator,
  IconBook,
  IconAlertTriangle,
  IconEyeOff,
  IconCalendar,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

export interface LedgerLineViewModel { entryDate: string; description?: string; debit: number; credit: number; runningBalance: number; }
export interface LedgerAccountViewModel { accountId: number; referenceNumber: number; accountName: string; type: string; normalBalanceIsDebit: boolean; endingBalance: number; lines: LedgerLineViewModel[]; }

const formatNumber = (amount: number) => {
  if (amount === 0) return '-';
  const formatted = new Intl.NumberFormat('id-ID', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount < 0? `(${formatted})` : formatted;
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

export default function TemporaryGeneralLedgerPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<LedgerAccountViewModel[]>([]);

  const fetchLedgerData = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/reports/general-ledger/temporary`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 404 || res.status === 400) { setNoPeriodSelected(true); setLedgers([]); return; }
      if (res.status === 401) { setErrorMessage('Session expired or unauthorized. Please login again.'); setLedgers([]); return; }
      if (!res.ok) throw new Error('Failed to load Temporary Accounts General Ledger.');
      const raw = await res.json();
      const data: LedgerAccountViewModel[] = Array.isArray(raw)? raw : Array.isArray(raw?.data)? raw.data : Array.isArray(raw?.ledgers)? raw.ledgers : [];
      setNoPeriodSelected(false); setLedgers(data);
    } catch (err: any) { setErrorMessage(err.message); setLedgers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchLedgerData();
    const h = () => fetchLedgerData();
    window.addEventListener('periodChanged', h);
    return () => window.removeEventListener('periodChanged', h);
  }, [fetchLedgerData]);

  const netTotal = useMemo(() => {
    return ledgers.reduce((sum, l) => sum + (l.normalBalanceIsDebit? -l.endingBalance : l.endingBalance), 0);
  }, [ledgers]);

  if (loading) return <div className="mx-auto max-w-6xl p-6 flex justify-center gap-2 text-sm text-muted-foreground"><IconLoader2 className="h-4 w-4 animate-spin" /> Loading Temporary Accounts General Ledger...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
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
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">This report follows whichever period you're viewing. Select a period to view its general ledger.</p>
          <Button asChild><Link href="/periods"><IconCalendar className="h-4 w-4" /> Go to Periods</Link></Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><IconCalculator className="h-5 w-5" /></span> General Ledger (Temporary Accounts)</h2>
              <p className="text-sm text-muted-foreground">Nominal (temporary) accounts — Income and Expenses (in IDR). Closed to Equity at period end.</p>
            </div>
            <Button asChild variant="outline"><Link href="/reports/general-journal"><IconBook className="h-4 w-4" /> General Journal</Link></Button>
          </div>

          {ledgers.length > 0 && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="text-sm font-semibold text-amber-500">Net Income / (Loss) before closing</span>
                <span className={`font-mono text-lg font-bold ${netTotal >= 0? 'text-emerald-500' : 'text-red-500'}`}>{formatNumber(netTotal)}</span>
              </CardContent>
            </Card>
          )}

          {ledgers.length === 0 &&!errorMessage && <Alert><AlertDescription>No temporary accounts found in the Chart of Accounts for this period.</AlertDescription></Alert>}

          {ledgers.map((ledger) => {
            const isDebitNormal = ledger.normalBalanceIsDebit;
            const isNormalPositive = isDebitNormal? ledger.endingBalance >= 0 : ledger.endingBalance <= 0;
            return (
              <Card key={ledger.accountId} id={`account-${ledger.accountId}`}>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-3">
                  <div className="flex items-center gap-2 text-base font-bold"><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold text-amber-500">{ledger.referenceNumber}</code> {ledger.accountName} <Badge variant="secondary" className="text-">{ledger.type}</Badge></div>
                  <span className={`font-mono text-sm font-semibold ${isNormalPositive? 'text-emerald-500' : 'text-red-500'}`}>Ending Balance: {formatNumber(ledger.endingBalance)} ({isDebitNormal? 'Dr' : 'Cr'})</span>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead className="pl-6">Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right pr-6">Balance</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {ledger.lines && ledger.lines.length > 0? ledger.lines.map((line, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="whitespace-nowrap pl-6 text-xs text-muted-foreground">{line.entryDate}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{line.description || '-'}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-500">{line.debit > 0? formatNumber(line.debit) : '-'}</TableCell>
                          <TableCell className="text-right font-mono text-red-500">{line.credit > 0? formatNumber(line.credit) : '-'}</TableCell>
                          <TableCell className="pr-6 text-right font-mono font-semibold">{formatNumber(line.runningBalance)}</TableCell>
                        </TableRow>
                      )) : <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No postings recorded for this account in the selected period.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}