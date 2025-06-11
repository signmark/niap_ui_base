/**
 * Типы для работы с Directus API
 */
import { log } from '../utils/logger';
import { directusApiManager } from '../directus';
import { DirectusAuthResult, DirectusRequestOptions } from './directus-types';
import axios from 'axios';

/**
 * Типы операций для логирования
 */
type CrudOperation = 'create' | 'read' | 'update' | 'delete' | 'list';

/**
 * Класс для унифицированного выполнения CRUD операций с Directus
 */
export class DirectusCrud {
  private logPrefix: string = 'directus-crud';

  /**
   * Создает запись в коллекции Directus
   * @param collection Название коллекции
   * @param data Данные для создания
   * @param options Дополнительные опции запроса
   * @returns Созданная запись
   */
  async create<T>(collection: string, data: Record<string, any>, options: DirectusRequestOptions = {}): Promise<T> {
    return this.executeOperation<T>('create', collection, async () => {
      const { authToken, userId } = options;
      
      // ИСПРАВЛЕНИЕ 403: Для коллекции campaign_content принудительно используем админский токен
      let finalAuthToken = authToken;
      if (collection === 'campaign_content' && !authToken) {
        const { directusAuthManager } = await import('./directus-auth-manager');
        const adminToken = await directusAuthManager.getAdminAuthToken();
        if (adminToken) {
          finalAuthToken = adminToken;
        }
      }
      
      const response = await directusApiManager.request({
        url: `/items/${collection}`,
        method: 'post',
        data
      }, finalAuthToken || userId);

      return response.data.data;
    });
  }

  /**
   * Получает список записей из коллекции Directus
   * @param collection Название коллекции
   * @param options Дополнительные опции запроса
   * @returns Список записей
   */
  async list<T>(collection: string, options: DirectusRequestOptions = {}): Promise<T[]> {
    return this.executeOperation<T[]>('list', collection, async () => {
      const { authToken, userId, filter, sort = [], limit, page } = options;
      
      const params: Record<string, any> = {};
      
      if (filter) params.filter = filter;
      if (sort && sort.length > 0) params.sort = sort;
      if (limit) params.limit = limit;
      if (page) params.page = page;
      
      // ИСПРАВЛЕНИЕ 403: Для коллекции campaign_content принудительно используем админский токен
      let finalAuthToken = authToken;
      if (collection === 'campaign_content' && !authToken) {
        const { directusAuthManager } = await import('./directus-auth-manager');
        const adminToken = await directusAuthManager.getAdminAuthToken();
        if (adminToken) {
          finalAuthToken = adminToken;
        }
      }
      
      const response = await directusApiManager.request({
        url: `/items/${collection}`,
        method: 'get',
        params
      }, finalAuthToken || userId);

      return response.data.data;
    });
  }
  
  /**
   * Ищет записи в коллекции Directus с расширенными опциями поиска
   * @param collection Название коллекции
   * @param options Дополнительные опции запроса
   * @returns Список найденных записей
   */
  async searchItems<T>(collection: string, options: DirectusRequestOptions = {}): Promise<T[]> {
    return this.executeOperation<T[]>('list', collection, async () => {
      const { authToken, userId } = options;
      const params = this.buildParams(options);
      
      // ИСПРАВЛЕНИЕ 403: Для коллекции campaign_content принудительно используем админский токен
      let finalAuthToken = authToken;
      if (collection === 'campaign_content' && !authToken) {
        const { directusAuthManager } = await import('./directus-auth-manager');
        const adminToken = await directusAuthManager.getAdminAuthToken();
        if (adminToken) {
          finalAuthToken = adminToken;
        }
      }
      
      const response = await directusApiManager.request({
        url: `/items/${collection}`,
        method: 'get',
        params
      }, finalAuthToken || userId);

      return response.data.data;
    });
  }

