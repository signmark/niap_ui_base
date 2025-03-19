import { useEffect, ReactNode, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/lib/store';
import { isTokenValid } from '@/lib/auth';

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [, navigate] = useLocation();
  const [location] = useLocation();
  const { token, setAuth, clearAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  
  // Получаем токен и ID из localStorage
  const hasStoredToken = !!localStorage.getItem('auth_token');
  const hasToken = !!token;
  const isLoginPage = location === '/login' || location === '/auth/login';
  
  console.log('AuthGuard: Checking auth state', { hasToken, hasStoredToken, isLoginPage });

  // Проверяем токен локально, без запросов к API
  const localTokenValid = isTokenValid();
  
  useEffect(() => {
    // Если нет токена и не на странице логина - перенаправляем
    if (!hasToken && !hasStoredToken && !isLoginPage) {
      console.log('AuthGuard: No token found, redirecting to login');
      navigate('/login');
      setIsLoading(false);
      return;
    }
    
    // Если на странице логина и есть валидный токен - перенаправляем на главную
    if (isLoginPage && hasToken && localTokenValid) {
      console.log('AuthGuard: Valid token present, redirecting to home from login page');
      navigate('/campaigns');
      setIsLoading(false);
      return;
    }
    
    // Если есть сохраненный токен, но нет в состоянии - восстанавливаем из localStorage
    if (!hasToken && hasStoredToken) {
      const storedToken = localStorage.getItem('auth_token') || '';
      const storedUserId = localStorage.getItem('user_id') || '';
      
      console.log('AuthGuard: Restored token from localStorage', {
        tokenLength: storedToken.length,
        hasUserId: !!storedUserId,
      });
      
      setAuth(storedToken, storedUserId);
    }
    
    // Проверяем локальную валидность токена
    if (hasToken || hasStoredToken) {
      if (localTokenValid) {
        console.log('AuthGuard: Token is valid locally');
        
        // Если на странице логина, перенаправляем на главную
        if (isLoginPage) {
          navigate('/campaigns');
        }
      } else {
        // Если токен невалидный, очищаем сессию
        console.log('AuthGuard: Token is invalid locally, clearing auth data');
        clearAuth();
        
        // Если не на странице логина, перенаправляем
        if (!isLoginPage) {
          navigate('/login');
        }
      }
    }
    
    setIsLoading(false);
  }, [hasToken, hasStoredToken, isLoginPage, localTokenValid, navigate, setAuth, clearAuth]);

  // Если идёт загрузка или проверка, показываем спиннер
  if (isLoading) {
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