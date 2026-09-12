'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconShieldCheck,
  IconHeartbeat,
  IconCircleCheck,
  IconAlertTriangle,
  IconActivity,
  IconDeviceLaptop,
  IconAlertOctagon,
  IconLogout,
  IconHistory,
  IconDownload,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

const NEXT_PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://aumonext-api.onrender.com').replace(/\/$/, '');

export interface UserSessionDto {
  id?: string;
  deviceName: string;
  operatingSystem?: string;
  browser: string;
  ipAddress: string;
  country: string;
  lastActivityAt?: string;
  lastActivity?: string;
  isCurrent: boolean;
}
export interface LoginActivityDto {
  id?: string;
  activityType?: string;
  activity?: string;
  device: string;
  operatingSystem?: string;
  browser: string;
  country: string;
  ipAddress: string;
  createdAt?: string;
  occurredAt?: string;
  isSuccess?: boolean;
}
export interface SecurityStatusDto {
  statusLevel?: string;
  activeSessionsCount?: number;
  failedAttemptsLast24Hours?: number;
  lastSuccessfulLogin?: string;
  emailVerified?: boolean;
}
export interface GuardianViewModel {
  username?: string;
  email?: string;
  securityScore?: number;
  activeSessionsCount?: number;
  trustedDevices?: number;
  lastLogin?: string;
  securityStatus?: SecurityStatusDto;
  security?: SecurityStatusDto;
  recentActivities?: LoginActivityDto[];
  activeSessions?: UserSessionDto[];
}

