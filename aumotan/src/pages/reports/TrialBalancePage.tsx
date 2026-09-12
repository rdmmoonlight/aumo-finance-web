import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import apiClient from '@/services/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconList, IconListCheck, IconShieldCheck, IconCalendar, IconEyeOff, IconAlertTriangle, IconLoader2, IconCircleCheck } from '@tabler/icons-react';

// Models
export interface TrialRow { accountId: number; referenceNumber: number; accountName: string; type: string; normalBalanceIsDebit: boolean; netBalance?: number; debit?: number; credit?: number; amount?: number; }

const formatNumber = (n:number) => n===0? '-': new Intl.NumberFormat('id-ID',{style:'decimal',maximumFractionDigits:0}).format(Math.abs(n));

function useTrialBalance(endpoint:string, isPostClosing=false) {
  const [noPeriod, setNoPeriod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [rows, setRows] = useState<TrialRow[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try{
      const {data} = await apiClient.get(endpoint);
      if(data?.hasPeriodSelected===false){ setNoPeriod(true); setRows([]); return; }

      let raw: any[] = [];
      if(isPostClosing){
        const assets = data?.assetAccounts || data?.assets || [];
        const liabs = data?.liabilityAccounts || data?.liabilities || [];
        const rawEquity = data?.equityAccounts || data?.equityExcludingRetainedEarnings || [];
        const reItem = rawEquity.find((e:any)=> e.accountName==='Retained Earnings');
        const reEnding = reItem? Number(reItem.amount) : Number(data?.retainedEarningsEnding)||0;
        const equityEx = rawEquity.filter((e:any)=> e.accountName!=='Retained Earnings');
        raw = [
         ...assets.map((a:any)=>({ accountId:a.accountId||a.referenceNumber, referenceNumber:a.referenceNumber, accountName:a.accountName, type:'Assets', normalBalanceIsDebit:true, debit:Number(a.amount)||0, credit:0 })),
         ...liabs.map((l:any)=>({ accountId:l.accountId||l.referenceNumber, referenceNumber:l.referenceNumber, accountName:l.accountName, type:'Liabilities', normalBalanceIsDebit:false, debit:0, credit:Number(l.amount)||0 })),
         ...equityEx.map((e:any)=>({ accountId:e.accountId||e.referenceNumber, referenceNumber:e.referenceNumber, accountName:e.accountName, type:'Equity', normalBalanceIsDebit:false, debit:0, credit:Number(e.amount)||0 })),
          { accountId:0, referenceNumber:0, accountName:'Retained Earnings', type:'Equity', normalBalanceIsDebit:false, debit: reEnding<0? Math.abs(reEnding):0, credit: reEnding>=0? reEnding:0 }
        ];
      } else {
        raw = Array.isArray(data)? data : data?.data || data?.rows || [];
      }

      const computed = raw.map((r:any)=>{
        const net = r.netBalance?? r.amount?? 0;
        let debit = r.debit?? 0; let credit = r.credit?? 0;
        if(r.debit===undefined && r.credit===undefined){
          if(r.normalBalanceIsDebit){ debit = net>=0? net:0; credit = net<0? Math.abs(net):0; }
          else { credit = net>=0? net:0; debit = net<0? Math.abs(net):0; }
        }
        return {...r, debit, credit };
      });

      setNoPeriod(false); setRows(computed);
    }catch(err:any){ if(err.response?.status===404){ setNoPeriod(true); } else setError(err.response?.data?.message||err.message); }
    finally{ setLoading(false); }
  }, [endpoint, isPostClosing]);

  useEffect(()=>{ fetchData(); const h=()=>fetchData(); window.addEventListener('periodChanged',h); return()=>window.removeEventListener('periodChanged',h); }, [fetchData]);

  const totalDebit = useMemo(()=> rows.reduce((s,r)=>s+(Number(r.debit)||0),0), [rows]);
  const totalCredit = useMemo(()=> rows.reduce((s,r)=>s+(Number(r.credit)||0),0), [rows]);
  const isBalanced = Math.abs(totalDebit-totalCredit) < 0.01;

  return { noPeriod, loading, error, rows, totalDebit, totalCredit, isBalanced };
}

