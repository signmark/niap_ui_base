import { useEffect, ReactNode, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';

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

  // Проверяем валидность токена с более надежной логикой
  const { isSuccess, data, isError } = useQuery<{ authenticated: boolean; userId: string | null }>({
    queryKey: ['/api/auth/me'],
    enabled: hasToken || hasStoredToken, // выполняем запрос только если есть токен
    retry: 0, // отключаем повторные попытки чтобы не блокировать пользователя
    staleTime: 1000 * 60 * 5, // 5 минут кэширования
    // При ошибке возвращаем предустановленный результат вместо исключения
    queryFn: async () => {
      try {
        // Получаем сохраненный токен и ID
        const storedToken = localStorage.getItem('auth_token') || '';
        const storedUserId = localStorage.getItem('user_id') || '';
        
        // Если токен отсутствует, сразу возвращаем unauthorized
        if (!storedToken) {
          return { authenticated: false, userId: null, message: 'No token found' };
        }
        
        // Выполняем запрос к API для проверки токена
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
            'x-user-id': storedUserId,
            'Content-Type': 'application/json'
          }
        });
        
        // Даже при сетевой ошибке, мы получим объект
        if (!response.ok) {
          console.warn('Authentication check failed with status:', response.status);
          
          // Если получаем 401 или 403, однозначно считаем токен невалидным
          if (response.status === 401 || response.status === 403) {
            return { authenticated: false, userId: null, message: 'Invalid token' };
          }
          
          // При других ошибках (например, 5xx) предполагаем, что токен валидный
          // чтобы не выбрасывать пользователя из системы при временных проблемах сервера
          return { authenticated: true, userId: storedUserId, message: 'Assumed valid (server error)' };
        }
        
        // Нормально получен ответ - парсим его
        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Authentication check error:', error);
        
        // При сетевых ошибках считаем токен валидным, чтобы не терять сессию
        // при временных проблемах с соединением
        const storedUserId = localStorage.getItem('user_id') || '';
        return { 
          authenticated: true, 
          userId: storedUserId, 
          message: 'Assumed valid (network error)'
        };
      }
    }
  });

  useEffect(() => {
    // Если нет токена и не на странице логина - перенаправляем
    if (!hasToken && !hasStoredToken && !isLoginPage) {
      console.log('AuthGuard: No token found, redirecting to login');
      navigate('/login');
      setIsLoading(false);
      return;
    }
    
    // Если на странице логина и есть валидный токен - перенаправляем на главную
    if (isLoginPage && hasToken) {
      console.log('AuthGuard: Token already in state, redirecting to home');
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
    
    // Если проверка токена прошла и получен результат
    if (isSuccess) {
      if (data?.authenticated) {
        console.log('AuthGuard: Token is valid');
        
        // Если на странице логина, перенаправляем на главную
        if (isLoginPage) {
          navigate('/campaigns');
        }
      } else {
        // ВАЖНОЕ ИЗМЕНЕНИЕ: Проверяем, нет ли токена в localStorage
        // Если нет токена в localStorage, просто игнорируем ошибку
        // Если есть токен, но сервер говорит, что он невалидный, очищаем
        const storedToken = localStorage.getItem('auth_token');
        
        if (storedToken) {
          console.log('AuthGuard: Token is invalid, clearing auth data');
          // Если токен невалидный, очищаем авторизацию
          clearAuth();
          
          // Если не на странице логина, перенаправляем
          if (!isLoginPage) {
            navigate('/login');
          }
        } else {
          console.log('AuthGuard: No token in localStorage, ignoring authentication error');
        }
      }
    }
    
    setIsLoading(false);
  }, [hasToken, hasStoredToken, isLoginPage, isSuccess, data, navigate, setAuth, clearAuth]);

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