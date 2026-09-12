import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import apiClient from '@/services/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export default function AuthPage() {
  const [email, setEmail] = useState('admin@aumo.com');
  const [password, setPassword] = useState('Admin123!');
  const [keepMe, setKeepMe] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('aumo_saved_email');
    if (saved) {
      setEmail(saved);
      setKeepMe(true);
    }
  }, []);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      // COOKIE MODE: gak ada token di JSON
      const res = await apiClient.post('/api/v1/auth/login',
        { Email: email, Password: password },
        { withCredentials: true }
      );

      console.log('[COOKIE LOGIN]', res.data);

      // backend lu return { Success: true, Message: "..." }
      const ok = res.data?.Success?? res.data?.success?? res.data?.isSuccess?? res.status === 200;

      if (!ok) throw new Error(res.data?.Message || res.data?.message || 'Login gagal');

      // Cookie AumoFinance.Session udah ke-set otomatis sama browser (HttpOnly)
      localStorage.setItem('isAuthenticated', 'true');
      if (keepMe) localStorage.setItem('aumo_saved_email', email);
      else localStorage.removeItem('aumo_saved_email');

      nav('/dashboard');
    } catch (e: any) {
      console.error('[LOGIN FAIL]', e.response?.data);
      setErr(e.response?.data?.Message || e.response?.data?.message || 'Email atau password salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-[1.15fr_1fr] bg-background">
      {/* LEFT */}
      <div className="bg-foreground text-background flex flex-col justify-between p-8 lg:p-12">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-background text-foreground rounded- flex items-center justify-center font-bold text-">A</div>
          <span className="font-semibold tracking-tight text-">AUMO FINANCE</span>
        </div>

        <div className="mt-12 lg:mt-0">
          <h1 className="text- lg:text- font-semibold leading-[0.95] tracking-[-0.03em] max-w-">
            Operations,<br/>neatly<br/>organized.
          </h1>
          <p className="text- leading-6 opacity-60 max-w- mt-6">
            Matte, tenang, tanpa distraksi. Dibuat untuk produksi, bukan pameran.
          </p>

          <div className="mt-12 border-t border-background/10">
            <div className="flex justify-between py-4 border-b border-background/10 text-"><span className="opacity-40 font-mono text-">01</span><span>Revenues & Expenses</span></div>
            <div className="flex justify-between py-4 border-b border-background/10 text-"><span className="opacity-40 font-mono text-">02</span><span>Tracking</span></div>
            <div className="flex justify-between py-4 border-b border-background/10 text-"><span className="opacity-40 font-mono text-">03</span><span>Finance & Costings</span></div>
          </div>
        </div>

        <div className="hidden lg:flex justify-between text- font-mono opacity-40">
          <span>© rdmmoonlight 2026</span>
          <span>COOKIE AUTH • AUMO SYSTEM</span>
        </div>
      </div>

      {/* RIGHT */}
      <div className="bg-background text-foreground flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-2">Masuk ke workspace kamu.</p>
          </div>

          <form onSubmit={onLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text- tracking-widest uppercase text-muted-foreground">Email</Label>
              <Input id="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@aumo.com" className="h-11 rounded-xl bg-card" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text- tracking-widest uppercase text-muted-foreground">Password</Label>
                <button type="button" onClick={()=>setShowPass(!showPass)} className="text- uppercase tracking-wide text-muted-foreground hover:text-foreground">
                  {showPass? 'Hide' : 'Show'}
                </button>
              </div>
              <Input id="password" type={showPass? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" className="h-11 rounded-xl bg-card" />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="keepMe"
                  checked={keepMe}
                  onCheckedChange={(v) => setKeepMe(v as boolean)}
                  className="rounded- border-foreground/20 data-[state=checked]:bg-foreground data-[state=checked]:text-background"
                />
                <Label htmlFor="keepMe" className="text- font-normal cursor-pointer leading-none">
                  Keep me signed in
                </Label>
              </div>
              <a href="#" className="text- text-muted-foreground hover:text-foreground underline underline-offset-4">Forgot?</a>
            </div>

            {err && (
              <div className="bg-destructive/10 text-destructive border border-destructive/20 text- px-3.5 py-3 rounded-xl">
                {err}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl text- font-medium">
              {loading? 'Processing...' : 'Sign In to Dashboard'}
            </Button>

            <div className="flex justify-between pt-6 border-t text- font-mono text-muted-foreground">
              <span>SECURE COOKIE</span>
              <span>Keep your data safe</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}