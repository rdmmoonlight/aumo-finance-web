import { useState, useEffect, useMemo, Suspense } from 'react';
import { Link } from '@tanstack/react-router';
import { useNavigate, useSearchParams } from '@/hooks/useCompatRouter';
import { IconSitemap, IconPlus, IconPencil, IconNotebook, IconTrash, IconX, IconSearch } from '@tabler/icons-react';

import apiClient from '@/services/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export interface ChartOfAccount {
  id: number; referenceNumber: number; accountName: string; type: string; role: string; balance: number; isActive: boolean;
}

const ACCOUNT_TYPES = ['Assets','Liabilities','Equity','OperatingIncome','OperatingExpenses','OtherIncome','OtherExpenses'];
const ACCOUNT_RANGES: Record<string, { start: number; end: number; label: string }> = {
  Assets: { start: 100, end: 199, label: 'Assets (100-199)' },
  Liabilities: { start: 200, end: 299, label: 'Liabilities (200-299)' },
  Equity: { start: 300, end: 399, label: 'Equity (300-399)' },
  OperatingIncome: { start: 400, end: 499, label: 'Operating Income (400-499)' },
  OperatingExpenses: { start: 500, end: 599, label: 'Operating Expenses (500-599)' },
  OtherIncome: { start: 600, end: 799, label: 'Other Income (600-799)' },
  OtherExpenses: { start: 800, end: 999, label: 'Other Expenses (800-999)' },
};


function ChartOfAccountsContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState<Partial<ChartOfAccount>>({ type: '', referenceNumber: 0, accountName: '', role: 'Default' });
  const [editAccount, setEditAccount] = useState<ChartOfAccount | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/api/v1/chart-of-accounts`);
      const loaded: ChartOfAccount[] = data?.accounts || [];
      setAccounts(loaded.sort((a,b)=>a.referenceNumber-b.referenceNumber));
    } catch (err: any) {
      if (err.response?.status===401) navigate({ to: '/auth' });
      setErrorMessage(err.response?.data?.message || 'Failed to load accounts');
    } finally { setLoading(false); }
  };

  useEffect(()=>{ fetchAccounts(); }, []);

  const filteredAccounts = useMemo(()=> accounts.filter(acc=>{
    const matchSearch =!searchText || acc.accountName.toLowerCase().includes(searchText.toLowerCase()) || acc.referenceNumber.toString().includes(searchText);
    const matchCat =!categoryFilter || acc.type===categoryFilter;
    return matchSearch && matchCat;
  }), [accounts, searchText, categoryFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreateError(null);
    const refNum = Number(newAccount.referenceNumber);
    const range = ACCOUNT_RANGES[newAccount.type!];
    if (range && (refNum < range.start || refNum > range.end)) {
      setCreateError(`Ref ${refNum} not valid for ${newAccount.type} (${range.start}-${range.end})`); return;
    }
    if (accounts.some(a=>a.referenceNumber===refNum)) { setCreateError(`Code ${refNum} already used`); return; }
    try {
      await apiClient.post(`/api/v1/chart-of-accounts`, {
        referenceNumber: refNum, accountName: newAccount.accountName, type: newAccount.type, role: newAccount.role||'Default'
      });
      setSuccessMessage(`Account '${newAccount.accountName}' created`); setIsAddModalOpen(false);
      setNewAccount({ type: '', referenceNumber: 0, accountName: '', role: 'Default' }); fetchAccounts();
    } catch (err: any) { setCreateError(err.response?.data?.message || 'Failed to create'); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editAccount) return; setEditError(null);
    try {
      await apiClient.put(`/api/v1/chart-of-accounts/${editAccount.id}`, editAccount);
      setSuccessMessage(`Account '${editAccount.accountName}' updated`); setIsEditModalOpen(false); fetchAccounts();
    } catch (err: any) { setEditError(err.response?.data?.message || 'Failed to update'); }
  };

  const confirmAndDelete = async (account: ChartOfAccount) => {
    if (!confirm(`Delete "${account.accountName}"?`)) return;
    try {
      await apiClient.delete(`/api/v1/chart-of-accounts/${account.id}`);
      setSuccessMessage(`Deleted '${account.accountName}'`); fetchAccounts();
    } catch (err: any) { setErrorMessage(err.response?.data?.message || 'Failed to delete'); }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><IconSitemap className="text-primary" size={24}/> Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">Master list of financial accounts • {filteredAccounts.length} accounts</p>
        </div>
        <Button onClick={()=>{ setCreateError(null); setIsAddModalOpen(true); }} className="gap-2"><IconPlus size={16}/> New Account</Button>
      </div>

      {errorMessage && <Alert variant="destructive" className="flex justify-between"><AlertDescription>{errorMessage}</AlertDescription><button onClick={()=>setErrorMessage(null)}><IconX size={14}/></button></Alert>}
      {successMessage && <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex justify-between"><AlertDescription>{successMessage}</AlertDescription><button onClick={()=>setSuccessMessage(null)}><IconX size={14}/></button></Alert>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="flex items-center gap-2">
            <div className="relative"><IconSearch size={14} className="absolute left-3 top-3 text-muted-foreground"/><Input className="pl-8 h-9 w-60" placeholder="Search..." value={searchText} onChange={e=>setSearchText(e.target.value)}/></div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All Categories"/></SelectTrigger>
              <SelectContent>{ACCOUNT_TYPES.map(t=><SelectItem key={t} value={t}>{ACCOUNT_RANGES[t].label}</SelectItem>)}</SelectContent>
            </Select>
            {categoryFilter && <Button variant="ghost" size="sm" onClick={()=>setCategoryFilter('')} className="h-9 px-2"><IconX size={14}/></Button>}
          </div>
          <Badge variant="secondary" className="font-mono">{filteredAccounts.length} total</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="text-"><TableHead className="pl-6 w-24">Ref</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-center pr-6">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading? <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow> :
               filteredAccounts.map(acc=>(
                <TableRow key={acc.id} className={cn(highlightId===String(acc.id)&&'bg-primary/10')}>
                  <TableCell className="pl-6 font-mono text-primary font-medium">{acc.referenceNumber}</TableCell>
                  <TableCell className="font-medium">{acc.accountName}</TableCell>
                  <TableCell><Badge variant="outline" className="text-">{acc.type}</Badge></TableCell>
                  <TableCell>{acc.role!=='Default'? <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20 text-">{acc.role}</Badge> : <span className="text-xs text-muted-foreground">Standard</span>}</TableCell>
                  <TableCell className={cn('text-right font-medium font-mono', acc.balance>=0?'text-emerald-500':'text-red-500')}>Rp {acc.balance.toLocaleString('en-US')}</TableCell>
                  <TableCell className="text-center"><Badge variant={acc.isActive?'default':'secondary'} className={cn('text-', acc.isActive&&'bg-emerald-500/15 text-emerald-600 border-emerald-500/20')}>{acc.isActive?'Active':'Inactive'}</Badge></TableCell>
                  <TableCell className="pr-6"><div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>{ setEditAccount({...acc}); setIsEditModalOpen(true); }}><IconPencil size={14}/></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild><Link to={`/reports/general-ledger/permanent#account-${acc.id}`}><IconNotebook size={14}/></Link></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={()=>confirmAndDelete(acc)}><IconTrash size={14}/></Button>
                  </div></TableCell>
                </TableRow>
              ))}
              {!loading && filteredAccounts.length===0 && <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No accounts found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ADD DIALOG */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><IconPlus size={18} className="text-primary"/> Add New Account</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && <Alert variant="destructive" className="text-xs"><AlertDescription>{createError}</AlertDescription></Alert>}
            <div className="space-y-2"><Label>Category</Label><Select value={newAccount.type} onValueChange={v=>setNewAccount({...newAccount, type: v, referenceNumber: ACCOUNT_RANGES[v]?.start||0})} required><SelectTrigger><SelectValue placeholder="Select Category"/></SelectTrigger><SelectContent>{ACCOUNT_TYPES.map(t=><SelectItem key={t} value={t}>{ACCOUNT_RANGES[t].label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Reference Number</Label><Input type="number" value={newAccount.referenceNumber||''} onChange={e=>setNewAccount({...newAccount, referenceNumber: Number(e.target.value)})} disabled={!newAccount.type} required/><p className="text- text-muted-foreground">{newAccount.type? `Valid: ${ACCOUNT_RANGES[newAccount.type].start}-${ACCOUNT_RANGES[newAccount.type].end}` : 'Select category first'}</p></div>
            <div className="space-y-2"><Label>Account Name</Label><Input value={newAccount.accountName||''} onChange={e=>setNewAccount({...newAccount, accountName: e.target.value})} required/></div>
            <DialogFooter><Button type="button" variant="ghost" onClick={()=>setIsAddModalOpen(false)}>Cancel</Button><Button type="submit">Save Account</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          {editAccount && (
            <form onSubmit={handleEdit} className="space-y-4">
              {editError && <Alert variant="destructive" className="text-xs"><AlertDescription>{editError}</AlertDescription></Alert>}
              <div className="space-y-2"><Label>Name</Label><Input value={editAccount.accountName} onChange={e=>setEditAccount({...editAccount, accountName: e.target.value})} required/></div>
              <div className="space-y-2"><Label>Ref Number</Label><Input type="number" value={editAccount.referenceNumber} onChange={e=>setEditAccount({...editAccount, referenceNumber: Number(e.target.value)})} required/></div>
              <DialogFooter><Button type="button" variant="ghost" onClick={()=>setIsEditModalOpen(false)}>Cancel</Button><Button type="submit">Update</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ChartOfAccountsPage() {
  return <Suspense fallback={<div className="py-20 text-center text-sm text-muted-foreground">Loading chart of accounts...</div>}><ChartOfAccountsContent/></Suspense>;
}