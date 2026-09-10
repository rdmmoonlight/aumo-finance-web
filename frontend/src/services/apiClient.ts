import axios from 'axios';
import { WEB_API_BASE_URL } from '@/lib/config';
const apiClient = axios.create({
  baseURL: WEB_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});
apiClient.interceptors.request.use(c => {
  const t = localStorage.getItem('token') || localStorage.getItem('accessToken');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  console.log('[API]', c.method?.toUpperCase(), `${c.baseURL}${c.url}`);
  return c;
});
export default apiClient;
