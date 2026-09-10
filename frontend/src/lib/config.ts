function getApiBase() {
  let raw = (import.meta.env.API_BASE_URL as string) || '';
  raw = raw.trim().replace(/\/+$/, '');
  // paksa tanpa /api/v1 di base
  raw = raw.replace(/\/api\/v1\/?$/, '');
  if (!raw) raw = 'https://aumonext-api.onrender.com';
  // paksa https
  if (raw.startsWith('http://')) raw = raw.replace('http://', 'https://');
  console.log('[CONFIG] API_BASE_URL (WAJIB TANPA /api/v1):', raw);
  return raw;
}
export const API_BASE_URL = getApiBase();
