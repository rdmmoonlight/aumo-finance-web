import axios from 'axios'
import { VITE_WEB_API_URL } from '@/lib/config'

const apiClient = axios.create({
  baseURL: VITE_WEB_API_URL,
  withCredentials: false,
})

// cuma attach token di browser, jangan di SSR
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('aumo_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  // kalo url nya http external, jangan pake baseURL
  if (config.url?.startsWith('http')) {
    config.baseURL = ''
  }
  return config
})

export default apiClient
