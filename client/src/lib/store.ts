import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  token: string | null;
  setAuth: (userId: string | null, token: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      isAuthenticated: false,
      userId: null,
      token: null,
      setAuth: (userId, token) => {
        console.log('Setting auth state:', { userId, hasToken: !!token });
        set({ 
          isAuthenticated: !!userId && !!token,
          userId,
          token
        });
      },
    }),
    {
      name: 'auth-store',
    }
  )
);