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

  // Schedule refresh 1 minute before token expires
  const refreshIn = Math.max(expires - 60000, 1000); // Minimum 1 second
  refreshTimeout = setTimeout(() => {
    refreshAccessToken().catch(console.error);
  }, refreshIn);
};

export const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await directusApi.post<AuthResponse>('/auth/refresh', {
      refresh_token: refreshToken,
      mode: 'json'
    });

    const { access_token, refresh_token, expires } = response.data.data;

    // Update tokens
    localStorage.setItem('auth_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);

    // Update auth store
    const auth = useAuthStore.getState();
    auth.setAuth(access_token, auth.userId);

    // Setup next refresh
    setupTokenRefresh(expires);

    return access_token;
  } catch (error) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
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