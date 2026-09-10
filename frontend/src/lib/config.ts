function getApiBase() {
  let raw = (import.meta.env.WEB_API_BASE_URL as string) || '';
  raw = raw.trim().replace(/\/+$/, '');
  raw = raw.replace(/\/api\/v1\/?$/, '');
  if (!raw) raw = 'https://aumonext-api.onrender.com';
  if (raw.startsWith('http://')) raw = raw.replace('http://', 'https://');
  console.log('[CONFIG] WEB_API_BASE_URL (WAJIB TANPA /api/v1):', raw);
  return raw;
}
export const API_BASE_URL = getApiBase();
