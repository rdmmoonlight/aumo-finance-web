import axios from 'axios'

function getApiBase() {
  let raw = (import.meta.env.WEB_API_BASE_URL as string) || '';
  raw = raw.trim().replace(/\/+$/, '');
  raw = raw.replace(/\/api\/v1\/?$/, '');
  if (!raw) raw = 'https://aumonext-api.onrender.com';
  if (raw.startsWith('http://')) raw = raw.replace('http://', 'https://');
  return raw;
}

const API_BASE_URL = getApiBase();

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true, // INI WAJIB. Biar cookie ikut kekirim
  headers: {
    'Content-Type': 'application/json',
  },
});
