import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { setupInitialAuth } from "@/lib/auth";

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  expires: number;
  user: {
    id: string;
    email: string;
  };
};

type AuthContextType = {
  user: any | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<LoginResponse, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<LoginResponse, Error, RegisterData>;
};

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { add: toast } = useToast();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const response = await fetch('https://directus.nplanner.ru/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...credentials,
          mode: 'json'
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.message || 'Failed to login');
      }

      return response.json();
    },
    onSuccess: (data: LoginResponse) => {
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setupInitialAuth(data.expires);
      queryClient.setQueryData(["/auth/me"], data.user);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка входа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await fetch('https://directus.nplanner.ru/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.message || 'Failed to register');
      }

      return response.json();
    },
    onSuccess: (data: LoginResponse) => {
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setupInitialAuth(data.expires);
      queryClient.setQueryData(["/auth/me"], data.user);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка регистрации",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Получаем текущий токен для выхода
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      try {
        await fetch('https://directus.nplanner.ru/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
      } finally {
        // Всегда очищаем локальное хранилище и состояние, даже если запрос logout не удался
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        queryClient.setQueryData(["/auth/me"], null);
        // Очищаем все кеши запросов
        queryClient.clear();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка выхода",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}