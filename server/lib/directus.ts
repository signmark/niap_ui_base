import axios from 'axios';

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.example.com';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

export const directusApi = axios.create({
  baseURL: DIRECTUS_URL,
  headers: {
    'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Add response interceptor for error handling
directusApi.interceptors.response.use(
  response => response,
  error => {
    console.error('Directus API Error:', error.response?.data || error.message);
    throw error;
  }
);

export { DIRECTUS_URL };
