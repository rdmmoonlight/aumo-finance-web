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

// Mendukung Vite (import.meta.env) & Next.js/CRA (process.env) secara aman
const getApiUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.API_URL) {
    return import.meta.env.API_URL;
  }
  if (typeof process !== 'undefined' && process.env?.API_URL) {
    return process.env.API_URL;
  }
  return 'https://aumonext-api.onrender.com';
};

const API_BASE_URL = getApiUrl().replace(/\/$/, '');

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

        const response = await fetch(`${API_BASE_URL}/api/v1/guardian`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!response.ok) throw new Error('Gagal mengambil data keamanan.');

        const json = await response.json();

        if (json.success && json.data) {
          setViewModel(json.data);
          setActiveSessionsList(json.activeSessions || []);
        } else {
          throw new Error(json.message || 'Gagal memuat data keamanan.');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Terjadi kesalahan saat memuat data.');
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
      const response = await fetch(`${API_BASE_URL}/api/v1/guardian/revoke-session/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Gagal mengakhiri sesi.');

      setActiveSessionsList((prev) => prev.filter((s) => s.id !== sessionId));
      setSuccessMessage('Sesi berhasil diakhiri.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal merevoke sesi.');
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm('Emergency Lockout: Apakah Anda yakin ingin keluar dari SEMUA perangkat lain?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/guardian/revoke-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Gagal mengakhiri semua sesi.');

      setActiveSessionsList((prev) => prev.filter((s) => s.isCurrent));
      setSuccessMessage('Semua sesi perangkat lain telah berhasil diakhiri.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengeksekusi emergency lockout.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-400">
        <IconLoader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <p className="text-xs font-medium tracking-wide">Memuat Guardian Security Dashboard...</p>
      </div>
    );
  }

  const activities = (viewModel?.recentActivities || []).slice(0, 5);
  const displayedSessions = activeSessionsList.slice(0, 5);
  const score = viewModel?.securityScore ?? 0;

  return (
    <div className="space-y-6 antialiased">
      {/* Header & Overall Health Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <IconShieldCheck className="text-amber-500" size={26} stroke={2} />
            Guardian Security
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Security health monitoring, active sessions, and login logs
          </p>
        </div>
        <div>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              score >= 70
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            <IconHeartbeat size={18} />
            <span>Security Score: {score}%</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
          <div className="flex items-center gap-2.5">
            <IconCircleCheck size={18} className="text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            &times;
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <div className="flex items-center gap-2.5">
            <IconAlertTriangle size={18} className="text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200">
            &times;
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex space-x-1 border-b border-zinc-800/80 pb-3">
        <button
          onClick={() => setActiveTab('health')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'health'
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <IconActivity size={16} className="text-rose-400" /> Security Health
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'sessions'
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <IconDeviceLaptop size={16} className="text-cyan-400" /> Active Sessions
          <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-zinc-700/60 text-zinc-300">
            {displayedSessions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'logs'
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <IconHistory size={16} className="text-amber-400" /> Login Logs
        </button>
      </div>

      {/* Tab 1: Security Health */}
      {activeTab === 'health' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-xs text-zinc-200">
              <IconHeartbeat className="text-rose-400" size={18} /> Security & Account Health Checkup
            </div>
            <span className="text-[11px] text-zinc-500">Automated Analysis</span>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/60">
              <div>
                <p className="text-xs font-medium text-zinc-200 flex items-center gap-2">
                  <IconDeviceLaptop size={16} className="text-cyan-400" /> Email Verification Status
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Primary account email confirmation</p>
              </div>
              <div>
                {viewModel?.security?.emailVerified ? (
                  <span className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Verified
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Unverified
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Active Sessions */}
      {activeTab === 'sessions' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold text-xs text-zinc-200">
              <IconDeviceLaptop className="text-cyan-400" size={18} /> Active Sessions (Max 5)
            </div>
            <button
              onClick={handleRevokeAllSessions}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-medium transition-all"
            >
              <IconAlertOctagon size={15} /> Revoke All Other Sessions
            </button>
          </div>

          <div className="overflow-x-auto">
            {displayedSessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">No active sessions found.</div>
            ) : (
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/60 text-zinc-400 text-[11px] font-medium border-b border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Device</th>
                    <th className="py-3 px-4">Browser</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {displayedSessions.map((session, index) => (
                    <tr key={session.id || index} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-zinc-100 flex items-center gap-2">
                        {session.deviceName}
                        {session.isCurrent && (
                          <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">{session.browser}</td>
                      <td className="py-3 px-4 font-mono text-cyan-400 text-[11px]">{session.ipAddress}</td>
                      <td className="py-3 px-4 text-zinc-400">
                        {session.lastActivity ? new Date(session.lastActivity).toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!session.isCurrent ? (
                          <button
                            onClick={() => handleRevokeSession(session.id, session.deviceName)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[11px] font-medium transition-all"
                          >
                            <IconLogout size={14} /> Sign Out
                          </button>
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
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold text-xs text-zinc-200">
              <IconHistory className="text-amber-400" size={18} /> Recent Login History (Max 5)
            </div>
            <button
              onClick={() => alert('Exporting audit log CSV...')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-all"
            >
              <IconDownload size={15} /> Export Log (CSV)
            </button>
          </div>

          <div className="overflow-x-auto">
            {activities.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">No login activity found.</div>
            ) : (
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/60 text-zinc-400 text-[11px] font-medium border-b border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Activity</th>
                    <th className="py-3 px-4">Device</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {activities.map((act, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-zinc-100">{act.activity}</td>
                      <td className="py-3 px-4 text-zinc-400">{act.device}</td>
                      <td className="py-3 px-4 font-mono text-cyan-400 text-[11px]">{act.ipAddress}</td>
                      <td className="py-3 px-4 text-zinc-400">
                        {act.occurredAt ? new Date(act.occurredAt).toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                          Success
                        </span>
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