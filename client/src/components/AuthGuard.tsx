import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/lib/store';
import { refreshAccessToken } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export function AuthGuard({ children }: Props) {
  const [, navigate] = useLocation();
  const [location] = useLocation();
  const [isSessionChecked, setIsSessionChecked] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.userId);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

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
      isLoginPage,
      userId
    });

    const checkSession = async () => {
      // Если есть токен в store и userId, считаем что авторизация в порядке
      if (token && userId) {
        console.log('AuthGuard: Authentication confirmed with token in store');
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
      
      // Если нет сохраненного токена, но есть refresh токен, пробуем обновить сессию
      if (!storedToken && storedRefreshToken) {
        try {
          console.log('AuthGuard: Attempting to refresh token with refresh_token');
          setIsRefreshing(true);
          await refreshAccessToken();
          setIsRefreshing(false);
          setIsSessionChecked(true);
          return;
        } catch (error) {
          console.error('AuthGuard: Token refresh failed:', error);
          setIsRefreshing(false);
          
          // Очищаем любые устаревшие токены
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_id');
          clearAuth();
          
          // Если обновление не удалось, перенаправляем на страницу входа
          if (!isLoginPage) {
            navigate('/auth/login');
          }
          setIsSessionChecked(true);
          return;
        }
      }
      
      // Если нет ни токена, ни storedToken и мы не на публичной странице, перенаправляем на логин
      // Добавляем проверку для страниц, которые должны быть доступны без аутентификации
      const isPublicPage = location === '/content' || location === '/';
      
      if (!token && !storedToken && !isLoginPage && !isPublicPage) {
        console.log('AuthGuard: No token found, redirecting to login');
        navigate('/auth/login');
      }
      
      setIsSessionChecked(true);
    };

    checkSession();
  }, [token, userId, location, navigate, setAuth, clearAuth]);

  // Показываем загрузку пока не проверили сессию
  if (!isSessionChecked) {
    return (
      <div className="flex h-screen items-center justify-center flex-col">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <div className="text-lg font-medium">
          {isRefreshing ? 'Обновление сессии...' : 'Проверка сессии...'}
        </div>
      </div>
    );
  }

  // Если проверка прошла, возвращаем дочерние компоненты
  return <>{children}</>;
}