'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// Model Sesi & Aktivitas (TypeScript Interface)
interface UserSession {
  id: string;
  deviceName: string;
  browser: string;
  ipAddress: string;
  lastActivityAt: string;
  isCurrent: boolean;
  isActive: boolean;
}

interface LoginActivity {
  id: string;
  activityType: string;
  device: string;
  ipAddress: string;
  createdAt: string;
  isSuccess: boolean;
}

// Data Simulasi / Mock Data untuk Dashboard Guardian
const initialSessions: UserSession[] = [
  {
    id: 'sess-1',
    deviceName: 'MacBook Pro 16"',
    browser: 'Chrome 123.0',
    ipAddress: '182.253.114.50',
    lastActivityAt: '2026-06-05 14:20:10',
    isCurrent: true,
    isActive: true,
  },
  {
    id: 'sess-2',
    deviceName: 'iPhone 15 Pro',
    browser: 'Safari Mobile',
    ipAddress: '182.253.114.88',
    lastActivityAt: '2026-06-04 09:15:42',
    isCurrent: false,
    isActive: true,
  },
];

const initialActivities: LoginActivity[] = [
  {
    id: 'act-1',
    activityType: 'Login Berhasil',
    device: 'MacBook Pro 16"',
    ipAddress: '182.253.114.50',
    createdAt: '2026-06-05 08:30:00',
    isSuccess: true,
  },
  {
    id: 'act-2',
    activityType: 'Perubahan Sandi',
    device: 'MacBook Pro 16"',
    ipAddress: '182.253.114.50',
    createdAt: '2026-06-01 19:10:22',
    isSuccess: true,
  },
  {
    id: 'act-3',
    activityType: 'Percobaan Login Gagal',
    device: 'Unknown Device',
    ipAddress: '45.12.33.19',
    createdAt: '2026-05-28 03:12:05',
    isSuccess: false,
  },
];

