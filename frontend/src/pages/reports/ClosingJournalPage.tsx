import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import apiClient from '@/services/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconLock, IconArrowRight, IconEyeOff, IconInfoCircle, IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';

export interface ClosingJournalLine { referenceNumber?: number; accountName: string; debit: number; credit: number; }
export interface ClosingJournalEntryGroup { description: string; lines: ClosingJournalLine[]; }
export interface ClosingJournalViewModel { netIncome: number; retainedEarningsAccountName: string; groups: ClosingJournalEntryGroup[]; }

const formatNumber = (amount: number) => {
  const formatted = new Intl.NumberFormat('id-ID',{style:'decimal',maximumFractionDigits:0}).format(Math.abs(amount));
  return amount<0? `(${formatted})`: formatted;
};

export default function ClosingJournalReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string|null>(null);
  const [vm, setVm] = useState<ClosingJournalViewModel>({ netIncome: 0, retainedEarningsAccountName: 'Retained Earnings', groups: [] });

  const fetchData = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try{
      const {data}=await apiClient.get('/api/v1/reports/closing-journal');
      if(data?.hasPeriodSelected===false){ setNoPeriodSelected(true); setVm({netIncome:0,retainedEarningsAccountName:'Retained Earnings',groups:[]}); return; }
      const cjData=data?.closingJournal||data; const rawGroups=Array.isArray(cjData?.groups)? cjData.groups:[];
      const safeGroups=rawGroups.map((g:any)=>({description:g.description||'Closing Entry', lines:Array.isArray(g.lines)? g.lines:[]}));
      setNoPeriodSelected(false); setVm({netIncome:Number(cjData?.netIncome)||0, retainedEarningsAccountName: cjData?.retainedEarningsAccountName||'Retained Earnings', groups: safeGroups});
    }catch(err:any){ setErrorMessage(err.response?.data?.message||err.message||'Failed to connect'); } finally{ setLoading(false); }
  }, []);

  useEffect(()=>{ fetchData(); const h=()=>fetchData(); window.addEventListener('periodChanged',h); return()=>window.removeEventListener('periodChanged',h); }, [fetchData]);

  const groupTotals = useMemo(()=> vm.groups.map(g=>{
    const lines=g.lines||[]; const totalDebit=lines.reduce((s,l)=>s+(Number(l.debit)||0),0); const totalCredit=lines.reduce((s,l)=>s+(Number(l.credit)||0),0); return {totalDebit,totalCredit};
  }), [vm.groups]);

  if(loading) return <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2"><IconLoader2 className="animate-spin" size={16}/> Loading closing entries...</div>;

  return (
    <div className="space-y-6">
      {errorMessage && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription>{errorMessage}</AlertDescription></Alert>}

      {noPeriodSelected? (
        <Card className="py-16 text-center border-dashed"><CardContent className="space-y-3"><IconEyeOff size={36} className="mx-auto text-muted-foreground"/><h3 className="font-semibold">No Period Selected</h3><p className="text-sm text-muted-foreground">This report follows whichever period you're viewing.</p><Button asChild size="sm"><Link to="/periods" className="gap-1.5"><IconEyeOff size={14}/> Go to Periods</Link></Button></CardContent></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold flex items-center gap-2"><IconLock className="text-amber-500" size={22}/> Closing Journal</h1><p className="text-sm text-muted-foreground mt-1 max-w-3xl">Closing entries are calculated automatically based on current nominal account balances — not yet posted to General Journal (In IDR).</p></div><Button asChild variant="outline" size="sm" className="gap-1.5"><Link to="/reports/post-closing-trial-balance"><IconArrowRight size={14}/> Post-Closing Trial Balance</Link></Button></div>

          {vm.groups.length===0 && <Alert><IconInfoCircle size={16}/><AlertDescription>There are no nominal accounts with balances to close.</AlertDescription></Alert>}

          {vm.groups.map((group,gIdx)=>{
            const totals=groupTotals[gIdx];
            return <Card key={gIdx} className="overflow-hidden"><CardHeader className="py-3 bg-muted/30 border-b"><CardTitle className="text-sm">{group.description}</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow className="text-"><TableHead className="text-center pl-6 w-[15%]">Ref.</TableHead><TableHead className="w-[45%]">Account</TableHead><TableHead className="text-right w-[20%]">Debit</TableHead><TableHead className="text-right pr-6 w-[20%]">Credit</TableHead></TableRow></TableHeader><TableBody>{group.lines.map((line,lIdx)=><TableRow key={lIdx}><TableCell className="text-center pl-6"><Badge variant="outline" className="font-mono text- text-amber-500">{line.referenceNumber&&line.referenceNumber>0? line.referenceNumber:'-'}</Badge></TableCell><TableCell className={`text-xs ${line.credit>0? 'pl-6 text-muted-foreground':'font-medium'}`}>{line.accountName}</TableCell><TableCell className="text-right font-mono text-xs text-emerald-500">{line.debit>0? formatNumber(line.debit):'-'}</TableCell><TableCell className="text-right pr-6 font-mono text-xs text-red-500">{line.credit>0? formatNumber(line.credit):'-'}</TableCell></TableRow>)}</TableBody><TableFooter><TableRow className="font-bold"><TableCell colSpan={2} className="text-right pl-6 text-xs">Total</TableCell><TableCell className="text-right font-mono text-xs text-emerald-500">{formatNumber(totals?.totalDebit||0)}</TableCell><TableCell className="text-right pr-6 font-mono text-xs text-red-500">{formatNumber(totals?.totalCredit||0)}</TableCell></TableRow></TableFooter></Table></CardContent></Card>
          })}

          {vm.groups.length>0 && <Alert className="bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-300"><IconInfoCircle size={16}/><AlertDescription className="text-xs">After closing, all nominal accounts will have zero balance and Net Income of <strong>{formatNumber(vm.netIncome)}</strong> will transfer to <strong>{vm.retainedEarningsAccountName}</strong>.</AlertDescription></Alert>}
        </>
      )}
    </div>
  );
}