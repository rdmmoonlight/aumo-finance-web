import axios from 'axios'

function getApiBase() {
  let raw = (import.meta.env.WEB_API_BASE_URL as string) || '';
  raw = raw.trim().replace(/\/+$/, '');
  raw = raw.replace(/\/api\/v1\/?$/, '');
  if (!raw) raw = 'https://aumonext-api.onrender.com';
  if (raw.startsWith('http://')) raw = raw.replace('http://', 'https://');
  console.log('[CONFIG] API_BASE_URL:', raw);
  return raw;
}

const API_BASE_URL = getApiBase();

const apiClient = axios.create({ // gak pake export const lagi
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true, // WAJIB BUAT COOKIE
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient; // INI KUNCINYA. Balik ke default
