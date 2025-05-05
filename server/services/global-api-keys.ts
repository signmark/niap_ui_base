/**
 * Сервис для работы с глобальными API ключами
 * Отвечает за кэширование, получение и управление глобальными API ключами
 */

import { directusApiManager } from '../directus';
import { log } from '../utils/logger';
import { directusCrud } from './directus-crud';
import { ApiServiceName } from './api-keys';

/**
 * Интерфейс для хранения кэша глобальных API ключей
 */
interface GlobalApiKeyCache {
  [serviceName: string]: {
    key: string;
    isActive: boolean;
    expiresAt: number; // Время истечения кэша
  };
}

/**
 * Сервис для работы с глобальными API ключами
 */
export class GlobalApiKeysService {
  private keyCache: GlobalApiKeyCache = {};
  private readonly cacheDuration = 60 * 60 * 1000; // 1 час
  private directusApi = directusApiManager.instance;
  
  constructor() {
    console.log('Global API Keys Service initialized');
    
    // Запускаем периодическую очистку кэша
    setInterval(() => this.cleanupCache(), 30 * 60 * 1000); // каждые 30 минут
    
    // Загружаем кэш при запуске
    this.refreshCache().catch(err => {
      console.error('Failed to initialize global API keys cache:', err);
    });
  }
  
  /**
   * Обновляет кэш глобальных API ключей
   */
  async refreshCache(): Promise<void> {
    try {
      // Получаем авторизационный токен системного администратора
      const systemToken = await this.getSystemToken();
      
      if (!systemToken) {
        console.warn('Не удалось получить системный токен для обновления кэша глобальных API ключей');
        return;
      }
      
      // Запрашиваем все активные глобальные API ключи
      const response = await this.directusApi.get('/items/global_api_keys', {
        params: {
          fields: ['id', 'service_name', 'api_key', 'is_active'],
          filter: {
            is_active: { _eq: true }
          }
        },
        headers: {
          Authorization: `Bearer ${systemToken}`
        }
      });
      
      const apiKeys = response.data?.data || [];
      console.log(`Загружено ${apiKeys.length} глобальных API ключей`);
      
      // Заполняем кэш полученными ключами
      const now = Date.now();
      const expires = now + this.cacheDuration;
      
      // Очищаем текущий кэш
      this.keyCache = {};
      
      // Заполняем новыми значениями
      for (const keyData of apiKeys) {
        if (keyData.service_name && keyData.api_key) {
          this.keyCache[keyData.service_name] = {
            key: keyData.api_key,
            isActive: keyData.is_active === true,
            expiresAt: expires
          };
        }
      }
      
      log(`Global API keys cache refreshed with ${apiKeys.length} keys`, 'global-api-keys');
    } catch (error) {
      console.error('Error refreshing global API keys cache:', error);
    }
  }
  
  /**
   * Получает токен системного администратора для доступа к API Directus
   * @returns Токен доступа или null в случае ошибки
   */
  private async getSystemToken(): Promise<string | null> {
    try {
      // Используем учетные данные администратора из переменных окружения
      const response = await this.directusApi.post('/auth/login', {
        email: process.env.DIRECTUS_ADMIN_EMAIL,
        password: process.env.DIRECTUS_ADMIN_PASSWORD
      });
      
      if (response.data?.data?.access_token) {
        return response.data.data.access_token;
      } else {
        console.error('Некорректный ответ при авторизации в Directus:', response.data);
        return null;
      }
    } catch (error) {
      console.error('Ошибка при получении токена системного администратора:', error);
      return null;
    }
  }
  
  /**
   * Получает глобальный API ключ для указанного сервиса
   * @param serviceName Название сервиса
   * @returns API ключ или null, если ключ не найден
   */
  async getGlobalApiKey(serviceName: ApiServiceName): Promise<string | null> {
    // Проверяем кэш
    if (this.keyCache[serviceName] && 
        this.keyCache[serviceName].isActive && 
        this.keyCache[serviceName].expiresAt > Date.now()) {
      log(`Using cached global ${serviceName} API key`, 'global-api-keys');
      return this.keyCache[serviceName].key;
    }
    
    // Если кэш устарел или ключа нет в кэше, обновляем кэш
    await this.refreshCache();
    
    // Проверяем кэш еще раз после обновления
    if (this.keyCache[serviceName] && this.keyCache[serviceName].isActive) {
      return this.keyCache[serviceName].key;
    }
    
    log(`Global ${serviceName} API key not found or inactive`, 'global-api-keys');
    return null;
  }
  
