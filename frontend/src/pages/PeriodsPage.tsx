import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCalendar, IconCalendarPlus, IconEye, IconEyeOff, IconPlus, IconLock, IconLockOpen, IconArrowLeft, IconCheck, IconAlertTriangle, IconX, IconInfoCircle, IconRefresh, IconCirclePlus, IconCalendarOff, IconLoader2 } from '@tabler/icons-react';
import apiClient from '@/services/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';


export interface AccountingPeriod { id: number; periodName: string; startDate: string; endDate: string; isClosed: boolean; }
interface AccountOption { id: string; displayLabel: string; }
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PeriodsPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list'|'create'>('list');
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number|null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string|null>(null);
  const [successMessage, setSuccessMessage] = useState<string|null>(null);
  const [month, setMonth] = useState(new Date().getMonth()+1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [setupMode, setSetupMode] = useState<'LoadExisting'|'CreateNew'>('LoadExisting');
  const [hasExisting, setHasExisting] = useState(false);
  const [availableCash, setAvailableCash] = useState<AccountOption[]>([]);
  const [availableRetained, setAvailableRetained] = useState<AccountOption[]>([]);
  const [cashAccountId, setCashAccountId] = useState(''); const [bankAccountId, setBankAccountId] = useState(''); const [retainedId, setRetainedId] = useState('');
  const [cashAccountCode, setCashAccountCode] = useState('101'); const [cashAccountName, setCashAccountName] = useState('Cash on Hand'); const [cashBalance, setCashBalance] = useState<number|''>('');
  const [bankAccountCode, setBankAccountCode] = useState('102'); const [bankAccountName, setBankAccountName] = useState('Bank Account'); const [bankBalance, setBankBalance] = useState<number|''>('');
  const [retainedCode, setRetainedCode] = useState('301'); const [retainedName, setRetainedName] = useState('Retained Earnings');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAll = async () => {
    setLoading(true); setErrorMessage(null);
    try {
      const { data: periodsRaw } = await apiClient.get(`/api/v1/periods`);
      const periodsData: AccountingPeriod[] = Array.isArray(periodsRaw)? periodsRaw : periodsRaw?.periods || periodsRaw?.data || [];
      setPeriods(periodsData);
      setSelectedPeriodId(periodsRaw?.selectedPeriodId || periodsData.find(p=>!p.isClosed)?.id || periodsData[0]?.id || null);

      const { data: info } = await apiClient.get(`/api/v1/periods/open-info`);
      const cashBankOptions = (info.availableCashAndBankAccounts||[]).map((acc:any)=>({ id:acc.id.toString(), displayLabel:acc.displayLabel||`${acc.referenceNumber} - ${acc.accountName}` }));
      const retainedOptions = (info.availableRetainedEarningsAccounts||[]).map((acc:any)=>({ id:acc.id.toString(), displayLabel:acc.displayLabel||`${acc.referenceNumber} - ${acc.accountName}` }));
      setAvailableCash(cashBankOptions); setAvailableRetained(retainedOptions);
      const exists = info.hasExistingPermanentAccounts?? (cashBankOptions.length>0 && retainedOptions.length>0);
      setHasExisting(exists); setSetupMode(exists?'LoadExisting':'CreateNew');
      if(exists){ setCashAccountId(cashBankOptions[0]?.id||''); setBankAccountId(cashBankOptions[1]?.id||cashBankOptions[0]?.id||''); setRetainedId(retainedOptions[0]?.id||''); }
    } catch (err:any){ if(err.response?.status===401) navigate('/auth'); setErrorMessage(err.response?.data?.message||'Failed to connect'); } finally { setLoading(false); }
  };

  useEffect(()=>{ fetchAll(); }, []);

  const selectPeriod = async (p:AccountingPeriod) => {
    setSelectedPeriodId(p.id);
    try { await apiClient.post(`/api/v1/periods/select/${p.id}`); setSuccessMessage(`Viewing ${p.periodName}`); window.dispatchEvent(new Event('periodChanged')); } catch (err:any){ setErrorMessage(err.response?.data?.message||'Failed'); }
  };
  const clearSelection = async () => { try{ await apiClient.post(`/api/v1/periods/clear-selection`);}catch{} finally{ setSelectedPeriodId(null); setSuccessMessage('No period selected'); window.dispatchEvent(new Event('periodChanged')); } };
  const closePeriod = async (p:AccountingPeriod) => {
    if(!confirm(`Close ${p.periodName}?`)) return; if(p.isClosed){ setErrorMessage('Already closed'); return; }
    try { await apiClient.post(`/api/v1/periods/close/${p.id}`); setPeriods(prev=>prev.map(x=>x.id===p.id? {...x,isClosed:true}:x)); setSuccessMessage(`${p.periodName} closed`); window.dispatchEvent(new Event('periodChanged')); } catch(err:any){ setErrorMessage(err.response?.data?.message||'Failed'); }
  };
  const handleCreate = async (e:React.FormEvent) => {
    e.preventDefault(); setErrorMessage(null);
    if(setupMode==='LoadExisting' && (!cashAccountId||!bankAccountId||!retainedId)){ setErrorMessage('Select Cash, Bank, Retained'); return; }
    if(setupMode==='LoadExisting' && cashAccountId===bankAccountId){ setErrorMessage('Cash and Bank cannot same'); return; }
    setIsSubmitting(true);
    try {
      const payload = { month, year, setupMode, cashAccountId: setupMode==='LoadExisting'? parseInt(cashAccountId,10):null, bankAccountId: setupMode==='LoadExisting'? parseInt(bankAccountId,10):null, retainedEarningsAccountId: setupMode==='LoadExisting'? parseInt(retainedId,10):null, cashAccountCode: setupMode==='CreateNew'? cashAccountCode:null, cashAccountName: setupMode==='CreateNew'? cashAccountName:null, cashBalance: setupMode==='CreateNew'? (Number(cashBalance)||0):null, bankAccountCode: setupMode==='CreateNew'? bankAccountCode:null, bankAccountName: setupMode==='CreateNew'? bankAccountName:null, bankBalance: setupMode==='CreateNew'? (Number(bankBalance)||0):null, retainedEarningsAccountCode: setupMode==='CreateNew'? retainedCode:null, retainedEarningsAccountName: setupMode==='CreateNew'? retainedName:null };
      const { data } = await apiClient.post(`/api/v1/periods`, payload);
      setSuccessMessage(data?.message||'Period opened'); setViewMode('list'); fetchAll(); window.dispatchEvent(new Event('periodChanged'));
    } catch(err:any){ setErrorMessage(err.response?.data?.message||'Failed create'); } finally{ setIsSubmitting(false); }
  };

  const totalOpening = (Number(cashBalance)||0)+(Number(bankBalance)||0);

  return (
    <div className="space-y-6 max-w-5xl">
      {errorMessage && <Alert variant="destructive" className="flex justify-between"><AlertDescription className="flex items-center gap-2"><IconAlertTriangle size={16}/>{errorMessage}</AlertDescription><button onClick={()=>setErrorMessage(null)}><IconX size={14}/></button></Alert>}
      {successMessage && <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex justify-between"><AlertDescription>{successMessage}</AlertDescription><button onClick={()=>setSuccessMessage(null)}><IconX size={14}/></button></Alert>}

      {viewMode==='list'? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-xl font-bold flex items-center gap-2"><IconCalendar className="text-primary" size={22}/> Accounting Periods</h1><p className="text-sm text-muted-foreground mt-1">Click <IconEye size={14} className="inline"/> to view period - whole app follows it</p></div><div className="flex gap-2">{selectedPeriodId!==null && <Button variant="outline" size="sm" className="gap-1.5" onClick={clearSelection}><IconEyeOff size={14}/> Stop Viewing</Button>}<Button size="sm" className="gap-1.5" onClick={()=>setViewMode('create')}><IconPlus size={14}/> Open New Period</Button></div></div>
          <Card><CardHeader className="flex-row items-center justify-between space-y-0 py-3"><CardTitle className="text-sm">Period List</CardTitle><Badge variant="secondary" className="font-mono text-xs">{periods.length} total</Badge></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow className="text-"><TableHead className="pl-6">Period Name</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-center pr-6">Action</TableHead></TableRow></TableHeader><TableBody>
            {loading? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><IconLoader2 className="animate-spin inline mr-2" size={16}/> Loading...</TableCell></TableRow> : periods.map(p=>{ const isSelected=selectedPeriodId===p.id; return <TableRow key={p.id} className={isSelected?'bg-muted/50':''}><TableCell className="pl-6 font-bold flex items-center gap-2">{p.periodName}{isSelected&&<Badge className="gap-1 bg-primary/15 text-primary border-primary/20 text-"><IconEye size={10}/> Viewing</Badge>}</TableCell><TableCell className="text-xs">{p.startDate}</TableCell><TableCell className="text-xs">{p.endDate}</TableCell><TableCell className="text-center">{p.isClosed? <Badge variant="secondary" className="gap-1 text-"><IconLock size={10}/> Closed</Badge>: <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-"><IconLockOpen size={10}/> Active</Badge>}</TableCell><TableCell className="text-center pr-6"><div className="flex justify-center gap-1"><Button variant={isSelected?'secondary':'outline'} size="icon" className="h-7 w-7" onClick={()=>selectPeriod(p)}><IconEye size={14}/></Button>{!p.isClosed&&<Button variant="outline" size="icon" className="h-7 w-7 text-amber-600" onClick={()=>closePeriod(p)}><IconLock size={14}/></Button>}</div></TableCell></TableRow>})}
            {!loading && periods.length===0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground"><IconCalendarOff className="mx-auto mb-2" size={28}/><p className="font-medium">No periods yet</p><p className="text-xs">Click Open New Period to start</p></TableCell></TableRow>}
          </TableBody></Table></CardContent></Card>
        </>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between"><div><h1 className="text-xl font-bold flex items-center gap-2"><IconCalendarPlus className="text-primary" size={22}/> Open New Period</h1><p className="text-sm text-muted-foreground">Start monthly cycle. Opening balance posted on day 1.</p></div><Button variant="outline" size="sm" className="gap-1.5" onClick={()=>setViewMode('list')}><IconArrowLeft size={14}/> Back</Button></div>
          <form onSubmit={handleCreate} className="space-y-6">
            <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Period</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-1.5"><Label>Month</Label><Select value={String(month)} onValueChange={v=>setMonth(Number(v))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{MONTH_NAMES.map((n,i)=><SelectItem key={i+1} value={String(i+1)}>{n}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Year</Label><Input type="number" value={year} onChange={e=>setYear(Number(e.target.value))} required/></div></CardContent></Card>

            <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Permanent Accounts Setup</CardTitle><CardDescription>Choose existing or create new</CardDescription></CardHeader><CardContent className="space-y-4">
              <RadioGroup value={setupMode} onValueChange={(v:any)=>setSetupMode(v)} className="flex gap-4"><div className="flex items-center gap-2"><RadioGroupItem value="LoadExisting" id="load" disabled={!hasExisting}/><Label htmlFor="load" className="flex items-center gap-1 text-xs cursor-pointer"><IconRefresh size={12}/> Use Existing</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="CreateNew" id="create"/><Label htmlFor="create" className="flex items-center gap-1 text-xs cursor-pointer"><IconCirclePlus size={12}/> Register New</Label></div></RadioGroup>
              {!hasExisting && <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-300"><IconInfoCircle size={16}/><AlertDescription className="text-xs">No existing Cash/Bank & Retained accounts found - new accounts required</AlertDescription></Alert>}

              {setupMode==='LoadExisting'? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="space-y-1.5"><Label>Cash Account</Label><Select value={cashAccountId} onValueChange={setCashAccountId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{availableCash.map(a=><SelectItem key={a.id} value={a.id}>{a.displayLabel}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Bank Account</Label><Select value={bankAccountId} onValueChange={setBankAccountId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{availableCash.map(a=><SelectItem key={a.id} value={a.id}>{a.displayLabel}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Retained Earnings</Label><Select value={retainedId} onValueChange={setRetainedId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{availableRetained.map(a=><SelectItem key={a.id} value={a.id}>{a.displayLabel}</SelectItem>)}</SelectContent></Select></div></div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-3"><div className="col-span-3 space-y-1"><Label className="text-xs">Cash Ref #</Label><Input value={cashAccountCode} onChange={e=>setCashAccountCode(e.target.value)}/></div><div className="col-span-5 space-y-1"><Label className="text-xs">Cash Name</Label><Input value={cashAccountName} onChange={e=>setCashAccountName(e.target.value)}/></div><div className="col-span-4 space-y-1"><Label className="text-xs">Cash Opening</Label><Input type="number" value={cashBalance} onChange={e=>setCashBalance(e.target.value===''?'':Number(e.target.value))}/></div></div>
                  <div className="grid grid-cols-12 gap-3"><div className="col-span-3 space-y-1"><Label className="text-xs">Bank Ref #</Label><Input value={bankAccountCode} onChange={e=>setBankAccountCode(e.target.value)}/></div><div className="col-span-5 space-y-1"><Label className="text-xs">Bank Name</Label><Input value={bankAccountName} onChange={e=>setBankAccountName(e.target.value)}/></div><div className="col-span-4 space-y-1"><Label className="text-xs">Bank Opening</Label><Input type="number" value={bankBalance} onChange={e=>setBankBalance(e.target.value===''?'':Number(e.target.value))}/></div></div>
                  <Alert className="bg-primary/10 border-primary/20"><IconInfoCircle size={16}/><AlertDescription className="text-xs">Opening credit to Retained Earnings will be: <strong>Rp {totalOpening.toLocaleString('id-ID')}</strong></AlertDescription></Alert>
                </div>
              )}
            </CardContent></Card>

            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setViewMode('list')}>Cancel</Button><Button type="submit" disabled={isSubmitting} className="gap-1.5">{isSubmitting? <IconLoader2 className="animate-spin" size={14}/> : <IconCheck size={14}/>} Open Period</Button></div>
          </form>
        </div>
      )}
    </div>
  );
}