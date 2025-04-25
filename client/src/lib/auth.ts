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
  const userId = localStorage.getItem('user_id');
  
  if (!refreshToken) {
    console.error('Невозможно обновить токен: отсутствует refresh_token');
    throw new Error('No refresh token available');
  }

  try {
    console.log('Attempting to refresh token');
    // First try our API endpoint
    try {
      console.log('Trying our API endpoint for token refresh');
      const apiResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          refresh_token: refreshToken,
          user_id: userId 
        })
      });
      
      if (apiResponse.ok) {
        const data = await apiResponse.json();
        if (data.token) {
          console.log('API endpoint refresh successful');
          localStorage.setItem('auth_token', data.token);
          if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
          }
          
          // Update auth store
          const auth = useAuthStore.getState();
          auth.setAuth(data.token, data.user_id || userId);
          
          // Setup next refresh
          if (data.expires) {
            setupTokenRefresh(data.expires);
          }
          
          return data.token;
        }
      } else {
        console.warn('API endpoint refresh failed, trying Directus directly');
      }
    } catch (error) {
      console.warn('Error with API endpoint refresh, falling back to Directus:', error);
    }
    
    // Fall back to direct Directus API
    // Предварительно проверяем, что база URL верная
    const baseUrl = directusApi.defaults.baseURL;
    const directusAuthUrl = baseUrl ? `${baseUrl}/auth/refresh` : 'https://directus.nplanner.ru/auth/refresh';
    
    const response = await fetch(directusAuthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
        mode: 'json'
      })
    });
    
    if (!response.ok) {
      console.error(`Directus auth refresh failed with status: ${response.status}`);
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    if (!responseData?.data?.access_token) {
      console.error('Неверный формат ответа при обновлении токена:', responseData);
      throw new Error('Invalid response format during token refresh');
    }

    const { access_token, refresh_token: new_refresh_token, expires } = responseData.data;
    console.log('Token refresh successful, new token length:', access_token.length);

    // Update tokens
    localStorage.setItem('auth_token', access_token);
    localStorage.setItem('refresh_token', new_refresh_token);

    // Update auth store
    const auth = useAuthStore.getState();
    auth.setAuth(access_token, userId || auth.userId);

    // Setup next refresh - schedule it for 80% of token lifetime
    setupTokenRefresh(expires);

    return access_token;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    
    // Clear tokens on refresh failure
    localStorage.removeItem('auth_token');
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
    localStorage.removeItem('user_id');

    // Clear auth store
    const auth = useAuthStore.getState();
    auth.clearAuth();

    // Try to logout via our API first
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.warn('Error during API logout:', error);
      
      // Fall back to direct Directus logout
      try {
        await directusApi.post('/auth/logout');
      } catch (directusError) {
        console.warn('Error during Directus logout:', directusError);
      }
    }
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

/**
 * Получает текущий токен аутентификации из localStorage
 * Используется для API запросов, требующих авторизации
 * @returns Promise<string> Токен доступа
 */
export const getToken = async (): Promise<string> => {
  const token = localStorage.getItem('auth_token');
  
  // Если токен отсутствует, попробуем обновить его
  if (!token) {
    try {
      return await refreshAccessToken();
    } catch (error) {
      console.error('Не удалось получить токен аутентификации:', error);
      throw new Error('Токен аутентификации недоступен');
    }
  }
  
  return token;
};