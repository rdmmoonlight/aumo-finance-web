export const API_BASE_URL = (import.meta.env.API_BASE_URL || '').replace(/\/$/, '');
if (!API_BASE_URL) console.warn('[CONFIG] API_BASE_URL kosong!');
else console.log('[CONFIG] API_BASE_URL:', API_BASE_URL);
export default { API_BASE_URL };
