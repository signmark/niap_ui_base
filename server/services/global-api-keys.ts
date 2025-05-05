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
 * Интерфейс глобального API ключа в Directus
 */
export interface GlobalApiKey {
  id?: string;
  service_name: string;
  api_key: string;
  priority?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Интерфейс для создания или обновления глобального API ключа
 */
export interface GlobalApiKeyInput {
  service: ApiServiceName;
  api_key: string;
  priority?: number; 
  active: boolean;
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

  /**
   * Получает список всех глобальных API ключей
   * @returns Список глобальных API ключей
   */
  async getGlobalApiKeys(): Promise<GlobalApiKey[]> {
    try {
      // Получаем системный токен
      const systemToken = await this.getSystemToken();
      
      if (!systemToken) {
        log('Не удалось получить системный токен для получения списка глобальных API ключей', 'global-api-keys');
        return [];
      }
      
      // Проверяем методом DirectusCrud вместо прямого запроса через API
      try {
        const keys = await directusCrud.list('global_api_keys', {
          authToken: systemToken,
          fields: ['id', 'service_name', 'api_key', 'is_active', 'created_at', 'updated_at'],
          sort: ['service_name']
        });
        
        console.log(`Получено ${keys.length} глобальных API ключей через DirectusCrud`, keys);
        log(`Получено ${keys.length} глобальных API ключей через DirectusCrud`, 'global-api-keys');
        
        // Мапим в правильный формат для результата
        return keys.map(key => ({
          id: typeof key === 'object' && key !== null && 'id' in key ? key.id : '',
          service_name: typeof key === 'object' && key !== null && 'service_name' in key ? key.service_name as string : '',
          api_key: typeof key === 'object' && key !== null && 'api_key' in key ? key.api_key as string : '',
          is_active: typeof key === 'object' && key !== null && 'is_active' in key ? (key.is_active === true || key.is_active === 1) : false,
          priority: 0,
          created_at: typeof key === 'object' && key !== null && 'created_at' in key ? key.created_at as string : new Date().toISOString(),
          updated_at: typeof key === 'object' && key !== null && 'updated_at' in key ? key.updated_at as string : new Date().toISOString()
        }));
      } catch (directusCrudError) {
        console.error('Error using DirectusCrud to fetch global API keys:', directusCrudError);
        
        // Если DirectusCrud не сработал, пробуем прямой запрос
        const response = await this.directusApi.get('/items/global_api_keys', {
          params: {
            fields: ['id', 'service_name', 'api_key', 'is_active', 'created_at', 'updated_at'],
            sort: ['service_name']
          },
          headers: {
            Authorization: `Bearer ${systemToken}`
          }
        });
        
        const apiKeys = response.data?.data || [];
        log(`Получено ${apiKeys.length} глобальных API ключей прямым запросом`, 'global-api-keys');
        
        return apiKeys;
      }
    } catch (error) {
      console.error('Error fetching global API keys:', error);
      return [];
    }
  }

  /**
   * Добавляет новый глобальный API ключ
   * @param keyData Данные ключа для добавления
   * @returns Созданный ключ или null в случае ошибки
   */
  async addGlobalApiKey(keyData: GlobalApiKeyInput): Promise<GlobalApiKey | null> {
    try {
      // Получаем системный токен
      const systemToken = await this.getSystemToken();
      
      if (!systemToken) {
        log('Не удалось получить системный токен для добавления глобального API ключа', 'global-api-keys');
        return null;
      }
      
      // Форматирование ключа для специфических сервисов
      let formattedKey = keyData.api_key;
      
      if (keyData.service === ApiServiceName.FAL_AI) {
        // Если ключ начинается с "Key ", удаляем префикс для хранения
        if (keyData.api_key.startsWith('Key ')) {
          formattedKey = keyData.api_key.substring(4);
        }
      } else if (keyData.service === ApiServiceName.XMLRIVER) {
        // Форматирование ключа XMLRiver в JSON формат
        try {
          JSON.parse(keyData.api_key); // Проверяем, что это уже JSON
        } catch (e) {
          // Если не JSON, преобразуем
          if (keyData.api_key.includes(':')) {
            const [user, key] = keyData.api_key.split(':');
            formattedKey = JSON.stringify({ user: user.trim(), key: key.trim() });
          } else {
            formattedKey = JSON.stringify({ user: "16797", key: keyData.api_key.trim() });
          }
        }
      }
      
      // Создаем новый глобальный ключ
      const response = await this.directusApi.post('/items/global_api_keys', {
        service_name: keyData.service,
        api_key: formattedKey,
        priority: keyData.priority || 0,
        is_active: keyData.active
      }, {
        headers: {
          Authorization: `Bearer ${systemToken}`
        }
      });
      
      const createdKey = response.data?.data;
      if (createdKey) {
        log(`Создан новый глобальный API ключ для сервиса ${keyData.service}`, 'global-api-keys');
        
        // Обновляем кэш
        this.refreshCache().catch(err => {
          console.error('Failed to refresh global API keys cache after adding a key:', err);
        });
        
        return createdKey;
      }
      
      return null;
    } catch (error) {
      console.error(`Error adding global API key for service ${keyData.service}:`, error);
      return null;
    }
  }