export default function GuardianSecurityPage() {
  const [activeTab, setActiveTab] = useState('health');
  const [viewModel, setViewModel] = useState<GuardianViewModel | null>(null);
  const [activeSessionsList, setActiveSessionsList] = useState<UserSessionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchGuardianData = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/guardian/dashboard`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Gagal mengambil data keamanan.');
        const json = await res.json();
        if (json.success && json.data) {
          setViewModel(json.data);
          setActiveSessionsList(json.data.activeSessions || json.activeSessions || []);
        } else throw new Error(json.message || 'Gagal memuat data.');
      } catch (err: any) {
        setErrorMessage(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGuardianData();
  }, []);

  const handleRevokeSession = async (sessionId?: string, deviceName?: string) => {
    if (!sessionId) return;
    if (!window.confirm(`Akhiri sesi untuk perangkat "${deviceName || 'ini'}"?`)) return;
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/guardian/revoke-session/${sessionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (!res.ok) throw new Error('Gagal mengakhiri sesi.');
      setActiveSessionsList((prev) => prev.filter((s) => s.id!== sessionId));
      setSuccessMessage('Sesi berhasil diakhiri.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm('Emergency Lockout: Yakin ingin keluar dari SEMUA perangkat lain?')) return;
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/guardian/revoke-all-sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (!res.ok) throw new Error('Gagal mengakhiri semua sesi.');
      setActiveSessionsList((prev) => prev.filter((s) => s.isCurrent));
      setSuccessMessage('Semua sesi perangkat lain telah berhasil diakhiri.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h- w-full" />
      </div>
    );
  }

  const activities = (viewModel?.recentActivities || []).slice(0, 5);
  const displayedSessions = activeSessionsList.slice(0, 5);
  const statusLevel = viewModel?.securityStatus?.statusLevel || 'Good';
  const calculatedScore = viewModel?.securityScore?? (statusLevel === 'Warning'? 60 : 95);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <IconShieldCheck className="h-5 w-5" />
            </span>
            Guardian Security
          </h4>
          <p className="text-sm text-muted-foreground">Security health monitoring, active sessions, and login logs</p>
        </div>
        <Badge variant={calculatedScore >= 70? 'default' : 'destructive'} className={`gap-2 px-3 py-1.5 text-sm ${calculatedScore >= 70? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}>
          <IconHeartbeat className="h-4 w-4" /> Security Score: {calculatedScore}%
        </Badge>
      </div>

      {/* Alerts */}
      {successMessage && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <IconCircleCheck className="h-4 w-4" />
          <AlertDescription className="flex w-full items-center justify-between">
            {successMessage}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSuccessMessage(null)}><IconX className="h-4 w-4" /></Button>
          </AlertDescription>
        </Alert>
      )}
      {errorMessage && (
        <Alert variant="destructive">
          <IconAlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex w-full items-center justify-between">
            {errorMessage}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setErrorMessage(null)}><IconX className="h-4 w-4" /></Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-auto rounded-full p-1">
          <TabsTrigger value="health" className="gap-2 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <IconActivity className="h-4 w-4 text-red-500" /> Security Health
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2 rounded-full">
            <IconDeviceLaptop className="h-4 w-4 text-sky-500" /> Active Sessions <Badge variant="secondary" className="ml-1">{displayedSessions.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2 rounded-full">
            <IconHistory className="h-4 w-4 text-amber-500" /> Login Logs
          </TabsTrigger>
        </TabsList>

        {/* TAB HEALTH */}
        <TabsContent value="health" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><IconHeartbeat className="h-5 w-5 text-red-500" /> Security & Account Health Checkup</CardTitle>
              <span className="text-xs text-muted-foreground">Automated Analysis</span>
            </CardHeader>
            <CardContent className="divide-y p-0">
              <div className="flex items-center justify-between p-4">
                <div><div className="flex items-center gap-2 font-semibold"><IconDeviceLaptop className="h-4 w-4 text-sky-500" /> Account Security Level</div><p className="text-xs text-muted-foreground">Overall account threat and status evaluation</p></div>
                <Badge variant={statusLevel === 'Warning'? 'destructive' : 'default'} className={statusLevel!== 'Warning'? 'bg-emerald-500 hover:bg-emerald-600' : ''}>{statusLevel}</Badge>
              </div>
              <div className="flex items-center justify-between p-4">
                <div><div className="flex items-center gap-2 font-semibold"><IconAlertTriangle className="h-4 w-4 text-amber-500" /> Failed Login Attempts (24h)</div><p className="text-xs text-muted-foreground">Failed authentication tries within last 24 hours</p></div>
                <Badge variant="secondary">{viewModel?.securityStatus?.failedAttemptsLast24Hours?? 0} Attempts</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB SESSIONS */}
        <TabsContent value="sessions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><IconDeviceLaptop className="h-5 w-5 text-sky-500" /> Active Sessions (Max 5)</CardTitle>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleRevokeAllSessions}><IconAlertOctagon className="h-4 w-4" /> Revoke All Other Sessions</Button>
            </CardHeader>
            <CardContent className="p-0">
              {displayedSessions.length === 0? (
                <div className="p-8 text-center text-sm text-muted-foreground">No active sessions found.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead className="pl-6">Device</TableHead><TableHead>Browser</TableHead><TableHead>IP Address</TableHead><TableHead>Last Activity</TableHead><TableHead className="pr-6 text-right">Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {displayedSessions.map((s, i) => (
                      <TableRow key={s.id || i}>
                        <TableCell className="pl-6 font-semibold">{s.deviceName} {s.isCurrent && <Badge className="ml-2 bg-emerald-500">Current</Badge>}</TableCell>
                        <TableCell className="text-muted-foreground">{s.browser}</TableCell>
                        <TableCell className="font-mono text-sky-500">{s.ipAddress}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{(s.lastActivityAt || s.lastActivity)? new Date(s.lastActivityAt || s.lastActivity!).toLocaleString('id-ID') : '-'}</TableCell>
                        <TableCell className="pr-6 text-right">
                          {!s.isCurrent? <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleRevokeSession(s.id, s.deviceName)}><IconLogout className="h-4 w-4" /> Sign Out</Button> : <Badge className="bg-emerald-500">Active now</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB LOGS */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><IconHistory className="h-5 w-5 text-sky-500" /> Recent Login History (Max 5)</CardTitle>
              <Button variant="outline" size="sm" onClick={() => alert('Exporting audit log CSV...')}><IconDownload className="h-4 w-4" /> Export Log (CSV)</Button>
            </CardHeader>
            <CardContent className="p-0">
              {activities.length === 0? (
                <div className="p-8 text-center text-sm text-muted-foreground">No login activity found.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead className="pl-6">Activity</TableHead><TableHead>Device</TableHead><TableHead>IP Address</TableHead><TableHead>Date</TableHead><TableHead className="pr-6 text-right">Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {activities.map((act, idx) => (
                      <TableRow key={act.id || idx}>
                        <TableCell className="pl-6 font-medium">{act.activityType || act.activity || 'Interactive Login'}</TableCell>
                        <TableCell className="text-muted-foreground">{act.device}</TableCell>
                        <TableCell className="font-mono text-sky-500">{act.ipAddress}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{(act.createdAt || act.occurredAt)? new Date(act.createdAt || act.occurredAt!).toLocaleString('id-ID') : '-'}</TableCell>
                        <TableCell className="pr-6 text-right"><Badge className={act.isSuccess?? true? 'bg-emerald-500 hover:bg-emerald-600' : ''} variant={(act.isSuccess?? true)? 'default' : 'destructive'}>{(act.isSuccess?? true)? 'Success' : 'Failed'}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}