import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '@/services/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconCash, IconCalendar, IconEyeOff, IconArrowRight, IconAlertTriangle, IconLoader2, IconInfoCircle } from '@tabler/icons-react';

export interface CashFlowLine { description: string; amount: number; }
export interface CashFlowStatementViewModel { operatingActivities: CashFlowLine[]; investingActivities: CashFlowLine[]; financingActivities: CashFlowLine[]; beginningCash: number; }

const formatNumber = (n:number) => { const f=new Intl.NumberFormat('id-ID',{style:'decimal',maximumFractionDigits:0}).format(Math.abs(n)); return n<0? `(${f})`: f; };

export default function StatementOfCashFlowPage() {
  const [noPeriod, setNoPeriod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [vm, setVm] = useState<CashFlowStatementViewModel>({ operatingActivities:[], investingActivities:[], financingActivities:[], beginningCash:0 });

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try{
      const {data}=await apiClient.get('/api/v1/reports/statement-of-cash-flow');
      if(data?.hasPeriodSelected===false){ setNoPeriod(true); return; }
      setNoPeriod(false);
      setVm({
        operatingActivities: data?.operatingActivities||[],
        investingActivities: data?.investingActivities||[],
        financingActivities: data?.financingActivities||[],
        beginningCash: Number(data?.beginningCash)||0,
      });
    }catch(err:any){ setError(err.response?.data?.message||err.message); } finally{ setLoading(false); }
  }, []);

  useEffect(()=>{ fetchData(); const h=()=>fetchData(); window.addEventListener('periodChanged',h); return()=>window.removeEventListener('periodChanged',h); }, [fetchData]);

  const netOperating = useMemo(()=> vm.operatingActivities.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.operatingActivities]);
  const netInvesting = useMemo(()=> vm.investingActivities.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.investingActivities]);
  const netFinancing = useMemo(()=> vm.financingActivities.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.financingActivities]);
  const netChange = netOperating + netInvesting + netFinancing;
  const endingCash = vm.beginningCash + netChange;

  if(loading) return <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2"><IconLoader2 className="animate-spin" size={16}/> Loading Cash Flow...</div>;

  const Section = ({title, lines, totalLabel, total}:{title:string, lines:CashFlowLine[], totalLabel:string, total:number}) => (
    <div className="space-y-2">
      <div className="text- font-bold tracking-widest text-amber-500 uppercase">{title}</div>
      {lines.length===0? <div className="text-xs text-muted-foreground italic pl-4">No {title.toLowerCase()}.</div> : lines.map((l,i)=><div key={i} className="flex items-center justify-between text-sm pl-4"><span>{l.description}</span><span className={`font-mono text-xs ${l.amount<0? 'text-red-500':'text-emerald-500'}`}>{formatNumber(l.amount)}</span></div>)}
      <div className="flex items-center justify-between font-semibold text-sm border-t pt-2"><span className="pl-4">{totalLabel}</span><span className={`font-mono ${total<0? 'text-red-500':'text-emerald-500'}`}>{formatNumber(total)}</span></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription>{error}</AlertDescription></Alert>}

      {noPeriod? (
        <Card className="py-16 text-center border-dashed"><CardContent className="space-y-3"><IconEyeOff size={36} className="mx-auto text-muted-foreground"/><h3 className="font-semibold">No Period Selected</h3><Button asChild size="sm"><Link to="/periods" className="gap-1.5"><IconCalendar size={14}/> Go to Periods</Link></Button></CardContent></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold flex items-center gap-2"><IconCash className="text-emerald-500" size={22}/> Cash Flow Statement</h1><p className="text-sm text-muted-foreground mt-1">Indirect method (IAS 7) • IDR</p></div><Button asChild variant="outline" size="sm" className="gap-1.5"><Link to="/reports/income-statement"><IconArrowRight size={14}/> Income Statement</Link></Button></div>

          <Card className="overflow-hidden"><CardContent className="p-4 space-y-6 divide-y">
            <Section title="Cash Flows from Operating Activities" lines={vm.operatingActivities} totalLabel="Net Cash from Operating" total={netOperating} />
            <div className="pt-6"><Section title="Cash Flows from Investing Activities" lines={vm.investingActivities} totalLabel="Net Cash from Investing" total={netInvesting} /></div>
            <div className="pt-6"><Section title="Cash Flows from Financing Activities" lines={vm.financingActivities} totalLabel="Net Cash from Financing" total={netFinancing} /></div>

            <div className="pt-6 space-y-2">
              <div className="flex items-center justify-between font-bold text-base"><span>Net Increase (Decrease) in Cash</span><span className={`font-mono ${netChange<0? 'text-red-500':'text-emerald-500'}`}>{formatNumber(netChange)}</span></div>
              <div className="flex items-center justify-between text-sm text-muted-foreground pl-3"><span>Cash, Beginning of Period</span><span className="font-mono">{formatNumber(vm.beginningCash)}</span></div>
              <div className="flex items-center justify-between font-bold text-base pt-2 border-t"><span className="text-sky-500">Cash, End of Period</span><span className="font-mono text-sky-500">{formatNumber(endingCash)}</span></div>
            </div>
          </CardContent></Card>

          <Alert className="bg-sky-500/10 border-sky-500/20"><IconInfoCircle size={16}/><AlertDescription className="text-xs">Prepared using Indirect Method per IAS 7.</AlertDescription></Alert>
        </>
      )}
    </div>
  );
}