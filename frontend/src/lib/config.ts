export const WEB_API_BASE_URL = (() => {
  let raw = (import.meta.env.WEB_API_BASE_URL as string) || 'https://aumonext-api.onrender.com';
  raw = raw.trim().replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '');
  console.log('[CONFIG] WEB_API_BASE_URL:', raw);
  return raw;
})();
