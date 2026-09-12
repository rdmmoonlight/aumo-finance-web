import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_WEB_API_URL,
  withCredentials: true,
})

// Interceptor response (Redirect ke auth/login kalau 401 Unauthorized)
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      
      // Mencegah infinite loop redirect jika sudah berada di halaman auth/login
      if (!currentPath.startsWith('/auth') && !currentPath.startsWith('/login')) {
        window.location.href = '/auth' // sesuaikan dengan rute auth kamu ('/auth' atau '/login')
      }
    }
    return Promise.reject(err)
  }
)

export default apiClient