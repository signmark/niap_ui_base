import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
// Импортируем хранилище кампании из отдельного файла
import { useCampaignStore } from './campaignStore';

interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  lastAdminCheck: number | null;
  setAuth: (token: string | null, userId: string | null) => void;
  clearAuth: () => void;
  getAuthToken: () => string | null;
  setIsAdmin: (isAdmin: boolean) => void;
  checkIsAdmin: () => Promise<boolean>;
  setToken: (token: string) => void;
  logout: () => void;
}

import { api } from './api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: localStorage.getItem('auth_token') || null,
      userId: localStorage.getItem('user_id') || null,
      isAuthenticated: !!(localStorage.getItem('auth_token') && localStorage.getItem('user_id')),
      isAdmin: localStorage.getItem('is_admin') === 'true',
      lastAdminCheck: null,
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

        console.log(`Сохранение авторизации: token=${!!token}, userId=${userId}`);
        set({ 
          token, 
          userId, 
          isAuthenticated: !!token && !!userId,
        });
      },
      clearAuth: () => {
        console.log('Очистка данных авторизации');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('is_admin'); // Очищаем статус админа при выходе
        
        // Сбрасываем выбранную кампанию при выходе пользователя из системы
        const clearCampaign = useCampaignStore.getState().clearSelectedCampaign;
        if (clearCampaign) {
          console.log('Сброс выбранной кампании при смене пользователя');
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
        if (!token) {
          console.log('Токен авторизации не найден');
        }
        return token;
      },

      setIsAdmin: (isAdmin) => {
        // Сохраняем статус администратора
        console.log('Устанавливаем статус администратора:', isAdmin);
        if (isAdmin) {
          localStorage.setItem('is_admin', 'true');
        } else {
          localStorage.removeItem('is_admin');
        }
        set({ isAdmin });
      },

      checkIsAdmin: async () => {
        const currentTime = Date.now();
        const lastCheck = get().lastAdminCheck || 0;
        const cacheTimeout = 30000; // 30 секунд кеша
        
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: используем кеш для предотвращения бесконечных запросов
        if (currentTime - lastCheck < cacheTimeout && get().isAdmin !== undefined) {
          console.log('Используем кешированный статус администратора:', get().isAdmin);
          return get().isAdmin;
        }
        
        console.log('Проверка статуса администратора');
        try {
          // Получаем текущий токен
          const token = get().getAuthToken();
          if (!token) {
            console.log('Невозможно проверить права администратора - пользователь не авторизован');
            set({ isAdmin: false, lastAdminCheck: currentTime });
            return false;
          }

          console.log('Отправка API запроса на /auth/is-admin c токеном', token.substring(0, 10) + '...');
          // Запрашиваем проверку администратора через явный fetch запрос с отключением кэширования
          const response = await fetch('/api/auth/is-admin', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            cache: 'no-cache' // Важно! Предотвращает кэширование
          });
          
          const data = await response.json();
          console.log('Ответ сервера на запрос проверки админа:', data);
          
          const isAdminResult = data && data.success && data.isAdmin === true;
          set({ 
            isAdmin: isAdminResult,
            lastAdminCheck: currentTime
          });
          localStorage.setItem('is_admin', isAdminResult.toString());
          
          if (isAdminResult) {
            console.log('Пользователь является администратором');
            return true;
          } else {
            console.log('Пользователь не является администратором');
            return false;
          }
        } catch (error) {
          console.error('Ошибка при проверке статуса администратора:', error);
          // При ошибке считаем пользователя не администратором
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