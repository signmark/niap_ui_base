/**
 * Подготавливает токен авторизации для запросов к Directus API
 * Исправляет дублирование префикса "Bearer" в токене
 * @param token Токен авторизации
 * @returns Корректно отформатированный токен авторизации
 */
export function formatAuthToken(token: string): string {
  // Если токен уже начинается с "Bearer ", возвращаем его как есть
  if (token.startsWith('Bearer ')) {
    return token;
  }
  // Иначе добавляем префикс "Bearer "
  return `Bearer ${token}`;
}