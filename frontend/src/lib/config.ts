const rawBase = (import.meta.env.API_BASE_URL as string) || (import.meta.env.VITE_API_URL as string) || '';

export const API_BASE_URL = rawBase.replace(/\/$/, '');

console.log('[CONFIG] API_BASE_URL =', API_BASE_URL, '| RAW =', rawBase);

if (!API_BASE_URL) {
  console.warn('[CONFIG] API_BASE_URL kosong! Set di Vercel ENV sebagai API_BASE_URL');
}

export default { API_BASE_URL };
