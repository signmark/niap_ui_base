import { directusApi } from './directus';
import { useAuthStore } from './store';

interface AuthResponse {
  data: {
    access_token: string;
    refresh_token: string;
    expires: number;
  };
}

let refreshPromise: Promise<string> | null = null;

export const refreshAccessToken = async (): Promise<string> => {
  if (typeof window === 'undefined') {
    throw new Error('This function should only be called in browser environment');
  }

  // Если уже идет обновление, вернем тот же промис
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    refreshPromise = new Promise(async (resolve, reject) => {
      try {
        const response = await directusApi.post<AuthResponse>('/auth/refresh', {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token, expires } = response.data.data;

        // Сохраняем новые токены
        localStorage.setItem('auth_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        // Обновляем состояние в store
        const auth = useAuthStore.getState();
        auth.setAuth(access_token, auth.userId);

        // Планируем следующее обновление за 1 минуту до истечения
        const refreshIn = expires - 60000; // 1 минута до истечения
        setTimeout(() => {
          refreshPromise = null;
          refreshAccessToken();
        }, refreshIn);

        resolve(access_token);
      } catch (error) {
        console.error('Failed to refresh token:', error);
        // Если не удалось обновить токен, очищаем данные авторизации
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        const auth = useAuthStore.getState();
        auth.clearAuth();
        reject(error);
      }
    });

    return refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

export const setupTokenRefresh = (expires: number) => {
  if (typeof window === 'undefined') return;

  const refreshIn = expires - 60000; // Обновляем за 1 минуту до истечения
  setTimeout(() => {
    refreshAccessToken();
  }, refreshIn);
};