  /**
   * Сохраняет или обновляет глобальный API ключ
   * @param serviceName Название сервиса
   * @param apiKey API ключ для сохранения
   * @param authToken Токен авторизации администратора
   * @returns ID созданного/обновленного ключа или null в случае ошибки
   */
  async setGlobalApiKey(serviceName: ApiServiceName, apiKey: string, authToken: string): Promise<string | null> {
    try {
      // Форматирование ключа для специфических сервисов
      let formattedKey = apiKey;
      
      if (serviceName === ApiServiceName.FAL_AI) {
        // Если ключ начинается с "Key ", удаляем префикс для хранения
        if (apiKey.startsWith('Key ')) {
          formattedKey = apiKey.substring(4);
        }
      } else if (serviceName === ApiServiceName.XMLRIVER) {
        // Форматирование ключа XMLRiver в JSON формат
        try {
          JSON.parse(apiKey); // Проверяем, что это уже JSON
        } catch (e) {
          // Если не JSON, преобразуем
          if (apiKey.includes(':')) {
            const [user, key] = apiKey.split(':');
            formattedKey = JSON.stringify({ user: user.trim(), key: key.trim() });
          } else {
            formattedKey = JSON.stringify({ user: "16797", key: apiKey.trim() });
          }
        }
      }
      
      // Проверяем, существует ли уже ключ для этого сервиса
      const existingKeys = await directusCrud.list('global_api_keys', {
        authToken,
        filter: {
          service_name: { _eq: serviceName }
        },
        fields: ['id']
      });
      
      let result;
      
      if (existingKeys.length > 0) {
        // Обновляем существующий ключ
        const existingKey = existingKeys[0] as { id: string };
        const keyId = existingKey.id;
        
        result = await directusCrud.update('global_api_keys', keyId, {
          api_key: formattedKey,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          authToken
        });
        
        log(`Updated global ${serviceName} API key`, 'global-api-keys');
        return keyId;
      } else {
        // Создаем новый ключ
        result = await directusCrud.create('global_api_keys', {
          service_name: serviceName,
          api_key: formattedKey,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          authToken
        });
        
        log(`Created new global ${serviceName} API key`, 'global-api-keys');
        return result.id;
      }
    } catch (error) {
      console.error(`Error saving global ${serviceName} API key:`, error);
      return null;
    }
  }
  
  /**
   * Деактивирует глобальный API ключ
   * @param serviceName Название сервиса
   * @param authToken Токен авторизации администратора
   * @returns true в случае успеха, false в случае ошибки
   */
  async deactivateGlobalApiKey(serviceName: ApiServiceName, authToken: string): Promise<boolean> {
    try {
      // Проверяем, существует ли ключ для этого сервиса
      const existingKeys = await directusCrud.list('global_api_keys', {
        authToken,
        filter: {
          service_name: { _eq: serviceName },
          is_active: { _eq: true }
        },
        fields: ['id']
      });
      
      if (existingKeys.length === 0) {
        log(`No active global ${serviceName} API key found to deactivate`, 'global-api-keys');
        return false;
      }
      
      // Деактивируем ключ
      const existingKey = existingKeys[0] as { id: string };
      const keyId = existingKey.id;
      
      await directusCrud.update('global_api_keys', keyId, {
        is_active: false,
        updated_at: new Date().toISOString()
      }, {
        authToken
      });
      
      log(`Deactivated global ${serviceName} API key`, 'global-api-keys');
      
      // Удаляем из кэша
      if (this.keyCache[serviceName]) {
        delete this.keyCache[serviceName];
      }
      
      return true;
    } catch (error) {
      console.error(`Error deactivating global ${serviceName} API key:`, error);
      return false;
    }
  }
  
  /**
   * Очищает устаревшие записи в кэше
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    Object.keys(this.keyCache).forEach(serviceName => {
      if (this.keyCache[serviceName].expiresAt < now) {
        delete this.keyCache[serviceName];
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      log(`Cleaned up ${cleanedCount} expired global API keys from cache`, 'global-api-keys');
    }
  }
}

// Создаем экземпляр сервиса для использования в приложении
export const globalApiKeysService = new GlobalApiKeysService();
