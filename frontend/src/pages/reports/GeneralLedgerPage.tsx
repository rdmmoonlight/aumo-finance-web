import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '@/services/apiClient';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconBook2, IconCalculator, IconCalendar, IconEyeOff, IconAlertTriangle, IconLoader2, IconInfoCircle } from '@tabler/icons-react';

export interface LedgerLineViewModel { entryDate: string; description?: string; debit: number; credit: number; runningBalance: number; }
export interface LedgerAccountViewModel { accountId: number; referenceNumber: number; accountName: string; type: string; normalBalanceIsDebit: boolean; endingBalance: number; lines: LedgerLineViewModel[]; }

const formatNumber = (amount: number) => {
  if(amount===0) return '-';
  const f = new Intl.NumberFormat('id-ID',{style:'decimal',maximumFractionDigits:0}).format(Math.abs(amount));
  return amount<0? `(${f})`: f;
};

function LedgerList({ ledgers, type }: { ledgers: LedgerAccountViewModel[], type: 'permanent'|'temporary' }) {
  if(!ledgers.length) return <Alert><IconInfoCircle size={16}/><AlertDescription>No {type} accounts found for this period.</AlertDescription></Alert>;
  return (
    <div className="space-y-4">
      {ledgers.map(ledger=>{
        const isDebitNormal=ledger.normalBalanceIsDebit;
        const isNormalPositive=isDebitNormal? ledger.endingBalance>=0 : ledger.endingBalance<=0;
        return (
          <Card key={ledger.accountId} className="overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2"><Badge variant="outline" className="font-mono text-amber-500">{ledger.referenceNumber}</Badge><span className="font-semibold text-sm">{ledger.accountName}</span><Badge variant="secondary" className="text-">{ledger.type}</Badge></div>
              <span className={`font-mono text-xs font-semibold ${isNormalPositive? 'text-emerald-500':'text-red-500'}`}>Ending: {formatNumber(ledger.endingBalance)} ({isDebitNormal? 'Dr':'Cr'})</span>
            </CardHeader>
            <CardContent className="p-0">
              <Table><TableHeader><TableRow className="text-"><TableHead className="pl-6">Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right pr-6">Balance</TableHead></TableRow></TableHeader>
                <TableBody>{ledger.lines?.length? ledger.lines.map((line,idx)=><TableRow key={idx}><TableCell className="pl-6 text-xs text-muted-foreground">{line.entryDate}</TableCell><TableCell className="text-xs text-muted-foreground">{line.description||'-'}</TableCell><TableCell className="text-right font-mono text-xs text-emerald-500">{line.debit>0? formatNumber(line.debit):'-'}</TableCell><TableCell className="text-right font-mono text-xs text-red-500">{line.credit>0? formatNumber(line.credit):'-'}</TableCell><TableCell className="text-right pr-6 font-mono text-xs font-medium">{formatNumber(line.runningBalance)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">No postings in this period</TableCell></TableRow>}</TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default function GeneralLedgerPage() {
  const [activeTab, setActiveTab] = useState<'permanent'|'temporary'>('permanent');
  const [noPeriod, setNoPeriod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [permanent, setPermanent] = useState<LedgerAccountViewModel[]>([]);
  const [temporary, setTemporary] = useState<LedgerAccountViewModel[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try{
      const [permRes, tempRes] = await Promise.all([
        apiClient.get('/api/v1/reports/general-ledger/permanent'),
        apiClient.get('/api/v1/reports/general-ledger/temporary'),
      ]);
      const getData = (raw:any) => Array.isArray(raw)? raw : raw?.data || raw?.ledgers || [];
      if(permRes.status===404 || tempRes.status===404){ setNoPeriod(true); return; }
      setPermanent(getData(permRes.data)); setTemporary(getData(tempRes.data)); setNoPeriod(false);
    }catch(err:any){ if(err.response?.status===404){ setNoPeriod(true); } else setError(err.response?.data?.message||'Failed to load'); } finally{ setLoading(false); }
  }, []);

  useEffect(()=>{ fetchAll(); const h=()=>fetchAll(); window.addEventListener('periodChanged',h); return()=>window.removeEventListener('periodChanged',h); }, [fetchAll]);

  const netTotal = useMemo(()=> temporary.reduce((sum,l)=> sum + (l.normalBalanceIsDebit? -l.endingBalance : l.endingBalance),0), [temporary]);

  if(loading) return <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2"><IconLoader2 className="animate-spin" size={16}/> Loading General Ledger...</div>;

  if(noPeriod) return <Card className="py-16 text-center border-dashed"><CardContent className="space-y-3"><IconEyeOff size={36} className="mx-auto text-muted-foreground"/><h3 className="font-semibold">No Period Selected</h3><p className="text-sm text-muted-foreground">Select a period to view its ledger.</p><Button asChild size="sm"><Link to="/periods" className="gap-1.5"><IconCalendar size={14}/> Go to Periods</Link></Button></CardContent></Card>;

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><IconBook2 className="text-primary" size={22}/> General Ledger</h1><p className="text-sm text-muted-foreground mt-1">Permanent = Assets/Liabilities/Equity • Temporary = Income/Expenses (IDR)</p></div>
        <Button asChild variant="outline" size="sm"><Link to="/reports/general-journal">General Journal</Link></Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v:any)=>setActiveTab(v)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-"><TabsTrigger value="permanent" className="gap-1.5"><IconBook2 size={14}/> Permanent ({permanent.length})</TabsTrigger><TabsTrigger value="temporary" className="gap-1.5"><IconCalculator size={14}/> Temporary ({temporary.length})</TabsTrigger></TabsList>

        <TabsContent value="permanent" className="space-y-4"><LedgerList ledgers={permanent} type="permanent" /></TabsContent>

        <TabsContent value="temporary" className="space-y-4">
          {temporary.length>0 && <Card className="bg-amber-500/5 border-amber-500/20"><CardContent className="py-3 px-4 flex items-center justify-between"><span className="text-sm font-medium">Net Income / (Loss) before closing</span><span className={`font-mono font-bold ${netTotal>=0? 'text-emerald-500':'text-red-500'}`}>{formatNumber(netTotal)}</span></CardContent></Card>}
          <LedgerList ledgers={temporary} type="temporary" />
        </TabsContent>
      </Tabs>
    </div>
  );
}