function TrialTable({ rows, totalDebit, totalCredit }: { rows:TrialRow[], totalDebit:number, totalCredit:number }) {
  return (
    <Card className="overflow-hidden"><CardContent className="p-0"><Table><TableHeader><TableRow className="text-"><TableHead className="text-center pl-6 w-[10%]">Ref.</TableHead><TableHead className="w-[50%]">Account</TableHead><TableHead className="w-[15%]">Type</TableHead><TableHead className="text-right w-[12%]">Debit</TableHead><TableHead className="text-right pr-6 w-[13%]">Credit</TableHead></TableRow></TableHeader>
      <TableBody>{rows.length? rows.map(r=><TableRow key={r.accountId}><TableCell className="text-center pl-6"><Badge variant="outline" className="font-mono text- text-amber-500">{r.referenceNumber||'-'}</Badge></TableCell><TableCell className="text-xs font-medium">{r.accountName}</TableCell><TableCell><Badge variant="secondary" className="text-">{r.type}</Badge></TableCell><TableCell className="text-right font-mono text-xs text-emerald-500">{(r.debit||0)>0? formatNumber(r.debit!):'-'}</TableCell><TableCell className="text-right pr-6 font-mono text-xs text-red-500">{(r.credit||0)>0? formatNumber(r.credit!):'-'}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">No accounts found.</TableCell></TableRow>}</TableBody>
      <TableFooter><TableRow className="font-bold"><TableCell colSpan={3} className="text-right pl-6">Total</TableCell><TableCell className="text-right font-mono text-emerald-500">{formatNumber(totalDebit)}</TableCell><TableCell className="text-right pr-6 font-mono text-red-500">{formatNumber(totalCredit)}</TableCell></TableRow></TableFooter>
    </Table></CardContent></Card>
  )
}

export default function TrialBalancePage() {
  const [activeTab, setActiveTab] = useState<'unadjusted'|'adjusted'|'post-closing'>('unadjusted');

  const unadj = useTrialBalance('/api/v1/reports/trial-balance/unadjusted');
  const adj = useTrialBalance('/api/v1/reports/trial-balance/adjusted');
  const post = useTrialBalance('/api/v1/reports/statement-of-financial-position?isPostClosing=true', true);

  const current = activeTab==='unadjusted'? unadj : activeTab==='adjusted'? adj : post;

  if(current.loading) return <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2"><IconLoader2 className="animate-spin" size={16}/> Loading {activeTab} trial balance...</div>;

  return (
    <div className="space-y-6">
      {current.error && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription>{current.error}</AlertDescription></Alert>}

      {current.noPeriod? (
        <Card className="py-16 text-center border-dashed"><CardContent className="space-y-3"><IconEyeOff size={36} className="mx-auto text-muted-foreground"/><h3 className="font-semibold">No Period Selected</h3><p className="text-sm text-muted-foreground">Select a period to view trial balance.</p><Button asChild size="sm"><Link to="/periods" className="gap-1.5"><IconCalendar size={14}/> Go to Periods</Link></Button></CardContent></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold flex items-center gap-2"><IconList className="text-sky-500" size={22}/> Trial Balance</h1><p className="text-sm text-muted-foreground mt-1">Unadjusted → Adjusted → Post-Closing • IDR</p></div></div>

          <Tabs value={activeTab} onValueChange={(v:any)=>setActiveTab(v)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 max-w-"><TabsTrigger value="unadjusted" className="gap-1.5"><IconList size={14}/> Unadjusted</TabsTrigger><TabsTrigger value="adjusted" className="gap-1.5"><IconListCheck size={14}/> Adjusted</TabsTrigger><TabsTrigger value="post-closing" className="gap-1.5"><IconShieldCheck size={14}/> Post-Closing</TabsTrigger></TabsList>

            <TabsContent value="unadjusted" className="space-y-4">
              <TrialTable rows={unadj.rows} totalDebit={unadj.totalDebit} totalCredit={unadj.totalCredit} />
              <Alert className={unadj.isBalanced? 'bg-emerald-500/10 border-emerald-500/20':'bg-red-500/10 border-red-500/20'}><IconCircleCheck size={16}/><AlertDescription className="text-xs">{unadj.isBalanced? 'Balanced: Debit = Credit':'Unbalanced - check journal entries'}</AlertDescription></Alert>
            </TabsContent>

            <TabsContent value="adjusted" className="space-y-4">
              <TrialTable rows={adj.rows} totalDebit={adj.totalDebit} totalCredit={adj.totalCredit} />
              <Alert className={adj.isBalanced? 'bg-emerald-500/10 border-emerald-500/20':'bg-red-500/10 border-red-500/20'}><IconCircleCheck size={16}/><AlertDescription className="text-xs">{adj.isBalanced? 'Adjusted TB is balanced':'Unbalanced - check adjusting entries'}</AlertDescription></Alert>
            </TabsContent>

            <TabsContent value="post-closing" className="space-y-4">
              <TrialTable rows={post.rows} totalDebit={post.totalDebit} totalCredit={post.totalCredit} />
              <Alert className={post.isBalanced? 'bg-emerald-500/10 border-emerald-500/20':'bg-red-500/10 border-red-500/20'}><IconCircleCheck size={16}/><AlertDescription className="text-xs">{post.isBalanced? 'Post-closing TB is balanced - ready for next period':'Out of balance - check closing entries'}</AlertDescription></Alert>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}