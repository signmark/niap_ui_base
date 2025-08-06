/**
 * Сервис для работы с глобальными API ключами
 * Отвечает за кэширование, получение и управление глобальными API ключами
 */

import { directusApiManager } from '../directus';
import { log } from '../utils/logger';  
import { directusCrud } from './directus-crud';
import { directusAuthManager } from './directus-auth-manager';
import { ApiServiceName } from './api-keys';
import axios from 'axios';

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
  is_active: boolean;
}

/**
 * Интерфейс для YouTube конфигурации
 */
export interface YouTubeConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

/**
 * Сервис для работы с глобальными API ключами
 */
export class GlobalApiKeysService {
  private keyCache: GlobalApiKeyCache = {};
  private keysCache: GlobalApiKey[] = [];
  private lastCacheUpdate = Date.now();
  private readonly cacheDuration = 60 * 60 * 1000; // 1 час
  private directusApi = directusApiManager.instance;
  
  constructor() {
    // Запускаем периодическую очистку кэша
    setInterval(() => this.cleanupCache(), 30 * 60 * 1000); // каждые 30 минут
    
    // Отложенная загрузка кэша для предотвращения дублирования аутентификации при старте
    setTimeout(() => {
      this.refreshCache().catch(err => {
        console.error('Failed to initialize global API keys cache:', err);
      });
    }, 15000); // Загружаем через 15 секунд после полной инициализации сервера
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
      // Глобальные API ключи загружены
      
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
    // Используем статический токен из переменных окружения (как в планировщике)
    const staticToken = process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_ADMIN_TOKEN;
    
    if (staticToken) {
      return staticToken;
    }
    
    console.error('[global-api-keys] Отсутствует DIRECTUS_TOKEN или DIRECTUS_ADMIN_TOKEN в переменных окружения');
    return null;
  }
  
  /**
   * Получает глобальный API ключ для указанного сервиса
   * @param serviceName Название сервиса
   * @returns API ключ или null, если ключ не найден
   */
  async getGlobalApiKey(serviceName: ApiServiceName): Promise<string | null> {
    // Создаем варианты названий для поиска (заглавные и строчные)
    const searchVariants = [
      serviceName, // исходное название из enum
      serviceName.toUpperCase(), // заглавными буквами (как в админ-панели)
      serviceName.toLowerCase() // строчными буквами (старая логика)
    ];
    
    // Проверяем кэш для всех вариантов
    for (const variant of searchVariants) {
      if (this.keyCache[variant] && 
          this.keyCache[variant].isActive && 
          this.keyCache[variant].expiresAt > Date.now()) {
        log(`Using cached global ${variant} API key`, 'global-api-keys');
        return this.keyCache[variant].key;
      }
    }
    
    // Если кэш устарел или ключа нет в кэше, обновляем кэш
    await this.refreshCache();
    
    // Проверяем кэш еще раз после обновления для всех вариантов
    for (const variant of searchVariants) {
      if (this.keyCache[variant] && this.keyCache[variant].isActive) {
        log(`Found global ${variant} API key after cache refresh`, 'global-api-keys');
        return this.keyCache[variant].key;
      }
    }
    
    log(`Global ${serviceName} API key not found or inactive (tried variants: ${searchVariants.join(', ')})`, 'global-api-keys');
    return null;
  }

