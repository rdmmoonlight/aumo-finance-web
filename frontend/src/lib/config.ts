export const WEB_API_BASE_URL = (() => {
  let raw = (import.meta.env.WEB_API_BASE_URL as string) || 'https://aumonext-api.onrender.com';
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw.replace(/^\/+/, '');
  if (typeof window !== 'undefined') {
    console.log('[CONFIG] WEB_API_BASE_URL:', raw);
  }
  return raw.replace(/\/+$/, '');
})()
