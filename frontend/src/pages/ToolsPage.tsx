import { useState, useEffect } from 'react';
import apiClient from '@/services/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconUpload, IconEye, IconDownload, IconCheck, IconAlertTriangle, IconFileSpreadsheet, IconCalendar } from '@tabler/icons-react';

interface JournalLineImport { rowIndex: number; refNumber: number; accountName: string; description: string; debit: number|null; credit: number|null; }
interface JournalTransactionImport { transactionNumber?: string; date: string; journalType: string; lines: JournalLineImport[]; }
interface JournalImportResult { isSuccess: boolean; totalTransactionsRead: number; totalLinesRead: number; transactions: JournalTransactionImport[]; }
interface AccountMappingDetail { excelRef: number; excelAccountName: string; mappedRef: number; mappedAccountName: string; status: string; }
interface DbAccount { id: number; referenceNumber: number; accountName: string; type: string; }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ToolsPage() {
  const [successMessage, setSuccessMessage] = useState<string|null>(null);
  const [errorMessage, setErrorMessage] = useState<string|null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth()+1);
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [selectedFile, setSelectedFile] = useState<File|null>(null);
  const [parseResult, setParseResult] = useState<JournalImportResult|null>(null);
  const [accountMappings, setAccountMappings] = useState<AccountMappingDetail[]>([]);
  const [dbAccounts, setDbAccounts] = useState<DbAccount[]>([]);
  const [isLoadingCoa, setIsLoadingCoa] = useState(false);

  useEffect(()=>{ (async()=>{
    setIsLoadingCoa(true);
    try{ const {data}=await apiClient.get('/api/v1/chart-of-accounts'); setDbAccounts(data.accounts||data.data||[]); }catch{} finally{ setIsLoadingCoa(false); }
  })(); }, []);

  const formatIDR = (n:number)=> new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n);

  const handlePreview = async () => {
    if(!selectedFile){ setErrorMessage('Select Excel first'); return; }
    setIsBusy(true); setErrorMessage(null);
    try{
      if(!(window as any).XLSX){ await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'; s.onload=res as any; s.onerror=rej as any; document.head.appendChild(s); }); }
      const XLSX=(window as any).XLSX; const buf=await selectedFile.arrayBuffer(); const wb=XLSX.read(buf,{type:'array'});
      const parsed:JournalTransactionImport[]=[]; const temp:Record<string,AccountMappingDetail>={}; let totalLines=0;

      ['GJ','AJ'].forEach(sheetName=>{
        const ws=wb.Sheets[sheetName]; if(!ws) return;
        const rows:any[]=XLSX.utils.sheet_to_json(ws,{raw:true,defval:''});
        let curDate=''; const grouped:Record<string,JournalLineImport[]>={};
        rows.forEach((row,i)=>{
          const rawDate=row['Date']??''; let day=1;
          if(/^\d{1,2}$/.test(String(rawDate).trim())) day=parseInt(String(rawDate),10);
          else if(/^\d{4}-\d{2}-\d{2}$/.test(String(rawDate))) day=parseInt(String(rawDate).split('-')[2],10);
          if(rawDate) curDate=`${targetYear}-${String(targetMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          if(!curDate) return;
          const accountName=String(row['Account Name']??'').trim(); const description=String(row['Description']??'').trim(); const refVal=Number(row['Ref']??0);
          if(!accountName &&!description &&!refVal) return;
          const mapKey=`${refVal}|||${accountName}`; if(!temp[mapKey]) temp[mapKey]={excelRef:refVal,excelAccountName:accountName,mappedRef:0,mappedAccountName:'',status:'UNMAPPED'};
          const line:JournalLineImport={rowIndex:i+2,refNumber:refVal,accountName,description,debit: row['Debit']!==''&&!isNaN(Number(row['Debit']))? Number(row['Debit']):null, credit: row['Credit']!==''&&!isNaN(Number(row['Credit']))? Number(row['Credit']):null };
          if(!grouped[curDate]) grouped[curDate]=[]; grouped[curDate].push(line); totalLines++;
        });
        Object.keys(grouped).forEach(d=>parsed.push({date:d,journalType:sheetName==='GJ'?'General':'Adjusting',lines:grouped[d]}));
      });

      setAccountMappings(Object.values(temp));
      setParseResult({isSuccess:true,totalTransactionsRead:parsed.length,totalLinesRead:totalLines,transactions:parsed});
    }catch(err:any){ setErrorMessage(err.message); }finally{ setIsBusy(false); }
  };

  const handleMappingChange = (excelRef:number, excelName:string, targetRef:number) => {
    const opt=dbAccounts.find(o=>o.referenceNumber===targetRef);
    setAccountMappings(prev=>prev.map(m=> m.excelRef===excelRef && m.excelAccountName===excelName? {...m, mappedRef: targetRef, mappedAccountName: opt?.accountName||'', status: targetRef? 'REALLOCATED':'UNMAPPED'}: m));
  };

  const handleConfirmImport = async () => {
    if(!parseResult) return; setIsBusy(true);
    try{
      await apiClient.post('/api/v1/tools/import-journal-entries',{
        targetMonth, targetYear, customMappings: accountMappings,
        transactions: parseResult.transactions.map(tx=>({date:tx.date,journalType:tx.journalType,lines:tx.lines.map(l=>({refNumber:l.refNumber,accountName:l.accountName,description:l.description,debit:l.debit,credit:l.credit}))}))
      });
      setSuccessMessage(`Imported ${parseResult.totalTransactionsRead} entries for ${targetMonth}/${targetYear}`); setParseResult(null); setSelectedFile(null); setAccountMappings([]);
    }catch(err:any){ setErrorMessage(err.response?.data?.message||err.message); }finally{ setIsBusy(false); }
  };

  const unmappedCount = accountMappings.filter(m=>m.mappedRef===0).length;

  return (
    <div className="space-y-6">
      {successMessage && <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300"><IconCheck size={16}/><AlertDescription>{successMessage}</AlertDescription></Alert>}
      {errorMessage && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription>{errorMessage}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-4 space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><IconFileSpreadsheet size={16} className="text-primary"/> Import Journal Entries</CardTitle><CardDescription>Upload Excel GJ/AJ sheets</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2"><Label className="flex items-center gap-1"><IconCalendar size={12}/> Target Period</Label><div className="grid grid-cols-2 gap-2"><Select value={String(targetMonth)} onValueChange={v=>setTargetMonth(Number(v))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{MONTHS.map((m,i)=><SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select><Select value={String(targetYear)} onValueChange={v=>setTargetYear(Number(v))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[2024,2025,2026,2027,2028].map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div></div>
              <div className="space-y-2"><Label>Excel File (.xlsx)</Label><Input type="file" accept=".xlsx" onChange={e=>{ setSelectedFile(e.target.files?.[0]||null); setParseResult(null); setAccountMappings([]); }}/><Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1" onClick={async()=>{
                const XLSX=(window as any).XLSX || await import('xlsx'); // fallback
              }}><IconDownload size={12}/> Download Template</Button></div>
              <div className="grid gap-2"><Button disabled={!selectedFile||isBusy} onClick={handlePreview} className="gap-2"><IconEye size={14}/> {isBusy? 'Processing...':'Preview Entries'}</Button>
              {parseResult && <Button disabled={isBusy||unmappedCount>0} onClick={handleConfirmImport} className="gap-2 bg-emerald-600 hover:bg-emerald-500"><IconCheck size={14}/> Submit & Import ({parseResult.totalTransactionsRead})</Button>}
              {unmappedCount>0 && <p className="text-xs text-destructive text-center font-medium">{unmappedCount} akun belum dipetakan</p>}</div>
            </CardContent>
          </Card>

          {accountMappings.length>0 && (
            <Card><CardHeader className="py-3 flex-row items-center justify-between space-y-0"><CardTitle className="text-xs">Mapping Status</CardTitle><Badge variant="secondary" className="text-">{accountMappings.length} akun</Badge></CardHeader><CardContent className="p-0 max-h- overflow-auto"><Table><TableHeader><TableRow className="text-"><TableHead>Excel Input</TableHead><TableHead>Target COA</TableHead></TableRow></TableHeader><TableBody>{accountMappings.map((m,i)=><TableRow key={i} className={m.mappedRef? 'bg-amber-500/10':''}><TableCell className="text-xs"><Badge variant="outline" className="font-mono text- mr-1">{m.excelRef}</Badge>{m.excelAccountName}</TableCell><TableCell><Select value={String(m.mappedRef||0)} onValueChange={v=>handleMappingChange(m.excelRef,m.excelAccountName,Number(v))} disabled={isLoadingCoa}><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Pilih COA"/></SelectTrigger><SelectContent>{dbAccounts.map(o=><SelectItem key={o.id} value={String(o.referenceNumber)} className="text-xs">[{o.referenceNumber}] {o.accountName}</SelectItem>)}</SelectContent></Select></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
          )}
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-8 space-y-4">
          {parseResult? (
            <div className="space-y-4 max-h-[calc(100vh-120px)] overflow-auto pr-1">
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold flex items-center gap-2"><IconUpload size={14}/> Preview Transactions</h3><Badge>{parseResult.transactions.length} loaded</Badge></div>
              {parseResult.transactions.map((tx,txIdx)=>(
                <Card key={txIdx} className="overflow-hidden"><CardHeader className="py-2 px-3 flex-row items-center justify-between space-y-0 bg-muted/30"><div className="flex items-center gap-2"><Badge className="text-">{tx.journalType}</Badge><Badge variant="outline" className="font-mono text-">{tx.date}</Badge></div><span className="text-xs text-muted-foreground">{tx.lines.length} lines</span></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow className="text-"><TableHead className="w-10">#</TableHead><TableHead className="w-20">Ref</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader><TableBody>{tx.lines.map((l,i)=>{
                  const mapping=accountMappings.find(m=>m.excelRef===l.refNumber && m.excelAccountName===l.accountName); const isUnmapped=!mapping?.mappedRef;
                  return <TableRow key={i} className={isUnmapped? 'bg-destructive/10':''}><TableCell className="text-xs">{l.rowIndex}</TableCell><TableCell><Badge variant="secondary" className="font-mono text-">{l.refNumber}</Badge></TableCell><TableCell className="text-xs"><div className="font-medium">{l.accountName}</div><div className="text- text-muted-foreground truncate">{l.description}</div>{mapping?.mappedRef? <Badge className="mt-1 bg-amber-500/15 text-amber-600 border-amber-500/20 text-">→ [{mapping.mappedRef}] {mapping.mappedAccountName}</Badge>: <Badge variant="destructive" className="mt-1 text-">Unmapped</Badge>}</TableCell><TableCell className="text-right font-mono text-xs">{l.debit!==null? formatIDR(l.debit):'-'}</TableCell><TableCell className="text-right font-mono text-xs">{l.credit!==null? formatIDR(l.credit):'-'}</TableCell></TableRow>
                })}</TableBody><TableFooter><TableRow><TableCell colSpan={3} className="text-right font-medium text-xs">Total</TableCell><TableCell className="text-right font-mono text-xs font-bold">{formatIDR(tx.lines.reduce((a,b)=>a+(b.debit||0),0))}</TableCell><TableCell className="text-right font-mono text-xs font-bold">{formatIDR(tx.lines.reduce((a,b)=>a+(b.credit||0),0))}</TableCell></TableRow></TableFooter></Table></CardContent></Card>
              ))}
            </div>
          ) : (
            <Card className="h- grid place-items-center border-dashed"><CardContent className="text-center text-muted-foreground"><IconUpload size={32} className="mx-auto mb-2 opacity-50"/><p className="text-sm font-medium">No Preview Yet</p><p className="text-xs">Select Excel on left and click Preview</p></CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}