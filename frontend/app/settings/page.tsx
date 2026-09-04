'use client';

import React, { useState, useEffect } from 'react';

export interface UserProfile {
  fullName: string;
  userName: string;
  email: string;
  isEmailConfirmed: boolean;
  phoneNumber: string;
  twoFactorEnabled: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function SettingsPage() {
  // State Profile Dinamis dari Backend Database
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // State Preferensi & UI
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [enableSystemAlerts, setEnableSystemAlerts] = useState<boolean>(true);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  // Status Notifikasi (Toast / Alert)
  const [statusAlertMessage, setStatusAlertMessage] = useState<string | null>(null);
  const [statusAlertClass, setStatusAlertClass] = useState<string>('alert-success');
  const [toastMessage, setToastMessage] = useState<string>('');

  // Fungsi Menampilkan Notifikasi
  const showNotification = (message: string, isError: boolean = false) => {
    setToastMessage(message);
    setStatusAlertMessage(message);
    setStatusAlertClass(isError ? 'alert-danger' : 'alert-success');

    setTimeout(() => {
      setStatusAlertMessage(null);
    }, 5000);
  };

  // 1. Fetch Data User Asli dari Database Backend saat Komponen Dimuat
  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const savedEmail = localStorage.getItem('userEmail');

        // Jika ada token, panggil endpoint profil backend
        if (token) {
          const res = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (res.ok) {
            const data = await res.json();
            setUserProfile({
              fullName: data.fullName || data.userName || 'User',
              userName: data.userName || data.email,
              email: data.email,
              isEmailConfirmed: Boolean(data.isEmailConfirmed ?? data.emailConfirmed ?? true),
              phoneNumber: data.phoneNumber || '-',
              twoFactorEnabled: Boolean(data.twoFactorEnabled),
            });
            return;
          }
        }

        // Fallback: Jika endpoint /auth/me belum tersedia, gunakan email dari session login
        if (savedEmail) {
          setUserProfile({
            fullName: 'Abdul Ghofur',
            userName: savedEmail.split('@')[0],
            email: savedEmail,
            isEmailConfirmed: true,
            phoneNumber: '-',
            twoFactorEnabled: false,
          });
        } else {
          showNotification('User session not found. Please sign in again.', true);
        }
      } catch (err: any) {
        showNotification(`Failed to load profile from database: ${err.message}`, true);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();

    // Inisialisasi Tema
    try {
      const savedTheme = localStorage.getItem('aumo_theme');
      setIsDarkMode(!savedTheme || savedTheme === 'dark');
    } catch {
      setIsDarkMode(true);
    }
  }, []);

  // Handler Kirim Ulang Verifikasi Email ke API Backend
  const handleResendVerification = async () => {
    if (!userProfile?.email) {
      showNotification('User account email not found.', true);
      return;
    }

    setIsSendingEmail(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userProfile.email }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to send verification email.');
      }

      showNotification('Verification email sent successfully. Please check your inbox.');
    } catch (err: any) {
      showNotification(`Failed to send verification email: ${err.message || 'Unknown error'}`, true);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Handler Perubahan Tema
  const handleThemeChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsDarkMode(checked);
    const selectedTheme = checked ? 'dark' : 'light';

    try {
      if ((window as any).aumoTheme) {
        (window as any).aumoTheme.set(selectedTheme);
      } else {
        document.documentElement.setAttribute('data-bs-theme', selectedTheme);
        localStorage.setItem('aumo_theme', selectedTheme);
      }
    } catch {}

    showNotification(`Theme updated to ${selectedTheme} mode.`);
  };

  // Handler Preferensi System Alerts
  const handleSystemAlertsChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setEnableSystemAlerts(checked);
    showNotification(`System alerts have been ${checked ? 'enabled' : 'disabled'}.`);
  };

  if (loading) {
    return (
      <div className="container-fluid py-5 text-center text-white-50">
        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Memuat profil pengguna dari database...</span>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-4 text-white">
      <h3 className="mb-4 fw-bold">Settings</h3>

      {/* Status Notification Alert */}
      {statusAlertMessage && (
        <div className={`alert ${statusAlertClass} alert-dismissible fade show my-3 shadow-sm`} role="alert">
          <i className="bi bi-info-circle me-2"></i>
          {statusAlertMessage}
          <button
            type="button"
            className="btn-close"
            onClick={() => setStatusAlertMessage(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* ===== USER PROFILE SECTION (FROM DB) ===== */}
      <div className="card glass-card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-header bg-primary text-white py-3 rounded-top-4">
          <h5 className="mb-0">👤 User Profile</h5>
        </div>
        <div className="card-body p-4">
          <div className="row">
            <div className="col-md-8">
              <dl className="row mb-0 gy-3">
                <dt className="col-sm-4 text-white-50">Full Name</dt>
                <dd className="col-sm-8 fw-semibold">{userProfile?.fullName || '-'}</dd>

                <dt className="col-sm-4 text-white-50">Username</dt>
                <dd className="col-sm-8 fw-semibold">{userProfile?.userName || '-'}</dd>

                <dt className="col-sm-4 text-white-50">Email</dt>
                <dd className="col-sm-8">{userProfile?.email || '-'}</dd>

                <dt className="col-sm-4 text-white-50">Email Status</dt>
                <dd className="col-sm-8">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className={`badge ${userProfile?.isEmailConfirmed ? 'bg-success' : 'bg-warning text-dark'}`}>
                      {userProfile?.isEmailConfirmed ? 'Confirmed' : 'Not Confirmed'}
                    </span>

                    {!userProfile?.isEmailConfirmed && (
                      <button
                        className="btn btn-sm btn-outline-primary py-0 px-2"
                        onClick={handleResendVerification}
                        disabled={isSendingEmail}
                      >
                        {isSendingEmail ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                            <span>Sending...</span>
                          </>
                        ) : (
                          <span>Resend Verification</span>
                        )}
                      </button>
                    )}
                  </div>
                </dd>

                <dt className="col-sm-4 text-white-50">Phone</dt>
                <dd className="col-sm-8 font-monospace">{userProfile?.phoneNumber || '-'}</dd>

                <dt className="col-sm-4 text-white-50">2FA Status</dt>
                <dd className="col-sm-8">
                  <span className={`badge ${userProfile?.twoFactorEnabled ? 'bg-success' : 'bg-secondary'}`}>
                    {userProfile?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* ===== PREFERENCES SECTION ===== */}
      <div className="card glass-card border-0 shadow-sm rounded-4">
        <div className="card-header bg-primary text-white py-3 rounded-top-4">
          <h5 className="mb-0">⚙️ Preferences</h5>
        </div>
        <div className="card-body p-4">
          <div className="mb-4">
            <label className="form-label d-block fw-semibold mb-2">Theme Interface</label>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="themeToggle"
                checked={isDarkMode}
                onChange={handleThemeChanged}
              />
              <label className="form-check-label ms-2 cursor-pointer" htmlFor="themeToggle">
                {isDarkMode ? '🌙 Dark Nebula Mode' : '☀️ Light Minimal Mode'}
              </label>
            </div>
          </div>

          <div className="mb-0">
            <label className="form-label d-block fw-semibold mb-2">System Alerts</label>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="alertsToggle"
                checked={enableSystemAlerts}
                onChange={handleSystemAlertsChanged}
              />
              <label className="form-check-label ms-2 cursor-pointer" htmlFor="alertsToggle">
                {enableSystemAlerts ? 'Enabled' : 'Disabled'}
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification Container */}
      <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1080 }}>
        <div id="settingsToast" className="toast show bg-dark text-white border-secondary shadow-lg" role="alert" aria-live="assertive" aria-atomic="true">
          <div className="toast-header bg-primary text-white border-bottom border-secondary border-opacity-25">
            <strong className="me-auto">Notification</strong>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={() => setToastMessage('')}
              aria-label="Close"
            ></button>
          </div>
          <div className="toast-body">
            {toastMessage || 'System ready.'}
          </div>
        </div>
      </div>
    </div>
  );
}