  /**
   * Получает конкретную запись из коллекции Directus по ID
   * @param collection Название коллекции
   * @param id ID записи
   * @param options Дополнительные опции запроса
   * @returns Запись или null, если запись не найдена
   */
  async getById<T>(collection: string, id: string | number, options: DirectusRequestOptions = {}): Promise<T | null> {
    return this.executeOperation<T | null>('read', collection, async () => {
      const { authToken, userId } = options;
      
      // ИСПРАВЛЕНИЕ 403: Для коллекции campaign_content принудительно используем админский токен
      let finalAuthToken = authToken;
      if (collection === 'campaign_content' && !authToken) {
        const { directusAuthManager } = await import('./directus-auth-manager');
        const adminToken = await directusAuthManager.getAdminAuthToken();
        if (adminToken) {
          finalAuthToken = adminToken;
        }
      }
      
      try {
        const response = await directusApiManager.request({
          url: `/items/${collection}/${id}`,
          method: 'get'
        }, finalAuthToken || userId);

        return response.data.data;
      } catch (error: any) {
        if (error.response && error.response.status === 404) {
          return null;
        }
        throw error;
      }
    });
  }

  /**
   * Обновляет запись в коллекции Directus
   * @param collection Название коллекции
   * @param id ID записи
   * @param data Данные для обновления
   * @param options Дополнительные опции запроса
   * @returns Обновленная запись
   */
  async update<T>(collection: string, id: string | number, data: Record<string, any>, options: DirectusRequestOptions = {}): Promise<T> {
    return this.executeOperation<T>('update', collection, async () => {
      const { authToken, userId } = options;
      
      // ИСПРАВЛЕНИЕ 403: Для коллекции campaign_content принудительно используем админский токен
      let finalAuthToken = authToken;
      if (collection === 'campaign_content' && !authToken) {
        const { directusAuthManager } = await import('./directus-auth-manager');
        const adminToken = await directusAuthManager.getAdminAuthToken();
        if (adminToken) {
          finalAuthToken = adminToken;
        }
      }
      
      const response = await directusApiManager.request({
        url: `/items/${collection}/${id}`,
        method: 'patch',
        data
      }, finalAuthToken || userId);

      return response.data.data;
    });
  }
  
  /**
   * Псевдоним для метода update (используется в сервисе аналитики)
   * @param collection Название коллекции
   * @param id ID записи
   * @param data Данные для обновления
   * @param options Дополнительные опции запроса
   * @returns Обновленная запись
   */
  async updateItem<T>(collection: string, id: string | number, data: Record<string, any>, options: DirectusRequestOptions = {}): Promise<T> {
    return this.update<T>(collection, id, data, options);
  }

  /**
   * Удаляет запись из коллекции Directus
   * @param collection Название коллекции
   * @param id ID записи
   * @param options Дополнительные опции запроса
   */
  async delete(collection: string, id: string | number, options: DirectusRequestOptions = {}): Promise<void> {
    return this.executeOperation<void>('delete', collection, async () => {
      const { authToken, userId } = options;
      
      // ИСПРАВЛЕНИЕ 403: Для коллекции campaign_content принудительно используем админский токен
      let finalAuthToken = authToken;
      if (collection === 'campaign_content' && !authToken) {
        const { directusAuthManager } = await import('./directus-auth-manager');
        const adminToken = await directusAuthManager.getAdminAuthToken();
        if (adminToken) {
          finalAuthToken = adminToken;
        }
      }
      
      await directusApiManager.request({
        url: `/items/${collection}/${id}`,
        method: 'delete'
      }, finalAuthToken || userId);
    });
  }

  /**
   * Выполняет пользовательский запрос к Directus API
   * @param method HTTP метод
   * @param path Путь запроса (без базового URL)
   * @param data Данные запроса (для POST, PUT, PATCH)
   * @param options Дополнительные опции запроса
   * @returns Результат запроса
   */
  async custom<T>(method: string, path: string, data?: any, options: DirectusRequestOptions = {}): Promise<T> {
    return this.executeOperation<T>('custom', path, async () => {
      const { authToken, userId } = options;
      
      const response = await directusApiManager.request({
        url: path,
        method: method.toLowerCase(),
        data: method.toUpperCase() !== 'GET' ? data : undefined,
        params: method.toUpperCase() === 'GET' ? data : undefined
      }, authToken || userId);

      return response.data.data;
    });
  }

