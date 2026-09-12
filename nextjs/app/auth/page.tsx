'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconArrowRight,
  IconArrowLeft,
  IconSend,
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
  IconLoader2,
} from '@tabler/icons-react';

type AuthView = 'login' | 'register' | 'resend' | 'verifying';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.endsWith('/')? rawApiUrl.slice(0, -1) : rawApiUrl;

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentView, setCurrentView] = useState<AuthView>('login');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [resendEmail, setResendEmail] = useState('');

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

  const getClientUserAgent = () => {
    if (typeof window!== 'undefined' && window.navigator?.userAgent) {
      return window.navigator.userAgent;
    }
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AumoWebClient/1.0';
  };

  const handleVerifyEmailBackend = async (email: string, token: string) => {
    try {
      const userAgentStr = getClientUserAgent();
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL}/api/v1/auth/verify-email?email=${encodeURIComponent(email.trim())}&token=${encodeURIComponent(token)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json', 'X-User-Agent': userAgentStr }, credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.success!== undefined &&!data.success)) throw new Error(data.message || 'Failed to verify email.');
      setSuccessMessage('Email verified successfully! You can now sign in.');
      setCurrentView('login');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to verify email.');
      setCurrentView('login');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null); setSuccessMessage(null); setInfoMessage(null); setIsSubmitting(true);
    try {
      const userAgentStr = getClientUserAgent();
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Agent': userAgentStr },
        credentials: 'include',
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword, rememberMe, userAgent: userAgentStr, operatingSystem: 'Web Browser' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.success!== undefined &&!data.success)) throw new Error(data.message || 'Invalid email or password.');
      if (data.userId) localStorage.setItem('userId', data.userId);
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally { setIsSubmitting(false); }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null); setSuccessMessage(null); setIsSubmitting(true);
    try {
      const userAgentStr = getClientUserAgent();
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Agent': userAgentStr },
        credentials: 'include',
        body: JSON.stringify({ fullName: regFullName, email: regEmail.trim(), password: regPassword, userAgent: userAgentStr, operatingSystem: 'Web Browser' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.success!== undefined &&!data.success)) throw new Error(data.message || 'Registration failed.');
      setSuccessMessage('Account created! Please check your inbox for verification.');
      setCurrentView('login');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally { setIsSubmitting(false); }
  };

  const handleResendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null); setSuccessMessage(null); setIsSubmitting(true);
    try {
      const userAgentStr = getClientUserAgent();
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Agent': userAgentStr },
        credentials: 'include',
        body: JSON.stringify({ email: resendEmail.trim(), userAgent: userAgentStr, operatingSystem: 'Web Browser' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.success!== undefined &&!data.success)) throw new Error(data.message || 'Failed to send email.');
      setSuccessMessage('If that email is registered, a new verification link has been sent.');
      setCurrentView('login');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send email.');
    } finally { setIsSubmitting(false); }
  };

  const clearMessages = () => { setErrorMessage(null); setSuccessMessage(null); setInfoMessage(null); };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#0B0D10] px-3 py-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(91,26,120,0.10),transparent_35%)]" />

      <div className="relative z-10 w-full max-w-">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h- w- items-center justify-center overflow-hidden rounded- border border-[#30353E] bg-[#181B21] shadow-lg">
            <img src="/favicon.ico" alt="Aumo Finance" className="h-9 w-9 object-contain" />
          </div>
          <div className="text- font-bold uppercase tracking-[0.22em] text-[#777F8D]">Aumo Finance</div>
          <div className="mt-1 text-xs text-[#555D69]">Secure financial workspace</div>
        </div>

        <Card className="rounded- border-[#2B3038] bg-[#15181D] shadow-[0_24px_60px_rgba(0,0,0,0.34)]">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text- font-bold tracking-tight text-[#F3F4F6]">
              {currentView === 'login' && 'Welcome back'}
              {currentView === 'register' && 'Create your account'}
              {currentView === 'resend' && 'Verify your account'}
              {currentView === 'verifying' && 'Verifying email'}
            </CardTitle>
            <CardDescription className="text- leading-6 text-[#747C89]">
              {currentView === 'login' && 'Sign in to access your financial dashboard.'}
              {currentView === 'register' && 'Set up your secure Aumo Finance workspace.'}
              {currentView === 'resend' && 'Request a new verification link for your account.'}
              {currentView === 'verifying' && 'Please wait while your email is being verified.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 pt-4">
            {/* Alerts */}
            <div className="mb-4 space-y-2">
              {successMessage && (
                <Alert className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  <IconCheck className="h-4 w-4" />
                  <AlertDescription className="text-xs">{successMessage}</AlertDescription>
                </Alert>
              )}
              {errorMessage && (
                <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-300">
                  <IconAlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
                </Alert>
              )}
              {infoMessage && (
                <Alert className="border-blue-500/20 bg-blue-500/10 text-blue-300">
                  <IconInfoCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{infoMessage}</AlertDescription>
                </Alert>
              )}
            </div>

            {currentView === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#9AA1AC]">Email address</Label>
                  <div className="relative">
                    <IconMail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8F97A5]" />
                    <Input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="name@example.com" type="email" required className="h-12 border-[#30353E] bg-[#171A20] pl-10 text-[#F1F2F4] placeholder:text-[#555D69] focus-visible:ring-0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#9AA1AC]">Password</Label>
                  <div className="relative">
                    <IconLock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8F97A5]" />
                    <Input value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" type={showLoginPassword? 'text' : 'password'} required className="h-12 border-[#30353E] bg-[#171A20] pl-10 pr-12 text-[#F1F2F4] focus-visible:ring-0" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setShowLoginPassword(v =>!v)} className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-[#737B87] hover:bg-transparent">
                      {showLoginPassword? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="remember" checked={rememberMe} onCheckedChange={(v) => setRememberMe(v as boolean)} className="border-[#30353E] data-[state=checked]:bg-[#5B1A78]" />
                  <Label htmlFor="remember" className="text-xs font-normal text-[#737B87]">Remember me</Label>
                </div>
                <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded- bg-gradient-to-b from-[#6D3B80] to-[#5B1A78] text- font-semibold text-white shadow-[0_7px_18px_rgba(91,26,120,0.18)] hover:opacity-90">
                  {isSubmitting? <><IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : <><span>Sign in</span> <IconArrowRight className="ml-1 h-4 w-4" /></>}
                </Button>
              </form>
            )}

            {currentView === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#9AA1AC]">Full name</Label>
                  <Input value={regFullName} onChange={(e) => setRegFullName(e.target.value)} placeholder="Abdul Ghofur" required className="h-12 border-[#30353E] bg-[#171A20] text-[#F1F2F4] focus-visible:ring-0" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#9AA1AC]">Email address</Label>
                  <Input value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="name@example.com" type="email" required className="h-12 border-[#30353E] bg-[#171A20] text-[#F1F2F4] focus-visible:ring-0" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#9AA1AC]">Password <span className="ml-1 font-normal text-[#555D69]">· minimum 6 characters</span></Label>
                  <div className="relative">
                    <Input value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="••••••••" type={showRegisterPassword? 'text' : 'password'} required className="h-12 border-[#30353E] bg-[#171A20] pr-12 text-[#F1F2F4] focus-visible:ring-0" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setShowRegisterPassword(v =>!v)} className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-[#737B87] hover:bg-transparent">
                      {showRegisterPassword? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded- bg-gradient-to-b from-[#6D3B80] to-[#5B1A78] text- font-semibold text-white">
                  {isSubmitting? <><IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...</> : <><span>Create account</span> <IconArrowRight className="ml-1 h-4 w-4" /></>}
                </Button>
              </form>
            )}

            {currentView === 'resend' && (
              <form onSubmit={handleResendSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#9AA1AC]">Registered email address</Label>
                  <Input value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} placeholder="name@example.com" type="email" required className="h-12 border-[#30353E] bg-[#171A20] text-[#F1F2F4] focus-visible:ring-0" />
                </div>
                <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded- bg-gradient-to-b from-[#6D3B80] to-[#5B1A78] text- font-semibold text-white">
                  {isSubmitting? <><IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> Sending link...</> : <><IconSend className="mr-2 h-4 w-4" /> Resend verification link</>}
                </Button>
              </form>
            )}

            {currentView === 'verifying' && (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#30353E] bg-[#181B21]">
                  <IconLoader2 className="h-6 w-6 animate-spin text-[#8B5C9D]" />
                </div>
                <p className="text- font-semibold text-[#D5D8DD]">Validating secure token</p>
                <p className="text-xs text-[#686F7B]">Please wait while we verify your email.</p>
              </div>
            )}

            <Separator className="my-6 bg-[#292E36]" />

            <div className="text-center">
              {currentView === 'login'? (
                <div className="flex flex-col gap-3">
                  <button type="button" onClick={() => { setCurrentView('resend'); clearMessages(); }} className="text-xs font-medium text-[#9A6BAC] hover:underline">
                    Didn't receive a verification email?
                  </button>
                  <button type="button" onClick={() => { setCurrentView('register'); clearMessages(); }} className="text-xs text-[#676F7B]">
                    Don't have an account? <strong className="font-semibold text-[#B19AB9]">Create one</strong>
                  </button>
                </div>
              ) : currentView!== 'verifying' && (
                <button type="button" onClick={() => { setCurrentView('login'); clearMessages(); }} className="inline-flex items-center gap-1 text-xs font-medium text-[#9A6BAC]">
                  <IconArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 text-center text- tracking-wide text-[#444B55]">Aumo Finance · Secure Ledger Environment</div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0B0D10] text-[#777F8D]"><IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</div>}>
      <AuthContent />
    </Suspense>
  );
}