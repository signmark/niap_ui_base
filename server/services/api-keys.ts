import { directusApi, directusApiManager } from '../directus';
import { log } from '../vite';

// Типы API сервисов, используемых в приложении
export type ApiServiceName = 'perplexity' | 'social_searcher' | 'apify' | 'deepseek' | 'fal_ai';

// Интерфейс для хранения API ключей и метаданных
interface ApiKeyCache {
  [userId: string]: {
    [serviceName in ApiServiceName]?: {
      key: string;
      expiresAt: number; // Время истечения кэша
    }
  };
}

/**
 * Сервис для управления API ключами
 * Централизованное хранение, кэширование и получение API ключей из Directus
 */
export class ApiKeyService {
  private keyCache: ApiKeyCache = {};
  private readonly cacheDuration = 30 * 60 * 1000; // 30 минут
  
  constructor() {
    // Инициализация сервиса
    console.log('API Key Service initialized');
    
    // Запускаем периодическую очистку кэша
    setInterval(() => this.cleanupCache(), 10 * 60 * 1000); // каждые 10 минут
  }
  
  /**
   * Получает API ключ из кэша или из Directus
   * @param userId ID пользователя
   * @param serviceName Название сервиса
   * @param authToken Токен авторизации для Directus
   * @returns API ключ или null, если ключ не найден
   */
  async getApiKey(userId: string, serviceName: ApiServiceName, authToken?: string): Promise<string | null> {
    // Сначала проверяем переменные окружения
    const envKey = this.getKeyFromEnvironment(serviceName);
    if (envKey) {
      log(`Using ${serviceName} API key from environment variables`, 'api-keys');
      return envKey;
    }
    
    // Если нет userId, не можем получить ключ из Directus
    if (!userId) {
      log(`Cannot fetch ${serviceName} API key: missing userId`, 'api-keys');
      return null;
    }
    
    // Проверяем кэш
    if (this.keyCache[userId]?.[serviceName]?.key &&
        this.keyCache[userId][serviceName]!.expiresAt > Date.now()) {
      log(`Using cached ${serviceName} API key for user ${userId}`, 'api-keys');
      return this.keyCache[userId][serviceName]!.key;
    }
    
    // Если ключа нет в кэше или он устарел, получаем из Directus
    try {
      // Используем улучшенный DirectusApiManager для запроса с автоматической авторизацией
      // Если есть authToken, используем его, иначе полагаемся на внутренний кэш токенов
      const requestConfig = {
        url: '/items/user_api_keys',
        method: 'get' as const,
        params: {
          filter: {
            user_id: { _eq: userId },
            service_name: { _eq: serviceName }
          },
          fields: ['id', 'api_key']
        },
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      };
      
      const response = await directusApiManager.request(requestConfig, userId);
      
      const items = response.data?.data || [];
      if (items.length && items[0].api_key) {
        // Получаем ключ из ответа БЕЗ МОДИФИКАЦИЙ
        const apiKey = items[0].api_key;
        
        // Только логирование для диагностики
        if (serviceName === 'fal_ai') {
          if (apiKey.startsWith('Key ')) {
            console.log(`[${serviceName}] Получен ключ с префиксом "Key" - правильный формат`);
          } else {
            console.log(`[${serviceName}] Получен ключ без префикса "Key"`);
          }
        }
        
        // Сохраняем ключ в кэше
        if (!this.keyCache[userId]) {
          this.keyCache[userId] = {};
        }
        
        this.keyCache[userId][serviceName] = {
          key: apiKey,
          expiresAt: Date.now() + this.cacheDuration
        };
        
        log(`Successfully fetched ${serviceName} API key from Directus for user ${userId}`, 'api-keys');
        return apiKey;
      } else {
        log(`${serviceName} API key not found in user settings for user ${userId}`, 'api-keys');
        return null;
      }
    } catch (error) {
      console.error(`Error fetching ${serviceName} API key:`, error);
      
      // Детальное логирование ошибки
      if ('response' in (error as any)) {
        const axiosError = error as any;
        console.error('Error details:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          message: axiosError.message
        });
        
        // Если ошибка 401, добавляем дополнительную информацию
        if (axiosError.response?.status === 401) {
          log(`Unauthorized error (401) while fetching ${serviceName} API key - token may be invalid or expired`, 'api-keys');
        }
      }
      
      log(`Error fetching ${serviceName} API key: ${error instanceof Error ? error.message : String(error)}`, 'api-keys');
      return null;
    }
  }
  
  /**
   * Сохраняет новый API ключ в Directus
   * @param userId ID пользователя
   * @param serviceName Название сервиса
   * @param apiKey API ключ для сохранения
   * @param authToken Токен авторизации для Directus
   * @returns true в случае успеха, false в случае ошибки
   */
  async saveApiKey(userId: string, serviceName: ApiServiceName, apiKey: string, authToken?: string): Promise<boolean> {
    try {
      if (!userId) {
        log(`Cannot save ${serviceName} API key: missing userId`, 'api-keys');
        return false;
      }
      
      // Только логирование для FAL.AI - никаких модификаций!
      if (serviceName === 'fal_ai') {
        // Диагностическое логирование формата ключа
        if (apiKey.startsWith('Key ')) {
          console.log(`[${serviceName}] Сохраняем ключ с префиксом "Key" - правильный формат`);
        } else {
          console.log(`[${serviceName}] Сохраняем ключ без префикса "Key"`);
        }
        
        // Только предупреждаем, если формат НЕ "Key <id>:<secret>"
        if (!apiKey.includes(':') && !apiKey.startsWith('Key ')) {
          console.warn(`[${serviceName}] API ключ может быть в неправильном формате. Правильный формат: "Key <key_id>:<key_secret>"`);
          log(`[${serviceName}] API ключ для пользователя ${userId} сохраняется в оригинальном формате, но может не работать`, 'api-keys');
        }
      }
      
      // Сначала проверяем, существует ли уже ключ для этого сервиса/пользователя
      const requestConfig = {
        url: '/items/user_api_keys',
        method: 'get' as const,
        params: {
          filter: {
            user_id: { _eq: userId },
            service_name: { _eq: serviceName }
          },
          fields: ['id']
        },
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      };
      
      const existingKeys = await directusApiManager.request(requestConfig, userId);
      const items = existingKeys.data?.data || [];
      
      let result;
      
      if (items.length > 0) {
        // Обновляем существующий ключ
        const keyId = items[0].id;
        
        const updateConfig = {
          url: `/items/user_api_keys/${keyId}`,
          method: 'patch' as const,
          data: {
            api_key: apiKey,
            updated_at: new Date().toISOString()
          },
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        };
        
        result = await directusApiManager.request(updateConfig, userId);
        log(`Updated ${serviceName} API key for user ${userId}`, 'api-keys');
      } else {
        // Создаем новый ключ
        const createConfig = {
          url: '/items/user_api_keys',
          method: 'post' as const,
          data: {
            user_id: userId,
            service_name: serviceName,
            api_key: apiKey,
            created_at: new Date().toISOString()
          },
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        };
        
        result = await directusApiManager.request(createConfig, userId);
        log(`Created new ${serviceName} API key for user ${userId}`, 'api-keys');
      }
      
      // Обновляем кэш
      if (!this.keyCache[userId]) {
        this.keyCache[userId] = {};
      }
      
      this.keyCache[userId][serviceName] = {
        key: apiKey,
        expiresAt: Date.now() + this.cacheDuration
      };
      
      return true;
    } catch (error) {
      console.error(`Error saving ${serviceName} API key:`, error);
      
      // Детальное логирование ошибки
      if ('response' in (error as any)) {
        const axiosError = error as any;
        console.error('Error details:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          message: axiosError.message
        });
      }
      
      log(`Error saving ${serviceName} API key: ${error instanceof Error ? error.message : String(error)}`, 'api-keys');
      return false;
    }
  }
  
  /**
   * Очищает устаревшие ключи из кэша
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    Object.keys(this.keyCache).forEach(userId => {
      Object.keys(this.keyCache[userId]).forEach(serviceName => {
        const service = serviceName as ApiServiceName;
        if (this.keyCache[userId][service]!.expiresAt < now) {
          delete this.keyCache[userId][service];
          cleanedCount++;
        }
      });
      
      // Если у пользователя не осталось ключей, удаляем его из кэша
      if (Object.keys(this.keyCache[userId]).length === 0) {
        delete this.keyCache[userId];
      }
    });
    
    if (cleanedCount > 0) {
      log(`Cleaned up ${cleanedCount} expired API keys from cache`, 'api-keys');
    }
  }
  
  /**
   * Получает API ключ из переменных окружения
   * @param serviceName Название сервиса
   * @returns API ключ или null, если ключ не найден
   */
  private getKeyFromEnvironment(serviceName: ApiServiceName): string | null {
    const envMapping: Record<ApiServiceName, string> = {
      perplexity: process.env.PERPLEXITY_API_KEY || '',
      social_searcher: process.env.SOCIAL_SEARCHER_API_KEY || '',
      apify: process.env.APIFY_API_KEY || '',
      deepseek: process.env.DEEPSEEK_API_KEY || '',
      fal_ai: process.env.FAL_AI_API_KEY || ''
    };
    
    const apiKey = envMapping[serviceName] || null;
    
    // Если ключ не найден, возвращаем null
    if (!apiKey) {
      if (serviceName === 'fal_ai') {
        console.log('🧪 [FAL.AI] API ключ не найден в переменных окружения');
        console.log('🧪 [FAL.AI] Проверено наличие переменной FAL_AI_API_KEY:', process.env.FAL_AI_API_KEY ? 'Присутствует' : 'Отсутствует');
      }
      return null;
    }
    
    // СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ FAL.AI
    if (serviceName === 'fal_ai') {
      // Только диагностическое логирование для FAL.AI, никаких модификаций
      console.log('🧪 [FAL.AI] Найден API ключ в переменных окружения');
      console.log(`🧪 [FAL.AI] Длина ключа: ${apiKey.length} символов`);
      
      if (apiKey.startsWith('Key ')) {
        console.log('🧪 [FAL.AI] Ключ уже имеет правильный префикс "Key " - сохраняем как есть');
      } else {
        console.log('🧪 [FAL.AI] Ключ не имеет префикса "Key " - возможно потребуется добавить');
      }
      
      // Проверка формата ключа
      if (apiKey.includes(':')) {
        console.log('🧪 [FAL.AI] Ключ содержит разделитель ":" - это хороший признак');
        
        // Пробуем извлечь части ключа для анализа
        const parts = apiKey.split(':');
        
        if (parts.length === 2) {
          // Первая часть может содержать "Key " в начале
          const keyIdPart = parts[0];
          
          if (keyIdPart.startsWith('Key ')) {
            console.log('🧪 [FAL.AI] Первая часть ключа (до ":") начинается с "Key " - правильный формат');
          } else {
            console.log('🧪 [FAL.AI] Первая часть ключа (до ":") не имеет префикса "Key "');
          }
        } else {
          console.log('🧪 [FAL.AI] Ключ содержит необычный формат с несколькими ":"');
        }
      } else {
        console.log('🧪 [FAL.AI] Ключ НЕ содержит разделитель ":" - возможно неверный формат');
      }
    }
    
    // ВАЖНО: для FAL.AI добавляем префикс "Key " если его нет и если есть ":"
    if (serviceName === 'fal_ai' && !apiKey.startsWith('Key ') && apiKey.includes(':')) {
      console.log('🔑 АВТОМАТИЧЕСКИ ДОБАВЛЯЕМ ПРЕФИКС "Key " К КЛЮЧУ FAL.AI ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ');
      return `Key ${apiKey}`;
    }
    
    // Для остальных сервисов возвращаем ключ в исходном формате
    return apiKey;
  }
  
  /**
   * Сбрасывает кэшированный ключ для пользователя и сервиса
   * @param userId ID пользователя
   * @param serviceName Название сервиса
   */
  invalidateCache(userId: string, serviceName: ApiServiceName): void {
    if (this.keyCache[userId]?.[serviceName]) {
      delete this.keyCache[userId][serviceName];
      log(`Invalidated cached ${serviceName} API key for user ${userId}`, 'api-keys');
    }
  }
}

// Экспортируем экземпляр сервиса для использования во всем приложении
export const apiKeyService = new ApiKeyService();