export const API_BASE_URL = (() => {
  let raw = (import.meta.env.API_BASE_URL as string) || 'https://aumonext-api.onrender.com';
  raw = raw.trim().replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '');
  console.log('[CONFIG] API_BASE_URL:', raw);
  return raw;
})();
