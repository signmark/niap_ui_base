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
}

import { api } from './api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: localStorage.getItem('auth_token') || null,
      userId: localStorage.getItem('user_id') || null,
      isAuthenticated: !!(localStorage.getItem('auth_token') && localStorage.getItem('user_id')),
      isAdmin: localStorage.getItem('is_admin') === 'true',
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
        if (isAdmin) {
          localStorage.setItem('is_admin', 'true');
        } else {
          localStorage.removeItem('is_admin');
        }
        set({ isAdmin });
      },

      checkIsAdmin: async () => {
        console.log('Проверка статуса администратора');
        try {
          // Получаем текущий токен
          const token = get().getAuthToken();
          if (!token) {
            console.log('Невозможно проверить права администратора - пользователь не авторизован');
            return false;
          }

          // Запрашиваем проверку администратора
          const response = await api.get('/auth/is-admin');
          
          if (response.data && response.data.success && response.data.isAdmin === true) {
            console.log('Пользователь является администратором');
            // Сохраняем статус администратора
            get().setIsAdmin(true);
            return true;
          } else {
            console.log('Пользователь не является администратором');
            // Сохраняем статус не-администратора
            get().setIsAdmin(false);
            return false;
          }
        } catch (error) {
          console.error('Ошибка при проверке статуса администратора:', error);
          // При ошибке считаем пользователя не администратором
          get().setIsAdmin(false);
          return false;
        }
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