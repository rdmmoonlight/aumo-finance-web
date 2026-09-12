import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import apiClient from '@/services/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconGridDots, IconCalendar, IconEyeOff, IconTrendingUp, IconAlertTriangle, IconLoader2, IconInfoCircle } from '@tabler/icons-react';

export interface WorksheetRow { accountId: number; referenceNumber: number; accountName: string; type: string; normalBalanceIsDebit: boolean; unadjustedDebit: number; unadjustedCredit: number; adjustmentDebit: number; adjustmentCredit: number; adjustedDebit: number; adjustedCredit: number; incomeStatementDebit: number; incomeStatementCredit: number; financialPositionDebit: number; financialPositionCredit: number; }
export interface WorksheetViewModel { rows: WorksheetRow[]; netIncome: number; }

const formatNumber = (n:number) => n===0? '-': new Intl.NumberFormat('id-ID',{style:'decimal',maximumFractionDigits:0}).format(Math.abs(n));

export default function WorksheetPage() {
  const [noPeriod, setNoPeriod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [vm, setVm] = useState<WorksheetViewModel>({ rows:[], netIncome:0 });

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try{
      const {data}=await apiClient.get('/api/v1/reports/worksheet');
      if(data?.hasPeriodSelected===false){ setNoPeriod(true); return; }
      const rawRows = data?.rows||[];
      const mapped: WorksheetRow[] = rawRows.map((r:any)=>({
        accountId:r.accountId, referenceNumber:r.referenceNumber, accountName:r.accountName, type:r.type, normalBalanceIsDebit:r.normalBalanceIsDebit??true,
        unadjustedDebit:Number(r.tbDebit)||0, unadjustedCredit:Number(r.tbCredit)||0,
        adjustmentDebit:Number(r.adjDebit)||0, adjustmentCredit:Number(r.adjCredit)||0,
        adjustedDebit:Number(r.adjTbDebit)||0, adjustedCredit:Number(r.adjTbCredit)||0,
        incomeStatementDebit:Number(r.isDebit)||0, incomeStatementCredit:Number(r.isCredit)||0,
        financialPositionDebit:Number(r.bsDebit)||0, financialPositionCredit:Number(r.bsCredit)||0,
      }));
      setNoPeriod(false); setVm({ rows:mapped, netIncome:Number(data?.totals?.netIncome)||0 });
    }catch(err:any){ setError(err.response?.data?.message||err.message); } finally{ setLoading(false); }
  }, []);

  useEffect(()=>{ fetchData(); const h=()=>fetchData(); window.addEventListener('periodChanged',h); return()=>window.removeEventListener('periodChanged',h); }, [fetchData]);

  const totals = useMemo(()=> vm.rows.reduce((acc,r)=>{ acc.unadjustedDebit+=r.unadjustedDebit; acc.unadjustedCredit+=r.unadjustedCredit; acc.adjustmentDebit+=r.adjustmentDebit; acc.adjustmentCredit+=r.adjustmentCredit; acc.adjustedDebit+=r.adjustedDebit; acc.adjustedCredit+=r.adjustedCredit; acc.isDebit+=r.incomeStatementDebit; acc.isCredit+=r.incomeStatementCredit; acc.bsDebit+=r.financialPositionDebit; acc.bsCredit+=r.financialPositionCredit; return acc; }, {unadjustedDebit:0,unadjustedCredit:0,adjustmentDebit:0,adjustmentCredit:0,adjustedDebit:0,adjustedCredit:0,isDebit:0,isCredit:0,bsDebit:0,bsCredit:0}), [vm.rows]);

  if(loading) return <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2"><IconLoader2 className="animate-spin" size={16}/> Loading Worksheet...</div>;

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription>{error}</AlertDescription></Alert>}

      {noPeriod? (
        <Card className="py-16 text-center border-dashed"><CardContent className="space-y-3"><IconEyeOff size={36} className="mx-auto text-muted-foreground"/><h3 className="font-semibold">No Period Selected</h3><Button asChild size="sm"><Link to="/periods" className="gap-1.5"><IconCalendar size={14}/> Go to Periods</Link></Button></CardContent></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold flex items-center gap-2"><IconGridDots className="text-sky-500" size={22}/> 10-Column Worksheet</h1><p className="text-sm text-muted-foreground mt-1">Trial Balance → Adjustments → Adjusted TB → Income Statement → Balance Sheet • IDR</p></div><Button asChild variant="outline" size="sm" className="gap-1.5"><Link to="/reports/income-statement"><IconTrendingUp size={14}/> Income Statement</Link></Button></div>

          <Card className="overflow-hidden"><CardContent className="p-0 overflow-auto">
            <Table className="text-xs"><TableHeader><TableRow className="bg-muted/50"><TableHead rowSpan={2} className="sticky left-0 bg-muted/50 z-10 min-w-">Account</TableHead><TableHead colSpan={2} className="text-center border-l">Trial Balance</TableHead><TableHead colSpan={2} className="text-center border-l">Adjustments</TableHead><TableHead colSpan={2} className="text-center border-l">Adjusted TB</TableHead><TableHead colSpan={2} className="text-center border-l">Income Statement</TableHead><TableHead colSpan={2} className="text-center border-l">Balance Sheet</TableHead></TableRow><TableRow className="bg-muted/50"><TableHead className="text-right">Dr</TableHead><TableHead className="text-right">Cr</TableHead><TableHead className="text-right border-l">Dr</TableHead><TableHead className="text-right">Cr</TableHead><TableHead className="text-right border-l">Dr</TableHead><TableHead className="text-right">Cr</TableHead><TableHead className="text-right border-l">Dr</TableHead><TableHead className="text-right">Cr</TableHead><TableHead className="text-right border-l">Dr</TableHead><TableHead className="text-right">Cr</TableHead></TableRow></TableHeader>
              <TableBody>
                {vm.rows.length? vm.rows.map(row=><TableRow key={row.accountId}><TableCell className="sticky left-0 bg-background font-medium flex items-center gap-2"><Badge variant="outline" className="font-mono text-">{row.referenceNumber}</Badge>{row.accountName}</TableCell><TableCell className="text-right font-mono">{row.unadjustedDebit? formatNumber(row.unadjustedDebit):'-'}</TableCell><TableCell className="text-right font-mono">{row.unadjustedCredit? formatNumber(row.unadjustedCredit):'-'}</TableCell><TableCell className="text-right font-mono text-amber-500 border-l">{row.adjustmentDebit? formatNumber(row.adjustmentDebit):'-'}</TableCell><TableCell className="text-right font-mono text-amber-500">{row.adjustmentCredit? formatNumber(row.adjustmentCredit):'-'}</TableCell><TableCell className="text-right font-mono border-l">{row.adjustedDebit? formatNumber(row.adjustedDebit):'-'}</TableCell><TableCell className="text-right font-mono">{row.adjustedCredit? formatNumber(row.adjustedCredit):'-'}</TableCell><TableCell className="text-right font-mono text-emerald-500 border-l">{row.incomeStatementDebit? formatNumber(row.incomeStatementDebit):'-'}</TableCell><TableCell className="text-right font-mono text-emerald-500">{row.incomeStatementCredit? formatNumber(row.incomeStatementCredit):'-'}</TableCell><TableCell className="text-right font-mono text-sky-500 border-l">{row.financialPositionDebit? formatNumber(row.financialPositionDebit):'-'}</TableCell><TableCell className="text-right font-mono text-sky-500">{row.financialPositionCredit? formatNumber(row.financialPositionCredit):'-'}</TableCell></TableRow>) : <TableRow><TableCell colSpan={11} className="text-center py-6 text-muted-foreground">No worksheet rows.</TableCell></TableRow>}
              </TableBody>
              <TableFooter className="font-bold">
                <TableRow><TableCell className="sticky left-0 bg-muted text-right">Total</TableCell><TableCell className="text-right font-mono">{formatNumber(totals.unadjustedDebit)}</TableCell><TableCell className="text-right font-mono">{formatNumber(totals.unadjustedCredit)}</TableCell><TableCell className="text-right font-mono text-amber-500 border-l">{formatNumber(totals.adjustmentDebit)}</TableCell><TableCell className="text-right font-mono text-amber-500">{formatNumber(totals.adjustmentCredit)}</TableCell><TableCell className="text-right font-mono border-l">{formatNumber(totals.adjustedDebit)}</TableCell><TableCell className="text-right font-mono">{formatNumber(totals.adjustedCredit)}</TableCell><TableCell className="text-right font-mono text-emerald-500 border-l">{formatNumber(totals.isDebit)}</TableCell><TableCell className="text-right font-mono text-emerald-500">{formatNumber(totals.isCredit)}</TableCell><TableCell className="text-right font-mono text-sky-500 border-l">{formatNumber(totals.bsDebit)}</TableCell><TableCell className="text-right font-mono text-sky-500">{formatNumber(totals.bsCredit)}</TableCell></TableRow>
                <TableRow><TableCell colSpan={7} className="sticky left-0 bg-muted text-right">Net Income (plug)</TableCell><TableCell className="text-right font-mono text-emerald-500 border-l">{vm.netIncome>=0? formatNumber(vm.netIncome):'-'}</TableCell><TableCell className="text-right font-mono text-emerald-500">{vm.netIncome<0? formatNumber(Math.abs(vm.netIncome)):'-'}</TableCell><TableCell className="text-right font-mono text-sky-500 border-l">{vm.netIncome<0? formatNumber(Math.abs(vm.netIncome)):'-'}</TableCell><TableCell className="text-right font-mono text-sky-500">{vm.netIncome>=0? formatNumber(vm.netIncome):'-'}</TableCell></TableRow>
                <TableRow className="bg-primary/5"><TableCell colSpan={7} className="sticky left-0 bg-primary/5 text-right">Total (after plug)</TableCell><TableCell className="text-right font-mono text-emerald-500 border-l">{formatNumber(totals.isDebit + (vm.netIncome>=0? vm.netIncome:0))}</TableCell><TableCell className="text-right font-mono text-emerald-500">{formatNumber(totals.isCredit + (vm.netIncome<0? Math.abs(vm.netIncome):0))}</TableCell><TableCell className="text-right font-mono text-sky-500 border-l">{formatNumber(totals.bsDebit + (vm.netIncome<0? Math.abs(vm.netIncome):0))}</TableCell><TableCell className="text-right font-mono text-sky-500">{formatNumber(totals.bsCredit + (vm.netIncome>=0? vm.netIncome:0))}</TableCell></TableRow>
              </TableFooter>
            </Table>
          </CardContent></Card>

          <Alert className="bg-sky-500/10 border-sky-500/20"><IconInfoCircle size={16}/><AlertDescription className="text-xs">Net Income: <strong>{formatNumber(vm.netIncome)}</strong> — plugged from Income Statement to Balance Sheet.</AlertDescription></Alert>
        </>
      )}
    </div>
  );
}