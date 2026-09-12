export const VITE_WEB_API_URL = (() => {
  let raw = (import.meta.env.VITE_WEB_API_URL as string) || 'https://aumonext-api.onrender.com';
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw.replace(/^\/+/, '');
  if (typeof window !== 'undefined') {
    console.log('[CONFIG] VITE_WEB_API_URL:', raw);
  }
  return raw.replace(/\/+$/, '');
})()
