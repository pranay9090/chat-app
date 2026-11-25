// ============================================================================
// Axios API Client
// Centralized HTTP client configured for the backend API
// ============================================================================

import axios from 'axios';

// Create an axios instance with base URL pointing to the Express server
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Request interceptor: reads JWT token from localStorage and attaches it
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    // If token exists, add it to Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: redirect to login if unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