  /**
   * Получает конфигурацию YouTube из базы данных с fallback на переменные окружения
   * @returns Конфигурация YouTube или null, если ключи не найдены
   */
  async getYouTubeConfig(): Promise<YouTubeConfig | null> {
    try {
      // Сначала пробуем получить из базы данных
      const systemToken = await this.getSystemToken();
      
      if (systemToken) {
        try {
          // Получаем все YouTube ключи из базы данных
          const response = await this.directusApi.get('/items/global_api_keys', {
            params: {
              fields: ['service_name', 'api_key'],
              filter: {
                service_name: { _in: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REDIRECT_URI'] },
                is_active: { _eq: true }
              }
            },
            headers: {
              Authorization: `Bearer ${systemToken}`
            }
          });
          
          const apiKeys = response.data?.data || [];
          console.log(`[global-api-keys] Получено ${apiKeys.length} YouTube ключей из базы данных`);
          
          if (apiKeys.length > 0) {
            // Создаем объект конфигурации из базы данных
            const config: Partial<YouTubeConfig> = {};
            
            for (const keyData of apiKeys) {
              switch (keyData.service_name) {
                case 'YOUTUBE_CLIENT_ID':
                  config.clientId = keyData.api_key;
                  break;
                case 'YOUTUBE_CLIENT_SECRET':
                  config.clientSecret = keyData.api_key;
                  break;
                case 'YOUTUBE_REDIRECT_URI':
                  // НЕ используем redirect URI из базы данных, пусть система автоопределит
                  console.log('[global-api-keys] Игнорируем redirect URI из базы для автоопределения среды');
                  break;
              }
            }
            
            // Проверяем, что есть обязательные поля из базы
            if (config.clientId && config.clientSecret) {
              console.log('[global-api-keys] YouTube конфигурация успешно загружена из базы данных');
              const finalConfig = config as YouTubeConfig;
              console.log('[global-api-keys] Final config from DB:', { 
                clientId: finalConfig.clientId ? '***' : 'null',
                clientSecret: finalConfig.clientSecret ? '***' : 'null', 
                redirectUri: finalConfig.redirectUri || 'не задан'
              });
              return finalConfig;
            }
          }
        } catch (dbError: any) {
          console.warn('[global-api-keys] Ошибка доступа к базе данных, используем fallback:', dbError.response?.status || dbError.message);
        }
      }
      
      // Fallback: используем переменные окружения
      console.log('[global-api-keys] Используем fallback на переменные окружения для YouTube');
      
      const envClientId = process.env.YOUTUBE_CLIENT_ID;
      const envClientSecret = process.env.YOUTUBE_CLIENT_SECRET;
      const envRedirectUri = process.env.YOUTUBE_REDIRECT_URI;
      
      if (envClientId && envClientSecret) {
        const envConfig: YouTubeConfig = {
          clientId: envClientId,
          clientSecret: envClientSecret,
          redirectUri: envRedirectUri
        };
        
        console.log('[global-api-keys] YouTube конфигурация загружена из переменных окружения');
        console.log('[global-api-keys] Env config:', { 
          clientId: envConfig.clientId ? '***' : 'null',
          clientSecret: envConfig.clientSecret ? '***' : 'null', 
          redirectUri: envConfig.redirectUri || 'не задан'
        });
        
        return envConfig;
      }
      
      console.error('[global-api-keys] YouTube конфигурация недоступна ни в базе данных, ни в переменных окружения');
      return null;
      
    } catch (error) {
      console.error('[global-api-keys] Критическая ошибка при получении YouTube конфигурации:', error);
      return null;
    }
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
        return result && typeof result === 'object' && 'id' in result ? (result.id as string) : null;
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
      
      // Пробуем получить ключи напрямую через API вместо DirectusCrud
      try {
        // Используем прямой API запрос вместо DirectusCrud
        const response = await directusApiManager.instance.get('/items/global_api_keys', {
          params: {
            sort: ['service_name'],
            fields: ['id', 'service_name', 'api_key', 'is_active', 'created_at', 'updated_at']
          },
          headers: systemToken ? { Authorization: `Bearer ${systemToken}` } : undefined
        });
        
        const keys = response.data?.data || [];
        log(`Получено ${keys.length} глобальных API ключей прямым запросом`, 'global-api-keys');
        
        // Мапим в правильный формат для результата
        const formattedKeys = keys.map((key: any) => ({
          id: typeof key === 'object' && key !== null && 'id' in key ? String(key.id) : '',
          service_name: typeof key === 'object' && key !== null && 'service_name' in key ? key.service_name as string : '',
          api_key: typeof key === 'object' && key !== null && 'api_key' in key ? key.api_key as string : '',
          is_active: typeof key === 'object' && key !== null && 'is_active' in key ? (key.is_active === true || key.is_active === 1) : false,
          created_at: typeof key === 'object' && key !== null && 'created_at' in key ? key.created_at as string : new Date().toISOString(),
          updated_at: typeof key === 'object' && key !== null && 'updated_at' in key ? key.updated_at as string : new Date().toISOString()
        }));
        
        // Сохраняем результат в кэше
        this.keysCache = formattedKeys;
        this.lastCacheUpdate = Date.now();
        
        return formattedKeys;
      } catch (directError: any) {
        console.error('Error during direct API call to fetch global API keys:', directError);
        
        // Если получаем ошибку доступа, возвращаем заглушку с основными API ключами
        if (directError.response && (directError.response.status === 403 || directError.response.status === 401)) {
          // Возвращаем фиксированный набор с только service_name для базовых сервисов
          const stubKeys: GlobalApiKey[] = Object.values(ApiServiceName).map(name => ({
            id: `stub-${name}`,
            service_name: name,
            api_key: '', // Пустой ключ
            is_active: false, // Неактивный
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));
          
          console.log(`Возвращаем заглушку с ${stubKeys.length} глобальными API ключами`);
          this.keysCache = stubKeys;
          this.lastCacheUpdate = Date.now();
          return stubKeys;
        }
        
        // Если ошибка не 403/401, возвращаем пустой массив
        return [];
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
        is_active: keyData.is_active
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
      
      // Обновляем ключ и получаем обновленные данные сразу
      const response = await this.directusApi.patch(`/items/global_api_keys/${id}`, {
        ...updateData,
        updated_at: new Date().toISOString()
      }, {
        headers: {
          Authorization: `Bearer ${systemToken}`
        },
        params: {
          fields: '*'  // Запрашиваем все поля сразу
        }
      });
      
      // Получаем обновленный ключ из ответа на PATCH
      const updatedKey = response.data?.data;
      
      if (updatedKey) {
        log(`Обновлен глобальный API ключ ${id}`, 'global-api-keys');
        
        // Обновляем только конкретный ключ в кэше, а не весь кэш
        if (this.keysCache) {
          // Находим индекс ключа в кэше
          const keyIndex = this.keysCache.findIndex(k => k.id === id);
          if (keyIndex !== -1) {
            // Обновляем конкретный ключ в кэше
            this.keysCache[keyIndex] = updatedKey;
            this.lastCacheUpdate = Date.now();
          }
        }
        
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
      console.log(`Запрос на удаление глобального API ключа с ID ${id}`);
      
      // Получаем системный токен
      const systemToken = await this.getSystemToken();
      
      if (!systemToken) {
        console.error('Не удалось получить системный токен для удаления глобального API ключа');
        log('Не удалось получить системный токен для удаления глобального API ключа', 'global-api-keys');
        return false;
      }
      
      console.log(`Системный токен получен: ${systemToken.substring(0, 10)}...`);
      
      // Получаем информацию о ключе для обновления кэша
      let keyInfo = null;
      try {
        const keyResponse = await this.directusApi.get(`/items/global_api_keys/${id}`, {
          headers: {
            Authorization: `Bearer ${systemToken}`
          }
        });
        keyInfo = keyResponse.data?.data;
        console.log(`Информация о ключе получена:`, keyInfo);
      } catch (keyError) {
        console.error(`Ошибка при получении информации о ключе ${id}:`, keyError);
      }
      
      try {
        // Используем directusCrud для удаления вместо прямого API-запроса
        await directusCrud.delete('global_api_keys', id, {
          authToken: systemToken
        });
        console.log(`Ключ с ID ${id} успешно удален через directusCrud`);
      } catch (directusCrudError) {
        console.error(`Ошибка при удалении через directusCrud:`, directusCrudError);
        
        // Запасной вариант: прямой API запрос с явным указанием заголовков
        try {
          console.log(`Пробуем удалить ключ с ID ${id} через прямой API запрос`);
          await this.directusApi.delete(`/items/global_api_keys/${id}`, {
            headers: {
              Authorization: `Bearer ${systemToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          console.log(`Ключ с ID ${id} успешно удален через прямой API запрос`);
        } catch (error) {
          const directApiError = error as any;
          console.error(`Ошибка при прямом удалении через API:`, directApiError);
          // Проверим, была ли ошибка из-за отсутствия ключа (404)
          if (directApiError.response?.status === 404) {
            console.log(`Ключ с ID ${id} не найден (404), считаем удаление успешным`);
            // Считаем удаление успешным, если ключ не найден
            return true;
          }
          throw directApiError;
        }
      }
      
      log(`Удален глобальный API ключ ${id}`, 'global-api-keys');
      
      // Удаляем ключ из списка ключей в кэше
      if (this.keysCache) {
        this.keysCache = this.keysCache.filter(k => k.id !== id);
        this.lastCacheUpdate = Date.now();
      }
      
      // Если у нас есть информация о ключе, удаляем его из кэша по сервису
      if (keyInfo && keyInfo.service_name) {
        if (this.keyCache[keyInfo.service_name]) {
          delete this.keyCache[keyInfo.service_name];
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting global API key ${id}:`, error);
      return false;
    }
  }

  /**
   * Обновляет redirect URI для YouTube в базе данных
   */
  async updateYouTubeRedirectUri(newRedirectUri: string): Promise<boolean> {
    try {
      console.log('[global-api-keys] Обновляем YouTube redirect URI:', newRedirectUri);
      
      const systemToken = await this.getSystemToken();
      if (!systemToken) {
        console.error('[global-api-keys] Не удалось получить системный токен');
        return false;
      }

      const directusUrl = process.env.DIRECTUS_URL || process.env.VITE_DIRECTUS_URL || 'https://directus.roboflow.space';
      
      const response = await axios.patch(
        `${directusUrl}/items/global_api_keys/9`, // ID записи YouTube в базе
        {
          api_secret: newRedirectUri
        },
        {
          headers: {
            'Authorization': `Bearer ${systemToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        console.log('[global-api-keys] YouTube redirect URI успешно обновлен');
        return true;
      } else {
        console.log('[global-api-keys] Неожиданный статус ответа:', response.status);
        return false;
      }
      
    } catch (error) {
      console.error('[global-api-keys] Ошибка при обновлении YouTube redirect URI:', error);
      return false;
    }
  }
}

// Создаем экземпляр сервиса для использования в приложении
export const globalApiKeysService = new GlobalApiKeysService();
