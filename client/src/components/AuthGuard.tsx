import { useEffect, ReactNode, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/lib/store';
import { isTokenValid, refreshAccessToken } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [, navigate] = useLocation();
  const [location] = useLocation();
  const { token, userId, setAuth, clearAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  
  // Получаем токен и ID из localStorage
  const storedToken = localStorage.getItem('auth_token');
  const storedUserId = localStorage.getItem('user_id');
  
  const hasStoredToken = !!storedToken;
  const hasToken = !!token;
  const isLoginPage = location === '/login' || location === '/auth/login';
  
  console.log('AuthGuard: Checking auth state', { hasToken, hasStoredToken, isLoginPage });

  // Проверка сессии с сервером
  const { data: authData, isLoading: isAuthChecking } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: hasToken || hasStoredToken,
    staleTime: 5 * 60 * 1000, // 5 минут
    retry: 1,
    queryFn: async () => {
      try {
        const currentToken = token || storedToken;
        if (!currentToken) return { authenticated: false };
        
        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'X-User-Id': userId || storedUserId || ''
          }
        });
        
        if (!res.ok) {
          if (res.status === 401) {
            console.log('AuthGuard: Session expired, trying to refresh token');
            try {
              // Пробуем обновить токен
              await refreshAccessToken();
              // Если успешно, перезапрашиваем
              const newToken = localStorage.getItem('auth_token');
              const newUserId = localStorage.getItem('user_id');
              
              if (newToken) {
                const refreshedRes = await fetch('/api/auth/me', {
                  headers: {
                    'Authorization': `Bearer ${newToken}`,
                    'X-User-Id': newUserId || ''
                  }
                });
                
                if (refreshedRes.ok) {
                  return await refreshedRes.json();
                }
              }
            } catch (refreshError) {
              console.error('Failed to refresh token:', refreshError);
            }
          }
          return { authenticated: false };
        }
        
        return await res.json();
      } catch (error) {
        console.error('Error checking auth status:', error);
        return { authenticated: false };
      }
    }
  });

  // Локальная проверка токена (более быстрая)
  const localTokenValid = isTokenValid();
  
  useEffect(() => {
    // Если загрузка все еще идет, ничего не делаем
    if (isAuthChecking) return;
    
    // Если токен из хранилища доступен, но не в стейте, восстанавливаем
    if (!hasToken && hasStoredToken && storedUserId) {
      console.log('AuthGuard: Token already in localStorage, restoring to state', { 
        tokenLength: storedToken?.length, 
        userId: storedUserId 
      });
      setAuth(storedToken!, storedUserId);
    }
    
    // Если проверка авторизации завершена
    if (authData) {
      console.log('AuthGuard: Auth check completed', authData);
      
      if (authData.authenticated) {
        // Токен валидный
        console.log('AuthGuard: Token is valid according to server');
        
        // Если на странице логина, перенаправляем
        if (isLoginPage) {
          navigate('/campaigns');
        }
        
        setIsLoading(false);
      } else {
        // Токен невалидный
        console.log('AuthGuard: Token is invalid according to server');
        
        // Очищаем данные авторизации
        clearAuth();
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_id');
        
        // Если не на странице логина, перенаправляем
        if (!isLoginPage) {
          navigate('/login');
        }
        
        setIsLoading(false);
      }
    } else {
      // Если нет данных авторизации и не на странице логина
      if (!hasToken && !hasStoredToken && !isLoginPage) {
        console.log('AuthGuard: No auth data and not on login page, redirecting');
        navigate('/login');
        setIsLoading(false);
      } else if (isLoginPage && (hasToken || (hasStoredToken && localTokenValid))) {
        // Если на странице логина с валидным токеном
        console.log('AuthGuard: On login page with valid token, redirecting to campaigns');
        navigate('/campaigns');
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [
    authData, 
    isAuthChecking, 
    hasToken, 
    hasStoredToken, 
    isLoginPage, 
    localTokenValid,
    navigate, 
    setAuth, 
    clearAuth,
    storedToken,
    storedUserId,
    userId
  ]);

  // Если идёт загрузка или проверка, показываем спиннер
  if (isLoading || isAuthChecking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Если не на странице логина и нет токена, не рендерим содержимое (будет редирект)
  if (!isLoginPage && !hasToken && !hasStoredToken) {
    return null;
  }

  // В остальных случаях рендерим содержимое
  return <>{children}</>;
}