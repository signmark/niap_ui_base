import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
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
  const { method = 'GET', data, params, headers: configHeaders = {} } = config;
  const token = useAuthStore.getState().token;
  const userId = useAuthStore.getState().userId;

  // Логирование для отладки
  console.log(`📤 API Запрос: ${method} ${url}`);
  console.log(`🔐 Статус авторизации:`, { 
    hasToken: !!token, 
    userId,
    tokenPrefix: token ? token.substring(0, 10) + '...' : null
  });

  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';

  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    "x-user-id": userId || '',
    ...configHeaders // Добавляем пользовательские заголовки
  };

  console.log(`📤 Заголовки запроса:`, { 
    hasAuthHeader: !!headers["Authorization"],
    contentType: headers["Content-Type"],
    userIdHeader: headers["x-user-id"],
    customHeaders: Object.keys(configHeaders).length > 0 ? Object.keys(configHeaders) : null
  });
  
  // Добавляем обработку таймаута для запроса медиа-анализа
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, url.includes('/media-analysis') ? 60000 : 30000); // Для анализа медиа используем больший таймаут
  
  try {
    const res = await fetch(url + queryString, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    await throwIfResNotOk(res);
    
    // Если статус 204 No Content, не пытаемся распарсить JSON
    if (res.status === 204) {
      return { success: true };
    }
    
    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error(`📤 Запрос к ${url} прерван по таймауту`);
      throw new Error(`Запрос превысил время ожидания. Пожалуйста, попробуйте позже.`);
    }
    
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = useAuthStore.getState().token;
    const userId = useAuthStore.getState().userId;
    
    // Добавляем обработку таймаута для запроса
    const controller = new AbortController();
    const url = queryKey[0] as string;
    // Для анализа медиа используем больший таймаут
    const timeoutDuration = url.includes('/media-analysis') ? 60000 : 30000;
    
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutDuration);

    try {
      console.log(`📤 Query fetch: GET ${url}`);
      
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          "x-user-id": userId || ''
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }
      
      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error(`📤 Запрос к ${url} прерван по таймауту (${timeoutDuration}ms)`);
        throw new Error(`Запрос превысил время ожидания (${timeoutDuration / 1000}с). Пожалуйста, попробуйте позже.`);
      }
      
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});