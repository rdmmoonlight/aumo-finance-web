import aumoConfig from '../config/aumo.config';

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  // Validasi ketat: Endpoint wajib diawali dengan '/'
  if (!endpoint.startsWith('/')) {
    throw new Error(
      `[apiClient Error]: Endpoint "${endpoint}" tidak valid. Endpoint wajib diawali dengan '/'. Contoh: '/journal-entry'`
    );
  }

  const isFormData = options.body instanceof FormData;

  // Set header default (Content-Type diabaikan jika FormData agar browser menyusun boundary secara otomatis)
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  // Stringify body jika berupa objek biasa dan bukan FormData/String
  let body: BodyInit | null | undefined;
  if (options.body) {
    if (isFormData || typeof options.body === 'string') {
      body = options.body as BodyInit;
    } else {
      body = JSON.stringify(options.body);
    }
  }

  // Penggabungan base URL dan endpoint
  const baseUrl = aumoConfig.apiBaseUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
    body,
  });

  // Handle error HTTP status
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || errorData.title || `HTTP error! Status: ${response.status}`
    );
  }

  // Handle respons bertipe Blob/File (export Excel, PDF, atau biner lainnya)
  const contentType = response.headers.get('content-type');
  if (
    contentType &&
    (contentType.includes('application/vnd.openxmlformats-officedocument') ||
      contentType.includes('application/pdf') ||
      contentType.includes('application/octet-stream'))
  ) {
    return (await response.blob()) as T;
  }

  // Parse JSON jika respons tidak kosong
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export default apiClient;