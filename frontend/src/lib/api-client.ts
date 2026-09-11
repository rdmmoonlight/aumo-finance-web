import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.WEB_API_BASE_URL,
  withCredentials: true, // buat cookie .NET
})

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if(err.response?.status === 401) window.location.href = '/login'
    return Promise.reject(err)
  }
)
