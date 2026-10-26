
import axios from 'axios'

// Base URL of your backend API
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Backend URL without /api, used for images
export const BACKEND_URL = API_BASE_URL.replace(/\/api\/?$/, '')

// Reusable helper for loading images from the backend
export const getImageUrl = (imagePath) => {
  if (!imagePath) return ''

  // Keep external image URLs unchanged
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath
  }

  const path = imagePath.startsWith('/')
    ? imagePath
    : `/${imagePath}`

  return `${BACKEND_URL}${path}`
}

// Create Axios instance
const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach the JWT token to protected API requests
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Auth APIs
export const registerUser = (data) =>
  API.post('/auth/register', data)

export const loginUser = (data) =>
  API.post('/auth/login', data)

export const logoutUser = () =>
  API.post('/auth/logout')

// Village APIs
export const importVillage = (data) =>
  API.post('/village/match', data)

export const getSavedVillage = () =>
  API.get('/village/saved')

// Upgrade APIs
export const calculateUpgradeCosts = (data) =>
  API.post('/upgrade/calculate', data)

// Export Axios instance
export default API
