import axios from 'axios'

// In development, use proxy (no CORS needed). In production, use Render backend
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://greenstone-resume-xzxm-6wag3is48-decipher6s-projects.vercel.app/api')

const authApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Auth functions
export const signup = (email, password, name) => {
  return authApi.post('/auth/signup', { email, password, name })
}

export const login = (email, password) => {
  return authApi.post('/auth/login', { email, password })
}

export const getMe = (token) => {
  return authApi.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  })
}


// Token management
export const setToken = (token) => {
  localStorage.setItem('auth_token', token)
}

export const getToken = () => {
  return localStorage.getItem('auth_token')
}

export const removeToken = () => {
  localStorage.removeItem('auth_token')
}

export default authApi

