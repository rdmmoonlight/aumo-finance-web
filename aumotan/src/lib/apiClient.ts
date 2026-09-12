import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_WEB_API_URL,
  withCredentials: true,
})

// Interceptor response (Redirect ke login kalau 401 Unauthorized)
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    // Pengecekan aman untuk lingkungan SSR / TanStack Start
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default apiClient