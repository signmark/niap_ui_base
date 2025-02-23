import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  setAuth: (userId: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      isAuthenticated: false,
      userId: null,
      setAuth: (userId) => 
        set({ 
          isAuthenticated: !!userId,
          userId 
        }),
    }),
    {
      name: 'auth-store',
    }
  )
);
