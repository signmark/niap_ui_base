import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/lib/store';
import { refreshAccessToken } from '@/lib/auth';

interface Props {
  children: React.ReactNode;
}

export function AuthGuard({ children }: Props) {
  const [, navigate] = useLocation();
  const [location] = useLocation();
  const [isSessionChecked, setIsSessionChecked] = useState(false);
  const token = useAuthStore((state) => state.token);
  const setAuth = useAuthStore((state) => state.setAuth);

  // Эффект при загрузке компонента для проверки авторизации
  useEffect(() => {
    // Проверяем, есть ли токен в хранилище
    const storedToken = localStorage.getItem('auth_token');
    const storedUserId = localStorage.getItem('user_id');
    const storedRefreshToken = localStorage.getItem('refresh_token');
    
    const isLoginPage = location === '/auth/login' || location === '/login';
    
    console.log('AuthGuard: Checking auth state', { 
      hasToken: !!token, 
      hasStoredToken: !!storedToken, 
      isLoginPage 
    });

    const checkSession = async () => {
      // Если нет сохраненного токена, но есть refresh токен, пробуем обновить сессию
      if (!storedToken && storedRefreshToken) {
        try {
          console.log('AuthGuard: Attempting to refresh token');
          await refreshAccessToken();
          setIsSessionChecked(true);
          return;
        } catch (error) {
          console.error('AuthGuard: Token refresh failed:', error);
          // Если обновление не удалось, перенаправляем на страницу входа
          if (!isLoginPage) {
            navigate('/auth/login');
          }
          setIsSessionChecked(true);
          return;
        }
      }
      
      // Если уже есть токен в store, считаем что авторизация в порядке
      if (token) {
        console.log('AuthGuard: Token already in store');
        setIsSessionChecked(true);
        return;
      }
      
      // Если есть сохраненный токен, но он не в store, добавляем его
      if (storedToken && storedUserId) {
        console.log('AuthGuard: Restoring token from localStorage');
        setAuth(storedToken, storedUserId);
        setIsSessionChecked(true);
        return;
      }
      
      // Если нет ни токена, ни storedToken, перенаправляем на логин
      if (!token && !storedToken && !isLoginPage) {
        console.log('AuthGuard: No token found, redirecting to login');
        navigate('/auth/login');
      }
      
      setIsSessionChecked(true);
    };

    checkSession();
  }, [token, location, navigate, setAuth]);

  // Показываем загрузку пока не проверили сессию
  if (!isSessionChecked) {
    return <div className="flex h-screen items-center justify-center">Проверка сессии...</div>;
  }

  // Если проверка прошла, возвращаем дочерние компоненты
  return <>{children}</>;
}