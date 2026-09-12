import { useState, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import apiClient from '@/services/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconBook, IconPlus, IconPencil, IconTrash, IconEyeOff, IconBookOff, IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';

export interface Account { id: number; referenceNumber: number; accountName: string; }
export interface JournalLine { id: number; lineOrder: number; debit: number; credit: number; lineDescription?: string; accountName?: string; referenceNumber?: number; account?: Account; }
export interface JournalEntry { id: number; transactionNumber: string; entryDate: string; createdAt: string; updatedAt?: string; lines: JournalLine[]; }

const formatNumber = (n:number) => new Intl.NumberFormat('id-ID').format(Math.abs(n));
const formatDateDisplay = (s:string) =>!s? '-': new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(s));
const formatDateTimeDisplay = (s?:string) =>!s? null: new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(s));

export default function GeneralJournalPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedPeriodName, setSelectedPeriodName] = useState<string|null>(null);
  const [isPeriodClosed, setIsPeriodClosed] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string|null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try{
      const {data}=await apiClient.get('/api/v1/reports/general-journal');
      if(data.success){ setSelectedPeriodName(data.selectedPeriodName||null); setIsPeriodClosed(data.isPeriodClosed||false); setEntries(data.entries||[]); }
      else throw new Error(data.message);
    }catch(err:any){ if(err.response?.status===401) navigate({ to: '/' }); setErrorMessage(err.response?.data?.message||err.message); } finally{ setLoading(false); }
  }, [navigate]);

  useEffect(()=>{ fetchData(); const h=()=>fetchData(); window.addEventListener('periodChanged',h); return()=>window.removeEventListener('periodChanged',h); }, [fetchData]);

  const deleteEntry = async (entry:JournalEntry) => {
    if(isPeriodClosed){ alert(`${entry.transactionNumber} in closed period`); return; }
    if(!confirm(`Delete ${entry.transactionNumber}?`)) return;
    try{ await apiClient.delete(`/api/v1/reports/general-journal/${entry.id}`); setEntries(prev=>prev.filter(e=>e.id!==entry.id)); }catch(err:any){ setErrorMessage(err.response?.data?.message||'Failed delete'); }
  };

  let currentDateTracker=''; let groupIdx=0;

  return (
    <div className="space-y-6">
      {errorMessage && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription>{errorMessage}</AlertDescription></Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><IconBook className="text-amber-500" size={22}/> General Journal</h1><p className="text-sm text-muted-foreground mt-1">Chronological record {selectedPeriodName? `(Viewing: ${selectedPeriodName})`:''}</p></div>
        <div className="flex gap-2"><Button asChild size="sm" className="gap-1.5"><Link to="/journal-entry"><IconPlus size={14}/> Add Entry</Link></Button><Button variant={editMode?'secondary':'outline'} size="sm" className="gap-1.5" onClick={()=>setEditMode(p=>!p)} disabled={!entries.length}><IconPencil size={14}/> Edit</Button></div>
      </div>

      <Card className="overflow-hidden"><CardContent className="p-0">
        <Table><TableHeader><TableRow className="text-"><TableHead className="pl-6 w-[14%]">Date & Ref</TableHead><TableHead className="w-[26%]">Account</TableHead><TableHead className="w-[28%]">Description</TableHead><TableHead className="text-center w-[8%]">Ref #</TableHead><TableHead className="text-right w-[12%]">Debit</TableHead><TableHead className="text-right pr-6 w-[12%]">Credit</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading? <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground"><IconLoader2 className="animate-spin inline mr-2" size={16}/> Loading general journal...</TableCell></TableRow> :
            entries.length>0? entries.map(entry=>{
              const sorted=[...(entry.lines||[])].sort((a,b)=>a.lineOrder-b.lineOrder);
              const curDate=formatDateDisplay(entry.entryDate); const showHeader=curDate!==currentDateTracker; if(showHeader){ currentDateTracker=curDate; groupIdx++; }
              const shade=groupIdx%2===0? 'bg-muted/20':'';
              return sorted.map((line,i)=>{
                const isFirst=i===0; const isDebit=line.debit>0; const accName=line.accountName||line.account?.accountName||'Unknown'; const ref=line.referenceNumber||line.account?.referenceNumber||'-';
                return <TableRow key={`${entry.id}-${line.id||i}`} className={shade}><TableCell className="pl-6 align-top py-2 text-xs">
                  {isFirst && showHeader && <Badge variant="secondary" className="text- mb-1 font-mono">{curDate}</Badge>}
                  {isFirst && <div className="flex flex-col gap-0.5"><span className="font-mono font-bold text-amber-500 text-">{entry.transactionNumber}</span>{entry.createdAt && <span className="text- text-muted-foreground">{formatDateTimeDisplay(entry.createdAt)}</span>}{entry.updatedAt && <span className="text- text-sky-500 flex items-center gap-0.5"><IconPencil size={10}/> {formatDateTimeDisplay(entry.updatedAt)}</span>}
                  {editMode && <div className="flex gap-1 mt-1"><Button asChild variant="outline" size="icon" className="h-6 w-6"><Link to={`/journal-entry?id=${entry.id}`}><IconPencil size={12}/></Link></Button><Button variant="outline" size="icon" className="h-6 w-6 text-destructive" onClick={()=>deleteEntry(entry)}><IconTrash size={12}/></Button></div>}</div>}
                </TableCell><TableCell className={`align-top py-2 text-xs ${isDebit? 'font-semibold':'pl-6 text-muted-foreground'}`}>{accName}</TableCell><TableCell className="align-top py-2 text-xs text-muted-foreground">{line.lineDescription||'-'}</TableCell><TableCell className="text-center align-top py-2"><Badge variant="outline" className="font-mono text- text-amber-500">{ref}</Badge></TableCell><TableCell className="text-right align-top py-2 font-mono text-xs font-medium text-emerald-500">{line.debit>0? formatNumber(line.debit):'-'}</TableCell><TableCell className="text-right pr-6 align-top py-2 font-mono text-xs font-medium text-red-500">{line.credit>0? formatNumber(line.credit):'-'}</TableCell></TableRow>
              })
            }) : (
              <TableRow><TableCell colSpan={6} className="text-center py-12"><div className="flex flex-col items-center gap-2 text-muted-foreground">{selectedPeriodName===null? <><IconEyeOff size={28}/><p className="text-sm font-medium">No Period Selected</p><p className="text-xs">Go to <Link to="/periods" className="text-primary underline">Periods</Link></p></>: <><IconBookOff size={28}/><p className="text-sm font-medium">No Entries Found</p><p className="text-xs">No entries in <strong>{selectedPeriodName}</strong></p></>}</div></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}