import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store";
import { handleError } from "@/utils/error-handler";



async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Агрессивная проверка на 401 - всегда очищаем токен
    if (res.status === 401) {
      console.log('🔑 401 Unauthorized - токен недействителен, очищаем сессию');
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return;
    }
    
    // Проверяем на истекший токен в ответе сервера
    if (res.status === 500) {
      try {
        const errorData = JSON.parse(text);
        if (errorData.details && errorData.details.includes('TOKEN_EXPIRED')) {
          console.log('Токен истек, перенаправляем на страницу входа...');
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return;
        }
      } catch (parseError) {
        // Если не удалось распарсить JSON, продолжаем обычную обработку ошибки
      }
    }
    
    const error = new Error(`${res.status}: ${text}`);
    (error as any).status = res.status;
    (error as any).response = { status: res.status, statusText: res.statusText };
    (error as any).config = { url: res.url };
    throw error;
  }
}

interface ApiRequestConfig {
  method?: string;
  data?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
}

export async function apiRequest(
  url: string,
  config: ApiRequestConfig = {}
): Promise<any> {
  const { method = 'GET', data, params } = config;
  const token = useAuthStore.getState().token;
  const userId = useAuthStore.getState().userId;

  // АГРЕССИВНАЯ проверка истекших токенов
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      // Добавляем буфер в 30 секунд для предотвращения пограничных случаев
      if (payload.exp && payload.exp < (now + 30)) {
        console.log('ПРИНУДИТЕЛЬНАЯ ОЧИСТКА: Токен истек или истекает скоро');
        localStorage.clear();
        sessionStorage.clear();
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return;
      }
    } catch (e) {
      console.log('ПРИНУДИТЕЛЬНАЯ ОЧИСТКА: Поврежденный токен');
      localStorage.clear();
      sessionStorage.clear();
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return;
    }
  }

  // Логирование для отладки
  // API запрос выполняется (детальное логирование отключено)

  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';

  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    "x-user-id": userId || ''
  };

  const res = await fetch(url + queryString, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // Если статус 204 No Content, не пытаемся распарсить JSON
  if (res.status === 204) {
    return { success: true };
  }
  
  return res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = useAuthStore.getState().token;
    const userId = useAuthStore.getState().userId;

    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        "x-user-id": userId || ''
      }
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Конфигурация React Query для кеширования данных между страницами
 * - staleTime: Infinity - данные никогда не считаются устаревшими 
 * - cacheTime: 1000 * 60 * 30 - кеш живет 30 минут
 * - structuralSharing: true - автоматически сравнивает структуру данных
 * - refetchOnMount: false - не запрашивать данные при монтировании компонента
 * - refetchOnWindowFocus: false - не запрашивать данные при фокусе окна
 */
// Глобальный обработчик ошибок для QueryClient
const globalErrorHandler = (error: any) => {
  const userError = handleError(error);
  if (userError.showToUser) {
    // В любом случае обрабатываем ошибку через наш logger
    // В production будут показаны только критические
    console.error(`Ошибка: ${userError.message}${userError.action ? ` ${userError.action}` : ''}`);
  }
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      gcTime: 1000 * 60 * 30, // 30 минут
      retry: false,
      refetchOnMount: false,
      structuralSharing: true,
    },
    mutations: {
      retry: false,
    },
  },
});

// Подписываемся на глобальные ошибки QueryClient
queryClient.getQueryCache().config.onError = globalErrorHandler;
queryClient.getMutationCache().config.onError = globalErrorHandler;