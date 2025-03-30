import axios from 'axios';

interface UserSettings {
  id: string;
  [key: string]: any;
}

const API_KEYS_CACHE = new Map<string, { timestamp: number; keys: Record<string, string> }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

/**
 * Очищает устаревшие API ключи из кэша
 */
function cleanupExpiredApiKeys() {
  const now = Date.now();
  for (const [userId, entry] of API_KEYS_CACHE.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      API_KEYS_CACHE.delete(userId);
    }
  }
}

/**
 * Получает API ключ пользователя из Directus
 * @param userId ID пользователя в Directus
 * @param keyName Имя API ключа (например, 'falAiApiKey')
 * @param authToken Токен авторизации пользователя в Directus
 * @returns API ключ или null, если ключ не найден
 */
export async function getUserApiKey(userId: string, keyName: string, authToken: string): Promise<string | null> {
  try {
    // Проверяем кэш
    const cachedKeys = API_KEYS_CACHE.get(userId);
    if (cachedKeys && cachedKeys.keys[keyName]) {
      console.log(`[api-keys] Использую кэшированный API ключ ${keyName} для пользователя ${userId}`);
      return cachedKeys.keys[keyName];
    }
    
    console.log(`[api-keys] Получаю API ключ ${keyName} для пользователя ${userId} из Directus`);
    
    // Форматируем токен авторизации
    const formattedToken = formatAuthToken(authToken);
    
    // Получаем настройки пользователя из Directus
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    const response = await axios.get(`${directusUrl}/users/me`, {
      headers: {
        'Authorization': formattedToken
      }
    });
    
    if (!response.data || !response.data.data) {
      console.error('[api-keys] Ошибка при получении данных пользователя из Directus');
      return null;
    }
    
    const userData: UserSettings = response.data.data;
    
    // Проверяем, есть ли у пользователя API ключи
    if (!userData.api_keys) {
      console.warn(`[api-keys] У пользователя ${userId} отсутствуют API ключи в настройках`);
      return null;
    }
    
    // Парсим JSON строку с API ключами, если она в строковом формате
    let apiKeys: Record<string, string> = {};
    try {
      apiKeys = typeof userData.api_keys === 'string' 
        ? JSON.parse(userData.api_keys) 
        : userData.api_keys;
    } catch (error) {
      console.error('[api-keys] Ошибка при парсинге JSON строки с API ключами:', error);
      return null;
    }
    
    // Проверяем, есть ли запрошенный ключ
    if (!apiKeys[keyName]) {
      console.warn(`[api-keys] API ключ ${keyName} не найден для пользователя ${userId}`);
      return null;
    }
    
    // Сохраняем в кэш
    API_KEYS_CACHE.set(userId, {
      timestamp: Date.now(),
      keys: apiKeys
    });
    
    console.log(`[api-keys] API ключ ${keyName} успешно получен для пользователя ${userId}`);
    
    return apiKeys[keyName];
  } catch (error) {
    console.error('[api-keys] Ошибка при получении API ключа:', error);
    return null;
  }
}

/**
 * Получает все API ключи пользователя из Directus
 * @param userId ID пользователя в Directus
 * @param authToken Токен авторизации пользователя в Directus
 * @returns Объект с API ключами или null, если ключи не найдены
 */
export async function getAllUserApiKeys(userId: string, authToken: string): Promise<Record<string, string> | null> {
  try {
    // Проверяем кэш
    const cachedKeys = API_KEYS_CACHE.get(userId);
    if (cachedKeys) {
      console.log(`[api-keys] Использую кэшированные API ключи для пользователя ${userId}`);
      return cachedKeys.keys;
    }
    
    console.log(`[api-keys] Получаю все API ключи для пользователя ${userId} из Directus`);
    
    // Форматируем токен авторизации
    const formattedToken = formatAuthToken(authToken);
    
    // Получаем настройки пользователя из Directus
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    const response = await axios.get(`${directusUrl}/users/me`, {
      headers: {
        'Authorization': formattedToken
      }
    });
    
    if (!response.data || !response.data.data) {
      console.error('[api-keys] Ошибка при получении данных пользователя из Directus');
      return null;
    }
    
    const userData: UserSettings = response.data.data;
    
    // Проверяем, есть ли у пользователя API ключи
    if (!userData.api_keys) {
      console.warn(`[api-keys] У пользователя ${userId} отсутствуют API ключи в настройках`);
      return null;
    }
    
    // Парсим JSON строку с API ключами, если она в строковом формате
    let apiKeys: Record<string, string> = {};
    try {
      apiKeys = typeof userData.api_keys === 'string' 
        ? JSON.parse(userData.api_keys) 
        : userData.api_keys;
    } catch (error) {
      console.error('[api-keys] Ошибка при парсинге JSON строки с API ключами:', error);
      return null;
    }
    
    // Сохраняем в кэш
    API_KEYS_CACHE.set(userId, {
      timestamp: Date.now(),
      keys: apiKeys
    });
    
    console.log(`[api-keys] API ключи успешно получены для пользователя ${userId}`);
    
    return apiKeys;
  } catch (error) {
    console.error('[api-keys] Ошибка при получении API ключей:', error);
    return null;
  }
}

/**
 * Проверяет, доступен ли API ключ для FAL AI у пользователя
 * @param userId ID пользователя в Directus
 * @param authToken Токен авторизации пользователя в Directus
 * @returns true, если API ключ FAL AI доступен, иначе false
 */
export async function hasFalAiApiKey(userId: string, authToken: string): Promise<boolean> {
  // Сначала проверяем API ключ в настройках пользователя
  const apiKey = await getUserApiKey(userId, 'fal_ai', authToken);
  
  if (apiKey !== null && apiKey !== '') {
    return true;
  }
  
  // Если ключ не найден в настройках пользователя, проверяем переменные окружения
  const envApiKey = process.env.FAL_AI_API_KEY;
  
  if (envApiKey && envApiKey.trim() !== '') {
    console.log('[api-keys] Используется системный API ключ FAL AI из переменных окружения');
    return true;
  }
  
  console.warn('[api-keys] API ключ FAL AI не найден ни в настройках пользователя, ни в переменных окружения');
  return false;
}

/**
 * Запускает автоматическую очистку устаревших API ключей в кэше
 */
export function startApiKeysCleanupInterval() {
  // Очищаем кэш каждые 10 минут
  setInterval(cleanupExpiredApiKeys, 10 * 60 * 1000);
}

/**
 * Форматирует токен авторизации для запросов к Directus API
 * @param token Токен авторизации
 * @returns Корректно отформатированный токен авторизации
 */
function formatAuthToken(token: string): string {
  if (!token) return '';
  
  // Если токен уже начинается с "Bearer ", используем его как есть
  if (token.startsWith('Bearer ')) {
    return token;
  }
  
  // Иначе добавляем префикс "Bearer "
  return `Bearer ${token}`;
}

// Экспортируем сервис для API-ключей
export const apiKeyService = {
  getUserApiKey,
  getAllUserApiKeys,
  hasFalAiApiKey,
  startApiKeysCleanupInterval
};