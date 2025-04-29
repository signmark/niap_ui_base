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
  const { method = 'GET', data, params } = config;
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
    "x-user-id": userId || ''
  };

  console.log(`📤 Заголовки запроса:`, { 
    hasAuthHeader: !!headers["Authorization"],
    contentType: headers["Content-Type"],
    userIdHeader: headers["x-user-id"]
  });

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