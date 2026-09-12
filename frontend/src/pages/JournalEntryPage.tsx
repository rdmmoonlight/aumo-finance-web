import { useState, useEffect, useMemo, Suspense } from 'react';
import { Link } from '@tanstack/react-router';
import { useNavigate, useSearchParams } from '@/hooks/useCompatRouter';
import {
  IconEdit, IconNotebook, IconArrowLeft, IconCircleCheck, IconAlertTriangle, IconLock, IconPlus, IconTrash, IconDeviceFloppy, IconLoader2,
} from '@tabler/icons-react';
import apiClient from '@/services/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';


export interface ChartOfAccountOption { id: number; referenceNumber: number; accountName: string; }
export interface LineItem { id: string; accountId: number; lineDescription: string; debit: string; credit: string; }

const formatIDR = (amount: number) => new Intl.NumberFormat('id-ID').format(amount);
const formatNumberWithDots = (val: string | number): string => {
  if (!val) return ''; const clean = val.toString().replace(/\D/g,''); if(!clean) return ''; return new Intl.NumberFormat('id-ID').format(parseInt(clean,10));
};
const parseFormattedNumber = (val: string): number => { if(!val) return 0; const clean = val.replace(/\D/g,''); return clean? parseInt(clean,10):0; };
const generateTxNumber = (type: string, dateStr: string) => {
  const prefix = type==='Adjusting'? 'AJ':'GJ'; const d = dateStr? new Date(dateStr): new Date(); const yy=d.getFullYear().toString().slice(-2); const mm=(d.getMonth()+1).toString().padStart(2,'0'); return `${prefix}${yy}${mm}0001`;
};

function JournalEntryContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entryIdParam = searchParams.get('id');
  const isEdit = Boolean(entryIdParam);

  const [journalType, setJournalType] = useState('General');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionNumber, setTransactionNumber] = useState('');
  const [availableAccounts, setAvailableAccounts] = useState<ChartOfAccountOption[]>([]);
  const [lines, setLines] = useState<LineItem[]>([
    { id: '1', accountId: 0, lineDescription: '', debit: '', credit: '' },
    { id: '2', accountId: 0, lineDescription: '', debit: '', credit: '' },
  ]);
  const [successMessage, setSuccessMessage] = useState<string|null>(null);
  const [lockedMessage, setLockedMessage] = useState<string|null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const resetForm = () => {
    const defaultDate = new Date().toISOString().split('T')[0];
    setJournalType('General'); setEntryDate(defaultDate); setTransactionNumber(generateTxNumber('General', defaultDate));
    setLines([{ id: Date.now()+'-1', accountId: 0, lineDescription: '', debit: '', credit: '' },{ id: Date.now()+'-2', accountId: 0, lineDescription: '', debit: '', credit: '' }]);
    setValidationErrors([]); setSuccessMessage(null);
  };

  useEffect(()=>{ if(!isEdit) setTransactionNumber(generateTxNumber(journalType, entryDate)); }, [journalType, entryDate, isEdit]);

  useEffect(()=>{
    const init = async () => {
      setLoading(true);
      try {
        const { data: accRes } = await apiClient.get(`/api/v1/chart-of-accounts`);
        const accountsData = Array.isArray(accRes)? accRes : accRes?.accounts || accRes?.data || [];
        setAvailableAccounts(accountsData.map((a:any)=>({ id:a.id, referenceNumber:a.referenceNumber, accountName:a.accountName })));

        if (isEdit && entryIdParam) {
          const { data: jData } = await apiClient.get(`/api/v1/journals/${entryIdParam}`);
          if (jData.isClosedPeriod) {
            setLockedMessage(`Journal ${jData.transactionNumber} is in closed period`);
          } else {
            setTransactionNumber(jData.transactionNumber); setJournalType(jData.journalType||'General'); setEntryDate(jData.entryDate?.split('T')[0]||new Date().toISOString().split('T')[0]);
            const rawLines = jData.lines||[]; if(rawLines.length) setLines(rawLines.map((l:any,i:number)=>({ id:l.id?.toString()||`${Date.now()}-${i}`, accountId:l.accountId, lineDescription:l.lineDescription||'', debit:l.debit>0?formatNumberWithDots(l.debit):'', credit:l.credit>0?formatNumberWithDots(l.credit):'' })));
          }
        } else { resetForm(); }
      } catch (err:any){ setValidationErrors([err?.response?.data?.message||'Failed to load']); } finally { setLoading(false); }
    }; init();
  }, [isEdit, entryIdParam]);

  const totalDebit = useMemo(()=> lines.reduce((s,l)=>s+parseFormattedNumber(l.debit),0), [lines]);
  const totalCredit = useMemo(()=> lines.reduce((s,l)=>s+parseFormattedNumber(l.credit),0), [lines]);
  const isBalanced = useMemo(()=> totalDebit>0 && totalDebit===totalCredit, [totalDebit, totalCredit]);

  const addLine = () => setLines(prev=>[...prev, { id:`${Date.now()}-${Math.random()}`, accountId:0, lineDescription:'', debit:'', credit:'' }]);
  const removeLine = (id:string) => { if(lines.length<=2){ alert('Min 2 lines'); return;} setLines(prev=>prev.filter(l=>l.id!==id)); };
  const updateLine = (id:string, field: keyof LineItem, value:any) => {
    setLines(prev=>prev.map(l=>{
      if(l.id!==id) return l;
      if(field==='debit' && value!=='') return {...l, debit:formatNumberWithDots(value), credit:''};
      if(field==='credit' && value!=='') return {...l, credit:formatNumberWithDots(value), debit:''};
      return {...l, [field]:value};
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setValidationErrors([]); setSuccessMessage(null);
    const effective = lines.filter(l=>l.accountId!==0 && (parseFormattedNumber(l.debit)>0 || parseFormattedNumber(l.credit)>0));
    if(effective.length<2){ setValidationErrors(['Min 2 valid lines']); return; }
    if(!isBalanced){ setValidationErrors(['Debit must equal Credit']); return; }
    try {
      const payload = { journalType, entryDate, transactionNumber, lines: effective.map(l=>({ accountId:l.accountId, lineDescription:l.lineDescription, debit:parseFormattedNumber(l.debit), credit:parseFormattedNumber(l.credit) })) };
      const endpoint = isEdit? `/api/v1/journals/${entryIdParam}`: `/api/v1/journals`;
      const res = isEdit? await apiClient.put(endpoint, payload): await apiClient.post(endpoint, payload);
      if(isEdit){ setSuccessMessage(`Updated ${transactionNumber}`); setTimeout(()=>navigate({ to: '/reports/general-journal' }),1200); }
      else { setSuccessMessage(`Posted ${res.data?.transactionNumber||transactionNumber}`); resetForm(); }
    } catch (err:any){ setValidationErrors([err?.response?.data?.message||'Failed to post']); }
  };

  if(loading) return <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground"><IconLoader2 className="h-8 w-8 animate-spin text-primary"/><span className="text-sm">Loading...</span></div>;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">{isEdit?<IconEdit className="text-primary"/>:<IconNotebook className="text-primary"/>}{isEdit?'Edit Journal Entry':'Create Journal Entry'}{isEdit&&<Badge variant="secondary" className="font-mono text-xs">{transactionNumber}</Badge>}</h2><p className="text-sm text-muted-foreground mt-1">Record double-entry transactions</p></div>
        <Button variant="outline" size="sm" asChild><Link to="/reports/general-journal" className="gap-1.5"><IconArrowLeft size={14}/> Back to Journal</Link></Button>
      </div>

      {successMessage && <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300"><IconCircleCheck size={16}/><AlertDescription>{successMessage}</AlertDescription></Alert>}
      {validationErrors.length>0 && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription><ul className="list-disc ml-4">{validationErrors.map((e,i)=><li key={i}>{e}</li>)}</ul></AlertDescription></Alert>}
      {lockedMessage? <Alert><IconLock size={16}/><AlertDescription>{lockedMessage} <Link to="/reports/general-journal" className="underline">Back</Link></AlertDescription></Alert> : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Transaction Info</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5"><label className="text-xs font-medium">Transaction No.</label><Input className="h-9 font-mono bg-muted" value={transactionNumber} readOnly/></div>
            <div className="space-y-1.5"><label className="text-xs font-medium">Journal Type</label><Select value={journalType} onValueChange={setJournalType}><SelectTrigger className="h-9"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="General">General Journal (GJ)</SelectItem><SelectItem value="Adjusting">Adjusting Entry (AJ)</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><label className="text-xs font-medium">Date</label><Input type="date" className="h-9" value={entryDate} onChange={e=>setEntryDate(e.target.value)} required/></div>
          </CardContent></Card>

          <Card className="overflow-hidden"><CardHeader className="py-3 flex-row items-center justify-between space-y-0"><CardTitle className="text-sm">Journal Lines</CardTitle><Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addLine}><IconPlus size={12}/> Add Line</Button></CardHeader><CardContent className="p-0">
            <Table><TableHeader><TableRow className="text-"><TableHead className="w-[10%]">Ref</TableHead><TableHead className="w-[28%]">Account</TableHead><TableHead>Description</TableHead><TableHead className="text-right w-[15%]">Debit</TableHead><TableHead className="text-right w-[15%]">Credit</TableHead><TableHead className="w-[5%]"></TableHead></TableRow></TableHeader><TableBody>
              {lines.map(line=>{
                const ref = availableAccounts.find(a=>a.id===line.accountId)?.referenceNumber;
                return <TableRow key={line.id}><TableCell><Input className="h-8 text-center text-xs bg-muted" readOnly value={ref||''} placeholder="---"/></TableCell>
                <TableCell><Select value={String(line.accountId)} onValueChange={v=>updateLine(line.id,'accountId',Number(v))}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Account"/></SelectTrigger><SelectContent>{availableAccounts.map(acc=><SelectItem key={acc.id} value={String(acc.id)} className="text-xs">{acc.referenceNumber} - {acc.accountName}</SelectItem>)}</SelectContent></Select></TableCell>
                <TableCell><Input className="h-8 text-xs" placeholder="Note..." value={line.lineDescription} onChange={e=>updateLine(line.id,'lineDescription',e.target.value)}/></TableCell>
                <TableCell><Input className="h-8 text-xs text-right font-mono" placeholder="0" value={line.debit} onChange={e=>updateLine(line.id,'debit',e.target.value)}/></TableCell>
                <TableCell><Input className="h-8 text-xs text-right font-mono" placeholder="0" value={line.credit} onChange={e=>updateLine(line.id,'credit',e.target.value)}/></TableCell>
                <TableCell><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={()=>removeLine(line.id)}><IconTrash size={14}/></Button></TableCell></TableRow>
              })}
            </TableBody>
            <TableFooter><TableRow><TableCell colSpan={3} className="text-right font-medium">Total:</TableCell><TableCell className="text-right font-mono text-emerald-500">Rp {formatIDR(totalDebit)}</TableCell><TableCell className="text-right font-mono text-red-500">Rp {formatIDR(totalCredit)}</TableCell><TableCell/></TableRow>
            <TableRow><TableCell colSpan={3} className="text-right">Status:</TableCell><TableCell colSpan={2} className="text-center">{isBalanced? <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 gap-1"><IconCircleCheck size={12}/> Balanced</Badge>: <Badge variant="destructive" className="gap-1 bg-red-500/15 text-red-500 border-red-500/20"><IconAlertTriangle size={12}/> Unbalanced Rp {formatIDR(Math.abs(totalDebit-totalCredit))}</Badge>}</TableCell><TableCell/></TableRow></TableFooter>
            </Table>
          </CardContent></Card>

          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={resetForm}>Reset</Button><Button type="submit" disabled={!isBalanced} className="gap-2"><IconDeviceFloppy size={16}/>{isEdit?'Save Changes':'Post Journal Entry'}</Button></div>
        </form>
      )}
    </div>
  );
}

export default function JournalEntryPage() {
  return <Suspense fallback={<div className="py-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><IconLoader2 className="animate-spin" size={16}/> Loading...</div>}><JournalEntryContent/></Suspense>;
}