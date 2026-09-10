import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  console.log('[API HIT]', config.method?.toUpperCase(), `${config.baseURL}${config.url}`);
  return config;
});

export default apiClient;
