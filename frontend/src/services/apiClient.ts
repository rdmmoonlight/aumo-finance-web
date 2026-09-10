import axios from 'axios'

function getApiBase(): string {
  let raw = (import.meta.env.WEB_API_BASE_URL as string) || '';
  raw = raw.trim().replace(/\/+$/, '');
  raw = raw.replace(/\/api\/v1$/i, ''); // bersihin kalau ada
  if (!raw) raw = 'https://aumonext-api.onrender.com';
  if (raw.startsWith('http://')) raw = raw.replace('http://', 'https://');
  console.log('[CONFIG] API_BASE_URL:', raw);
  return raw;
}

const API_BASE_URL = getApiBase();

const apiClient = axios.create({
  baseURL: API_BASE_URL, // <-- COPOT /api/v1 DARI SINI
  withCredentials: true, // WAJIB BUAT COOKIE
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
});

export default apiClient;
