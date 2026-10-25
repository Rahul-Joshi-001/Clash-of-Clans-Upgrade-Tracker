import axios from 'axios'

const API = axios.create({
  baseURL: 'http://localhost:3000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach the JWT token to protected API requests.
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

export default API