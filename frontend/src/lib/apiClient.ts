import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.WEB_API_URL,
  withCredentials: true, // WAJIB agar Cookie SameSite/Cors dikirim oleh browser
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

// Interceptor response (Redirect ke /auth kalau 401 Unauthorized)
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      
      // Mencegah infinite loop redirect jika sudah berada di halaman auth
      if (!currentPath.startsWith('/auth') && !currentPath.startsWith('/login')) {
        window.location.href = '/auth'
      }
    }
    return Promise.reject(err)
  }
)

export default apiClient
      
