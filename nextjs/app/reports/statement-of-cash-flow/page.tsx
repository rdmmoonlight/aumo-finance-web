'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  IconCash,
  IconAlertTriangle,
  IconEyeOff,
  IconCalendar,
  IconArrowRightCircle,
  IconInfoCircle,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

export interface CashFlowLine { description: string; amount: number; }
export interface CashFlowStatementViewModel { operatingActivities: CashFlowLine[]; investingActivities: CashFlowLine[]; financingActivities: CashFlowLine[]; beginningCash: number; }

const formatNumber = (amount: number) => {
  const formatted = new Intl.NumberFormat('id-ID', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount < 0? `(${formatted})` : formatted;
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

export default function CashFlowReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<CashFlowStatementViewModel>({ operatingActivities: [], investingActivities: [], financingActivities: [], beginningCash: 0 });

  const fetchCashFlowData = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/reports/statement-of-cash-flow`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { setErrorMessage('Session expired or unauthorized. Please login again.'); return; }
      if (res.status === 404) { setErrorMessage('Endpoint /reports/statement-of-cash-flow not found.'); return; }
      if (!res.ok) throw new Error('Failed to load Cash Flow Statement.');
      const data = await res.json();
      if (data?.hasPeriodSelected === false) { setNoPeriodSelected(true); setVm({ operatingActivities: [], investingActivities: [], financingActivities: [], beginningCash: 0 }); return; }
      setNoPeriodSelected(false);
      setVm({ operatingActivities: Array.isArray(data?.operatingActivities)? data.operatingActivities : [], investingActivities: Array.isArray(data?.investingActivities)? data.investingActivities : [], financingActivities: Array.isArray(data?.financingActivities)? data.financingActivities : [], beginningCash: Number(data?.beginningCash) || 0 });
    } catch (err: any) { setErrorMessage(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchCashFlowData();
    const h = () => fetchCashFlowData();
    window.addEventListener('periodChanged', h);
    return () => window.removeEventListener('periodChanged', h);
  }, [fetchCashFlowData]);

  const netOperating = useMemo(() => vm.operatingActivities.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.operatingActivities]);
  const netInvesting = useMemo(() => vm.investingActivities.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.investingActivities]);
  const netFinancing = useMemo(() => vm.financingActivities.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.financingActivities]);
  const netChangeInCash = useMemo(() => netOperating + netInvesting + netFinancing, [netOperating, netInvesting, netFinancing]);
  const endingCash = useMemo(() => vm.beginningCash + netChangeInCash, [vm.beginningCash, netChangeInCash]);

  if (loading) return <div className="mx-auto max-w-4xl p-6 flex justify-center gap-2 text-sm text-muted-foreground"><IconLoader2 className="h-4 w-4 animate-spin" /> Loading Cash Flow Statement...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
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
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><IconCash className="h-5 w-5" /></span> Cash Flow Statement</h2>
              <p className="max-w- text-sm text-muted-foreground">Indirect method (IAS 7), derived from Adjusted Trial Balance & Income Statement (In IDR, unless otherwise stated).</p>
            </div>
            <Button asChild variant="outline"><Link href="/reports/income-statement"><IconArrowRightCircle className="h-4 w-4" /> Income Statement</Link></Button>
          </div>

          <Card>
            <CardContent className="p-6">
              <Table>
                <TableBody>
                  <TableRow className="border-0"><TableCell colSpan={2} className="pb-2 pt-0 text- font-bold uppercase tracking-widest text-amber-500">Cash Flows from Operating Activities</TableCell></TableRow>
                  {vm.operatingActivities.length === 0? <TableRow className="border-0"><TableCell className="pl-4 text-sm italic text-muted-foreground">No operating activities.</TableCell><TableCell className="text-right font-mono text-muted-foreground">-</TableCell></TableRow>
                  : vm.operatingActivities.map((l,i)=><TableRow key={`op-${i}`} className="border-0"><TableCell className="pl-4 py-1.5 text-sm">{l.description}</TableCell><TableCell className={`py-1.5 text-right font-mono text-sm ${l.amount < 0? 'text-red-500' : 'text-emerald-500'}`}>{formatNumber(l.amount)}</TableCell></TableRow>)}
                  <TableRow className="border-t font-semibold"><TableCell className="pl-4 pt-3 text-sm">Net Cash Provided by (Used in) Operating Activities</TableCell><TableCell className={`pt-3 text-right font-mono text-sm ${netOperating < 0? 'text-red-500' : 'text-emerald-500'}`}>{formatNumber(netOperating)}</TableCell></TableRow>

                  <TableRow className="border-0"><TableCell colSpan={2} className="pb-2 pt-6 text- font-bold uppercase tracking-widest text-amber-500">Cash Flows from Investing Activities</TableCell></TableRow>
                  {vm.investingActivities.length === 0? <TableRow className="border-0"><TableCell className="pl-4 text-sm italic text-muted-foreground">No investing activities.</TableCell><TableCell className="text-right font-mono text-muted-foreground">-</TableCell></TableRow>
                  : vm.investingActivities.map((l,i)=><TableRow key={`inv-${i}`} className="border-0"><TableCell className="pl-4 py-1.5 text-sm">{l.description}</TableCell><TableCell className={`py-1.5 text-right font-mono text-sm ${l.amount < 0? 'text-red-500' : 'text-emerald-500'}`}>{formatNumber(l.amount)}</TableCell></TableRow>)}
                  <TableRow className="border-t font-semibold"><TableCell className="pl-4 pt-3 text-sm">Net Cash Provided by (Used in) Investing Activities</TableCell><TableCell className={`pt-3 text-right font-mono text-sm ${netInvesting < 0? 'text-red-500' : 'text-emerald-500'}`}>{formatNumber(netInvesting)}</TableCell></TableRow>

                  <TableRow className="border-0"><TableCell colSpan={2} className="pb-2 pt-6 text- font-bold uppercase tracking-widest text-amber-500">Cash Flows from Financing Activities</TableCell></TableRow>
                  {vm.financingActivities.length === 0? <TableRow className="border-0"><TableCell className="pl-4 text-sm italic text-muted-foreground">No financing activities.</TableCell><TableCell className="text-right font-mono text-muted-foreground">-</TableCell></TableRow>
                  : vm.financingActivities.map((l,i)=><TableRow key={`fin-${i}`} className="border-0"><TableCell className="pl-4 py-1.5 text-sm">{l.description}</TableCell><TableCell className={`py-1.5 text-right font-mono text-sm ${l.amount < 0? 'text-red-500' : 'text-emerald-500'}`}>{formatNumber(l.amount)}</TableCell></TableRow>)}
                  <TableRow className="border-t font-semibold"><TableCell className="pl-4 pt-3 text-sm">Net Cash Provided by (Used in) Financing Activities</TableCell><TableCell className={`pt-3 text-right font-mono text-sm ${netFinancing < 0? 'text-red-500' : 'text-emerald-500'}`}>{formatNumber(netFinancing)}</TableCell></TableRow>

                  <TableRow className="border-t- font-bold text-base"><TableCell className="pt-4">Net Increase (Decrease) in Cash and Cash Equivalents</TableCell><TableCell className={`pt-4 text-right font-mono ${netChangeInCash < 0? 'text-red-500' : 'text-emerald-500'}`}>{formatNumber(netChangeInCash)}</TableCell></TableRow>
                  <TableRow className="border-0"><TableCell className="pl-3 py-1.5 text-sm text-muted-foreground">Cash and Cash Equivalents, Beginning of Period</TableCell><TableCell className="py-1.5 text-right font-mono text-sm text-muted-foreground">{formatNumber(vm.beginningCash)}</TableCell></TableRow>
                  <TableRow className="border-t font-bold"><TableCell className="pl-3 pt-3 text-sky-500">Cash and Cash Equivalents, End of Period</TableCell><TableCell className="pt-3 text-right font-mono text-sky-500">{formatNumber(endingCash)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Alert className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"><IconInfoCircle className="h-4 w-4" /><AlertDescription>Prepared using the Indirect Method in accordance with IAS 7 / US GAAP.</AlertDescription></Alert>
        </>
      )}
    </div>
  );
}