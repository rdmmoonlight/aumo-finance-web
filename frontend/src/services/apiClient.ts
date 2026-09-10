import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';
const apiClient = axios.create({
  baseURL: API_BASE_URL, // https://aumonext-api.onrender.com
  headers: { 'Content-Type': 'application/json' },
});
apiClient.interceptors.request.use(c => {
  const t = localStorage.getItem('token') || localStorage.getItem('accessToken');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  console.log('[API]', c.method?.toUpperCase(), `${c.baseURL}${c.url}`);
  return c;
});
export default apiClient;
