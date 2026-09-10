import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/services/apiClient';

export default function AuthPage() {
  const [email, setEmail] = useState('admin@aumo.com');
  const [password, setPassword] = useState('Admin123!');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      // Backend kamu butuh LoginRequest = { Email, Password } 
      // bukan { email } lowercase, tapi .NET case-insensitive, kita kirim Pascal + camel biar aman
      const payload = { 
        Email: email, 
        email: email,
        UserName: email,
        userName: email,
        Password: password,
        password: password
      };
      console.log('[LOGIN PAYLOAD]', payload);
      const res = await apiClient.post('/auth/login', payload);
      console.log('[LOGIN SUCCESS]', res.data);
      
      const token = res.data.token || res.data.accessToken || res.data.data?.token;
      if (!token) throw new Error('Token tidak ada di response');
      
      localStorage.setItem('token', token);
      localStorage.setItem('accessToken', token);
      if (res.data.refreshToken) localStorage.setItem('refreshToken', res.data.refreshToken);
      
      nav('/dashboard');
    } catch (e:any) {
      console.error('[LOGIN FAIL]', e.response?.data);
      setErr(e.response?.data?.message || e.response?.data?.Message || 'Login 401 - cek email/password');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={onLogin} className="w-full max-w-sm space-y-4 p-6 border rounded-xl">
        <h1 className="text-2xl font-bold">Login Aumo</h1>
        <div className="text-xs text-muted-foreground break-all">{import.meta.env.API_BASE_URL}</div>
        <input className="w-full border p-2 rounded" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email / Username" />
        <input className="w-full border p-2 rounded" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" />
        {err && <div className="text-sm text-red-500">{err}</div>}
        <button disabled={loading} className="w-full bg-black text-white p-2 rounded">{loading?'Loading...':'Login'}</button>
      </form>
    </div>
  );
}
