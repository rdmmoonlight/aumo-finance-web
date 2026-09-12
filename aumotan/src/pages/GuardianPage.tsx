import { useState, useEffect } from 'react';
import { IconShieldCheck, IconHeartbeat, IconCircleCheck, IconAlertTriangle, IconActivity, IconDeviceLaptop, IconAlertOctagon, IconLogout, IconHistory, IconDownload, IconLoader2 } from '@tabler/icons-react';
import apiClient from '@/services/apiClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface UserSessionDto { id?: string; deviceName: string; browser: string; ipAddress: string; country: string; lastActivity: string; isCurrent: boolean; }
export interface LoginActivityDto { activity: string; device: string; browser: string; country: string; ipAddress: string; occurredAt: string; }
export interface GuardianViewModel { username: string; email: string; securityScore: number; activeSessions: number; trustedDevices: number; lastLogin: string; security: { emailVerified: boolean }; recentActivities: LoginActivityDto[]; }


export default function GuardianSecurityPage() {
  const [activeTab, setActiveTab] = useState('health');
  const [viewModel, setViewModel] = useState<GuardianViewModel | null>(null);
  const [sessions, setSessions] = useState<UserSessionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const { data } = await apiClient.get(`/api/v1/guardian`);
        if (data?.success) {
          setViewModel(data.data); setSessions(data.activeSessions||[]);
        }
      } catch (err: any) {
        setErrorMessage(err?.response?.data?.message || err.message);
      } finally { setIsLoading(false); }
    };
    fetchData();
  }, []);

  const handleRevokeSession = async (id?: string, device?: string) => {
    if (!id ||!confirm(`Akhiri sesi "${device}"?`)) return;
    try {
      await apiClient.post(`/api/v1/guardian/revoke-session/${id}`);
      setSessions(prev=>prev.filter(s=>s.id!==id)); setSuccessMessage('Sesi diakhiri');
      setTimeout(()=>setSuccessMessage(null),3000);
    } catch (err: any) { setErrorMessage(err?.response?.data?.message || 'Gagal'); }
  };

  const handleRevokeAll = async () => {
    if (!confirm('Emergency Lockout semua device lain?')) return;
    try {
      await apiClient.post(`/api/v1/guardian/revoke-all`);
      setSessions(prev=>prev.filter(s=>s.isCurrent)); setSuccessMessage('Semua sesi lain diakhiri');
    } catch (err: any) { setErrorMessage(err?.response?.data?.message || 'Gagal'); }
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center min-h- gap-3 text-muted-foreground"><IconLoader2 className="w-8 h-8 animate-spin text-primary"/><p className="text-xs">Memuat Guardian...</p></div>;

  const score = viewModel?.securityScore??0;
  const activities = (viewModel?.recentActivities||[]).slice(0,5);
  const displayedSessions = sessions.slice(0,5);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><IconShieldCheck className="text-primary" size={24}/> Guardian Security</h1><p className="text-sm text-muted-foreground">Security health, sessions, and logs</p></div>
        <Badge variant="outline" className={`gap-2 px-3 py-1.5 ${score>=70?'bg-emerald-500/10 text-emerald-500 border-emerald-500/20':'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}><IconHeartbeat size={16}/> Score: {score}%</Badge>
      </div>

      {successMessage && <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300"><IconCircleCheck size={16}/><AlertDescription>{successMessage}</AlertDescription></Alert>}
      {errorMessage && <Alert variant="destructive"><IconAlertTriangle size={16}/><AlertDescription>{errorMessage}</AlertDescription></Alert>}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 sm:w-"><TabsTrigger value="health" className="gap-1.5 text-xs"><IconActivity size={14}/> Health</TabsTrigger><TabsTrigger value="sessions" className="gap-1.5 text-xs"><IconDeviceLaptop size={14}/> Sessions <Badge variant="secondary" className="ml-1 px-1 text-">{displayedSessions.length}</Badge></TabsTrigger><TabsTrigger value="logs" className="gap-1.5 text-xs"><IconHistory size={14}/> Logs</TabsTrigger></TabsList>

        <TabsContent value="health" className="mt-4">
          <Card><CardHeader className="py-3 border-b flex-row items-center justify-between space-y-0"><div className="flex items-center gap-2 text-sm font-semibold"><IconHeartbeat size={16} className="text-rose-400"/> Account Health Checkup</div><span className="text- text-muted-foreground">Automated</span></CardHeader><CardContent className="p-4"><div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"><div><p className="text-sm font-medium">Email Verification</p><p className="text-xs text-muted-foreground">Primary email confirmation</p></div>{viewModel?.security?.emailVerified? <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20">Verified</Badge>: <Badge variant="secondary">Unverified</Badge>}</div></CardContent></Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <Card><CardHeader className="py-3 flex-row items-center justify-between space-y-0 border-b"><span className="text-sm font-semibold">Active Sessions (Max 5)</span><Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleRevokeAll}><IconAlertOctagon size={14}/> Revoke All</Button></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow className="text-"><TableHead>Device</TableHead><TableHead>Browser</TableHead><TableHead>IP</TableHead><TableHead>Last</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{displayedSessions.map((s,i)=><TableRow key={s.id||i}><TableCell className="font-medium flex items-center gap-2">{s.deviceName}{s.isCurrent&&<Badge className="text- bg-emerald-500/15 text-emerald-600">Current</Badge>}</TableCell><TableCell className="text-muted-foreground text-xs">{s.browser}</TableCell><TableCell className="font-mono text-xs text-primary">{s.ipAddress}</TableCell><TableCell className="text-xs text-muted-foreground">{s.lastActivity? new Date(s.lastActivity).toLocaleString('id-ID'):'-'}</TableCell><TableCell className="text-right">{!s.isCurrent? <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={()=>handleRevokeSession(s.id,s.deviceName)}><IconLogout size={12}/> Out</Button>: <span className="text-xs text-emerald-500">Active</span>}</TableCell></TableRow>)}</TableBody></Table>{displayedSessions.length===0&&<div className="p-8 text-center text-sm text-muted-foreground">No sessions</div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card><CardHeader className="py-3 flex-row items-center justify-between space-y-0 border-b"><span className="text-sm font-semibold">Recent Login History (Max 5)</span><Button variant="outline" size="sm" className="h-7 text-xs gap-1"><IconDownload size={14}/> Export CSV</Button></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow className="text-"><TableHead>Activity</TableHead><TableHead>Device</TableHead><TableHead>IP</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader><TableBody>{activities.map((a,i)=><TableRow key={i}><TableCell className="font-medium text-xs">{a.activity}</TableCell><TableCell className="text-xs text-muted-foreground">{a.device}</TableCell><TableCell className="font-mono text-xs text-primary">{a.ipAddress}</TableCell><TableCell className="text-xs text-muted-foreground">{a.occurredAt? new Date(a.occurredAt).toLocaleString('id-ID'):'-'}</TableCell><TableCell className="text-right"><Badge className="text- bg-emerald-500/15 text-emerald-600">Success</Badge></TableCell></TableRow>)}</TableBody></Table>{activities.length===0&&<div className="p-8 text-center text-sm text-muted-foreground">No logs</div>}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}