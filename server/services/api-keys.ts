import { directusApi } from '../directus';
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
      if (!authToken) {
        log(`Cannot fetch ${serviceName} API key: missing authToken`, 'api-keys');
        return null;
      }
      
      const response = await directusApi.get('/items/user_api_keys', {
        params: {
          filter: {
            user_id: { _eq: userId },
            service_name: { _eq: serviceName }
          },
          fields: ['id', 'api_key']
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const items = response.data?.data || [];
      if (items.length && items[0].api_key) {
        // Сохраняем ключ в кэше
        if (!this.keyCache[userId]) {
          this.keyCache[userId] = {};
        }
        
        this.keyCache[userId][serviceName] = {
          key: items[0].api_key,
          expiresAt: Date.now() + this.cacheDuration
        };
        
        log(`Successfully fetched ${serviceName} API key from Directus for user ${userId}`, 'api-keys');
        return items[0].api_key;
      } else {
        log(`${serviceName} API key not found in user settings for user ${userId}`, 'api-keys');
        return null;
      }
    } catch (error) {
      console.error(`Error fetching ${serviceName} API key:`, error);
      log(`Error fetching ${serviceName} API key: ${error instanceof Error ? error.message : String(error)}`, 'api-keys');
      return null;
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
    
    return envMapping[serviceName] || null;
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