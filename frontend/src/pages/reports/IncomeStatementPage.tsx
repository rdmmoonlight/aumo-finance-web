import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '@/services/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconTrendingUp, IconCalendar, IconEyeOff, IconArrowRight, IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';

export interface IncomeStatementLine { referenceNumber: number; accountName: string; amount: number; }
export interface IncomeStatementViewModel { asOfDate: string; revenues: IncomeStatementLine[]; operatingExpenses: IncomeStatementLine[]; otherIncome: IncomeStatementLine[]; otherExpenses: IncomeStatementLine[]; }

const formatNumber = (n:number) => {
  const f = new Intl.NumberFormat('id-ID',{style:'decimal',maximumFractionDigits:0}).format(Math.abs(n));
  return n<0? `(${f})`: f;
};

export default function IncomeStatementPage() {
  const [noPeriod, setNoPeriod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [vm, setVm] = useState<IncomeStatementViewModel>({ asOfDate:'', revenues:[], operatingExpenses:[], otherIncome:[], otherExpenses:[] });

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try{
      const {data}=await apiClient.get('/api/v1/reports/income-statement');
      if(data?.hasPeriodSelected===false){ setNoPeriod(true); return; }
      setNoPeriod(false);
      setVm({
        asOfDate: data?.asOfDate||'',
        revenues: data?.revenueAccounts || data?.revenues || [],
        operatingExpenses: data?.expenseAccounts || data?.operatingExpenses || [],
        otherIncome: data?.otherIncomeAccounts || data?.otherIncome || [],
        otherExpenses: data?.otherExpenseAccounts || data?.otherExpenses || [],
      });
    }catch(err:any){ setError(err.response?.data?.message||err.message); } finally{ setLoading(false); }
  }, []);

  useEffect(()=>{ fetchData(); const h=()=>fetchData(); window.addEventListener('periodChanged',h); return()=>window.removeEventListener('periodChanged',h); }, [fetchData]);

  const totalRevenue = useMemo(()=> vm.revenues.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.revenues]);
  const totalOpex = useMemo(()=> vm.operatingExpenses.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.operatingExpenses]);
  const operatingIncome = totalRevenue - totalOpex;
  const totalOtherIncome = useMemo(()=> vm.otherIncome.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.otherIncome]);
  const totalOtherExpenses = useMemo(()=> vm.otherExpenses.reduce((s,i)=>s+(Number(i.amount)||0),0), [vm.otherExpenses]);
  const netIncome = operatingIncome + totalOtherIncome - totalOtherExpenses;

  if(loading) return <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2"><IconLoader2 className="animate-spin" size={16}/> Loading Income Statement...</div>;

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription>{error}</AlertDescription></Alert>}

      {noPeriod? (
        <Card className="py-16 text-center border-dashed"><CardContent className="space-y-3"><IconEyeOff size={36} className="mx-auto text-muted-foreground"/><h3 className="font-semibold">No Period Selected</h3><p className="text-sm text-muted-foreground">This report follows whichever period you're viewing.</p><Button asChild size="sm"><Link to="/periods" className="gap-1.5"><IconCalendar size={14}/> Go to Periods</Link></Button></CardContent></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold flex items-center gap-2"><IconTrendingUp className="text-emerald-500" size={22}/> Income Statement</h1><p className="text-sm text-muted-foreground mt-1">Profit or Loss (IAS 1) for {vm.asOfDate? new Date(vm.asOfDate).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'current period'} • IDR</p></div><Button asChild variant="outline" size="sm" className="gap-1.5"><Link to="/reports/retained-earnings"><IconArrowRight size={14}/> Retained Earnings</Link></Button></div>

          <Card className="overflow-hidden"><CardContent className="p-0">
            <div className="divide-y">
              {/* Revenue */}
              <div className="p-4 space-y-2"><div className="text- font-bold tracking-widest text-amber-500 uppercase">Revenue</div>
                {vm.revenues.length===0? <div className="text-xs text-muted-foreground italic pl-4">No revenue accounts recorded.</div> : vm.revenues.map((l,i)=><div key={i} className="flex items-center justify-between text-sm pl-4"><span className="flex items-center gap-2"><Badge variant="outline" className="font-mono text-">{l.referenceNumber}</Badge>{l.accountName}</span><span className="font-mono text-xs">{formatNumber(l.amount)}</span></div>)}
                <div className="flex items-center justify-between font-semibold text-sm border-t pt-2 mt-2"><span className="pl-4">Total Revenue</span><span className="font-mono">{formatNumber(totalRevenue)}</span></div>
              </div>

              {/* Opex */}
              <div className="p-4 space-y-2"><div className="text- font-bold tracking-widest text-amber-500 uppercase">Operating Expenses</div>
                {vm.operatingExpenses.length===0? <div className="text-xs text-muted-foreground italic pl-4">No operating expenses.</div> : vm.operatingExpenses.map((l,i)=><div key={i} className="flex items-center justify-between text-sm pl-4"><span className="flex items-center gap-2"><Badge variant="outline" className="font-mono text-">{l.referenceNumber}</Badge>{l.accountName}</span><span className="font-mono text-xs">({formatNumber(l.amount)})</span></div>)}
                <div className="flex items-center justify-between font-semibold text-sm border-t pt-2 mt-2"><span className="pl-4">Total Operating Expenses</span><span className="font-mono">({formatNumber(totalOpex)})</span></div>
              </div>

              {/* Operating Income */}
              <div className="flex items-center justify-between p-4 bg-muted/30 font-bold"><span>Operating Income</span><span className={`font-mono text-base ${operatingIncome>=0? 'text-emerald-500':'text-red-500'}`}>{formatNumber(operatingIncome)}</span></div>

              {/* Other Income/Expenses */}
              {(vm.otherIncome.length>0 || vm.otherExpenses.length>0) && (
                <div className="p-4 space-y-2"><div className="text- font-bold tracking-widest text-amber-500 uppercase">Other Income & Expenses</div>
                  {vm.otherIncome.map((l,i)=><div key={`oi-${i}`} className="flex items-center justify-between text-sm pl-4"><span className="flex items-center gap-2"><Badge variant="outline" className="font-mono text-">{l.referenceNumber}</Badge>{l.accountName}</span><span className="font-mono text-xs">{formatNumber(l.amount)}</span></div>)}
                  {vm.otherExpenses.map((l,i)=><div key={`oe-${i}`} className="flex items-center justify-between text-sm pl-4"><span className="flex items-center gap-2"><Badge variant="outline" className="font-mono text-">{l.referenceNumber}</Badge>{l.accountName}</span><span className="font-mono text-xs">({formatNumber(l.amount)})</span></div>)}
                </div>
              )}

              {/* Net Income */}
              <div className="flex items-center justify-between p-4 bg-primary/5 border-t-2 border-primary/20"><span className="font-bold text-base">Net Income</span><span className={`font-mono font-bold text-lg ${netIncome>=0? 'text-emerald-500':'text-red-500'}`}>{formatNumber(netIncome)}</span></div>
            </div>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}