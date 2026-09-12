'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  IconSitemap,
  IconPlus,
  IconAlertTriangle,
  IconCircleCheck,
  IconX,
  IconPencil,
  IconNotebook,
  IconTrash,
  IconCirclePlus,
  IconEdit,
  IconInfoCircle,
  IconLoader2,
} from '@tabler/icons-react';

export interface ChartOfAccount {
  id: number;
  referenceNumber: number;
  accountName: string;
  type: string;
  role: string;
  balance: number;
  isActive: boolean;
}

const ACCOUNT_TYPES = ['Assets','Liabilities','Equity','OperatingIncome','OperatingExpenses','OtherIncome','OtherExpenses'];
const ACCOUNT_RANGES: Record<string, { start: number; end: number; label: string }> = {
  Assets: { start: 100, end: 199, label: 'Assets (100 - 199)' },
  Liabilities: { start: 200, end: 299, label: 'Liabilities (200 - 299)' },
  Equity: { start: 300, end: 399, label: 'Equity (300 - 399)' },
  OperatingIncome: { start: 400, end: 499, label: 'Operating Income (400 - 499)' },
  OperatingExpenses: { start: 500, end: 599, label: 'Operating Expenses (500 - 599)' },
  OtherIncome: { start: 600, end: 799, label: 'Other Income (600 - 799)' },
  OtherExpenses: { start: 800, end: 999, label: 'Other Expenses (800 - 999)' },
};
const formatCategoryLabel = (type: string) => ACCOUNT_RANGES[type]?.label || type;
const validateReferenceNumber = (type: string, refNum: number) => {
  const range = ACCOUNT_RANGES[type];
  if (!range) return false;
  return refNum >= range.start && refNum <= range.end;
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://my-authentic-web-api.onrender.com';
const NEXT_PUBLIC_API_URL = rawApiUrl.endsWith('/')? rawApiUrl.slice(0, -1) : rawApiUrl;

function ChartOfAccountsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriodName, setSelectedPeriodName] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState<Partial<ChartOfAccount>>({ type: '', referenceNumber: 0, accountName: '', role: 'Default' });
  const [editAccount, setEditAccount] = useState<ChartOfAccount | null>(null);

  const handleUnauthorized = () => { localStorage.removeItem('userId'); router.push('/'); };

  const fetchAccounts = async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/chart-of-accounts`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error('Failed to load Chart of Accounts.');
      const rawData = await res.json();
      setSelectedPeriodName(rawData?.selectedPeriodName || null);
      setAccounts((rawData?.accounts || []).sort((a: any, b: any) => a.referenceNumber - b.referenceNumber));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to backend.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchSearch =!searchText || acc.accountName.toLowerCase().includes(searchText.toLowerCase()) || acc.referenceNumber.toString().includes(searchText);
      const matchCategory =!categoryFilter || categoryFilter === 'all' || acc.type === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [accounts, searchText, categoryFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreateError(null);
    if (!newAccount.type) { setCreateError('Please select an account category.'); return; }
    const refNum = Number(newAccount.referenceNumber);
    if (!validateReferenceNumber(newAccount.type, refNum)) { setCreateError(`Ref ${refNum} is not valid for ${newAccount.type}.`); return; }
    if (accounts.some((a) => a.referenceNumber === refNum)) { setCreateError(`Account code ${refNum} is already in use!`); return; }
    try {
      const payload = { referenceNumber: refNum, accountName: newAccount.accountName || 'Untitled Account', type: newAccount.type, role: newAccount.role || 'Default' };
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/chart-of-accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to save.');
      setSuccessMessage(data.message || `Account '${payload.accountName}' created.`);
      setNewAccount({ type: '', referenceNumber: 0, accountName: '', role: 'Default' });
      setIsAddModalOpen(false); await fetchAccounts();
    } catch (err: any) { setCreateError(err.message); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editAccount) return; setEditError(null);
    if (!validateReferenceNumber(editAccount.type, editAccount.referenceNumber)) { setEditError(`Ref ${editAccount.referenceNumber} is not valid for ${editAccount.type}.`); return; }
    if (accounts.some((a) => a.referenceNumber === editAccount.referenceNumber && a.id!== editAccount.id)) { setEditError(`Code ${editAccount.referenceNumber} already in use!`); return; }
    try {
      const payload = { referenceNumber: editAccount.referenceNumber, accountName: editAccount.accountName, type: editAccount.type, role: editAccount.role || 'Default', isActive: editAccount.isActive };
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/chart-of-accounts/${editAccount.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to update.');
      setSuccessMessage(data.message || `Account '${editAccount.accountName}' updated.`);
      setIsEditModalOpen(false); await fetchAccounts();
    } catch (err: any) { setEditError(err.message); }
  };

  const confirmAndDelete = async (account: ChartOfAccount) => {
    if (!window.confirm(`Delete account "${account.accountName}"?`)) return;
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/chart-of-accounts/${account.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to delete.');
      setSuccessMessage(data.message || `Deleted '${account.accountName}'.`); await fetchAccounts();
    } catch (err: any) { setErrorMessage(err.message); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <IconSitemap className="h-6 w-6 text-primary" /> Chart of Accounts
          </h2>
          <p className="text-sm text-muted-foreground">Master list of financial accounts {selectedPeriodName? `(Period: ${selectedPeriodName})` : ''}</p>
        </div>
        <Button onClick={() => { setCreateError(null); setIsAddModalOpen(true); }} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
          <IconPlus className="h-4 w-4" /> New Account
        </Button>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <div className="flex items-center gap-2"><IconAlertTriangle className="h-4 w-4" /><AlertDescription>{errorMessage}</AlertDescription></div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setErrorMessage(null)}><IconX className="h-4 w-4" /></Button>
        </Alert>
      )}
      {successMessage && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2"><IconCircleCheck className="h-4 w-4" /><AlertDescription>{successMessage}</AlertDescription></div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSuccessMessage(null)}><IconX className="h-4 w-4" /></Button>
        </Alert>
      )}

      {/* Table Card */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Input placeholder="Search accounts..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full sm:w-" />
            <Select value={categoryFilter || 'all'} onValueChange={(v: string) => setCategoryFilter(v)}>
              <SelectTrigger className="w-full sm:w-"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ACCOUNT_TYPES.map((t) => (<SelectItem key={t} value={t}>{formatCategoryLabel(t)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Accounts: {filteredAccounts.length}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 w-">Ref No.</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="pr-6 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center"><IconLoader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading account data...</TableCell></TableRow>
                ) : filteredAccounts.length > 0? (
                  filteredAccounts.map((acc) => (
                    <TableRow key={acc.id} id={`account-${acc.id}`} className={highlightId === String(acc.id)? 'bg-amber-500/10' : ''}>
                      <TableCell className="pl-6 font-mono text-sky-500">{acc.referenceNumber}</TableCell>
                      <TableCell className="font-semibold">{acc.accountName}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-">{acc.type}</Badge></TableCell>
                      <TableCell>{acc.role!== 'Default'? <Badge variant="outline" className="text- border-blue-500/30 text-blue-500">{acc.role}</Badge> : <span className="text-xs text-muted-foreground">Standard</span>}</TableCell>
                      <TableCell className={`text-right font-semibold ${acc.balance >= 0? 'text-emerald-500' : 'text-red-400'}`}>Rp {acc.balance.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-center"><Badge variant={acc.isActive? 'default' : 'secondary'} className={acc.isActive? 'bg-emerald-500 hover:bg-emerald-600' : ''}>{acc.isActive? 'Active' : 'Inactive'}</Badge></TableCell>
                      <TableCell className="pr-6">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditError(null); setEditAccount({...acc }); setIsEditModalOpen(true); }}><IconPencil className="h-4 w-4" /></Button>
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7"><Link href={`/reports/general-ledger#account-${acc.id}`}><IconNotebook className="h-4 w-4" /></Link></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => confirmAndDelete(acc)}><IconTrash className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground"><IconSitemap className="mx-auto mb-2 h-8 w-8" /> No accounts found. Add a new account to get started.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ADD MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><IconCirclePlus className="h-5 w-5 text-amber-500" /> Add New Account</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && <Alert variant="destructive"><AlertDescription>{createError}</AlertDescription></Alert>}
            <div className="space-y-2">
              <Label>Account Category</Label>
              <Select value={newAccount.type} onValueChange={(v) => setNewAccount({...newAccount, type: v, referenceNumber: ACCOUNT_RANGES[v]?.start || 0 })}>
                <SelectTrigger><SelectValue placeholder="-- Select Category --" /></SelectTrigger>
                <SelectContent>{ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{formatCategoryLabel(t)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input type="number" value={newAccount.referenceNumber || ''} disabled={!newAccount.type} onChange={(e) => setNewAccount({...newAccount, referenceNumber: Number(e.target.value) })} required />
              {newAccount.type && <p className="flex items-center gap-1 text-xs text-muted-foreground"><IconInfoCircle className="h-3 w-3" /> Valid range: {ACCOUNT_RANGES[newAccount.type]?.start} - {ACCOUNT_RANGES[newAccount.type]?.end}</p>}
            </div>
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input placeholder="e.g. Rent Expense" value={newAccount.accountName || ''} onChange={(e) => setNewAccount({...newAccount, accountName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>System Role</Label>
              <Select value={newAccount.role} onValueChange={(v) => setNewAccount({...newAccount, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Default">Standard / Default</SelectItem>
                  <SelectItem value="CashAndEquivalents">Cash & Equivalents</SelectItem>
                  <SelectItem value="RetainedEarnings">Retained Earnings</SelectItem>
                  <SelectItem value="TaxPayable">Tax Payable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
              <Button type="submit">Save Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><IconEdit className="h-5 w-5 text-amber-500" /> Edit Account</DialogTitle></DialogHeader>
          {editAccount && (
            <form onSubmit={handleEdit} className="space-y-4">
              {editError && <Alert variant="destructive"><AlertDescription>{editError}</AlertDescription></Alert>}
              <div className="space-y-2">
                <Label>Account Category</Label>
                <Select value={editAccount.type} onValueChange={(v) => setEditAccount({...editAccount, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{formatCategoryLabel(t)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input type="number" value={editAccount.referenceNumber} onChange={(e) => setEditAccount({...editAccount, referenceNumber: Number(e.target.value) })} required />
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><IconInfoCircle className="h-3 w-3" /> Valid range: {ACCOUNT_RANGES[editAccount.type]?.start} - {ACCOUNT_RANGES[editAccount.type]?.end}</p>
              </div>
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input value={editAccount.accountName} onChange={(e) => setEditAccount({...editAccount, accountName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>System Role</Label>
                <Select value={editAccount.role} onValueChange={(v) => setEditAccount({...editAccount, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Default">Standard / Default</SelectItem>
                    <SelectItem value="CashAndEquivalents">Cash & Equivalents</SelectItem>
                    <SelectItem value="RetainedEarnings">Retained Earnings</SelectItem>
                    <SelectItem value="TaxPayable">Tax Payable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox checked={editAccount.isActive} onCheckedChange={(v) => setEditAccount({...editAccount, isActive: v as boolean })} id="active" />
                <Label htmlFor="active">Active Account</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                <Button type="submit">Update Account</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ChartOfAccountsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><IconLoader2 className="mr-2 h-5 w-5 animate-spin" /> Loading chart of accounts...</div>}>
      <ChartOfAccountsContent />
    </Suspense>
  );
}