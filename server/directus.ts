import axios from 'axios';

// Create a Directus API client instance
export const directusApi = axios.create({
  baseURL: process.env.DIRECTUS_URL || 'http://localhost:8055',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
directusApi.interceptors.response.use(
  response => response,
  error => {
    console.error('Directus API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        params: error.config?.params
      }
    });
    return Promise.reject(error);
  }
);

export default directusApi;
