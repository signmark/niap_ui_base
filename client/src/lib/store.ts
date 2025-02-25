import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (token: string | null, userId: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      isAuthenticated: false,
      isInitialized: false,
      setAuth: (token, userId) => {
        console.log('Setting auth:', { token: !!token, userId: !!userId });
        set({ 
          token, 
          userId, 
          isAuthenticated: !!token && !!userId,
          isInitialized: true
        });
      },
      clearAuth: () => {
        console.log('Clearing auth');
        set({ 
          token: null, 
          userId: null, 
          isAuthenticated: false,
          isInitialized: true
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => {
        console.log('Rehydrating auth store');
        return (state) => {
          console.log('Rehydrated state:', state);
          // Ensure we mark the store as initialized after rehydration
          if (state) {
            useAuthStore.setState({ isInitialized: true });
          }
        };
      },
    }
  )
);