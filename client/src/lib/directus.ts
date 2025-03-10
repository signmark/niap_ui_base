import axios from 'axios';

// Base URL for Directus API
export const DIRECTUS_URL = 'https://directus.nplanner.ru';

// Create axios instance for Directus API
export const directusApi = axios.create({
  baseURL: DIRECTUS_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
directusApi.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  return config;
});

// Response interceptor for error handling
directusApi.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.data?.errors?.[0]) {
      throw new Error(error.response.data.errors[0].message);
    }
    throw error;
  }
);