'use client';

import React, { useState, useEffect } from 'react';
import {
  IconShieldCheck,
  IconHeartbeat,
  IconCircleCheck,
  IconAlertTriangle,
  IconActivity,
  IconDeviceLaptop,
  IconAdjustments,
  IconAlertOctagon,
  IconLogout,
  IconHistory,
  IconDownload,
} from '@tabler/icons-react';

// Interface disesuaikan dengan GuardianViewModel.cs & DTO backend
export interface UserSessionDto {
  id: string;
  deviceName: string;
  browser: string;
  ipAddress: string;
  lastActivityAt: string;
  isCurrent: boolean;
  isActive: boolean;
}

export interface LoginActivityDto {
  id: string;
  activityType: string;
  device: string;
  ipAddress: string;
  createdAt: string;
  isSuccess: boolean;
}

export interface GuardianViewModel {
  accountStatus: string;
  isAccountHealthy: boolean;
  privacyMode: boolean;
  autoLockTimeoutMinutes: number;
  activeSessions: UserSessionDto[];
  recentActivities: LoginActivityDto[];
}

export default function GuardianSecurityPage() {
  const [activeTab, setActiveTab] = useState<string>('health');
  
  // State data utama dari GuardianViewModel
  const [viewModel, setViewModel] = useState<GuardianViewModel | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Notification State
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settings State
  const [privacyMode, setPrivacyMode] = useState<boolean>(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState<string>('5');

  // Fetch data dari API endpoint
  useEffect(() => {
    const fetchGuardianData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/guardian');
        if (!response.ok) {
          throw new Error('Gagal mengambil data keamanan.');
        }
        const data: GuardianViewModel = await response.json();
        
        setViewModel(data);
        setPrivacyMode(data.privacyMode);
        setAutoLockTimeout(data.autoLockTimeoutMinutes.toString());
      } catch (err: any) {
        setErrorMessage(err.message || 'Terjadi kesalahan saat memuat data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuardianData();
  }, []);

  // Handle Revoke Individual Session
  const handleRevokeSession = async (sessionId: string) => {
    if (!viewModel) return;
    
    const sessionTarget = viewModel.activeSessions.find((s) => s.id === sessionId);
    if (!window.confirm(`Terminate session for "${sessionTarget?.deviceName || 'this device'}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/guardian/sessions/${sessionId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Gagal mengakhiri sesi.');

      setViewModel((prev) =>
        prev
          ? {
              ...prev,
              activeSessions: prev.activeSessions.filter((s) => s.id !== sessionId),
            }
          : null
      );
      setSuccessMessage('Session has been signed out successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal merevoke sesi.');
    }
  };

  // Handle Revoke All Sessions (Emergency Lockout)
  const handleRevokeAllSessions = async () => {
    const confirmed = window.confirm(
      'Emergency Lockout: Are you sure you want to sign out of ALL devices? You will be required to log in again.'
    );
    if (!confirmed) return;

    try {
      const response = await fetch('/api/guardian/sessions/revoke-all', { method: 'POST' });
      if (!response.ok) throw new Error('Gagal mengakhiri semua sesi.');

      setViewModel((prev) =>
        prev
          ? {
              ...prev,
              activeSessions: prev.activeSessions.filter((s) => s.isCurrent),
            }
          : null
      );
      setSuccessMessage('All other active sessions have been terminated.');

      setTimeout(() => {
        window.location.href = '/auth/login';
      }, 1500);
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

  const sessions = viewModel?.activeSessions || [];
  const activities = viewModel?.recentActivities || [];

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
            Security health monitoring, active sessions, and protection controls
          </p>
        </div>
        <div>
          <span className={`badge ${viewModel?.isAccountHealthy ? 'bg-success' : 'bg-warning'} fs-6 px-3 py-2 shadow-sm d-inline-flex align-items-center gap-2`}>
            <IconHeartbeat size={20} /> {viewModel?.accountStatus || 'Account Healthy'}
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
            <span className="badge bg-secondary ms-1">{sessions.length}</span>
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link fw-bold d-inline-flex align-items-center gap-2 ${
              activeTab === 'protection' ? 'active bg-primary text-white shadow-sm' : 'text-white-50'
            }`}
            type="button"
            onClick={() => setActiveTab('protection')}
          >
            <IconAdjustments className="text-warning" size={18} /> Protection &amp; Logs
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
                      <IconDeviceLaptop className="text-info" size={18} /> Active Device Sessions
                    </div>
                    <small className="text-white-50">Monitors how many devices are currently signed in.</small>
                  </div>
                  <div>
                    <span className="badge bg-success">{sessions.length} Active Session(s)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== TAB 2: ACTIVE SESSIONS ==================== */}
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
                <IconAlertOctagon size={16} /> Revoke All Sessions
              </button>
            </div>
            <div className="card-body p-0">
              {sessions.length === 0 ? (
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
                      {sessions.slice(0, 5).map((session) => (
                        <tr key={session.id}>
                          <td className="ps-4 fw-bold">
                            {session.deviceName}
                            {session.isCurrent && <span className="badge bg-success ms-2">Current</span>}
                          </td>
                          <td className="text-white-50">{session.browser}</td>
                          <td className="font-monospace text-info">{session.ipAddress}</td>
                          <td className="text-white-50 small">{session.lastActivityAt}</td>
                          <td className="text-end pe-4">
                            {!session.isCurrent ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger btn-terminate-session d-inline-flex align-items-center gap-1 ms-auto"
                                onClick={() => handleRevokeSession(session.id)}
                              >
                                <IconLogout size={16} /> Sign Out
                              </button>
                            ) : (
                              <span className="badge bg-success">Active now</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ==================== TAB 3: PROTECTION & LOGS ==================== */}
        <div className={`tab-pane fade ${activeTab === 'protection' ? 'show active' : ''}`}>
          {/* Quick Settings Card */}
          <div className="card glass-card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 py-3">
              <strong className="text-white d-flex align-items-center gap-2">
                <IconAdjustments className="text-warning" size={20} /> Protection Settings
              </strong>
            </div>
            <div className="card-body p-4">
              <div className="row align-items-center g-3">
                <div className="col-md-6">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-bold">Privacy Mode (Mask Balances)</div>
                      <small className="text-white-50">Conceal monetary values across the app ($ &bull;&bull;&bull;&bull;&bull;)</small>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={privacyMode}
                        onChange={(e) => setPrivacyMode(e.target.checked)}
                      />
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-bold">Auto-Lock Timeout</div>
                      <small className="text-white-50">Automatically lock screen when idle</small>
                    </div>
                    <select
                      className="form-select form-select-sm bg-body-tertiary text-body border-secondary w-auto"
                      value={autoLockTimeout}
                      onChange={(e) => setAutoLockTimeout(e.target.value)}
                    >
                      <option value="0">Disabled</option>
                      <option value="5">5 Minutes</option>
                      <option value="15">15 Minutes</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Login Activity Log (Max 5) */}
          <div className="card glass-card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center py-3 flex-wrap gap-2">
              <strong className="text-white d-flex align-items-center gap-2">
                <IconHistory className="text-info" size={20} /> Recent Login History (Max 5)
              </strong>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                onClick={() => alert('Exporting audit log CSV simulation...')}
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
                      {activities.slice(0, 5).map((activity) => (
                        <tr key={activity.id}>
                          <td className="ps-4 fw-semibold">{activity.activityType}</td>
                          <td className="text-white-50">{activity.device}</td>
                          <td className="font-monospace text-info">{activity.ipAddress}</td>
                          <td className="text-white-50 small">{activity.createdAt}</td>
                          <td className="text-end pe-4">
                            {activity.isSuccess ? (
                              <span className="badge bg-success">Success</span>
                            ) : (
                              <span className="badge bg-danger">Failed</span>
                            )}
                          </td>
                        </tr>
                      ))}
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
