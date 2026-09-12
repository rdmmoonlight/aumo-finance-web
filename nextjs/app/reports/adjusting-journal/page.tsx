'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  IconAdjustmentsHorizontal,
  IconPlus,
  IconPencil,
  IconAlertTriangle,
  IconEyeOff,
  IconFileX,
  IconTrash,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

export interface Account { id: number; referenceNumber: number; accountName: string; }
export interface JournalLine {
  id: number; lineOrder: number; debit: number; credit: number; lineDescription?: string;
  accountId?: number; accountName?: string; referenceNumber?: number; account?: Account;
}
export interface JournalEntry {
  id: number; transactionNumber: string; journalType: string; entryDate: string; createdAt: string; updatedAt?: string; lines: JournalLine[];
}

const formatNumber = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.abs(amount));
const formatDateDisplay = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};
const formatDateTimeDisplay = (dateTimeString?: string) => {
  if (!dateTimeString) return null;
  const date = new Date(dateTimeString);
  if (isNaN(date.getTime())) return dateTimeString;
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

export default function AdjustingJournalPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedPeriodName, setSelectedPeriodName] = useState<string | null>(null);
  const [isPeriodClosed, setIsPeriodClosed] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem('userId');
    router.push('/');
  }, [router]);

  const fetchJournalData = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/reports/adjusting-journal`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error('Failed to load adjusting journal data.');
      const data = await res.json();
      if (data.success) {
        setSelectedPeriodName(data.selectedPeriodName || null);
        setIsPeriodClosed(data.isPeriodClosed || false);
        setEntries(Array.isArray(data.entries)? data.entries : []);
      } else throw new Error(data.message || 'Failed to parse data.');
    } catch (err: any) {
      setErrorMessage(err.message); setEntries([]);
    } finally { setLoading(false); }
  }, [handleUnauthorized]);

  useEffect(() => { fetchJournalData(); }, [fetchJournalData]);

  const deleteEntry = async (entry: JournalEntry) => {
    if (isPeriodClosed) { alert(`Journal entry ${entry.transactionNumber} is in a closed period and cannot be deleted.`); return; }
    if (!window.confirm(`Delete adjusting journal entry ${entry.transactionNumber}?`)) return;
    setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/reports/adjusting-journal/${entry.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { handleUnauthorized(); return; }
      const d = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(d.message || 'Failed to delete.');
      setEntries((prev) => prev.filter((e) => e.id!== entry.id));
    } catch (err: any) { setErrorMessage(err.message); }
  };

  let currentDateTracker = '';
  let groupIndexTracker = 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      {errorMessage && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <div className="flex items-center gap-2"><IconAlertTriangle className="h-4 w-4" /><AlertDescription>{errorMessage}</AlertDescription></div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>setErrorMessage(null)}><IconX className="h-4 w-4" /></Button>
        </Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500"><IconAdjustmentsHorizontal className="h-5 w-5" /></span> Adjusting Journal</h2>
          <p className="text-sm text-muted-foreground">Adjusting entries to align revenues and expenses {selectedPeriodName? `(Viewing Period: ${selectedPeriodName})` : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild><Link href="/adjusting-journal-entry"><IconPlus className="h-4 w-4" /> Add Entry</Link></Button>
          <Button variant={editMode? 'secondary' : 'outline'} onClick={()=>setEditMode((p)=>!p)} disabled={entries.length === 0}><IconPencil className="h-4 w-4" /> Edit</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 w-[14%]">Date & Ref</TableHead>
                  <TableHead className="w-[26%]">Account</TableHead>
                  <TableHead className="w-[28%]">Description</TableHead>
                  <TableHead className="text-center w-[8%]">Ref #</TableHead>
                  <TableHead className="text-right w-[12%]">Debit</TableHead>
                  <TableHead className="text-right pr-6 w-[12%]">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading? (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground"><IconLoader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading adjusting journal...</TableCell></TableRow>
                ) : entries.length > 0? (
                  entries.map((entry) => {
                    const sortedLines = [...(entry.lines || [])].sort((a,b)=>a.lineOrder-b.lineOrder);
                    const currentDateStr = formatDateDisplay(entry.entryDate);
                    const showDateHeader = currentDateStr!== currentDateTracker;
                    if (showDateHeader) { currentDateTracker = currentDateStr; groupIndexTracker++; }
                    const entryShade = groupIndexTracker % 2 === 0? '' : 'bg-muted/30';

                    return sortedLines.map((line, i) => {
                      const isFirstRow = i === 0;
                      const isDebit = line.debit > 0;
                      const accountName = line.accountName || line.account?.accountName || 'Unknown Account';
                      const refNum = line.referenceNumber || line.account?.referenceNumber || '-';
                      return (
                        <TableRow key={`${entry.id}-${line.id || i}`} className={entryShade}>
                          <TableCell className="pl-6 align-top py-2">
                            {isFirstRow && showDateHeader && <Badge variant="secondary" className="mb-1 font-mono text-">{currentDateStr}</Badge>}
                            {isFirstRow && (
                              <div className="mt-1 flex flex-col items-start gap-1">
                                <span className="font-mono text-xs font-bold text-amber-500">{entry.transactionNumber}</span>
                                {entry.createdAt && <span className="text- text-muted-foreground">{formatDateTimeDisplay(entry.createdAt)}</span>}
                                {entry.updatedAt && <span className="flex items-center gap-1 text- text-sky-500"><IconPencil className="h-3 w-3" />{formatDateTimeDisplay(entry.updatedAt)}</span>}
                                {editMode && (
                                  <div className="mt-1 flex gap-1">
                                    <Button asChild variant="ghost" size="icon" className="h-6 w-6"><Link href={`/adjusting-journal-entry?id=${entry.id}`}><IconPencil className="h-3.5 w-3.5" /></Link></Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={()=>deleteEntry(entry)}><IconTrash className="h-3.5 w-3.5" /></Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className={`align-top py-2 ${isDebit? 'font-semibold' : 'pl-4 text-muted-foreground'}`}>{accountName}</TableCell>
                          <TableCell className="align-top py-2 text-xs text-muted-foreground">{line.lineDescription || '-'}</TableCell>
                          <TableCell className="text-center align-top py-2"><code className="font-mono text-xs font-bold text-amber-500">{refNum}</code></TableCell>
                          <TableCell className="text-right align-top py-2 font-mono font-bold text-emerald-500">{line.debit > 0? formatNumber(line.debit) : '-'}</TableCell>
                          <TableCell className="pr-6 text-right align-top py-2 font-mono font-bold text-red-500">{line.credit > 0? formatNumber(line.credit) : '-'}</TableCell>
                        </TableRow>
                      );
                    });
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      {selectedPeriodName === null? (
                        <div className="flex flex-col items-center"><IconEyeOff className="mb-2 h-8 w-8 text-muted-foreground" /><h6 className="font-semibold">No Period Selected</h6><p className="text-xs text-muted-foreground">Go to <Link href="/periods" className="font-bold text-primary underline">Periods</Link> to select one.</p></div>
                      ) : (
                        <div className="flex flex-col items-center"><IconFileX className="mb-2 h-8 w-8 text-muted-foreground" /><h6 className="font-semibold">No Adjusting Entries Found</h6><p className="text-xs text-muted-foreground">No adjusting entries recorded in <strong>{selectedPeriodName}</strong>.</p></div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}