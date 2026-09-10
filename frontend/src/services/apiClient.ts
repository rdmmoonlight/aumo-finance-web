import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';
const apiClient = axios.create({
  baseURL: API_BASE_URL, // harus https://aumonext-api.onrender.com/api/v1
  headers: { 'Content-Type': 'application/json' },
});
apiClient.interceptors.request.use(c => {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  if (token) c.headers.Authorization = `Bearer ${token}`;
  return c;
});
export default apiClient;
