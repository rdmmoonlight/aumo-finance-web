import axios from 'axios';
import { WEB_API_BASE_URL } from '@/lib/config';

const apiClient = axios.create({
  baseURL: WEB_API_BASE_URL.replace(/\/$/, ''),
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('isAuthenticated');
    }
    return Promise.reject(err);
  }
);

export default apiClient;