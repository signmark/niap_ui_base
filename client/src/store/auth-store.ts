import { create } from 'zustand';

interface AuthState {
  token: string | null;
  userId: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setTokens: (token: string, refreshToken: string, userId: string) => void;
  clearTokens: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Инициализация состояния из localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
  const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null;

  return {
    token,
    refreshToken,
    userId,
    isAuthenticated: !!token,
    
    setTokens: (token, refreshToken, userId) => {
      // Сохраняем токены как в store, так и в localStorage
      localStorage.setItem('auth_token', token);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user_id', userId);
      
      set({ token, refreshToken, userId, isAuthenticated: true });
    },
    
    clearTokens: () => {
      // Удаляем токены как из store, так и из localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_id');
      
      set({ token: null, refreshToken: null, userId: null, isAuthenticated: false });
    }
  };
});