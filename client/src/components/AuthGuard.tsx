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

    const validateToken = async (accessToken: string): Promise<boolean> => {
      try {
        // Проверяем действительность токена через API
        const response = await fetch('/api/auth/check', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
          console.warn('AuthGuard: Token validation failed, response status:', response.status);
          return false;
        }

        const data = await response.json();
        console.log('AuthGuard: Token validation result:', data);
        
        return data && data.valid === true;
      } catch (error) {
        console.error('AuthGuard: Error validating token:', error);
        return false;
      }
    };

    const checkSession = async () => {
      // Если есть токен в store и userId, проверяем его действительность
      if (token && userId) {
        console.log('AuthGuard: Validating token from store');
        const isValid = await validateToken(token);
        
        if (isValid) {
          console.log('AuthGuard: Token validation successful');
          setIsSessionChecked(true);
          return;
        } else {
          console.log('AuthGuard: Token from store is invalid, attempting to restore from localStorage');
          // Токен недействителен, пробуем взять из localStorage
        }
      }
      
      // Если есть сохраненный токен, проверяем его
      if (storedToken && storedUserId) {
        console.log('AuthGuard: Validating token from localStorage');
        const isValid = await validateToken(storedToken);
        
        if (isValid) {
          console.log('AuthGuard: Stored token is valid, restoring session');
          setAuth(storedToken, storedUserId);
          setIsSessionChecked(true);
          return;
        } else {
          console.log('AuthGuard: Stored token is invalid, attempting to refresh');
          // Сохраненный токен недействителен, пробуем обновить
        }
      }
      
      // Если refresh token есть, пробуем обновить токен
      if (storedRefreshToken) {
        try {
          console.log('AuthGuard: Attempting to refresh token with refresh_token');
          setIsRefreshing(true);
          await refreshAccessToken();
          
          // После обновления проверяем, что новый токен появился в localStorage
          const refreshedToken = localStorage.getItem('auth_token');
          const refreshedUserId = localStorage.getItem('user_id');
          
          if (refreshedToken && refreshedUserId) {
            console.log('AuthGuard: Token successfully refreshed');
            setAuth(refreshedToken, refreshedUserId);
            setIsRefreshing(false);
            setIsSessionChecked(true);
            return;
          } else {
            throw new Error('Failed to obtain new token after refresh');
          }
        } catch (error) {
          console.error('AuthGuard: Token refresh failed:', error);
          setIsRefreshing(false);
          
          // При ошибке refresh, не очищаем токены сразу - просто пропускаем на страницу входа
          console.log('AuthGuard: Refresh failed, but keeping stored tokens for potential restore');
        }
      }
      
      // Если нет ни токена, ни возможности обновить, перенаправляем на логин
      console.log('AuthGuard: No valid authentication found');
      if (!isLoginPage) {
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