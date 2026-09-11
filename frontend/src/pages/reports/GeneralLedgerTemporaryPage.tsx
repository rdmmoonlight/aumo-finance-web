import { useState, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import apiClient from '@/services/apiClient';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconBook2, IconCalendar, IconEyeOff, IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';

export interface LedgerLineViewModel { entryDate: string; description?: string; debit: number; credit: number; runningBalance: number; }
export interface LedgerAccountViewModel { accountId: number; referenceNumber: number; accountName: string; type: string; normalBalanceIsDebit: boolean; endingBalance: number; lines: LedgerLineViewModel[]; }

const formatNumber = (n:number) => {
  if(n===0) return '-';
  const f=new Intl.NumberFormat('id-ID',{style:'decimal',maximumFractionDigits:0}).format(Math.abs(n));
  return n<0? `(${f})`: f;
};

export default function GeneralLedgerPermanentPage() {
  const [noPeriod, setNoPeriod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [ledgers, setLedgers] = useState<LedgerAccountViewModel[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try{
      const {data}=await apiClient.get('/api/v1/reports/general-ledger/permanent');
      if(data?.hasPeriodSelected===false){ setNoPeriod(true); return; }
      const raw = Array.isArray(data)? data : data?.data || data?.ledgers || [];
      setLedgers(raw); setNoPeriod(false);
    }catch(err:any){ if(err.response?.status===404) setNoPeriod(true); else setError(err.response?.data?.message||'Failed to load'); } finally{ setLoading(false); }
  }, []);

  useEffect(()=>{ fetchData(); const h=()=>fetchData(); window.addEventListener('periodChanged',h); return()=>window.removeEventListener('periodChanged',h); }, [fetchData]);

  if(loading) return <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2"><IconLoader2 className="animate-spin" size={16}/> Loading Permanent Ledger...</div>;
  if(noPeriod) return <Card className="py-16 text-center border-dashed"><CardContent className="space-y-3"><IconEyeOff size={36} className="mx-auto text-muted-foreground"/><h3 className="font-semibold">No Period Selected</h3><Button asChild size="sm"><Link to="/periods" className="gap-1.5"><IconCalendar size={14}/> Go to Periods</Link></Button></CardContent></Card>;

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><IconBook2 className="text-primary" size={22}/> Permanent Ledger</h1><p className="text-sm text-muted-foreground mt-1">Assets, Liabilities, Equity • {ledgers.length} accounts • IDR</p></div>
        <Button asChild variant="outline" size="sm"><Link to="/reports/general-ledger/temporary">View Temporary</Link></Button>
      </div>

      <div className="space-y-4">
        {ledgers.map(ledger=>(
          <Card key={ledger.accountId} className="overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2"><Badge variant="outline" className="font-mono text-amber-500 text-xs">{ledger.referenceNumber}</Badge><span className="font-semibold text-sm">{ledger.accountName}</span><Badge variant="secondary" className="text-">{ledger.type}</Badge></div>
              <span className="font-mono text-xs font-semibold text-emerald-500">Ending: {formatNumber(ledger.endingBalance)}</span>
            </CardHeader>
            <CardContent className="p-0">
              <Table><TableHeader><TableRow className="text-xs"><TableHead className="pl-6">Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right pr-6">Balance</TableHead></TableRow></TableHeader>
                <TableBody>{ledger.lines?.length? ledger.lines.map((line,idx)=><TableRow key={idx}><TableCell className="pl-6 text-xs text-muted-foreground">{line.entryDate}</TableCell><TableCell className="text-xs text-muted-foreground">{line.description||'-'}</TableCell><TableCell className="text-right font-mono text-xs text-emerald-500">{line.debit>0? formatNumber(line.debit):'-'}</TableCell><TableCell className="text-right font-mono text-xs text-red-500">{line.credit>0? formatNumber(line.credit):'-'}</TableCell><TableCell className="text-right pr-6 font-mono text-xs font-medium">{formatNumber(line.runningBalance)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">No postings</TableCell></TableRow>}</TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}