import axios from 'axios';

const API_BASE_URL = (import.meta.env.WEB_API_BASE_URL as string) || 'https://aumonext-api.onrender.com';
apiClient.interceptors.request.use(c => {
  const t = localStorage.getItem('token') || localStorage.getItem('accessToken');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  console.log('[API]', c.method?.toUpperCase(), `${c.baseURL}${c.url}`);
  return c;
});

export default apiClient;
