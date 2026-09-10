import React, { useState, useEffect } from 'react';
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
  IconLoader2,
} from '@tabler/icons-react';

import apiClient from '@/services/apiClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface UserSessionDto {
  id?: string;
  deviceName: string;
  browser: string;
  ipAddress: string;
  country: string;
  lastActivity: string;
  isCurrent: boolean;
}

export interface LoginActivityDto {
  activity: string;
  device: string;
  browser: string;
  country: string;
  ipAddress: string;
  occurredAt: string;
}

export interface SecurityStatusDto {
  emailVerified: boolean;
}

export interface GuardianViewModel {
  username: string;
  email: string;
  securityScore: number;
  activeSessions: number;
  trustedDevices: number;
  lastLogin: string;
  security: SecurityStatusDto;
  recentActivities: LoginActivityDto[];
}

export default function GuardianSecurityPage() {
  const [activeTab, setActiveTab] = useState<'health' | 'sessions' | 'logs'>('health');

  const [viewModel, setViewModel] = useState<GuardianViewModel | null>(null);
  const [activeSessionsList, setActiveSessionsList] = useState<UserSessionDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchGuardianData = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        // Cukup panggil path relatif karena baseURL sudah di-set di apiClient
        const response = await apiClient.get('/api/v1/guardian');

        if (response.status !== 200 && response.status !== 201) {
          throw new Error('Gagal mengambil data keamanan.');
        }

        const json = response.data;

        if (json.success && json.data) {
          setViewModel(json.data);
          setActiveSessionsList(json.activeSessions || []);
        } else {
          throw new Error(json.message || 'Gagal memuat data keamanan.');
        }
      } catch (err: any) {
        setErrorMessage(err.response?.data?.message || err.message || 'Terjadi kesalahan saat memuat data.');
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
      // Gunakan apiClient.post untuk request HTTP POST
      const response = await apiClient.post(`/api/v1/guardian/revoke-session/${sessionId}`);

      if (response.status !== 200 && response.status !== 201) {
        throw new Error('Gagal mengakhiri sesi.');
      }

      setActiveSessionsList((prev) => prev.filter((s) => s.id !== sessionId));
      setSuccessMessage('Sesi berhasil diakhiri.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Gagal merevoke sesi.');
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm('Emergency Lockout: Apakah Anda yakin ingin keluar dari SEMUA perangkat lain?')) return;

    try {
      // Gunakan apiClient.post untuk request HTTP POST
      const response = await apiClient.post('/api/v1/guardian/revoke-all');

      if (response.status !== 200 && response.status !== 201) {
        throw new Error('Gagal mengakhiri semua sesi.');
      }

      setActiveSessionsList((prev) => prev.filter((s) => s.isCurrent));
      setSuccessMessage('Semua sesi perangkat lain telah berhasil diakhiri.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Gagal mengeksekusi emergency lockout.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <IconLoader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <p className="text-xs font-medium tracking-wide">Memuat Guardian Security Dashboard...</p>
      </div>
    );
  }

  const activities = (viewModel?.recentActivities || []).slice(0, 5);
  const displayedSessions = activeSessionsList.slice(0, 5);
  const score = viewModel?.securityScore ?? 0;

  return (
    <div className="space-y-6 antialiased text-foreground">
      {/* Header & Overall Health Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <IconShieldCheck className="text-amber-500" size={26} stroke={2} />
            Guardian Security
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Security health monitoring, active sessions, and login logs
          </p>
        </div>
        <div>
          <Badge
            variant="outline"
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold ${
              score >= 70
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            <IconHeartbeat size={18} />
            <span>Security Score: {score}%</span>
          </Badge>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
          <div className="flex items-center gap-2.5">
            <IconCircleCheck size={18} className="text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            &times;
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive-foreground text-xs">
          <div className="flex items-center gap-2.5">
            <IconAlertTriangle size={18} className="text-destructive shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-destructive hover:opacity-80">
            &times;
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex space-x-1 border-b pb-3">
        <Button
          variant={activeTab === 'health' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('health')}
          className="gap-2 text-xs"
        >
          <IconActivity size={16} className="text-rose-400" /> Security Health
        </Button>

        <Button
          variant={activeTab === 'sessions' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('sessions')}
          className="gap-2 text-xs"
        >
          <IconDeviceLaptop size={16} className="text-cyan-400" /> Active Sessions
          <Badge variant="secondary" className="px-1.5 py-0.2 text-[10px] ml-1">
            {displayedSessions.length}
          </Badge>
        </Button>

        <Button
          variant={activeTab === 'logs' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('logs')}
          className="gap-2 text-xs"
        >
          <IconHistory size={16} className="text-amber-400" /> Login Logs
        </Button>
      </div>

      {/* Tab 1: Security Health */}
      {activeTab === 'health' && (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-xs">
              <IconHeartbeat className="text-rose-400" size={18} /> Security & Account Health Checkup
            </div>
            <span className="text-[11px] text-muted-foreground">Automated Analysis</span>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div>
                <p className="text-xs font-medium flex items-center gap-2">
                  <IconDeviceLaptop size={16} className="text-cyan-400" /> Email Verification Status
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Primary account email confirmation</p>
              </div>
              <div>
                {viewModel?.security?.emailVerified ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                    Unverified
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Active Sessions */}
      {activeTab === 'sessions' && (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold text-xs">
              <IconDeviceLaptop className="text-cyan-400" size={18} /> Active Sessions (Max 5)
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRevokeAllSessions}
              className="gap-1.5 h-8 text-xs"
            >
              <IconAlertOctagon size={15} /> Revoke All Other Sessions
            </Button>
          </div>

          <div className="overflow-x-auto">
            {displayedSessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No active sessions found.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground text-[11px] font-medium border-b">
                  <tr>
                    <th className="py-3 px-4">Device</th>
                    <th className="py-3 px-4">Browser</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayedSessions.map((session, index) => (
                    <tr key={session.id || index} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold flex items-center gap-2">
                        {session.deviceName}
                        {session.isCurrent && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                            Current
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{session.browser}</td>
                      <td className="py-3 px-4 font-mono text-cyan-400 text-[11px]">{session.ipAddress}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {session.lastActivity ? new Date(session.lastActivity).toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!session.isCurrent ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeSession(session.id, session.deviceName)}
                            className="text-destructive hover:bg-destructive/10 gap-1 h-7 text-[11px]"
                          >
                            <IconLogout size={14} /> Sign Out
                          </Button>
                        ) : (
                          <span className="text-[11px] font-medium text-emerald-400">Active now</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Login Logs */}
      {activeTab === 'logs' && (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold text-xs">
              <IconHistory className="text-amber-400" size={18} /> Recent Login History (Max 5)
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => alert('Exporting audit log CSV...')}
              className="gap-1.5 h-8 text-xs"
            >
              <IconDownload size={15} /> Export Log (CSV)
            </Button>
          </div>

          <div className="overflow-x-auto">
            {activities.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No login activity found.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground text-[11px] font-medium border-b">
                  <tr>
                    <th className="py-3 px-4">Activity</th>
                    <th className="py-3 px-4">Device</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activities.map((act, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold">{act.activity}</td>
                      <td className="py-3 px-4 text-muted-foreground">{act.device}</td>
                      <td className="py-3 px-4 font-mono text-cyan-400 text-[11px]">{act.ipAddress}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {act.occurredAt ? new Date(act.occurredAt).toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                          Success
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