  /**
   * Формирует параметры запроса на основе предоставленных опций
   * @param options Опции запроса
   * @returns Параметры запроса для axios
   */
  private buildParams(options: DirectusRequestOptions): Record<string, any> {
    const params: Record<string, any> = {};
    
    if (options.filter) params.filter = options.filter;
    if (options.sort && options.sort.length > 0) params.sort = options.sort;
    if (options.limit) params.limit = options.limit;
    if (options.page) params.page = options.page;
    if (options.fields && options.fields.length > 0) params.fields = options.fields;
    if (options.search) params.search = options.search;
    if (options.meta && options.meta.length > 0) params.meta = options.meta;
    if (options.deep) params.deep = options.deep;
    
    return params;
  }

  /**
   * Выполняет операцию с логированием и обработкой ошибок
   * @param operation Тип операции
   * @param collection Название коллекции
   * @param executor Функция выполнения операции
   * @returns Результат операции
   */
  private async executeOperation<T>(operation: CrudOperation | 'custom', collection: string, executor: () => Promise<T>): Promise<T> {
    try {
      log(`Выполнение операции ${operation} для коллекции ${collection}`, this.logPrefix);
      const result = await executor();
      log(`Операция ${operation} для коллекции ${collection} выполнена успешно`, this.logPrefix);
      return result;
    } catch (error: any) {
      log(`Ошибка при выполнении операции ${operation} для коллекции ${collection}: ${error.message}`, this.logPrefix);
      
      if (error.response) {
        log(`Статус ошибки: ${error.response.status}`, this.logPrefix);
        if (error.response.data && error.response.data.errors) {
          log(`Детали ошибки: ${JSON.stringify(error.response.data.errors)}`, this.logPrefix);
        }
      }
      
      throw error;
    }
  }

