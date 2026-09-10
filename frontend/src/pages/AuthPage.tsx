import apiClient from '@/services/apiClient';
import { useState, useEffect, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconEye, IconEyeOff, IconMail, IconLock, IconArrowRight, IconLoader2 } from '@tabler/icons-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

type AuthView = 'login' | 'register' | 'resend' | 'verifying';


function AuthContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentView, setCurrentView] = useState<AuthView>('login');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    const token = searchParams.get('token');
    const emailQuery = searchParams.get('email');
    if (token && emailQuery) {
      setCurrentView('verifying');
      handleVerifyEmailBackend(emailQuery, token);
    }
  }, [searchParams]);

  const handleVerifyEmailBackend = async (email: string, token: string) => {
    try {
      await apiClient.get(`/api/v1/auth/verify-email`, {
        params: { email: email.trim(), token },
      });
      setSuccessMessage('Email verified! You can now sign in.');
      setCurrentView('login');
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Link expired.');
      setCurrentView('login');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null); setSuccessMessage(null); setIsSubmitting(true);
    try {
      const { data } = await apiClient.post(`/api/v1/auth/login`, {
        email: loginEmail.trim(), password: loginPassword, rememberMe,
      });
      if (data?.userId) localStorage.setItem('userId', data.userId);
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Invalid email or password.');
    } finally { setIsSubmitting(false); }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post(`/api/v1/auth/register`, {
        fullName: regFullName, email: regEmail.trim(), password: regPassword,
      });
      setSuccessMessage('Account created! Check inbox.');
      setCurrentView('login');
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to register.');
    } finally { setIsSubmitting(false); }
  };

  const handleResendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post(`/api/v1/auth/resend-verification`, {
        email: resendEmail.trim(),
      });
      setSuccessMessage('Link sent if email registered.');
      setCurrentView('login');
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to send.');
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen w-full grid place-items-center bg-[#0B0D10] p-4">
      <div className="w-full max-w-">
        <Card className="border-[#2B3038] bg-[#15181D] text-white shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle>
              {currentView==='login'&&'Welcome back'}
              {currentView==='register'&&'Create account'}
              {currentView==='resend'&&'Verify account'}
              {currentView==='verifying'&&'Verifying...'}
            </CardTitle>
            <CardDescription className="text-[#747C89]">Aumo Finance Secure Workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {successMessage && <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-300 text-xs"><AlertDescription>{successMessage}</AlertDescription></Alert>}
            {errorMessage && <Alert variant="destructive" className="text-xs"><AlertDescription>{errorMessage}</AlertDescription></Alert>}

            {currentView==='login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Email</Label>
                  <div className="relative"><IconMail size={16} className="absolute left-3 top-3.5 text-muted-foreground"/><Input className="pl-9 bg-[#171A20] border-[#30353E] h-12" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required/></div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Password</Label>
                  <div className="relative"><IconLock size={16} className="absolute left-3 top-3.5 text-muted-foreground"/><Input className="pl-9 pr-10 bg-[#171A20] border-[#30353E] h-12" type={showLoginPassword?'text':'password'} value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} required/><button type="button" onClick={()=>setShowLoginPassword(v=>!v)} className="absolute right-3 top-3.5 text-muted-foreground">{showLoginPassword?<IconEyeOff size={16}/>:<IconEye size={16}/>}</button></div>
                </div>
                <div className="flex items-center gap-2"><Checkbox id="remember" checked={rememberMe} onCheckedChange={(v)=>setRememberMe(!!v)}/><Label htmlFor="remember" className="text-xs font-normal">Remember me</Label></div>
                <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-[#5B1A78] hover:bg-[#6D3B80]">{isSubmitting&&<IconLoader2 className="animate-spin mr-2" size={16}/>}Sign in <IconArrowRight size={16} className="ml-1"/></Button>
              </form>
            )}
            {/* register & resend sama, cuma ganti API_BASE_URL */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return <Suspense fallback={<div className="min-h-screen grid place-items-center bg-[#0B0D10] text-sm">Loading...</div>}><AuthContent /></Suspense>;
}