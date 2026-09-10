import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '@/services/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconPigMoney, IconCalendar, IconEyeOff, IconArrowRight, IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';

export interface RetainedEarningsViewModel { accountName: string; startDate: string; endDate: string; beginningBalance: number; netIncome: number; dividends: number; }

const formatNumber = (n:number) => { const f=new Intl.NumberFormat('id-ID',{style:'decimal',maximumFractionDigits:0}).format(Math.abs(n)); return n<0? `(${f})`: f; };
const formatDateDisplay = (s?:string) => !s? '': new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(s));

export default function RetainedEarningsPage() {
  const [noPeriod, setNoPeriod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [vm, setVm] = useState<RetainedEarningsViewModel>({ accountName:'Retained Earnings', startDate:'', endDate:'', beginningBalance:0, netIncome:0, dividends:0 });

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try{
      const {data}=await apiClient.get('/api/v1/reports/retained-earnings');
      if(data?.hasPeriodSelected===false){ setNoPeriod(true); return; }
      setNoPeriod(false);
      setVm({
        accountName: data?.accountName||'Retained Earnings',
        startDate: data?.startDate||'',
        endDate: data?.endDate||'',
        beginningBalance: Number(data?.beginningRetainedEarnings ?? data?.beginningBalance)||0,
        netIncome: Number(data?.netIncome)||0,
        dividends: Number(data?.dividendsOrDraws ?? data?.dividends)||0,
      });
    }catch(err:any){ setError(err.response?.data?.message||err.message); } finally{ setLoading(false); }
  }, []);

  useEffect(()=>{ fetchData(); const h=()=>fetchData(); window.addEventListener('periodChanged',h); return()=>window.removeEventListener('periodChanged',h); }, [fetchData]);

  const endingBalance = useMemo(()=> vm.beginningBalance + vm.netIncome - vm.dividends, [vm]);

  if(loading) return <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2"><IconLoader2 className="animate-spin" size={16}/> Loading Retained Earnings...</div>;

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription>{error}</AlertDescription></Alert>}

      {noPeriod? (
        <Card className="py-16 text-center border-dashed"><CardContent className="space-y-3"><IconEyeOff size={36} className="mx-auto text-muted-foreground"/><h3 className="font-semibold">No Period Selected</h3><p className="text-sm text-muted-foreground">This report follows whichever period you're viewing.</p><Button asChild size="sm"><Link to="/periods" className="gap-1.5"><IconCalendar size={14}/> Go to Periods</Link></Button></CardContent></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold flex items-center gap-2"><IconPigMoney className="text-emerald-500" size={22}/> Retained Earnings Statement</h1><p className="text-sm text-muted-foreground mt-1">Bridges Income Statement to Equity on Balance Sheet • IDR</p></div><Button asChild variant="outline" size="sm" className="gap-1.5"><Link to="/reports/statement-of-financial-position"><IconArrowRight size={14}/> Balance Sheet</Link></Button></div>

          <Card className="max-w- overflow-hidden">
            <CardHeader><CardTitle className="text-base">{vm.accountName}</CardTitle><CardDescription>{formatDateDisplay(vm.startDate)} → {formatDateDisplay(vm.endDate)}</CardDescription></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y text-sm">
                <div className="flex items-center justify-between p-4"><span>Retained earnings, {formatDateDisplay(vm.startDate)||'start'}</span><span className="font-mono font-medium">{formatNumber(vm.beginningBalance)}</span></div>
                <div className="flex items-center justify-between p-4 pl-8"><span className="text-muted-foreground">Add: Net Income</span><span className={`font-mono font-medium ${vm.netIncome>=0? 'text-emerald-500':'text-red-500'}`}>{formatNumber(vm.netIncome)}</span></div>
                {vm.dividends!==0 && <div className="flex items-center justify-between p-4 pl-8"><span className="text-muted-foreground">Less: Dividends / Withdrawals</span><span className="font-mono font-medium text-red-500">({formatNumber(vm.dividends)})</span></div>}
                <div className="flex items-center justify-between p-4 bg-primary/5 font-bold text-base border-t-2"><span>Retained earnings, {formatDateDisplay(vm.endDate)||'end'}</span><span className="font-mono text-emerald-500">{formatNumber(endingBalance)}</span></div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}