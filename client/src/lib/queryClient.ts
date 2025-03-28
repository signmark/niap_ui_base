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
  
  try {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    } else {
      console.warn('Ответ сервера не в формате JSON:', contentType);
      const text = await res.text();
      // Попытаемся проверить, не содержит ли текст JSON
      try {
        if (text.includes('{') && text.includes('}')) {
          // Попытка найти JSON в тексте
          const jsonMatch = text.match(/\{.*\}/s);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
        }
        // Если JSON не найден, вернем текст как сообщение об ошибке
        throw new Error(`Сервер вернул не JSON: ${text.substring(0, 100)}...`);
      } catch (e) {
        throw new Error(`Ошибка при обработке ответа: ${e.message}`);
      }
    }
  } catch (error) {
    console.error('Ошибка при разборе ответа сервера:', error);
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