  /**
   * Обновляет глобальный API ключ
   * @param id ID ключа для обновления
   * @param updateData Данные для обновления
   * @returns Обновленный ключ или null в случае ошибки
   */
  async updateGlobalApiKey(id: string, updateData: Partial<GlobalApiKey>): Promise<GlobalApiKey | null> {
    try {
      // Получаем системный токен
      const systemToken = await this.getSystemToken();
      
      if (!systemToken) {
        log('Не удалось получить системный токен для обновления глобального API ключа', 'global-api-keys');
        return null;
      }
      
      // Обновляем ключ
      const response = await this.directusApi.patch(`/items/global_api_keys/${id}`, {
        ...updateData,
        updated_at: new Date().toISOString()
      }, {
        headers: {
          Authorization: `Bearer ${systemToken}`
        }
      });
      
      // Получаем обновленный ключ
      const getResponse = await this.directusApi.get(`/items/global_api_keys/${id}`, {
        headers: {
          Authorization: `Bearer ${systemToken}`
        }
      });
      
      const updatedKey = getResponse.data?.data;
      if (updatedKey) {
        log(`Обновлен глобальный API ключ ${id}`, 'global-api-keys');
        
        // Обновляем кэш
        this.refreshCache().catch(err => {
          console.error('Failed to refresh global API keys cache after updating a key:', err);
        });
        
        return updatedKey;
      }
      
      return null;
    } catch (error) {
      console.error(`Error updating global API key ${id}:`, error);
      return null;
    }
  }

  /**
   * Удаляет глобальный API ключ
   * @param id ID ключа для удаления
   * @returns true в случае успеха, false в случае ошибки
   */
  async deleteGlobalApiKey(id: string): Promise<boolean> {
    try {
      // Получаем системный токен
      const systemToken = await this.getSystemToken();
      
      if (!systemToken) {
        log('Не удалось получить системный токен для удаления глобального API ключа', 'global-api-keys');
        return false;
      }
      
      // Получаем информацию о ключе для обновления кэша
      const keyInfo = await this.directusApi.get(`/items/global_api_keys/${id}`, {
        headers: {
          Authorization: `Bearer ${systemToken}`
        }
      }).then(response => response.data?.data).catch(() => null);
      
      // Удаляем ключ
      await this.directusApi.delete(`/items/global_api_keys/${id}`, {
        headers: {
          Authorization: `Bearer ${systemToken}`
        }
      });
      
      log(`Удален глобальный API ключ ${id}`, 'global-api-keys');
      
      // Если у нас есть информация о ключе, удаляем его из кэша
      if (keyInfo && keyInfo.service_name) {
        if (this.keyCache[keyInfo.service_name]) {
          delete this.keyCache[keyInfo.service_name];
        }
      } else {
        // Если нет информации о ключе, просто обновляем весь кэш
        this.refreshCache().catch(err => {
          console.error('Failed to refresh global API keys cache after deleting a key:', err);
        });
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting global API key ${id}:`, error);
      return false;
    }
  }
}

// Создаем экземпляр сервиса для использования в приложении
export const globalApiKeysService = new GlobalApiKeysService();
