import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  userId: string | null;
  setAuth: (userId: string | null, token: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      setAuth: (userId, token) => {
        set({ userId, token });
      },
    }),
    {
      name: 'auth-store',
    }
  )
);