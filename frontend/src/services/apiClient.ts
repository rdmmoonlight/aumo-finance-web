import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('userId');
      // window.location.href = '/auth';
    }
    return Promise.reject(err);
  }
);

export default apiClient;
