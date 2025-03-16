import { directusApi } from './directus';
import { useAuthStore } from './store';

interface AuthResponse {
  data: {
    access_token: string;
    refresh_token: string;
    expires: number;
    user: {
      id: string;
    };
  };
}

let refreshTimeout: NodeJS.Timeout | null = null;

export const setupTokenRefresh = (expires: number) => {
  if (typeof window === 'undefined') return;

  // Clear any existing refresh timeout
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }

  // Convert to milliseconds if it looks like seconds
  let expiresMs = expires;
  if (expires < 10000) { // If less than 10 seconds, it's probably in seconds format
    console.log('Expires value appears to be in seconds, converting to milliseconds');
    expiresMs = expires * 1000;
  }

  // Schedule refresh to happen at 80% of the token lifetime
  // This ensures we refresh well before expiration
  const refreshIn = Math.max(Math.floor(expiresMs * 0.8), 1000); // Minimum 1 second
  
  console.log(`Token will expire in ${expiresMs/1000} seconds, scheduling refresh in ${refreshIn/1000} seconds`);
  
  refreshTimeout = setTimeout(() => {
    console.log('Refresh timeout triggered, refreshing token');
    refreshAccessToken().catch(error => {
      console.error('Failed to refresh token in scheduled refresh:', error);
    });
  }, refreshIn);
};

export const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    console.error('Невозможно обновить токен: отсутствует refresh_token');
    throw new Error('No refresh token available');
  }

  try {
    console.log('Attempting to refresh token');
    const response = await directusApi.post<AuthResponse>('/auth/refresh', {
      refresh_token: refreshToken,
      mode: 'json'
    });

    if (!response.data?.data?.access_token) {
      console.error('Неверный формат ответа при обновлении токена:', response.data);
      throw new Error('Invalid response format during token refresh');
    }

    const { access_token, refresh_token, expires } = response.data.data;
    console.log('Token refresh successful, new token length:', access_token.length);

    // Update tokens
    localStorage.setItem('authToken', access_token);
    localStorage.setItem('refresh_token', refresh_token);

    // Update auth store
    const auth = useAuthStore.getState();
    auth.setAuth(access_token, auth.userId);

    // Setup next refresh - schedule it for 1 minute before expiration
    const refreshIn = Math.max(expires - 60000, 1000); // At least 1 second
    console.log(`Setting up next token refresh in ${refreshIn / 1000} seconds`);
    setupTokenRefresh(refreshIn);

    return access_token;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    
    // Clear tokens on refresh failure
    localStorage.removeItem('authToken');
    localStorage.removeItem('refresh_token');
    
    // Clear auth store
    const auth = useAuthStore.getState();
    auth.clearAuth();
    
    throw error;
  }
};

export const loginWithDirectus = async (email: string, password: string) => {
  try {
    const response = await directusApi.post<AuthResponse>('/auth/login', {
      email,
      password,
    });

    const { access_token, refresh_token, expires, user } = response.data.data;

    // Save tokens and user ID
    localStorage.setItem('auth_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('user_id', user.id);

    // Update auth store with user ID
    const auth = useAuthStore.getState();
    auth.setAuth(access_token, user.id);

    // Setup token refresh
    setupTokenRefresh(expires);

    return { access_token, user };
  } catch (error: any) {
    console.error('Login error:', error);
    throw new Error(error.response?.data?.errors?.[0]?.message || error.message);
  }
};

export const logout = async () => {
  try {
    // Clear refresh timeout
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }

    // Clear tokens
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');

    // Clear auth store
    const auth = useAuthStore.getState();
    auth.clearAuth();

    // Try to logout from Directus
    try {
      await directusApi.post('/auth/logout');
    } catch (error) {
      console.warn('Error during logout:', error);
    }
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};