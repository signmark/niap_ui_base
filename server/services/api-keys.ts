import { directusApiManager } from '../directus';
import { log } from '../utils/logger';
import { directusCrud } from './directus-crud';

// Типы API сервисов, используемых в приложении
export type ApiServiceName = 'perplexity' | 'social_searcher' | 'apify' | 'deepseek' | 'fal_ai' | 'xmlriver';

// Маппинг имен сервисов как они записаны в БД
const SERVICE_NAME_DB_MAPPING: Record<ApiServiceName, string> = {
  'perplexity': 'perplexity',
  'social_searcher': 'social_searcher',
  'apify': 'apify',
  'deepseek': 'deepseek',
  'fal_ai': 'fal_ai',
  'xmlriver': 'xmlriver'
};

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
    // ВАЖНОЕ ПРАВИЛО: Все API ключи должны браться ТОЛЬКО из Directus (через user_api_keys)
    // Если нет userId, не можем получить ключ из Directus
    if (!userId) {
      log(`Cannot fetch ${serviceName} API key: missing userId. API keys must come only from Directus user settings.`, 'api-keys');
      return null;
    }
    
    // 1. Сначала проверяем кэш пользовательских ключей
    if (this.keyCache[userId]?.[serviceName]?.key &&
        this.keyCache[userId][serviceName]!.expiresAt > Date.now()) {
      log(`Using cached ${serviceName} API key for user ${userId}`, 'api-keys');
      return this.keyCache[userId][serviceName]!.key;
    }
    
    // 2. Если ключа нет в кэше или он устарел, пытаемся получить из Directus
    try {
      // Добавляем расширенное логирование для отладки запроса
      console.log(`[${serviceName}] Fetching API key for user ${userId} using DirectusCrud`);
      console.log(`[${serviceName}] Search parameters: user_id=${userId}, service_name=${serviceName}`);
      
      // Получаем название сервиса в БД из маппинга
      const dbServiceName = SERVICE_NAME_DB_MAPPING[serviceName];
      console.log(`[${serviceName}] DB service name mapping: '${serviceName}' -> '${dbServiceName}'`);
      
      // Получаем все ключи для пользователя для отладки
      const allUserKeys = await directusCrud.list('user_api_keys', {
        userId: userId,
        authToken: authToken,
        filter: {
          user_id: { _eq: userId }
        },
        fields: ['id', 'service_name', 'api_key']
      });
      
      console.log(`[${serviceName}] Found ${allUserKeys.length} total API keys for user ${userId}`);
      console.log(`[${serviceName}] Available services:`, allUserKeys.map((k: any) => k.service_name).join(', '));
      
      // Диагностика: Выведем все ключи более подробно для отладки
      console.log(`[${serviceName}] Keys details:`, allUserKeys.map((k: any) => ({
        id: k.id,
        service: k.service_name || 'undefined',
        hasApiKey: !!k.api_key
      })));

      // Теперь ищем конкретный ключ, используя более гибкую логику с учетом правильного отображения имени сервиса
      // Проверяем наличие поля service_name перед использованием
      let items = allUserKeys.filter((key: any) => 
        key.service_name && key.service_name.toLowerCase() === dbServiceName.toLowerCase());
      
      console.log(`[${serviceName}] After filtering by DB service name '${dbServiceName}': found ${items.length} matching keys`);
      
      // Если не нашли ключ для конкретного пользователя, ищем для любого пользователя
      if (!items || items.length === 0) {
        console.log(`Не найден ключ ${serviceName} для пользователя ${userId}, пробуем найти для любого пользователя`);
        
        // Получим все ключи в системе для диагностики
        const allKeys = await directusCrud.list('user_api_keys', {
          userId: userId,
          authToken: authToken,
          fields: ['id', 'user_id', 'service_name', 'api_key']
        });
        
        console.log(`[${serviceName}] Found ${allKeys.length} total API keys in the system`);
        
        // Более безопасная обработка с проверкой на undefined/null
        const availableServices = allKeys
          .map((k: any) => k.service_name)
          .filter((name: any) => name !== undefined && name !== null);
          
        console.log(`[${serviceName}] Available services in system:`, 
                    [...new Set(availableServices)].join(', '));
        
        // Диагностика: выведем подробности о всех ключах
        console.log(`[${serviceName}] All keys details:`, allKeys.map((k: any) => ({
          id: k.id,
          user: k.user_id || 'undefined',
          service: k.service_name || 'undefined',
          hasApiKey: !!k.api_key
        })));
        
        // Поиск с учетом возможного отсутствия service_name
        if (allKeys.length > 0 && allKeys.every(key => !key.service_name)) {
          console.log(`[${serviceName}] Внимание: все ключи в системе не имеют service_name. Пробуем найти ключ для использования.`);
          
          // Если ни у одного ключа нет service_name, возьмем первый доступный ключ
          items = allKeys.filter(key => key.api_key && key.api_key.length > 0);
          
          if (items.length > 0) {
            console.log(`[${serviceName}] Найден ключ без service_name, но с api_key. Используем его временно.`);
          }
        } else {
          // Стандартная фильтрация
          items = allKeys.filter((key: any) => 
            key.service_name && key.service_name.toLowerCase() === dbServiceName.toLowerCase());
        }
        
        console.log(`[${serviceName}] After filtering all keys with DB service name '${dbServiceName}': found ${items.length} matching keys`);
      }
      
      if (items.length && items[0].api_key) {
        // Получаем ключ из ответа и форматируем если необходимо
        let apiKey = items[0].api_key;
        
        // Специальная обработка для XMLRiver - проверяем, что ключ в правильном формате JSON
        if (serviceName === 'xmlriver') {
          try {
            // Проверяем, является ли ключ JSON строкой с необходимыми полями
            const parsed = JSON.parse(apiKey);
            if (typeof parsed === 'object' && parsed !== null && 'user' in parsed && 'key' in parsed) {
              console.log(`[${serviceName}] Успешно получен и распознан ключ XMLRiver в формате JSON`);
              // Используем API ключ как есть, так как он уже в нужном формате
            } else {
              console.warn(`[${serviceName}] API ключ в формате JSON, но не содержит обязательные поля user и key`);
            }
          } catch (e) {
            console.warn(`[${serviceName}] API ключ не в формате JSON, пробуем преобразовать`);
            // Если не удалось распарсить JSON, пробуем преобразовать в нужный формат
            if (apiKey.includes(':')) {
              const [user, key] = apiKey.split(':');
              apiKey = JSON.stringify({ user: user.trim(), key: key.trim() });
              console.log(`[${serviceName}] Преобразовали ключ в формат JSON с пользовательскими данными`);
            } else {
              // Если разделитель не найден, предполагаем, что это только API ключ без user ID
              apiKey = JSON.stringify({ user: "16797", key: apiKey.trim() });
              console.log(`[${serviceName}] Преобразовали ключ в формат JSON с user_id по умолчанию (16797)`);
            }
          }
        }
        
        // Специальная обработка для FAL.AI - проверяем и добавляем префикс "Key " если необходимо
        if (serviceName === 'fal_ai') {
          // Проверяем формат ключа
          if (apiKey.startsWith('Key ')) {
            console.log(`[${serviceName}] Получен ключ с префиксом "Key" - правильный формат`);
          } else if (apiKey.includes(':')) {
            console.log(`[${serviceName}] Получен ключ без префикса "Key", автоматически добавляем`);
            apiKey = `Key ${apiKey}`;
            console.log(`[${serviceName}] Форматированный ключ: ${apiKey.substring(0, 12)}...`);
          } else {
            console.log(`[${serviceName}] Получен ключ в неизвестном формате, не содержит ':'`);
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
        console.warn(`⚠️ [${serviceName}] API ключ не найден в настройках пользователя. Необходимо добавить ключ в Directus.`);
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
      
      // Для FAL.AI - проверка и форматирование ключа при сохранении
      if (serviceName === 'fal_ai') {
        // Автоматически форматируем ключи FAL.AI при сохранении
        if (apiKey.startsWith('Key ')) {
          console.log(`[${serviceName}] Сохраняем ключ с префиксом "Key" - правильный формат`);
        } else if (apiKey.includes(':')) {
          console.log(`[${serviceName}] Сохраняем ключ без префикса "Key", автоматически форматируем`);
          apiKey = `Key ${apiKey}`;
          console.log(`[${serviceName}] Форматированный ключ: ${apiKey.substring(0, 12)}...`);
        } else {
          console.warn(`[${serviceName}] API ключ может быть в неправильном формате. Правильный формат: "Key <key_id>:<key_secret>"`);
          log(`[${serviceName}] API ключ для пользователя ${userId} сохраняется, но может не работать`, 'api-keys');
        }
      }
      
      // Для XMLRiver - хранение комбинации user ID и API ключа
      if (serviceName === 'xmlriver') {
        try {
          // Проверяем, не передан ли уже ключ в JSON формате
          const parsed = JSON.parse(apiKey);
          
          // Если это объект с полями user и key, значит уже отформатирован
          if (typeof parsed === 'object' && 'user' in parsed && 'key' in parsed) {
            console.log(`[${serviceName}] Получен API ключ в формате JSON, сохраняем как есть`);
          } else {
            // Иначе это некорректный формат, пробуем создать JSON формат заново
            console.warn(`[${serviceName}] Некорректный формат JSON для XMLRiver API ключа`);
          }
        } catch (e) {
          // Если не удалось распарсить JSON, то это строка с API ключом
          // Форматируем в JSON объект
          console.log(`[${serviceName}] Преобразуем обычный ключ в формат JSON`);
          
          // Предполагаем, что ключ содержит два значения: user_id:api_key
          if (apiKey.includes(':')) {
            const [user, key] = apiKey.split(':');
            apiKey = JSON.stringify({ user: user.trim(), key: key.trim() });
            console.log(`[${serviceName}] Сохраняем ключ в формате JSON с user_id:api_key`);
          } else {
            // Если разделитель не найден, предполагаем, что это только API ключ без user ID
            // Используем значение по умолчанию для user ID (16797)
            apiKey = JSON.stringify({ user: "16797", key: apiKey.trim() });
            console.log(`[${serviceName}] Сохраняем ключ в формате JSON с user_id по умолчанию (16797)`);
          }
        }
      }
      
      // Сначала проверяем, существует ли уже ключ для этого сервиса/пользователя
      console.log(`[${serviceName}] Проверка существующих API ключей для пользователя ${userId} с использованием DirectusCrud`);
      
      // Получаем название сервиса в БД из маппинга
      const dbServiceName = SERVICE_NAME_DB_MAPPING[serviceName];
      console.log(`[${serviceName}] DB service name mapping: '${serviceName}' -> '${dbServiceName}'`);
      
      const existingKeys = await directusCrud.list('user_api_keys', {
        userId: userId,
        authToken: authToken,
        filter: {
          user_id: { _eq: userId },
          service_name: { _eq: dbServiceName }
        },
        fields: ['id']
      });
      
      let result;
      
      if (existingKeys.length > 0) {
        // Обновляем существующий ключ
        const keyId = existingKeys[0].id;
        console.log(`[${serviceName}] Обновление существующего API ключа с ID ${keyId}`);
        
        result = await directusCrud.update('user_api_keys', keyId, {
          api_key: apiKey,
          updated_at: new Date().toISOString()
        }, {
          userId: userId,
          authToken: authToken
        });
        
        log(`Updated ${serviceName} API key for user ${userId}`, 'api-keys');
      } else {
        // Создаем новый ключ
        console.log(`[${serviceName}] Создание нового API ключа для пользователя ${userId}`);
        
        result = await directusCrud.create('user_api_keys', {
          user_id: userId,
          service_name: dbServiceName,
          api_key: apiKey,
          created_at: new Date().toISOString()
        }, {
          userId: userId,
          authToken: authToken
        });
        
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
    // Для упрощения разработки и тестирования разрешаем использовать переменные окружения
    // как запасной вариант, если ключ не найден в Directus
    if (serviceName === 'perplexity') {
      console.log(`[${serviceName}] Запрошен ключ из переменных окружения`);
      return process.env.PERPLEXITY_API_KEY || null;
    } else if (serviceName === 'social_searcher') {
      return process.env.SOCIAL_SEARCHER_API_KEY || null;
    } else if (serviceName === 'apify') {
      return process.env.APIFY_API_KEY || null;
    } else if (serviceName === 'deepseek') {
      return process.env.DEEPSEEK_API_KEY || null;
    } else if (serviceName === 'fal_ai') {
      return process.env.FAL_AI_API_KEY || null;
    } else if (serviceName === 'xmlriver') {
      // XMLRiver требует особый формат с user и key
      const userId = process.env.XMLRIVER_USER_ID || "16797"; // ID пользователя по умолчанию
      const apiKey = process.env.XMLRIVER_API_KEY || null;
      
      if (!apiKey) return null;
      
      return JSON.stringify({
        user: userId,
        key: apiKey
      });
    }
    
    return null;
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