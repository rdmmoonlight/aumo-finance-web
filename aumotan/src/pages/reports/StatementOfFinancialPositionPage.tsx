import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import apiClient from '@/services/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconBuildingBank, IconCalendar, IconEyeOff, IconArrowRight, IconAlertTriangle, IconLoader2, IconCircleCheck, IconAlertCircle } from '@tabler/icons-react';

export interface FinancialPositionLine { referenceNumber: number; accountName: string; amount: number; }
export interface StatementOfFinancialPositionViewModel { asOfDate: string; isPostClosing: boolean; assets: FinancialPositionLine[]; liabilities: FinancialPositionLine[]; equityExcludingRetainedEarnings: FinancialPositionLine[]; retainedEarningsEnding: number; }

const formatNumber = (n:number) => { const f=new Intl.NumberFormat('id-ID',{style:'decimal',maximumFractionDigits:0}).format(Math.abs(n)); return n<0? `(${f})`: f; };
const formatDateDisplay = (s?:string) =>!s? '': new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(s));

export default function StatementOfFinancialPositionPage() {
  const [noPeriod, setNoPeriod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [vm, setVm] = useState<StatementOfFinancialPositionViewModel>({ asOfDate:'', isPostClosing:false, assets:[], liabilities:[], equityExcludingRetainedEarnings:[], retainedEarningsEnding:0 });

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try{
      const {data}=await apiClient.get('/api/v1/reports/statement-of-financial-position');
      if(data?.hasPeriodSelected===false){ setNoPeriod(true); return; }
      const assetsList = data?.assetAccounts || data?.assets || [];
      const liabList = data?.liabilityAccounts || data?.liabilities || [];
      const rawEquity = data?.equityAccounts || data?.equityExcludingRetainedEarnings || [];
      const equityExcludingRE = rawEquity.filter((e:any)=> e.accountName!=='Retained Earnings');
      const reItem = rawEquity.find((e:any)=> e.accountName==='Retained Earnings');
      setNoPeriod(false);
      setVm({ asOfDate: data?.asOfDate||'', isPostClosing:!!data?.isPostClosing, assets: assetsList, liabilities: liabList, equityExcludingRetainedEarnings: equityExcludingRE, retainedEarningsEnding: reItem? Number(reItem.amount): Number(data?.retainedEarningsEnding)||0 });
    }catch(err:any){ setError(err.response?.data?.message||err.message); } finally{ setLoading(false); }
  }, []);

  useEffect(()=>{ fetchData(); const h=()=>fetchData(); window.addEventListener('periodChanged',h); return()=>window.removeEventListener('periodChanged',h); }, [fetchData]);

  const totalAssets = useMemo(()=> vm.assets.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.assets]);
  const totalLiabilities = useMemo(()=> vm.liabilities.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.liabilities]);
  const totalEquity = useMemo(()=> vm.equityExcludingRetainedEarnings.reduce((s,i)=>s+(Number(i.amount)||0),0) + vm.retainedEarningsEnding, [vm]);
  const totalLiabEquity = totalLiabilities + totalEquity;
  const isBalanced = Math.abs(totalAssets - totalLiabEquity) < 0.01;

  if(loading) return <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2"><IconLoader2 className="animate-spin" size={16}/> Loading Balance Sheet...</div>;

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription>{error}</AlertDescription></Alert>}

      {noPeriod? (
        <Card className="py-16 text-center border-dashed"><CardContent className="space-y-3"><IconEyeOff size={36} className="mx-auto text-muted-foreground"/><h3 className="font-semibold">No Period Selected</h3><Button asChild size="sm"><Link to="/periods" className="gap-1.5"><IconCalendar size={14}/> Go to Periods</Link></Button></CardContent></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold flex items-center gap-2"><IconBuildingBank className="text-sky-500" size={22}/> Statement of Financial Position</h1><p className="text-sm text-muted-foreground mt-1">As of {formatDateDisplay(vm.asOfDate)||'current period'} • IAS 1 • IDR</p></div><Button asChild variant="outline" size="sm" className="gap-1.5"><Link to="/reports/closing-journal"><IconArrowRight size={14}/> Closing Journal</Link></Button></div>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            {/* Assets */}
            <Card className="overflow-hidden"><CardHeader className="py-3 bg-muted/30 border-b"><CardTitle className="text- tracking-widest uppercase text-amber-500">Assets</CardTitle></CardHeader><CardContent className="p-0"><div className="divide-y text-sm">{vm.assets.length===0? <div className="p-4 text-xs text-muted-foreground italic">No assets.</div> : vm.assets.map((l,i)=><div key={i} className="flex items-center justify-between p-3 px-4"><span className="flex items-center gap-2"><Badge variant="outline" className="font-mono text-">{l.referenceNumber}</Badge>{l.accountName}</span><span className="font-mono text-xs">{formatNumber(l.amount)}</span></div>)}</div><div className="flex items-center justify-between p-4 border-t font-bold bg-muted/20"><span>Total Assets</span><span className="font-mono text-sky-500">{formatNumber(totalAssets)}</span></div></CardContent></Card>

            <div className="space-y-4">
              <Card className="overflow-hidden"><CardHeader className="py-3 bg-muted/30 border-b"><CardTitle className="text- tracking-widest uppercase text-amber-500">Liabilities</CardTitle></CardHeader><CardContent className="p-0"><div className="divide-y text-sm">{vm.liabilities.length===0? <div className="p-4 text-xs text-muted-foreground italic">No liabilities.</div> : vm.liabilities.map((l,i)=><div key={i} className="flex items-center justify-between p-3 px-4"><span className="flex items-center gap-2"><Badge variant="outline" className="font-mono text-">{l.referenceNumber}</Badge>{l.accountName}</span><span className="font-mono text-xs">{formatNumber(l.amount)}</span></div>)}</div><div className="flex items-center justify-between p-4 border-t font-semibold"><span>Total Liabilities</span><span className="font-mono">{formatNumber(totalLiabilities)}</span></div></CardContent></Card>

              <Card className="overflow-hidden"><CardHeader className="py-3 bg-muted/30 border-b"><CardTitle className="text- tracking-widest uppercase text-amber-500">Equity</CardTitle></CardHeader><CardContent className="p-0"><div className="divide-y text-sm">{vm.equityExcludingRetainedEarnings.map((l,i)=><div key={i} className="flex items-center justify-between p-3 px-4"><span className="flex items-center gap-2"><Badge variant="outline" className="font-mono text-">{l.referenceNumber}</Badge>{l.accountName}</span><span className="font-mono text-xs">{formatNumber(l.amount)}</span></div>)}<div className="flex items-center justify-between p-3 px-4"><span>Retained earnings, {formatDateDisplay(vm.asOfDate)}</span><span className="font-mono text-xs">{formatNumber(vm.retainedEarningsEnding)}</span></div></div><div className="flex items-center justify-between p-4 border-t font-semibold"><span>Total Equity</span><span className="font-mono">{formatNumber(totalEquity)}</span></div></CardContent></Card>

              <Card className="bg-primary/5 border-primary/20"><CardContent className="p-4 flex items-center justify-between font-bold text-base"><span>Total Liabilities & Equity</span><span className="font-mono text-sky-500">{formatNumber(totalLiabEquity)}</span></CardContent></Card>
            </div>
          </div>

          <Alert className={isBalanced? 'bg-emerald-500/10 border-emerald-500/20':'bg-red-500/10 border-red-500/20'}>{isBalanced? <IconCircleCheck size={16} className="text-emerald-500"/>: <IconAlertCircle size={16} className="text-red-500"/>}<AlertDescription className="text-xs">{isBalanced? 'Total Assets = Total Liabilities + Equity. Balanced.': 'Total Assets ≠ Total Liabilities + Equity. Check journal entries.'}</AlertDescription></Alert>
        </>
      )}
    </div>
  );
}