import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
// Импортируем хранилище кампании из отдельного файла
import { useCampaignStore } from './campaignStore';

interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  setAuth: (token: string | null, userId: string | null) => void;
  clearAuth: () => void;
  getAuthToken: () => string | null;
  setIsAdmin: (isAdmin: boolean) => void;
  checkIsAdmin: () => Promise<boolean>;
  setToken: (token: string) => void;
  logout: () => void;
}

import { api } from './api';

// Функция для проверки истекшего токена
const checkTokenExpiration = (token: string | null): boolean => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp && payload.exp > now;
  } catch {
    return false;
  }
};

// Проверяем токен при загрузке
const storedToken = localStorage.getItem('auth_token');
const isTokenValid = checkTokenExpiration(storedToken);

// Если токен истек, очищаем localStorage
if (storedToken && !isTokenValid) {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('is_admin');
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: isTokenValid ? storedToken : null,
      userId: isTokenValid ? localStorage.getItem('user_id') : null,
      isAuthenticated: isTokenValid && !!(localStorage.getItem('auth_token') && localStorage.getItem('user_id')),
      isAdmin: isTokenValid ? localStorage.getItem('is_admin') === 'true' : false,
      setAuth: (token, userId) => {
        // Сохраняем токен и userId в localStorage для прямого доступа
        if (token) {
          localStorage.setItem('auth_token', token);
        } else {
          localStorage.removeItem('auth_token');
        }
        
        if (userId) {
          localStorage.setItem('user_id', userId);
        } else {
          localStorage.removeItem('user_id');
        }

        set({ 
          token, 
          userId, 
          isAuthenticated: !!token && !!userId,
        });
      },
      clearAuth: () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('is_admin'); // Очищаем статус админа при выходе
        
        // Сбрасываем выбранную кампанию при выходе пользователя из системы
        const clearCampaign = useCampaignStore.getState().clearSelectedCampaign;
        if (clearCampaign) {
          clearCampaign();
        }
        
        set({ 
          token: null, 
          userId: null, 
          isAuthenticated: false,
          isAdmin: false, // Сбрасываем статус администратора
        });
      },
      getAuthToken: () => {
        // Получить действующий токен авторизации
        const state = get();
        const token = state.token || localStorage.getItem('auth_token');
        return token;
      },

      setIsAdmin: (isAdmin) => {
        // Сохраняем статус администратора
        if (isAdmin) {
          localStorage.setItem('is_admin', 'true');
        } else {
          localStorage.removeItem('is_admin');
        }
        set({ isAdmin });
      },

      checkIsAdmin: async () => {
        try {
          // Получаем текущий токен
          const token = get().getAuthToken();
          if (!token) {
            get().setIsAdmin(false);
            return false;
          }

          // ПРИНУДИТЕЛЬНАЯ проверка токена перед запросом
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < (now + 30)) {
              localStorage.clear();
              sessionStorage.clear();
              get().logout();
              window.location.href = '/login';
              return false;
            }
          } catch (e) {
            localStorage.clear();
            sessionStorage.clear();
            get().logout();
            window.location.href = '/login';
            return false;
          }
          const response = await fetch('/api/auth/is-admin', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            cache: 'no-cache'
          });
          
          const data = await response.json();
          
          if (data && data.success && data.isAdmin === true) {
            get().setIsAdmin(true);
            return true;
          } else {
            get().setIsAdmin(false);
            return false;
          }
        } catch (error) {
          console.error('Ошибка при проверке статуса администратора:', error);
          get().setIsAdmin(false);
          return false;
        }
      },

      setToken: (token: string) => {
        localStorage.setItem('auth_token', token);
        set({ token, isAuthenticated: !!token && !!get().userId });
      },

      logout: () => {
        get().clearAuth();
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        token: state.token,
        userId: state.userId,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin
      }),
    }
  )
);

// Хранилище для выбранной кампании перенесено в campaignStore.ts
// Используйте импорт из 'lib/campaignStore' для доступа к состоянию кампании