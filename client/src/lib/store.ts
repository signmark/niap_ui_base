import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string | null, userId: string | null) => void;
  clearAuth: () => void;
  getAuthToken: () => string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: localStorage.getItem('auth_token') || null,
      userId: null,
      isAuthenticated: !!localStorage.getItem('auth_token'),
      setAuth: (token, userId) => {
        // Сохраняем токен и в localStorage для прямого доступа
        if (token) {
          localStorage.setItem('auth_token', token);
        } else {
          localStorage.removeItem('auth_token');
        }

        set({ 
          token, 
          userId, 
          isAuthenticated: !!token && !!userId,
        });
      },
      clearAuth: () => {
        localStorage.removeItem('auth_token');
        set({ 
          token: null, 
          userId: null, 
          isAuthenticated: false,
        });
      },
      getAuthToken: () => {
        // Получить действующий токен авторизации
        const state = get();
        return state.token || localStorage.getItem('auth_token');
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);