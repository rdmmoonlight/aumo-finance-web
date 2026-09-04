'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type AuthView = 'login' | 'register' | 'resend' | 'verifying';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentView, setCurrentView] = useState<AuthView>('login');

  // Status & Alert Messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Password visibility
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState<boolean>(false);

  // Form State: Login
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);

  // Form State: Register
  const [regFullName, setRegFullName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');

  // Form State: Resend Verification
  const [resendEmail, setResendEmail] = useState<string>('');

  // Sinkronisasi query parameter & Token Verifikasi Email
  useEffect(() => {
    const msg = searchParams.get('message');
    const success = searchParams.get('successMessage');
    const error = searchParams.get('errorMessage');
    const info = searchParams.get('infoMessage');
    const token = searchParams.get('token');
    const emailQuery = searchParams.get('email');

    if (success) setSuccessMessage(success);
    if (msg) setSuccessMessage(msg);
    if (error) setErrorMessage(error);
    if (info) setInfoMessage(info);

    if (token && emailQuery) {
      setCurrentView('verifying');
      handleVerifyEmailBackend(emailQuery, token);
    }
  }, [searchParams]);

  // Handler API: Verifikasi Email ke Backend
  const handleVerifyEmailBackend = async (email: string, token: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/web/auth/verify-email?email=${encodeURIComponent(
          email.trim()
        )}&token=${encodeURIComponent(token)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            'Failed to verify email. Link may have expired.'
        );
      }

      setSuccessMessage(
        'Email verified successfully! You can now sign in.'
      );
      setCurrentView('login');
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Failed to verify email. Link may have expired.'
      );
      setCurrentView('login');
    }
  };

  // Handler API: Login (Web Auth via Cookie)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/web/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Penting untuk menyimpan Session Cookie
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
          rememberMe,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || (data.success !== undefined && !data.success)) {
        throw new Error(
          data.message || data.title || 'Invalid email or password.'
        );
      }

      if (data.userId) {
        localStorage.setItem('userId', data.userId);
      }

      router.push('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler API: Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/web/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: regFullName,
          email: regEmail.trim(),
          password: regPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || 'An unexpected error occurred during registration.'
        );
      }

      setSuccessMessage(
        'Account created successfully! Please check your inbox for verification.'
      );
      setCurrentView('login');
    } catch (err: any) {
      setErrorMessage(
        err.message || 'An unexpected error occurred during registration.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler API: Resend Verification
  const handleResendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/web/auth/resend-verification`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: resendEmail.trim(),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to send verification email.'
        );
      }

      setSuccessMessage(
        'If that email is registered, a new verification link has been sent to your inbox.'
      );
      setCurrentView('login');
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Failed to send verification email.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setInfoMessage(null);
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#171A20',
    borderColor: '#30353E',
    color: '#F1F2F4',
    minHeight: '48px',
    boxShadow: 'none',
  };

  const iconBoxStyle: React.CSSProperties = {
    backgroundColor: '#171A20',
    borderColor: '#30353E',
    color: '#8F97A5',
    minWidth: '48px',
  };

  const passwordToggleStyle: React.CSSProperties = {
    backgroundColor: '#171A20',
    borderColor: '#30353E',
    color: '#737B87',
    minWidth: '48px',
    cursor: 'pointer',
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: '18px',
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center min-vh-100 w-100 px-3 py-5"
      style={{
        background:
          'linear-gradient(145deg, #0B0D10 0%, #101318 55%, #0C0F13 100%)',
        color: '#F1F2F4',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 50% 20%, rgba(91, 26, 120, 0.075), transparent 32%)',
        }}
      />

      <div
        className="w-100"
        style={{
          maxWidth: '460px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div className="text-center mb-4">
          <div
            className="d-inline-flex align-items-center justify-content-center mb-3"
            style={{
              width: '58px',
              height: '58px',
              borderRadius: '16px',
              background: '#181B21',
              border: '1px solid #30353E',
              overflow: 'hidden',
              boxShadow:
                '0 8px 24px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255,255,255,0.025)',
            }}
          >
            <img
              src="/favicon.ico"
              alt="Aumo Finance"
              width="38"
              height="38"
              style={{
                display: 'block',
                objectFit: 'contain',
              }}
            />
          </div>

          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#777F8D',
              marginBottom: '6px',
            }}
          >
            Aumo Finance
          </div>

          <div
            style={{
              fontSize: '12px',
              color: '#555D69',
              letterSpacing: '0.02em',
            }}
          >
            Secure financial workspace
          </div>
        </div>

        <div
          style={{
            background:
              'linear-gradient(145deg, #15181D 0%, #13161B 100%)',
            border: '1px solid #2B3038',
            borderRadius: '22px',
            padding: '34px',
            boxShadow:
              '0 24px 60px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.025)',
          }}
        >
          <div className="text-center mb-4">
            <h1
              className="mb-2"
              style={{
                fontSize: '25px',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: '#F3F4F6',
              }}
            >
              {currentView === 'login' && 'Welcome back'}
              {currentView === 'register' && 'Create your account'}
              {currentView === 'resend' && 'Verify your account'}
              {currentView === 'verifying' && 'Verifying email'}
            </h1>

            <p
              className="mb-0"
              style={{
                fontSize: '13px',
                lineHeight: 1.6,
                color: '#747C89',
              }}
            >
              {currentView === 'login' &&
                'Sign in to access your financial dashboard.'}

              {currentView === 'register' &&
                'Set up your secure Aumo Finance workspace.'}

              {currentView === 'resend' &&
                'Request a new verification link for your account.'}

              {currentView === 'verifying' &&
                'Please wait while your email is being verified.'}
            </p>
          </div>

          {/* Alerts */}
          {successMessage && (
            <div
              className="d-flex align-items-start gap-2 mb-3"
              role="alert"
              style={{
                padding: '11px 13px',
                borderRadius: '10px',
                backgroundColor: 'rgba(79, 163, 106, 0.09)',
                border: '1px solid rgba(79, 163, 106, 0.22)',
                color: '#87C99A',
                fontSize: '12px',
                lineHeight: 1.5,
              }}
            >
              <i className="bi bi-check-circle-fill mt-1"></i>
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div
              className="d-flex align-items-start gap-2 mb-3"
              role="alert"
              style={{
                padding: '11px 13px',
                borderRadius: '10px',
                backgroundColor: 'rgba(190, 75, 75, 0.09)',
                border: '1px solid rgba(190, 75, 75, 0.22)',
                color: '#DB9292',
                fontSize: '12px',
                lineHeight: 1.5,
              }}
            >
              <i className="bi bi-exclamation-triangle-fill mt-1"></i>
              <span>{errorMessage}</span>
            </div>
          )}

          {infoMessage && (
            <div
              className="d-flex align-items-start gap-2 mb-3"
              role="alert"
              style={{
                padding: '11px 13px',
                borderRadius: '10px',
                backgroundColor: 'rgba(90, 110, 145, 0.09)',
                border: '1px solid rgba(90, 110, 145, 0.22)',
                color: '#9AAAC4',
                fontSize: '12px',
                lineHeight: 1.5,
              }}
            >
              <i className="bi bi-info-circle-fill mt-1"></i>
              <span>{infoMessage}</span>
            </div>
          )}

          {/* LOGIN */}
          {currentView === 'login' && (
            <form onSubmit={handleLoginSubmit}>
              <div style={fieldStyle}>
                <label
                  className="d-block mb-2"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#9AA1AC',
                  }}
                >
                  Email address
                </label>

                <div className="input-group">
                  <span
                    className="input-group-text border-end-0"
                    style={{
                      ...iconBoxStyle,
                      borderRadius: '11px 0 0 11px',
                    }}
                  >
                    <i className="bi bi-envelope"></i>
                  </span>

                  <input
                    type="email"
                    className="form-control border-start-0 ps-1"
                    style={{
                      ...inputStyle,
                      borderRadius: '0 11px 11px 0',
                    }}
                    placeholder="name@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  className="d-block mb-2"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#9AA1AC',
                  }}
                >
                  Password
                </label>

                <div className="input-group">
                  <span
                    className="input-group-text border-end-0"
                    style={{
                      ...iconBoxStyle,
                      borderRadius: '11px 0 0 11px',
                    }}
                  >
                    <i className="bi bi-lock"></i>
                  </span>

                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    className="form-control border-start-0 border-end-0 ps-1"
                    style={{
                      ...inputStyle,
                      borderRadius: 0,
                    }}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />

                  <button
                    type="button"
                    className="input-group-text border-start-0"
                    style={{
                      ...passwordToggleStyle,
                      borderRadius: '0 11px 11px 0',
                    }}
                    aria-label={
                      showLoginPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    onClick={() =>
                      setShowLoginPassword((current) => !current)
                    }
                  >
                    <i
                      className={
                        showLoginPassword
                          ? 'bi bi-eye-slash'
                          : 'bi bi-eye'
                      }
                    ></i>
                  </button>
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between mb-4">
                <label
                  className="d-flex align-items-center gap-2"
                  style={{
                    fontSize: '12px',
                    color: '#737B87',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    className="form-check-input m-0"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Remember me
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-100 border-0 d-flex align-items-center justify-content-center gap-2"
                style={{
                  minHeight: '48px',
                  borderRadius: '11px',
                  background:
                    'linear-gradient(180deg, #6D3B80 0%, #5B1A78 100%)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  boxShadow:
                    '0 7px 18px rgba(91, 26, 120, 0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
                  opacity: isSubmitting ? 0.65 : 1,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <i className="bi bi-arrow-right"></i>
                  </>
                )}
              </button>
            </form>
          )}

          {/* REGISTER */}
          {currentView === 'register' && (
            <form onSubmit={handleRegisterSubmit}>
              <div style={fieldStyle}>
                <label
                  className="d-block mb-2"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#9AA1AC',
                  }}
                >
                  Full name
                </label>

                <input
                  type="text"
                  className="form-control"
                  style={{
                    ...inputStyle,
                    borderRadius: '11px',
                  }}
                  placeholder="Abdul Ghofur"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  required
                />
              </div>

              <div style={fieldStyle}>
                <label
                  className="d-block mb-2"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#9AA1AC',
                  }}
                >
                  Email address
                </label>

                <input
                  type="email"
                  className="form-control"
                  style={{
                    ...inputStyle,
                    borderRadius: '11px',
                  }}
                  placeholder="name@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  className="d-block mb-2"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#9AA1AC',
                  }}
                >
                  Password
                  <span
                    style={{
                      color: '#555D69',
                      fontWeight: 400,
                      marginLeft: '5px',
                    }}
                  >
                    · minimum 6 characters
                  </span>
                </label>

                <div className="input-group">
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    className="form-control border-end-0"
                    style={{
                      ...inputStyle,
                      borderRadius: '11px 0 0 11px',
                    }}
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                  />

                  <button
                    type="button"
                    className="input-group-text border-start-0"
                    style={{
                      ...passwordToggleStyle,
                      borderRadius: '0 11px 11px 0',
                    }}
                    aria-label={
                      showRegisterPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    onClick={() =>
                      setShowRegisterPassword((current) => !current)
                    }
                  >
                    <i
                      className={
                        showRegisterPassword
                          ? 'bi bi-eye-slash'
                          : 'bi bi-eye'
                      }
                    ></i>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-100 border-0 d-flex align-items-center justify-content-center gap-2"
                style={{
                  minHeight: '48px',
                  borderRadius: '11px',
                  background:
                    'linear-gradient(180deg, #6D3B80 0%, #5B1A78 100%)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow:
                    '0 7px 18px rgba(91, 26, 120, 0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
                  opacity: isSubmitting ? 0.65 : 1,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                    />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create account</span>
                    <i className="bi bi-arrow-right"></i>
                  </>
                )}
              </button>
            </form>
          )}

          {/* RESEND */}
          {currentView === 'resend' && (
            <form onSubmit={handleResendSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label
                  className="d-block mb-2"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#9AA1AC',
                  }}
                >
                  Registered email address
                </label>

                <input
                  type="email"
                  className="form-control"
                  style={{
                    ...inputStyle,
                    borderRadius: '11px',
                  }}
                  placeholder="name@example.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-100 border-0 d-flex align-items-center justify-content-center gap-2"
                style={{
                  minHeight: '48px',
                  borderRadius: '11px',
                  background:
                    'linear-gradient(180deg, #6D3B80 0%, #5B1A78 100%)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow:
                    '0 7px 18px rgba(91, 26, 120, 0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
                  opacity: isSubmitting ? 0.65 : 1,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                    />
                    <span>Sending link...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-send"></i>
                    <span>Resend verification link</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* VERIFYING */}
          {currentView === 'verifying' && (
            <div className="text-center py-4">
              <div
                className="d-inline-flex align-items-center justify-content-center mb-4"
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#181B21',
                  border: '1px solid #30353E',
                }}
              >
                <span
                  className="spinner-border"
                  role="status"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderWidth: '2px',
                    color: '#8B5C9D',
                  }}
                >
                  <span className="visually-hidden">Loading...</span>
                </span>
              </div>

              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#D5D8DD',
                  marginBottom: '6px',
                }}
              >
                Validating secure token
              </div>

              <p
                className="mb-0"
                style={{
                  fontSize: '12px',
                  color: '#686F7B',
                }}
              >
                Please wait while we verify your email.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div
            className="mt-4 pt-4 text-center"
            style={{
              borderTop: '1px solid #292E36',
            }}
          >
            {currentView === 'login' && (
              <div className="d-flex flex-column gap-3">
                <button
                  type="button"
                  className="border-0 bg-transparent p-0"
                  style={{
                    color: '#9A6BAC',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    setCurrentView('resend');
                    clearMessages();
                  }}
                >
                  Didn't receive a verification email?
                </button>

                <button
                  type="button"
                  className="border-0 bg-transparent p-0"
                  style={{
                    color: '#676F7B',
                    fontSize: '12px',
                  }}
                  onClick={() => {
                    setCurrentView('register');
                    clearMessages();
                  }}
                >
                  Don't have an account?{' '}
                  <strong
                    style={{
                      color: '#B19AB9',
                      fontWeight: 600,
                    }}
                  >
                    Create one
                  </strong>
                </button>
              </div>
            )}

            {currentView !== 'login' && currentView !== 'verifying' && (
              <button
                type="button"
                className="border-0 bg-transparent p-0"
                style={{
                  color: '#9A6BAC',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
                onClick={() => {
                  setCurrentView('login');
                  clearMessages();
                }}
              >
                <i className="bi bi-arrow-left me-2"></i>
                Back to sign in
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="text-center mt-4"
          style={{
            fontSize: '10px',
            color: '#444B55',
            letterSpacing: '0.04em',
          }}
        >
          Aumo Finance · Secure Ledger Environment
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-vh-100 d-flex align-items-center justify-content-center"
          style={{
            background: '#0B0D10',
            color: '#777F8D',
          }}
        >
          <span
            className="spinner-border spinner-border-sm me-2"
            role="status"
          />
          Loading...
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
