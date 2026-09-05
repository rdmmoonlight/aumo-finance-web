const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface FetchOptions extends RequestInit {
  body?: any;
}

export async function apiClient(endpoint: string, options: FetchOptions = {}) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Jika body berupa objek, ubah ke JSON (kecuali jika FormData untuk upload file excel)
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    body,
    // credentials: 'include' // Aktifkan jika backend Anda menggunakan Cookie/Session ASP.NET Core Identity
  });

  // Handle respons error
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.title || `HTTP error! Status: ${response.status}`);
  }

  // Jika respons berupa file (blob/excel download)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument')) {
    return response.blob();
  }

  // Parse JSON jika ada isinya
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
