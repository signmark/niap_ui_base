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
      isSmmAdmin: localStorage.getItem('is_smm_admin') === 'true',
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
        localStorage.removeItem('is_smm_admin'); // Очищаем статус SMM админа при выходе
        
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
          isSmmAdmin: false, // Сбрасываем статус SMM администратора
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
      
      setIsSmmAdmin: (isSmmAdmin) => {
        // Сохраняем статус SMM администратора
        console.log('Устанавливаем статус SMM администратора:', isSmmAdmin);
        if (isSmmAdmin) {
          localStorage.setItem('is_smm_admin', 'true');
        } else {
          localStorage.removeItem('is_smm_admin');
        }
        set({ isSmmAdmin });
      },

      checkIsAdmin: async () => {
        console.log('Проверка статуса администратора');
        try {
          // Получаем текущий токен
          const token = get().getAuthToken();
          if (!token) {
            console.log('Невозможно проверить права администратора - пользователь не авторизован');
            get().setIsAdmin(false); // Очищаем статус администратора при отсутствии токена
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
          
          if (data && data.success && data.isAdmin === true) {
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
      },
      
      checkIsSmmAdmin: async () => {
        console.log('Проверка статуса SMM администратора');
        try {
          // Получаем текущий токен
          const token = get().getAuthToken();
          if (!token) {
            console.log('Невозможно проверить права SMM администратора - пользователь не авторизован');
            get().setIsSmmAdmin(false);
            return false;
          }

          console.log('Отправка API запроса на /auth/is-smm-admin c токеном', token.substring(0, 10) + '...');
          // Запрашиваем проверку SMM администратора через явный fetch запрос с отключением кэширования
          const response = await fetch('/api/auth/is-smm-admin', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            cache: 'no-cache'
          });
          
          const data = await response.json();
          console.log('Ответ сервера на запрос проверки SMM админа:', data);
          
          if (data && data.success && data.isSmmAdmin === true) {
            console.log('Пользователь является SMM администратором');
            // Сохраняем статус SMM администратора
            get().setIsSmmAdmin(true);
            return true;
          } else {
            console.log('Пользователь не является SMM администратором');
            // Сохраняем статус не-SMM-администратора
            get().setIsSmmAdmin(false);
            return false;
          }
        } catch (error) {
          console.error('Ошибка при проверке статуса SMM администратора:', error);
          // При ошибке считаем пользователя не SMM администратором
          get().setIsSmmAdmin(false);
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
        isAdmin: state.isAdmin,
        isSmmAdmin: state.isSmmAdmin
      }),
    }
  )
);

// Хранилище для выбранной кампании перенесено в campaignStore.ts
// Используйте импорт из 'lib/campaignStore' для доступа к состоянию кампании