export default function GuardianSecurityPage() {
  const [activeTab, setActiveTab] = useState<string>('health');
  const [sessions, setSessions] = useState<UserSession[]>(initialSessions);
  const [activities, setActivities] = useState<LoginActivity[]>(initialActivities);
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settings State
  const [privacyMode, setPrivacyMode] = useState<boolean>(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState<string>('5');

  // Handle Revoke Individual Session
  const handleRevokeSession = (sessionId: string) => {
    const sessionTarget = sessions.find((s) => s.id === sessionId);
    if (!window.confirm(`Terminate session for "${sessionTarget?.deviceName || 'this device'}"?`)) {
      return;
    }

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setSuccessMessage('Session has been signed out successfully.');
    
    // Auto clear notification
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Handle Revoke All Sessions (Emergency Lockout)
  const handleRevokeAllSessions = () => {
    const confirmed = window.confirm(
      'Emergency Lockout: Are you sure you want to sign out of ALL devices? You will be required to log in again.'
    );
    if (!confirmed) return;

    // Sisakan sesi saat ini saja
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    setSuccessMessage('All other active sessions have been terminated.');
    
    setTimeout(() => {
      window.location.href = '/auth/login';
    }, 1500);
  };

  return (
    <div className="container-fluid py-4 px-4 text-white">
      {/* Header & Overall Health Badge */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h4 className="mb-1 text-white fw-bold">
            <i className="bi bi-shield-check text-warning me-2"></i>Guardian Security
          </h4>
          <p className="text-white-50 small mb-0">
            Security health monitoring, active sessions, and protection controls
          </p>
        </div>
        <div>
          <span className="badge bg-success fs-6 px-3 py-2 shadow-sm">
            <i className="bi bi-heart-pulse-fill me-1"></i> Account Healthy
          </span>
        </div>
      </div>

      {/* Alert Notifications */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show mb-4 shadow-sm" role="alert">
          <i className="bi bi-check-circle me-2"></i> {successMessage}
          <button
            type="button"
            className="btn-close"
            onClick={() => setSuccessMessage(null)}
          ></button>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show mb-4 shadow-sm" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i> {errorMessage}
          <button
            type="button"
            className="btn-close"
            onClick={() => setErrorMessage(null)}
          ></button>
        </div>
      )}

      {/* SUB-TABS NAVIGATION (Nav Pills) */}
      <ul className="nav nav-pills mb-4 border-bottom border-secondary border-opacity-25 pb-3" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link fw-bold ${activeTab === 'health' ? 'active bg-primary text-white shadow-sm' : 'text-white-50'}`}
            type="button"
            onClick={() => setActiveTab('health')}
          >
            <i className="bi bi-activity text-danger me-2"></i> Security Health
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link fw-bold ${activeTab === 'sessions' ? 'active bg-primary text-white shadow-sm' : 'text-white-50'}`}
            type="button"
            onClick={() => setActiveTab('sessions')}
          >
            <i className="bi bi-laptop text-info me-2"></i> Active Sessions
            <span className="badge bg-secondary ms-2">{sessions.length}</span>
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link fw-bold ${activeTab === 'protection' ? 'active bg-primary text-white shadow-sm' : 'text-white-50'}`}
            type="button"
            onClick={() => setActiveTab('protection')}
          >
            <i className="bi bi-sliders text-warning me-2"></i> Protection &amp; Logs
          </button>
        </li>
      </ul>

      {/* TAB CONTENTS */}
      <div className="tab-content">
        {/* ==================== TAB 1: SECURITY HEALTH ==================== */}
        <div className={`tab-pane fade ${activeTab === 'health' ? 'show active' : ''}`}>
          <div className="card glass-card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center py-3">
              <strong className="text-white">
                <i className="bi bi-heart-pulse me-2 text-danger"></i> Security &amp; Account Health Checkup
              </strong>
              <small className="text-white-50">Automated Analysis</small>
            </div>
            <div className="card-body p-0">
              <div className="list-group list-group-flush bg-transparent">
                <div className="list-group-item bg-transparent text-white border-secondary border-opacity-25 p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <div className="fw-bold"><i className="bi bi-laptop text-info me-2"></i> Active Device Sessions</div>
                    <small className="text-white-50">Monitors how many devices are currently signed in.</small>
                  </div>
                  <div>
                    <span className="badge bg-success">{sessions.length} Active Session(s)</span>
                  </div>
                </div>

                <div className="list-group-item bg-transparent text-white border-secondary border-opacity-25 p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <div className="fw-bold"><i className="bi bi-key text-warning me-2"></i> Transaction PIN</div>
                    <small className="text-white-50">Secondary protection for sensitive financial actions.</small>
                  </div>
                  <div>
                    <span className="badge bg-warning text-dark me-2">Not Set</span>
                    <Link href="/settings" className="btn btn-sm btn-outline-warning py-0">Set Up PIN</Link>
                  </div>
                </div>

                <div className="list-group-item bg-transparent text-white border-secondary border-opacity-25 p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <div className="fw-bold"><i className="bi bi-shield-lock text-primary me-2"></i> Password Age</div>
                    <small className="text-white-50">Tracks when your password was last changed (Recommended: &lt; 90 days).</small>
                  </div>
                  <div>
                    <span className="badge bg-success me-2">Updated Recently</span>
                    <Link href="/settings" className="btn btn-sm btn-outline-light py-0">Change</Link>
                  </div>
                </div>

                <div className="list-group-item bg-transparent text-white border-secondary border-opacity-25 p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <div className="fw-bold"><i className="bi bi-shield-exclamation text-danger me-2"></i> Failed Login Attempts</div>
                    <small className="text-white-50">Unrecognized access attempts detected in the last 30 days.</small>
                  </div>
                  <div>
                    <span className="badge bg-success">0 Threat(s) Found</span>
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
              <strong className="text-white">
                <i className="bi bi-laptop me-2 text-info"></i> Active Sessions (Max 5)
              </strong>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleRevokeAllSessions}>
                <i className="bi bi-exclamation-octagon me-1"></i> Revoke All Sessions
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
                            {session.isCurrent && (
                              <span className="badge bg-success ms-2">Current</span>
                            )}
                          </td>
                          <td className="text-white-50">{session.browser}</td>
                          <td className="font-monospace text-info">{session.ipAddress}</td>
                          <td className="text-white-50 small">{session.lastActivityAt}</td>
                          <td className="text-end pe-4">
                            {!session.isCurrent ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger btn-terminate-session"
                                onClick={() => handleRevokeSession(session.id)}
                              >
                                <i className="bi bi-box-arrow-right"></i> Sign Out
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
              <strong className="text-white">
                <i className="bi bi-sliders me-2 text-warning"></i> Protection Settings
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
              <strong className="text-white">
                <i className="bi bi-clock-history me-2 text-info"></i> Recent Login History (Max 5)
              </strong>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => alert('Exporting audit log CSV simulation...')}
              >
                <i className="bi bi-download me-1"></i> Export Log (CSV)
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
