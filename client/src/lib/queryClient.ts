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
      
      // Отображаем первые 100 символов ответа для отладки
      console.warn('Начало текста ответа:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      
      // Если ответ содержит HTML, вернем заглушку с предупреждением
      // Это временное решение для перехвата ошибок HTML вместо JSON
      if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        console.warn('Сервер вернул HTML вместо JSON');
        return {
          success: false,
          error: "Сервер вернул HTML вместо JSON. Возможно, проблема с маршрутизацией или авторизацией.",
          content: {
            title: "Ошибка генерации",
            html: "<p>Не удалось сгенерировать контент. Пожалуйста, попробуйте еще раз или обратитесь к администратору.</p>"
          }
        };
      }
      
      // Попытаемся проверить, не содержит ли текст JSON
      try {
        if (text.includes('{') && text.includes('}')) {
          // Попытка найти JSON в тексте
          const jsonMatch = text.match(/\{.*\}/s);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
        }
        
        // Если JSON не найден, возвращаем структурированный ответ с ошибкой
        return {
          success: false,
          error: "Неверный формат ответа сервера",
          content: {
            title: "Ошибка обработки ответа",
            html: "<p>Сервер вернул данные в неизвестном формате. Пожалуйста, обратитесь к администратору.</p>"
          }
        };
      } catch (e) {
        // В случае ошибки при разборе, также возвращаем структурированный ответ
        console.error('Ошибка при попытке извлечь JSON из текста:', e);
        return {
          success: false,
          error: `Ошибка при обработке ответа: ${e.message}`,
          content: {
            title: "Ошибка обработки данных",
            html: "<p>Произошла ошибка при обработке данных от сервера. Пожалуйста, обратитесь к администратору.</p>"
          }
        };
      }
    }
  } catch (error) {
    console.error('Ошибка при разборе ответа сервера:', error);
    
    // Вместо выбрасывания исключения возвращаем структурированный ответ с ошибкой
    return {
      success: false,
      error: error.message || "Неизвестная ошибка при обработке ответа",
      content: {
        title: "Ошибка сервера",
        html: "<p>Произошла ошибка при обработке ответа сервера. Пожалуйста, попробуйте позже.</p>"
      }
    };
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

    try {
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
      
      // Если статус 204 No Content, не пытаемся распарсить JSON
      if (res.status === 204) {
        return { success: true };
      }
      
      try {
        const contentType = res.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          return await res.json();
        } else {
          console.warn('Ответ сервера не в формате JSON (query):', contentType);
          const text = await res.text();
          
          // Если ответ содержит HTML, вернем заглушку с предупреждением
          if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
            return {
              success: false,
              error: "Получен HTML вместо данных. Возможно, проблема с авторизацией.",
              data: []
            };
          }
          
          // Попытаемся найти JSON в тексте
          try {
            if (text.includes('{') && text.includes('}')) {
              const jsonMatch = text.match(/\{.*\}/s);
              if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
              }
            }
            
            // Если JSON не найден, возвращаем пустой массив или объект
            return {
              success: false,
              error: "Неверный формат ответа",
              data: []
            };
          } catch (e) {
            console.error('Ошибка при анализе текста ответа:', e);
            return {
              success: false,
              error: `Ошибка обработки: ${e.message}`,
              data: []
            };
          }
        }
      } catch (error) {
        console.error('Ошибка при разборе ответа сервера:', error);
        return {
          success: false,
          error: error.message || "Неизвестная ошибка при обработке ответа",
          data: []
        };
      }
    } catch (error) {
      console.error('Ошибка при выполнении запроса:', error);
      return {
        success: false,
        error: error.message || "Ошибка сетевого запроса",
        data: []
      };
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