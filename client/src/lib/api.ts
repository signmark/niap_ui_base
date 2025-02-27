
/**
 * Универсальный метод для выполнения запросов к API
 * с автоматическим добавлением токена авторизации
 */
export const apiRequest = async (
  method: string, 
  url: string, 
  body?: any, 
  additionalHeaders: Record<string, string> = {}
) => {
  const token = localStorage.getItem('auth_token');
  const headers = { 
    'Content-Type': 'application/json',
    ...additionalHeaders
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    let errorMessage;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || `Ошибка ${response.status}`;
    } catch (e) {
      errorMessage = `Ошибка ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
};
