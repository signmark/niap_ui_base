import axios from 'axios';

// Create an instance of axios for Directus API
export const directusApi = axios.create({
  baseURL: 'https://directus.nplanner.ru',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*'
  }
});

// Create a general API instance
export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;