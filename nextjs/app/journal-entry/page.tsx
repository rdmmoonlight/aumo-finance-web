'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  IconEdit,
  IconNotebook,
  IconArrowLeft,
  IconCircleCheck,
  IconAlertTriangle,
  IconLock,
  IconHash,
  IconCategory,
  IconCalendar,
  IconListDetails,
  IconPlus,
  IconTrash,
  IconDeviceFloppy,
  IconLoader2,
  IconX,
} from '@tabler/icons-react';

export interface ChartOfAccountOption { id: number; referenceNumber: number; accountName: string; }
export interface LineItem {
  id: string;
  accountId: number;
  lineDescription: string;
  debit: string;
  credit: string;
  suggestions: string[];
  showSuggestions: boolean;
}

const formatIDR = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'decimal', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount);
const formatNumberWithDots = (val: string | number): string => {
  if (val === '' || val == null) return '';
  const clean = val.toString().replace(/\D/g, '');
  if (!clean) return '';
  return new Intl.NumberFormat('id-ID').format(parseInt(clean, 10));
};
const parseFormattedNumber = (val: string): number => {
  if (!val) return 0;
  const clean = val.replace(/\D/g, '');
  return clean? parseInt(clean, 10) : 0;
};
const generateTxNumber = (journalType: string, dateStr: string): string => {
  const prefix = journalType === 'Adjusting'? 'AJ' : 'GJ';
  const d = dateStr? new Date(dateStr) : new Date();
  const yy = d.getFullYear().toString().slice(-2);
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${prefix}${yy}${mm}0001`;
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const NEXT_PUBLIC_API_URL = rawApiUrl.endsWith('/')? rawApiUrl.slice(0, -1) : rawApiUrl;

function JournalEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entryIdParam = searchParams.get('id');
  const isEdit = Boolean(entryIdParam);

  const [journalType, setJournalType] = useState('General');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionNumber, setTransactionNumber] = useState('');
  const [availableAccounts, setAvailableAccounts] = useState<ChartOfAccountOption[]>([]);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const resetForm = () => {
    const defaultDate = new Date().toISOString().split('T')[0];
    setJournalType('General');
    setEntryDate(defaultDate);
    setTransactionNumber(generateTxNumber('General', defaultDate));
    setLines([
      { id: Date.now().toString() + '-1', accountId: 0, lineDescription: '', debit: '', credit: '', suggestions: [], showSuggestions: false },
      { id: Date.now().toString() + '-2', accountId: 0, lineDescription: '', debit: '', credit: '', suggestions: [], showSuggestions: false },
    ]);
    setValidationErrors([]); setSuccessMessage(null);
  };

  useEffect(() => { if (!isEdit) setTransactionNumber(generateTxNumber(journalType, entryDate)); }, [journalType, entryDate, isEdit]);

  useEffect(() => {
    const initPage = async () => {
      setLoading(true);
      try {
        const accountsRes = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/chart-of-accounts`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
        if (accountsRes.ok) {
          const raw = await accountsRes.json();
          const data = Array.isArray(raw)? raw : Array.isArray(raw?.data)? raw.data : Array.isArray(raw?.accounts)? raw.accounts : [];
          setAvailableAccounts(data.map((acc: any) => ({ id: acc.id, referenceNumber: acc.referenceNumber, accountName: acc.accountName })));
        } else if (accountsRes.status === 401) throw new Error('Sesi telah berakhir. Silakan login kembali.');

        if (isEdit && entryIdParam) {
          const journalRes = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/journals/${entryIdParam}`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
          if (!journalRes.ok) throw new Error('Failed to retrieve journal entry.');
          const journalData = await journalRes.json();
          if (journalData.isClosedPeriod) {
            setLockedMessage(`Journal entry ${journalData.transactionNumber} belongs to a closed period and cannot be edited.`);
          } else {
            setTransactionNumber(journalData.transactionNumber);
            setJournalType(journalData.journalType || 'General');
            setEntryDate(journalData.entryDate? journalData.entryDate.split('T')[0] : new Date().toISOString().split('T')[0]);
            const rawLines = Array.isArray(journalData.lines)? journalData.lines : [];
            if (rawLines.length > 0) {
              setLines(rawLines.map((l: any, idx: number) => ({
                id: l.id? l.id.toString() : `${Date.now()}-${idx}`,
                accountId: l.accountId,
                lineDescription: l.lineDescription || '',
                debit: l.debit > 0? formatNumberWithDots(l.debit) : '',
                credit: l.credit > 0? formatNumberWithDots(l.credit) : '',
                suggestions: [], showSuggestions: false,
              })));
            }
          }
        } else resetForm();
      } catch (err: any) {
        setValidationErrors([err.message || 'Failed to load data.']);
      } finally { setLoading(false); }
    };
    initPage();
  }, [isEdit, entryIdParam]);

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + parseFormattedNumber(l.debit), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + parseFormattedNumber(l.credit), 0), [lines]);
  const isBalanced = useMemo(() => totalDebit > 0 && totalCredit > 0 && totalDebit === totalCredit, [totalDebit, totalCredit]);

  const addLine = () => setLines((p) => [...p, { id: `${Date.now()}-${Math.random()}`, accountId: 0, lineDescription: '', debit: '', credit: '', suggestions: [], showSuggestions: false }]);
  const removeLine = (id: string) => {
    if (lines.length <= 2) { alert('A journal entry must have at least two line items.'); return; }
    setLines((p) => p.filter((l) => l.id!== id));
  };
  const updateLineField = (id: string, field: keyof LineItem, value: any) => {
    setLines((prev) => prev.map((line) => {
      if (line.id!== id) return line;
      if (field === 'debit' && value!== '') return {...line, debit: formatNumberWithDots(value), credit: '' };
      if (field === 'credit' && value!== '') return {...line, credit: formatNumberWithDots(value), debit: '' };
      return {...line, [field]: value };
    }));
  };

  const handleDescriptionInput = (id: string, text: string) => {
    updateLineField(id, 'lineDescription', text);
    if (text.trim().length < 2) { setLines((p) => p.map((l) => l.id === id? {...l, showSuggestions: false, suggestions: [] } : l)); return; }
    const historicalNotes = ['Payroll Disbursement', 'Office Rent Payment', 'Accounts Receivable Collection', 'Supplies Purchase', 'Owner Capital Contribution'];
    const filtered = historicalNotes.filter((n) => n.toLowerCase().includes(text.toLowerCase()));
    setLines((p) => p.map((l) => l.id === id? {...l, suggestions: filtered, showSuggestions: filtered.length > 0 } : l));
  };
  const selectSuggestion = (id: string, txt: string) => setLines((p) => p.map((l) => l.id === id? {...l, lineDescription: txt, showSuggestions: false } : l));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setValidationErrors([]); setSuccessMessage(null);
    const errors: string[] = [];
    const effectiveLines = lines.filter((l) => l.accountId!== 0 && (parseFormattedNumber(l.debit) > 0 || parseFormattedNumber(l.credit) > 0));
    if (effectiveLines.length < 2) errors.push('A journal entry must have at least two valid line items.');
    if (!isBalanced) errors.push('Total debit must equal total credit before posting.');
    if (errors.length > 0) { setValidationErrors(errors); return; }

    try {
      const payload = { journalType, entryDate, transactionNumber, lines: effectiveLines.map((l) => ({ accountId: l.accountId, lineDescription: l.lineDescription, debit: parseFormattedNumber(l.debit), credit: parseFormattedNumber(l.credit) })) };
      const url = isEdit? `${NEXT_PUBLIC_API_URL}/api/v1/journals/${entryIdParam}` : `${NEXT_PUBLIC_API_URL}/api/v1/journals`;
      const method = isEdit? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(errData.message || 'Failed to save journal.'); }
      const result = await res.json();
      if (isEdit) { setSuccessMessage(`Journal entry ${transactionNumber} has been updated.`); setTimeout(() => router.push('/reports/general-journal'), 1200); }
      else { setSuccessMessage(`Journal entry ${result.transactionNumber || transactionNumber} has been posted successfully.`); resetForm(); }
    } catch (err: any) { setValidationErrors([err.message]); }
  };

  if (loading) return <div className="flex justify-center py-20 text-sm text-muted-foreground"><IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> Loading journal data from server...</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {isEdit? <><IconEdit className="h-6 w-6 text-amber-500" /> Edit Journal Entry <Badge variant="secondary" className="ml-2 font-mono">{transactionNumber}</Badge></> : <><IconNotebook className="h-6 w-6 text-amber-500" /> Create Journal Entry</>}
          </h2>
          <p className="text-sm text-muted-foreground">{isEdit? 'Update this double-entry transaction.' : 'Record double-entry financial transactions or adjusting entries.'}</p>
        </div>
        <Button asChild variant="outline"><Link href="/reports/general-journal"><IconArrowLeft className="h-4 w-4" /> Back to Journal</Link></Button>
      </div>

      {successMessage && <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600"><IconCircleCheck className="h-4 w-4" /><AlertDescription className="flex w-full justify-between">{successMessage}<Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>setSuccessMessage(null)}><IconX className="h-4 w-4" /></Button></AlertDescription></Alert>}
      {validationErrors.length > 0 && <Alert variant="destructive"><IconAlertTriangle className="h-4 w-4" /><AlertDescription><ul className="list-disc pl-4 text-xs">{validationErrors.map((e,i)=><li key={i}>{e}</li>)}</ul></AlertDescription></Alert>}
      {lockedMessage? (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-600"><IconLock className="h-4 w-4" /><AlertDescription className="flex items-center gap-2">{lockedMessage}<Link href="/reports/general-journal" className="underline">Back to General Journal</Link></AlertDescription></Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
              <div className="space-y-2"><Label className="flex items-center gap-1"><IconHash className="h-3.5 w-3.5" /> Transaction No.</Label><Input value={transactionNumber} readOnly className="font-mono font-semibold bg-muted" /></div>
              <div className="space-y-2"><Label className="flex items-center gap-1"><IconCategory className="h-3.5 w-3.5" /> Journal Type</Label>
                <Select value={journalType} onValueChange={setJournalType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="General">General Journal (GJ)</SelectItem><SelectItem value="Adjusting">Adjusting Entry (AJ)</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-2"><Label className="flex items-center gap-1"><IconCalendar className="h-3.5 w-3.5" /> Transaction Date</Label><Input type="date" value={entryDate} onChange={(e)=>setEntryDate(e.target.value)} required /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3"><CardTitle className="flex items-center gap-2 text-base"><IconListDetails className="h-5 w-5 text-amber-500" /> Journal Lines</CardTitle><Button type="button" size="sm" variant="outline" onClick={addLine}><IconPlus className="h-4 w-4" /> Add Line</Button></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead className="w- pl-6">Ref No.</TableHead><TableHead className="w-[24%]">Account Name</TableHead><TableHead className="w-[24%]">Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="pr-6 text-center">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {lines.map((line) => {
                      const accountRef = availableAccounts.find((a) => a.id === line.accountId)?.referenceNumber;
                      return (
                        <TableRow key={line.id}>
                          <TableCell className="pl-6"><Input value={accountRef? accountRef.toString() : ''} readOnly placeholder="---" className="h-9 text-center font-mono text-sky-500 bg-muted" /></TableCell>
                          <TableCell>
                            <Select value={line.accountId? line.accountId.toString() : ''} onValueChange={(v)=>updateLineField(line.id,'accountId',Number(v))}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Select Account..." /></SelectTrigger>
                              <SelectContent>{availableAccounts.map((acc)=><SelectItem key={acc.id} value={acc.id.toString()}>{acc.referenceNumber} - {acc.accountName}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="relative">
                            <Input placeholder="Note..." value={line.lineDescription} onChange={(e)=>handleDescriptionInput(line.id,e.target.value)} onBlur={()=>setTimeout(()=>updateLineField(line.id,'showSuggestions',false),200)} className="h-9" />
                            {line.showSuggestions && line.suggestions.length > 0 && (
                              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
                                {line.suggestions.map((s, i)=><button key={i} type="button" className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent" onMouseDown={(e)=>{e.preventDefault(); selectSuggestion(line.id,s)}}>{s}</button>)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell><Input inputMode="numeric" placeholder="0" value={line.debit} onChange={(e)=>updateLineField(line.id,'debit',e.target.value)} className="h-9 text-right font-mono" /></TableCell>
                          <TableCell><Input inputMode="numeric" placeholder="0" value={line.credit} onChange={(e)=>updateLineField(line.id,'credit',e.target.value)} className="h-9 text-right font-mono" /></TableCell>
                          <TableCell className="pr-6 text-center"><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={()=>removeLine(line.id)}><IconTrash className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow><TableCell colSpan={3} className="text-right font-semibold">Total Balance:</TableCell><TableCell className="text-right font-mono font-bold text-emerald-500">Rp {formatIDR(totalDebit)}</TableCell><TableCell className="text-right font-mono font-bold text-red-500">Rp {formatIDR(totalCredit)}</TableCell><TableCell /></TableRow>
                    <TableRow><TableCell colSpan={3} className="text-right">Status:</TableCell><TableCell colSpan={2} className="text-center">{isBalanced? <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-600"><IconCircleCheck className="h-3.5 w-3.5" /> Balanced</Badge> : <Badge variant="destructive" className="gap-1"><IconAlertTriangle className="h-3.5 w-3.5" /> Unbalanced (Rp {formatIDR(Math.abs(totalDebit-totalCredit))})</Badge>}</TableCell><TableCell /></TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            {isEdit? <Button asChild variant="secondary"><Link href="/reports/general-journal">Cancel</Link></Button> : <Button type="button" variant="secondary" onClick={resetForm}>Reset Form</Button>}
            <Button type="submit" disabled={!isBalanced} className="gap-2"><IconDeviceFloppy className="h-4 w-4" />{isEdit? 'Save Changes' : 'Post Journal Entry'}</Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function JournalEntryPage() {
  return <Suspense fallback={<div className="flex justify-center py-20 text-sm text-muted-foreground"><IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> Loading journal entry page...</div>}><JournalEntryContent /></Suspense>;
}