  /**
   * Получает информацию о текущем пользователе из Directus
   * @param options Опции запроса
   * @returns Информация о пользователе
   */
  async getCurrentUser(options: DirectusRequestOptions): Promise<any> {
    return this.executeOperation<any>('read', 'users/me', async () => {
      const { authToken, userId } = options;
      
      if (!authToken && !userId) {
        throw new Error("Нет токена авторизации или ID пользователя для получения информации");
      }
      
      try {
        // Используем прямой запрос через axios, минуя directusApiManager
        const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
        const response = await axios.get(`${directusUrl}/users/me`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (!response.data || !response.data.data) {
          throw new Error('Неверный формат ответа при получении информации о пользователе');
        }
        
        return response.data.data;
      } catch (error: any) {
        // Только при наличии authToken логируем подробности, иначе возможна потеря приватных данных
        if (authToken) {
          console.error('Ошибка при получении информации о пользователе', {
            status: error.response?.status,
            error: error.message,
            details: error.response?.data
          });
        }
        
        // Пробуем запрос через directusApiManager как запасной вариант
        try {
          const response = await directusApiManager.request({
            url: '/users/me',
            method: 'get'
          }, authToken || userId);
          
          return response.data.data;
        } catch (secondError) {
          // Если и второй запрос не удался, выбрасываем оригинальную ошибку
          throw error;
        }
      }
    });
  }

  /**
   * Получает административный токен для доступа к системным функциям Directus
   * @returns Административный токен или null
   */
  async getAdminToken(): Promise<string | null> {
    try {
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
      const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL;
      const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD;

      if (!adminEmail || !adminPassword) {
        log('Отсутствуют учетные данные администратора в переменных окружения', this.logPrefix);
        return null;
      }

      const response = await axios.post(`${directusUrl}/auth/login`, {
        email: adminEmail,
        password: adminPassword
      });

      if (response.data?.data?.access_token) {
        log('Получен административный токен для Directus', this.logPrefix);
        return response.data.data.access_token;
      }

      log('Неверный формат ответа при получении административного токена', this.logPrefix);
      return null;
    } catch (error: any) {
      log(`Ошибка при получении административного токена: ${error.message}`, this.logPrefix);
      return null;
    }
  }

  /**
   * Авторизуется в Directus как администратор
   * @param email Email администратора
   * @param password Пароль администратора
   * @returns Результат авторизации
   */
  async login(email: string, password: string): Promise<DirectusAuthResult> {
    return this.executeOperation<DirectusAuthResult>('custom', 'auth/login', async () => {
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
      
      const response = await axios.post(`${directusUrl}/auth/login`, {
        email,
        password
      });

      if (!response.data?.data?.access_token) {
        throw new Error('Неверный формат ответа при авторизации');
      }

      return {
        access_token: response.data.data.access_token,
        refresh_token: response.data.data.refresh_token,
        expires: response.data.data.expires
      };
    });
  }

  /**
   * Получает данные пользователя по токену авторизации
   * @param token Токен авторизации
   * @returns Данные пользователя или null
   */
  async getUserByToken(token: string): Promise<any | null> {
    try {
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
      const response = await axios.get(`${directusUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.data || !response.data.data) {
        return null;
      }

      return response.data.data;
    } catch (error: any) {
      log(`Ошибка при получении пользователя по токену: ${error.message}`, this.logPrefix);
      return null;
    }
  }

  /**
   * Авторизует пользователя в Directus и возвращает информацию о токене
   * @param email Email пользователя
   * @param password Пароль пользователя
   * @returns Результат авторизации
   */
  async authenticateUser(email: string, password: string): Promise<DirectusAuthResult> {
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
    
    try {
      log(`Попытка авторизации пользователя ${email}`, this.logPrefix);
      
      const response = await axios.post(`${directusUrl}/auth/login`, {
        email,
        password
      });
      
      if (!response.data || !response.data.data || !response.data.data.access_token) {
        throw new Error('Неверный формат ответа от API при авторизации');
      }
      
      log(`Пользователь ${email} успешно авторизован`, this.logPrefix);
      
      return {
        access_token: response.data.data.access_token,
        refresh_token: response.data.data.refresh_token,
        expires: response.data.data.expires,
        user: response.data.data.user
      };
    } catch (error: any) {
      log(`Ошибка при авторизации пользователя ${email}: ${error.message}`, this.logPrefix);
      
      if (error.response && error.response.data) {
        log(`Детали ошибки: ${JSON.stringify(error.response.data)}`, this.logPrefix);
      }
      
      throw new Error(`Ошибка авторизации: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  /**
   * Обновляет токен доступа с помощью refresh token
   * @param refreshToken Токен обновления
   * @returns Новый токен доступа и информация об истечении
   */
  async refreshToken(refreshToken: string): Promise<DirectusAuthResult> {
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
    
    try {
      log('Обновление токена доступа', this.logPrefix);
      
      const response = await axios.post(`${directusUrl}/auth/refresh`, {
        refresh_token: refreshToken
      });
      
      if (!response.data || !response.data.data || !response.data.data.access_token) {
        throw new Error('Неверный формат ответа от API при обновлении токена');
      }
      
      log('Токен доступа успешно обновлен', this.logPrefix);
      
      return {
        access_token: response.data.data.access_token,
        refresh_token: response.data.data.refresh_token,
        expires: response.data.data.expires
      };
    } catch (error: any) {
      log(`Ошибка при обновлении токена: ${error.message}`, this.logPrefix);
      
      if (error.response && error.response.data) {
        log(`Детали ошибки: ${JSON.stringify(error.response.data)}`, this.logPrefix);
      }
      
      throw new Error(`Ошибка обновления токена: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }
}

export const directusCrud = new DirectusCrud();