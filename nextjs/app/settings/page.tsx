'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconUser,
  IconSettings,
  IconMoon,
  IconSun,
  IconInfoCircle,
  IconCheck,
  IconPhone,
  IconShieldCheck,
  IconMail,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

export interface UserProfile {
  userId: string;
  fullName: string;
  userName: string;
  email: string;
  isEmailConfirmed: boolean;
  phoneNumber: string;
  twoFactorEnabled: boolean;
}

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function SettingsPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [enableSystemAlerts, setEnableSystemAlerts] = useState(true);
  const [isSendingEmail] = useState(false);
  const [statusAlertMessage, setStatusAlertMessage] = useState<string | null>(null);
  const [statusAlertClass, setStatusAlertClass] = useState<'success' | 'error'>('success');
  const [toastMessage, setToastMessage] = useState('');

  const showNotification = (message: string, isError = false) => {
    setToastMessage(message);
    setStatusAlertMessage(message);
    setStatusAlertClass(isError? 'error' : 'success');
    setTimeout(() => setStatusAlertMessage(null), 5000);
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/auth/me`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setUserProfile({
              userId: data.userId || '',
              fullName: data.fullName || data.userName || 'User',
              userName: data.userName || data.email,
              email: data.email || '-',
              isEmailConfirmed: true,
              phoneNumber: '-',
              twoFactorEnabled: false,
            });
            return;
          }
        } else if (res.status === 401 || res.status === 404) {
          showNotification('User session not found. Please sign in again.', true);
        }
      } catch (err: any) {
        showNotification(`Failed to load profile: ${err.message}`, true);
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();
    try {
      const savedTheme = localStorage.getItem('aumo_theme');
      setIsDarkMode(!savedTheme || savedTheme === 'dark');
    } catch { setIsDarkMode(true); }
  }, []);

  const handleThemeChanged = (checked: boolean) => {
    setIsDarkMode(checked);
    const selectedTheme = checked? 'dark' : 'light';
    try {
      if ((window as any).aumoTheme) (window as any).aumoTheme.set(selectedTheme);
      else {
        document.documentElement.setAttribute('data-bs-theme', selectedTheme);
        localStorage.setItem('aumo_theme', selectedTheme);
      }
    } catch {}
    showNotification(`Theme updated to ${selectedTheme} mode.`);
  };

  const handleSystemAlertsChanged = (checked: boolean) => {
    setEnableSystemAlerts(checked);
    showNotification(`System alerts have been ${checked? 'enabled' : 'disabled'}.`);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h- w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <h3 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <IconSettings className="h-5 w-5" />
        </span>
        Settings
      </h3>

      {statusAlertMessage && (
        <Alert variant={statusAlertClass === 'error'? 'destructive' : 'default'} className={`flex items-center justify-between ${statusAlertClass === 'success'? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : ''}`}>
          <div className="flex items-center gap-2"><IconInfoCircle className="h-4 w-4" /><AlertDescription>{statusAlertMessage}</AlertDescription></div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>setStatusAlertMessage(null)}><IconX className="h-4 w-4" /></Button>
        </Alert>
      )}

      {/* USER PROFILE */}
      <Card>
        <CardHeader className="bg-primary text-primary-foreground rounded-t-lg py-3">
          <CardTitle className="flex items-center gap-2 text-base"><IconUser className="h-5 w-5" /> User Profile</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr]"><span className="text-sm text-muted-foreground">Full Name</span><span className="text-sm font-semibold">{userProfile?.fullName || '-'}</span></div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr]"><span className="text-sm text-muted-foreground">Username</span><span className="text-sm font-semibold">{userProfile?.userName || '-'}</span></div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr]"><span className="text-sm text-muted-foreground">Email</span><span className="flex items-center gap-1.5 text-sm font-medium"><IconMail className="h-4 w-4 text-muted-foreground" />{userProfile?.email || '-'}</span></div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr]"><span className="text-sm text-muted-foreground">Email Status</span><Badge className="w-fit gap-1 bg-emerald-500 hover:bg-emerald-600"><IconCheck className="h-3.5 w-3.5" /> Confirmed</Badge></div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr]"><span className="text-sm text-muted-foreground">Phone</span><span className="flex items-center gap-1.5 font-mono text-sm"><IconPhone className="h-4 w-4 text-muted-foreground" />{userProfile?.phoneNumber || '-'}</span></div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr]"><span className="text-sm text-muted-foreground">2FA Status</span><Badge variant="secondary" className="w-fit gap-1"><IconShieldCheck className="h-3.5 w-3.5" /> Disabled</Badge></div>
          </div>
        </CardContent>
      </Card>

      {/* PREFERENCES */}
      <Card>
        <CardHeader className="bg-primary text-primary-foreground rounded-t-lg py-3">
          <CardTitle className="flex items-center gap-2 text-base"><IconSettings className="h-5 w-5" /> Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Theme Interface</Label>
              <p className="text-xs text-muted-foreground">Switch between dark and light appearance.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm">{isDarkMode? <><IconMoon className="h-4 w-4 text-sky-500" /> Dark Nebula</> : <><IconSun className="h-4 w-4 text-amber-500" /> Light Minimal</>}</div>
              <Switch checked={isDarkMode} onCheckedChange={handleThemeChanged} id="themeToggle" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">System Alerts</Label>
              <p className="text-xs text-muted-foreground">Receive important system notifications.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm">{enableSystemAlerts? 'Enabled' : 'Disabled'}</span>
              <Switch checked={enableSystemAlerts} onCheckedChange={handleSystemAlertsChanged} id="alertsToggle" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toast */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50">
        {toastMessage && (
          <Card className="pointer-events-auto w- shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between bg-primary py-2 text-primary-foreground"><div className="flex items-center gap-2 text-sm font-semibold"><IconInfoCircle className="h-4 w-4" /> Notification</div><Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground hover:bg-white/10" onClick={()=>setToastMessage('')}><IconX className="h-4 w-4" /></Button></CardHeader>
            <CardContent className="p-3 text-sm">{toastMessage || 'System ready.'}</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}