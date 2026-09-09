'use client';

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
} from '@tabler/icons-react';

// Base URL Backend API dari environment variable Vercel atau fallback ke URL Render
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://aumonext-api.onrender.com'
).replace(/\/$/, '');

// DTO disesuaikan dengan ActiveSessionViewModel C#
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

// DTO disesuaikan dengan LoginActivityViewModel C#
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

// SecurityStatusViewModel C#
export interface SecurityStatusDto {
  statusLevel?: string;
  activeSessionsCount?: number;
  failedAttemptsLast24Hours?: number;
  lastSuccessfulLogin?: string;
  emailVerified?: boolean;
}

// GuardianDashboardViewModel C#
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
  const [activeTab, setActiveTab] = useState<string>('health');

  // State data utama dari Backend
  const [viewModel, setViewModel] = useState<GuardianViewModel | null>(null);
  const [activeSessionsList, setActiveSessionsList] = useState<UserSessionDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Notification State
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch data dari API endpoint backend (/api/v1/guardian/dashboard)
  useEffect(() => {
    const fetchGuardianData = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        // Solusi 1: Pemanggilan endpoint diarahkan ke /api/v1/guardian/dashboard
        const response = await fetch(`${API_BASE_URL}/api/v1/guardian/dashboard`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Gagal mengambil data keamanan.');
        }

        const json = await response.json();

        if (json.success && json.data) {
          const data = json.data;
          setViewModel(data);

          // Mendukung struktur data dari GuardianDashboardViewModel maupun array langsung
          const sessions = data.activeSessions || json.activeSessions || [];
          setActiveSessionsList(sessions);
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

  // Handle Revoke Individual Session
  const handleRevokeSession = async (sessionId?: string, deviceName?: string) => {
    if (!sessionId) return;

    if (!window.confirm(`Akhiri sesi untuk perangkat "${deviceName || 'ini'}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/guardian/revoke-session/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  // Handle Revoke All Sessions (Emergency Lockout)
  const handleRevokeAllSessions = async () => {
    const confirmed = window.confirm(
      'Emergency Lockout: Apakah Anda yakin ingin keluar dari SEMUA perangkat lain?'
    );
    if (!confirmed) return;

    try {
      // Diselaraskan dengan endpoint [HttpPost("revoke-all-sessions")] di C#
      const response = await fetch(`${API_BASE_URL}/api/v1/guardian/revoke-all-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      <div className="container-fluid py-5 text-center text-white">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-white-50">Memuat Guardian Security Dashboard...</p>
      </div>
    );
  }

  // Membatasi Login History Maksimal 5
  const activities = (viewModel?.recentActivities || []).slice(0, 5);
  // Membatasi Active Sessions Maksimal 5 untuk display
  const displayedSessions = activeSessionsList.slice(0, 5);

  // Kalkulasi Skor Keamanan jika tidak ada field eksplisit dari BE
  const statusLevel = viewModel?.securityStatus?.statusLevel || 'Good';
  const calculatedScore = viewModel?.securityScore ?? (statusLevel === 'Warning' ? 60 : 95);

  return (
    <div
      className="container-fluid py-4 px-4 text-white"
      style={{ fontFamily: "'Aptos', 'Aptos Display', 'Segoe UI', sans-serif" }}
    >
      {/* Header & Overall Health Badge */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h4 className="mb-1 text-white fw-bold d-flex align-items-center gap-2">
            <IconShieldCheck className="text-warning" size={28} />
            Guardian Security
          </h4>
          <p className="text-white-50 small mb-0">
            Security health monitoring, active sessions, and login logs
          </p>
        </div>
        <div>
          <span
            className={`badge ${calculatedScore >= 70 ? 'bg-success' : 'bg-warning'} fs-6 px-3 py-2 shadow-sm d-inline-flex align-items-center gap-2`}
          >
            <IconHeartbeat size={20} /> Security Score: {calculatedScore}%
          </span>
        </div>
      </div>

      {/* Alert Notifications */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show mb-4 shadow-sm d-flex align-items-center" role="alert">
          <IconCircleCheck className="me-2 flex-shrink-0" size={20} />
          <div>{successMessage}</div>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setSuccessMessage(null)}
          ></button>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show mb-4 shadow-sm d-flex align-items-center" role="alert">
          <IconAlertTriangle className="me-2 flex-shrink-0" size={20} />
          <div>{errorMessage}</div>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setErrorMessage(null)}
          ></button>
        </div>
      )}

      {/* SUB-TABS NAVIGATION (Nav Pills) */}
      <ul className="nav nav-pills mb-4 border-bottom border-secondary border-opacity-25 pb-3" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link fw-bold d-inline-flex align-items-center gap-2 ${
              activeTab === 'health' ? 'active bg-primary text-white shadow-sm' : 'text-white-50'
            }`}
            type="button"
            onClick={() => setActiveTab('health')}
          >
            <IconActivity className="text-danger" size={18} /> Security Health
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link fw-bold d-inline-flex align-items-center gap-2 ${
              activeTab === 'sessions' ? 'active bg-primary text-white shadow-sm' : 'text-white-50'
            }`}
            type="button"
            onClick={() => setActiveTab('sessions')}
          >
            <IconDeviceLaptop className="text-info" size={18} /> Active Sessions
            <span className="badge bg-secondary ms-1">{displayedSessions.length}</span>
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link fw-bold d-inline-flex align-items-center gap-2 ${
              activeTab === 'logs' ? 'active bg-primary text-white shadow-sm' : 'text-white-50'
            }`}
            type="button"
            onClick={() => setActiveTab('logs')}
          >
            <IconHistory className="text-warning" size={18} /> Login Logs
          </button>
        </li>
      </ul>

      {/* TAB CONTENTS */}
      <div className="tab-content">
        {/* ==================== TAB 1: SECURITY HEALTH ==================== */}
        <div className={`tab-pane fade ${activeTab === 'health' ? 'show active' : ''}`}>
          <div className="card glass-card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center py-3">
              <strong className="text-white d-flex align-items-center gap-2">
                <IconHeartbeat className="text-danger" size={20} /> Security &amp; Account Health Checkup
              </strong>
              <small className="text-white-50">Automated Analysis</small>
            </div>
            <div className="card-body p-0">
              <div className="list-group list-group-flush bg-transparent">
                <div className="list-group-item bg-transparent text-white border-secondary border-opacity-25 p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <div className="fw-bold d-flex align-items-center gap-2">
                      <IconDeviceLaptop className="text-info" size={18} /> Account Security Level
                    </div>
                    <small className="text-white-50">Overall account threat and status evaluation</small>
                  </div>
                  <div>
                    <span className={`badge ${statusLevel === 'Warning' ? 'bg-warning text-dark' : 'bg-success'}`}>
                      {statusLevel}
                    </span>
                  </div>
                </div>

                <div className="list-group-item bg-transparent text-white border-secondary border-opacity-25 p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <div className="fw-bold d-flex align-items-center gap-2">
                      <IconAlertTriangle className="text-warning" size={18} /> Failed Login Attempts (24h)
                    </div>
                    <small className="text-white-50">Failed authentication tries within last 24 hours</small>
                  </div>
                  <div>
                    <span className="badge bg-secondary">
                      {viewModel?.securityStatus?.failedAttemptsLast24Hours ?? 0} Attempts
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== TAB 2: ACTIVE SESSIONS (MAX 5) ==================== */}
        <div className={`tab-pane fade ${activeTab === 'sessions' ? 'show active' : ''}`}>
          <div className="card glass-card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center py-3 flex-wrap gap-2">
              <strong className="text-white d-flex align-items-center gap-2">
                <IconDeviceLaptop className="text-info" size={20} /> Active Sessions (Max 5)
              </strong>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                onClick={handleRevokeAllSessions}
              >
                <IconAlertOctagon size={16} /> Revoke All Other Sessions
              </button>
            </div>
            <div className="card-body p-0">
              {displayedSessions.length === 0 ? (
                <div className="p-4 text-center text-white-50">No active sessions found.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 text-white">
                    <thead className="table-light text-secondary small">
                      <tr>
                        <th className="ps-4">Device</th>
                        <th>Browser</th>
                        <th>IP Address</th>
                        <th>Last Activity</th>
                        <th className="text-end pe-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="border-top-0">
                      {displayedSessions.map((session, index) => {
                        const activityDate = session.lastActivityAt || session.lastActivity;
                        return (
                          <tr key={session.id || index}>
                            <td className="ps-4 fw-bold">
                              {session.deviceName}
                              {session.isCurrent && <span className="badge bg-success ms-2">Current</span>}
                            </td>
                            <td className="text-white-50">{session.browser}</td>
                            <td className="font-monospace text-info">{session.ipAddress}</td>
                            <td className="text-white-50 small">
                              {activityDate ? new Date(activityDate).toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="text-end pe-4">
                              {!session.isCurrent ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1 ms-auto"
                                  onClick={() => handleRevokeSession(session.id, session.deviceName)}
                                >
                                  <IconLogout size={16} /> Sign Out
                                </button>
                              ) : (
                                <span className="badge bg-success">Active now</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ==================== TAB 3: LOGIN LOGS (MAX 5) ==================== */}
        <div className={`tab-pane fade ${activeTab === 'logs' ? 'show active' : ''}`}>
          <div className="card glass-card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center py-3 flex-wrap gap-2">
              <strong className="text-white d-flex align-items-center gap-2">
                <IconHistory className="text-info" size={20} /> Recent Login History (Max 5)
              </strong>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                onClick={() => alert('Exporting audit log CSV...')}
              >
                <IconDownload size={16} /> Export Log (CSV)
              </button>
            </div>
            <div className="card-body p-0">
              {activities.length === 0 ? (
                <div className="p-4 text-center text-white-50">No login activity found.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 text-white">
                    <thead className="table-light text-secondary small">
                      <tr>
                        <th className="ps-4">Activity</th>
                        <th>Device</th>
                        <th>IP Address</th>
                        <th>Date</th>
                        <th className="text-end pe-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="border-top-0">
                      {activities.map((act, idx) => {
                        const actDate = act.createdAt || act.occurredAt;
                        const isSuccess = act.isSuccess ?? true;
                        return (
                          <tr key={act.id || idx}>
                            <td className="ps-4 fw-semibold">{act.activityType || act.activity || 'Interactive Login'}</td>
                            <td className="text-white-50">{act.device}</td>
                            <td className="font-monospace text-info">{act.ipAddress}</td>
                            <td className="text-white-50 small">
                              {actDate ? new Date(actDate).toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="text-end pe-4">
                              <span className={`badge ${isSuccess ? 'bg-success' : 'bg-danger'}`}>
                                {isSuccess ? 'Success' : 'Failed'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
