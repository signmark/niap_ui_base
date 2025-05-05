/**
 * Сервис для работы с глобальными API ключами
 * Позволяет администраторам управлять общими API ключами для всех пользователей
 */

import { directusApiManager } from '../directus';
import { log } from '../utils/logger';
import { ApiServiceName } from './api-keys';

// Получаем инстанс Axios для Directus API
const directusApi = directusApiManager.instance;

/**
 * Класс для работы с глобальными API ключами
 * Хранит и обрабатывает общие для всех пользователей ключи
 */
export class GlobalApiKeysService {
  // Кэш для хранения глобальных API ключей (service_name -> key)
  private keyCache: Record<string, string> = {};
  
  // Метка времени последнего обновления кэша
  private lastCacheUpdate: number = 0;
  
  // Время жизни кэша в миллисекундах (10 минут)
  private cacheTTL: number = 10 * 60 * 1000;
  
  /**
   * Получает глобальный API ключ для указанного сервиса
   * @param serviceName Имя сервиса, для которого нужен ключ
   * @returns API ключ или null, если ключ не найден
   */
  async getGlobalApiKey(serviceName: ApiServiceName): Promise<string | null> {
    const now = Date.now();
    
    // Проверяем, не истек ли кэш
    if (now - this.lastCacheUpdate > this.cacheTTL) {
      await this.refreshCache();
    }
    
    // Проверяем кэш
    if (this.keyCache[serviceName]) {
      log(`[global-api-keys] Использование кэшированного ключа для ${serviceName}`, 'api-keys');
      return this.keyCache[serviceName];
    }
    
    // Если ключа нет в кэше, пробуем загрузить его напрямую
    try {
      const response = await directusApi.get('/items/global_api_keys', {
        params: {
          filter: {
            service_name: { _eq: serviceName },
            is_active: { _eq: true }
          },
          fields: ['id', 'service_name', 'api_key']
        }
      });
      
      const apiKeys = response.data?.data || [];
      if (apiKeys.length > 0 && apiKeys[0].api_key) {
        const apiKey = apiKeys[0].api_key;
        
        // Сохраняем в кэш
        this.keyCache[serviceName] = apiKey;
        log(`[global-api-keys] Получен и кэширован глобальный ключ для ${serviceName}`, 'api-keys');
        
        return apiKey;
      }
      
      log(`[global-api-keys] Глобальный ключ для ${serviceName} не найден`, 'api-keys');
      return null;
    } catch (error: any) {
      log(`[global-api-keys] Ошибка при получении глобального ключа для ${serviceName}: ${error.message}`, 'api-keys');
      return null;
    }
  }
  
  /**
   * Обновляет кэш глобальных API ключей
   * @returns true если обновление прошло успешно, иначе false
   */
  async refreshCache(): Promise<boolean> {
    try {
      const response = await directusApi.get('/items/global_api_keys', {
        params: {
          filter: {
            is_active: { _eq: true }
          },
          fields: ['id', 'service_name', 'api_key']
        }
      });
      
      const apiKeys = response.data?.data || [];
      log(`[global-api-keys] Получено ${apiKeys.length} глобальных API ключей`, 'api-keys');
      
      // Очищаем и обновляем кэш
      this.keyCache = {};
      for (const keyData of apiKeys) {
        if (keyData.service_name && keyData.api_key) {
          this.keyCache[keyData.service_name] = keyData.api_key;
        }
      }
      
      // Обновляем метку времени
      this.lastCacheUpdate = Date.now();
      
      return true;
    } catch (error: any) {
      log(`[global-api-keys] Ошибка при обновлении кэша: ${error.message}`, 'api-keys');
      return false;
    }
  }
  
  /**
   * Создает или обновляет глобальный API ключ
   * Эта функция должна вызываться только администраторами
   * @param serviceName Имя сервиса
   * @param apiKey Значение API ключа
   * @param authToken Токен авторизации администратора
   * @returns ID записи или null в случае ошибки
   */
  async setGlobalApiKey(serviceName: ApiServiceName, apiKey: string, authToken: string): Promise<string | null> {
    try {
      // Проверяем, существует ли уже ключ для этого сервиса
      const response = await directusApi.get('/items/global_api_keys', {
        params: {
          filter: {
            service_name: { _eq: serviceName }
          },
          fields: ['id']
        },
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      const existingKeys = response.data?.data || [];
      
      if (existingKeys.length > 0) {
        // Обновляем существующий ключ
        const existingKeyId = existingKeys[0].id;
        await directusApi.patch(`/items/global_api_keys/${existingKeyId}`, {
          api_key: apiKey,
          is_active: true
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        // Обновляем кэш
        this.keyCache[serviceName] = apiKey;
        this.lastCacheUpdate = Date.now();
        
        log(`[global-api-keys] Глобальный ключ для ${serviceName} обновлен`, 'api-keys');
        return existingKeyId;
      } else {
        // Создаем новый ключ
        const createResponse = await directusApi.post('/items/global_api_keys', {
          service_name: serviceName,
          api_key: apiKey,
          is_active: true,
          description: `Глобальный ключ для ${serviceName}`
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const newKeyId = createResponse.data?.data?.id;
        
        // Обновляем кэш
        this.keyCache[serviceName] = apiKey;
        this.lastCacheUpdate = Date.now();
        
        log(`[global-api-keys] Создан новый глобальный ключ для ${serviceName}`, 'api-keys');
        return newKeyId;
      }
    } catch (error: any) {
      log(`[global-api-keys] Ошибка при установке глобального ключа для ${serviceName}: ${error.message}`, 'api-keys');
      return null;
    }
  }
  
  /**
   * Деактивирует глобальный API ключ
   * Эта функция должна вызываться только администраторами
   * @param serviceName Имя сервиса
   * @param authToken Токен авторизации администратора
   * @returns true в случае успеха, иначе false
   */
  async deactivateGlobalApiKey(serviceName: ApiServiceName, authToken: string): Promise<boolean> {
    try {
      // Проверяем, существует ли ключ для этого сервиса
      const response = await directusApi.get('/items/global_api_keys', {
        params: {
          filter: {
            service_name: { _eq: serviceName }
          },
          fields: ['id']
        },
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      const existingKeys = response.data?.data || [];
      
      if (existingKeys.length > 0) {
        // Деактивируем ключ
        const existingKeyId = existingKeys[0].id;
        await directusApi.patch(`/items/global_api_keys/${existingKeyId}`, {
          is_active: false
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        // Удаляем из кэша
        delete this.keyCache[serviceName];
        
        log(`[global-api-keys] Глобальный ключ для ${serviceName} деактивирован`, 'api-keys');
        return true;
      }
      
      return false;
    } catch (error: any) {
      log(`[global-api-keys] Ошибка при деактивации глобального ключа для ${serviceName}: ${error.message}`, 'api-keys');
      return false;
    }
  }
}

// Экспортируем синглтон сервиса
export const globalApiKeysService = new GlobalApiKeysService();
