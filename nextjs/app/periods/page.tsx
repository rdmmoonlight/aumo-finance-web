'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconCalendar,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconArrowLeft,
  IconAlertTriangle,
  IconCircleCheck,
  IconX,
  IconLock,
  IconLockOpen,
  IconRefresh,
  IconCirclePlus,
  IconInfoCircle,
  IconCheck,
  IconCalendarPlus,
  IconCalendarOff,
  IconLoader2,
} from '@tabler/icons-react';

export interface AccountingPeriod { id: number; periodName: string; startDate: string; endDate: string; isClosed: boolean; }
interface AccountOption { id: string; displayLabel: string; }

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

export default function PeriodsMainPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [setupMode, setSetupMode] = useState<'LoadExisting' | 'CreateNew'>('LoadExisting');

  const [hasExistingPermanentAccounts, setHasExistingPermanentAccounts] = useState(false);
  const [availableCashAccounts, setAvailableCashAccounts] = useState<AccountOption[]>([]);
  const [availableRetainedAccounts, setAvailableRetainedAccounts] = useState<AccountOption[]>([]);
  const [permanentAccounts, setPermanentAccounts] = useState<AccountOption[]>([]);

  const [cashAccountId, setCashAccountId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [retainedEarningsAccountId, setRetainedEarningsAccountId] = useState('');

  const [cashAccountCode, setCashAccountCode] = useState('101');
  const [cashAccountName, setCashAccountName] = useState('Cash on Hand');
  const [cashBalance, setCashBalance] = useState<number | ''>('');
  const [bankAccountCode, setBankAccountCode] = useState('102');
  const [bankAccountName, setBankAccountName] = useState('Bank Account');
  const [bankBalance, setBankBalance] = useState<number | ''>('');
  const [retainedAccountCode, setRetainedAccountCode] = useState('301');
  const [retainedAccountName, setRetainedAccountName] = useState('Retained Earnings');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUnauthorized = () => { localStorage.removeItem('userId'); router.push('/'); };
  const notifyPeriodChanged = () => window.dispatchEvent(new Event('periodChanged'));

  const fetchPeriodsAndAccounts = async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const periodsRes = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (periodsRes.status === 401) { handleUnauthorized(); return; }
      if (!periodsRes.ok) throw new Error('Failed to load accounting periods.');
      const periodsRaw = await periodsRes.json();
      const periodsData: AccountingPeriod[] = Array.isArray(periodsRaw)? periodsRaw : Array.isArray(periodsRaw?.periods)? periodsRaw.periods : Array.isArray(periodsRaw?.data)? periodsRaw.data : [];
      setPeriods(periodsData);
      if (periodsRaw?.selectedPeriodId) setSelectedPeriodId(periodsRaw.selectedPeriodId);
      else { const active = periodsData.find(p =>!p.isClosed) || periodsData[0]; setSelectedPeriodId(active? active.id : null); }

      const openInfoRes = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods/open-info`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (openInfoRes.status === 401) { handleUnauthorized(); return; }
      if (openInfoRes.ok) {
        const info = await openInfoRes.json();
        const cashBankOptions: AccountOption[] = (info.availableCashAndBankAccounts || []).map((acc: any) => ({ id: acc.id.toString(), displayLabel: acc.displayLabel || `${acc.referenceNumber} - ${acc.accountName}` }));
        const retainedOptions: AccountOption[] = (info.availableRetainedEarningsAccounts || []).map((acc: any) => ({ id: acc.id.toString(), displayLabel: acc.displayLabel || `${acc.referenceNumber} - ${acc.accountName}` }));
        const permAccounts: AccountOption[] = (info.permanentAccounts || []).map((acc: any) => ({ id: acc.id.toString(), displayLabel: acc.displayLabel || `${acc.referenceNumber} - ${acc.accountName}` }));
        setAvailableCashAccounts(cashBankOptions); setAvailableRetainedAccounts(retainedOptions); setPermanentAccounts(permAccounts);
        const exists = info.hasExistingPermanentAccounts?? (cashBankOptions.length > 0 && retainedOptions.length > 0);
        setHasExistingPermanentAccounts(exists); setSetupMode(exists? 'LoadExisting' : 'CreateNew');
        if (exists) { setCashAccountId(cashBankOptions[0]?.id || ''); setBankAccountId(cashBankOptions[1]?.id || cashBankOptions[0]?.id || ''); setRetainedEarningsAccountId(retainedOptions[0]?.id || ''); }
      }
    } catch (err: any) { setErrorMessage(err.message); setPeriods([]); } finally { setLoading(false); }
  };

  useEffect(() => { fetchPeriodsAndAccounts(); }, []);

  const selectPeriod = async (period: AccountingPeriod) => {
    setErrorMessage(null); setSelectedPeriodId(period.id);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods/select/${period.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(d.message || 'Failed to select period.'); }
      setSuccessMessage(`Now viewing ${period.periodName}${period.isClosed? ' (Closed & Read-Only).' : '.'}`); notifyPeriodChanged();
    } catch (err: any) { setErrorMessage(err.message); fetchPeriodsAndAccounts(); }
  };

  const clearSelection = async () => {
    try { await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods/clear-selection`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' }); } catch {}
    finally { setSelectedPeriodId(null); setSuccessMessage('No period selected. Reports and journals are hidden until you view a period.'); notifyPeriodChanged(); }
  };

  const confirmAndClosePeriod = async (period: AccountingPeriod) => {
    if (!window.confirm(`Are you sure you want to close ${period.periodName}?`)) return;
    if (period.isClosed) { setErrorMessage(`Period ${period.periodName} is already closed.`); return; }
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods/close/${period.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(d.message || 'Failed to close period.'); }
      setPeriods((prev) => prev.map((p) => p.id === period.id? {...p, isClosed: true } : p));
      setSuccessMessage(`Period ${period.periodName} has been closed.`); notifyPeriodChanged();
    } catch (err: any) { setErrorMessage(err.message); }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErrorMessage(null);
    if (month < 1 || month > 12) { setErrorMessage('Please select a valid month.'); return; }
    if (year < 2000 || year > 2100) { setErrorMessage('Please provide a valid year.'); return; }
    if (setupMode === 'LoadExisting') {
      if (!cashAccountId ||!bankAccountId ||!retainedEarningsAccountId) { setErrorMessage('Please select Cash, Bank, and Retained Earnings accounts.'); return; }
      if (cashAccountId === bankAccountId) { setErrorMessage('Cash and Bank cannot be same account.'); return; }
    } else {
      if (!cashAccountCode ||!cashAccountName ||!bankAccountCode ||!bankAccountName ||!retainedAccountCode ||!retainedAccountName) { setErrorMessage('Please complete all new account fields.'); return; }
    }
    setIsSubmitting(true);
    try {
      const payload = {
        month, year, setupMode,
        cashAccountId: setupMode === 'LoadExisting'? parseInt(cashAccountId) : null,
        bankAccountId: setupMode === 'LoadExisting'? parseInt(bankAccountId) : null,
        retainedEarningsAccountId: setupMode === 'LoadExisting'? parseInt(retainedEarningsAccountId) : null,
        cashAccountCode: setupMode === 'CreateNew'? cashAccountCode : null,
        cashAccountName: setupMode === 'CreateNew'? cashAccountName : null,
        cashBalance: setupMode === 'CreateNew'? (Number(cashBalance) || 0) : null,
        bankAccountCode: setupMode === 'CreateNew'? bankAccountCode : null,
        bankAccountName: setupMode === 'CreateNew'? bankAccountName : null,
        bankBalance: setupMode === 'CreateNew'? (Number(bankBalance) || 0) : null,
        retainedEarningsAccountCode: setupMode === 'CreateNew'? retainedAccountCode : null,
        retainedEarningsAccountName: setupMode === 'CreateNew'? retainedAccountName : null,
      };
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(d.message || 'Failed to open new period.'); }
      const d = await res.json(); setSuccessMessage(d.message || 'Successfully opened new period.'); setViewMode('list'); fetchPeriodsAndAccounts(); notifyPeriodChanged();
    } catch (err: any) { setErrorMessage(err.message); } finally { setIsSubmitting(false); }
  };

  const totalOpeningBalance = (Number(cashBalance) || 0) + (Number(bankBalance) || 0);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      {errorMessage && <Alert variant="destructive" className="flex items-center justify-between"><div className="flex items-center gap-2"><IconAlertTriangle className="h-4 w-4" /><AlertDescription>{errorMessage}</AlertDescription></div><Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>setErrorMessage(null)}><IconX className="h-4 w-4" /></Button></Alert>}
      {successMessage && <Alert className="flex items-center justify-between border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><div className="flex items-center gap-2"><IconCircleCheck className="h-4 w-4" /><AlertDescription>{successMessage}</AlertDescription></div><Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>setSuccessMessage(null)}><IconX className="h-4 w-4" /></Button></Alert>}

      {viewMode === 'list'? (
        <>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><IconCalendar className="h-6 w-6 text-primary" /> Accounting Periods</h2><p className="text-sm text-muted-foreground">Manage your financial cycles. Click <IconEye className="inline h-3.5 w-3.5" /> to view a period — whole app will follow it.</p></div>
            <div className="flex gap-2">
              {selectedPeriodId!== null && <Button variant="secondary" onClick={clearSelection}><IconEyeOff className="h-4 w-4" /> Stop Viewing</Button>}
              <Button onClick={()=>{ setErrorMessage(null); setViewMode('create'); }} className="bg-amber-500 text-black hover:bg-amber-600"><IconPlus className="h-4 w-4" /> Open New Period</Button>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3"><CardTitle className="text-sm font-medium">Period List</CardTitle><span className="text-xs text-muted-foreground">Total: {periods.length}</span></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead className="pl-6">Period Name</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="pr-6 text-center">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading? <TableRow><TableCell colSpan={5} className="py-10 text-center"><IconLoader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading data from server...</TableCell></TableRow>
                  : periods.length > 0? periods.map((period) => {
                    const isSelected = selectedPeriodId === period.id;
                    return (
                      <TableRow key={period.id} className={isSelected? 'bg-amber-500/10' : ''}>
                        <TableCell className="pl-6 font-bold">{period.periodName} {isSelected && <Badge className="ml-2 gap-1 bg-amber-500 text-black"><IconEye className="h-3 w-3" /> Viewing</Badge>}</TableCell>
                        <TableCell>{period.startDate}</TableCell><TableCell>{period.endDate}</TableCell>
                        <TableCell className="text-center">{period.isClosed? <Badge variant="secondary" className="gap-1"><IconLock className="h-3 w-3" /> Closed</Badge> : <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-600"><IconLockOpen className="h-3 w-3" /> Active</Badge>}</TableCell>
                        <TableCell className="pr-6 text-center">
                          <div className="flex justify-center gap-1">
                            <Button variant={isSelected? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={()=>selectPeriod(period)}><IconEye className="h-4 w-4" /></Button>
                            {!period.isClosed && <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" onClick={()=>confirmAndClosePeriod(period)}><IconLock className="h-4 w-4" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }) : <TableRow><TableCell colSpan={5} className="py-12 text-center"><IconCalendarOff className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p>No accounting periods initialized yet.</p><span className="text-xs text-muted-foreground">Click Open New Period to start your first cycle.</span></TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-2xl font-bold"><IconCalendarPlus className="h-6 w-6 text-primary" /> Open New Period</h2><p className="text-sm text-muted-foreground">Start a new monthly cycle. Opening balance will be posted on day 1.</p></div><Button variant="secondary" onClick={()=>{ setErrorMessage(null); setViewMode('list'); }}><IconArrowLeft className="h-4 w-4" /> Back</Button></div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Card><CardHeader><CardTitle className="text-base">Period</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Month</Label><Select value={month.toString()} onValueChange={(v)=>setMonth(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTH_NAMES.map((n,i)=><SelectItem key={i+1} value={(i+1).toString()}>{n}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Year</Label><Input type="number" value={year} onChange={(e)=>setYear(Number(e.target.value))} required /></div>
            </CardContent></Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Permanent Accounts Setup</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={setupMode} onValueChange={(v)=>setSetupMode(v as any)} className="flex gap-4">
                  <div className="flex items-center space-x-2 rounded-lg border px-4 py-2"><RadioGroupItem value="LoadExisting" id="modeLoad" disabled={!hasExistingPermanentAccounts} /><Label htmlFor="modeLoad" className="flex items-center gap-1"><IconRefresh className="h-4 w-4" /> Use Existing Accounts</Label></div>
                  <div className="flex items-center space-x-2 rounded-lg border px-4 py-2"><RadioGroupItem value="CreateNew" id="modeNew" /><Label htmlFor="modeNew" className="flex items-center gap-1"><IconCirclePlus className="h-4 w-4" /> Register New Accounts</Label></div>
                </RadioGroup>

                {!hasExistingPermanentAccounts && <Alert className="border-sky-500/30 bg-sky-500/10 text-sky-600"><IconInfoCircle className="h-4 w-4" /><AlertDescription>No existing Cash/Bank & Retained Earnings found — this looks like your first period, so new accounts are required.</AlertDescription></Alert>}

                {setupMode === 'LoadExisting'? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2"><Label>Cash Account</Label><Select value={cashAccountId} onValueChange={setCashAccountId}><SelectTrigger><SelectValue placeholder="Select cash account" /></SelectTrigger><SelectContent>{availableCashAccounts.map(a=><SelectItem key={a.id} value={a.id}>{a.displayLabel}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Bank Account</Label><Select value={bankAccountId} onValueChange={setBankAccountId}><SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger><SelectContent>{availableCashAccounts.map(a=><SelectItem key={a.id} value={a.id}>{a.displayLabel}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Retained Earnings Account</Label><Select value={retainedEarningsAccountId} onValueChange={setRetainedEarningsAccountId}><SelectTrigger><SelectValue placeholder="Select RE account" /></SelectTrigger><SelectContent>{availableRetainedAccounts.map(a=><SelectItem key={a.id} value={a.id}>{a.displayLabel}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">Opening journal (General) will be posted on <strong>01 {MONTH_NAMES[month-1]} {year}</strong>, debiting Cash & Bank and crediting Retained Earnings.</p>
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-3 space-y-1"><Label>Cash Ref #</Label><Input placeholder="101" value={cashAccountCode} onChange={(e)=>setCashAccountCode(e.target.value)} /></div>
                      <div className="col-span-5 space-y-1"><Label>Cash Account Name</Label><Input value={cashAccountName} onChange={(e)=>setCashAccountName(e.target.value)} /></div>
                      <div className="col-span-4 space-y-1"><Label>Cash Opening Balance</Label><Input type="number" value={cashBalance} onChange={(e)=>setCashBalance(e.target.value === ''? '' : Number(e.target.value))} /></div>

                      <div className="col-span-3 space-y-1"><Label>Bank Ref #</Label><Input value={bankAccountCode} onChange={(e)=>setBankAccountCode(e.target.value)} /></div>
                      <div className="col-span-5 space-y-1"><Label>Bank Account Name</Label><Input value={bankAccountName} onChange={(e)=>setBankAccountName(e.target.value)} /></div>
                      <div className="col-span-4 space-y-1"><Label>Bank Opening Balance</Label><Input type="number" value={bankBalance} onChange={(e)=>setBankBalance(e.target.value === ''? '' : Number(e.target.value))} /></div>

                      <div className="col-span-3 space-y-1"><Label>RE Ref #</Label><Input value={retainedAccountCode} onChange={(e)=>setRetainedAccountCode(e.target.value)} /></div>
                      <div className="col-span-9 space-y-1"><Label>Retained Earnings Name</Label><Input value={retainedAccountName} onChange={(e)=>setRetainedAccountName(e.target.value)} /></div>
                    </div>
                    <Alert className="border-sky-500/30 bg-sky-500/10"><IconInfoCircle className="h-4 w-4" /><AlertDescription>Opening credit to Retained Earnings will be: <strong>Rp {totalOpeningBalance.toLocaleString('en-US')}</strong></AlertDescription></Alert>
                  </>
                )}

                {permanentAccounts.length > 0 && <div className="pt-2"><Label className="mb-2 block">Existing permanent accounts (for reference):</Label><div className="flex flex-wrap gap-2">{permanentAccounts.map(a=><Badge key={a.id} variant="secondary">{a.displayLabel}</Badge>)}</div></div>}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={()=>setViewMode('list')}>Cancel</Button><Button type="submit" disabled={isSubmitting} className="gap-2">{isSubmitting? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconCheck className="h-4 w-4" />} Open Period</Button></div>
          </form>
        </div>
      )}
    </div>
  );
}