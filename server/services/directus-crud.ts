import { directusApiManager } from '../directus';
import { log } from '../utils/logger';

/**
 * Типы операций для логирования
 */
type CrudOperation = 'create' | 'read' | 'update' | 'delete' | 'list';

/**
 * Опции для запросов
 */
interface RequestOptions {
  userId?: string;
  authToken?: string;
  fields?: string[];
  sort?: string[];
  limit?: number;
  page?: number;
  filter?: Record<string, any>;
  search?: string;
  meta?: string[];
  deep?: Record<string, any>;
}

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
  async create<T>(collection: string, data: Record<string, any>, options: RequestOptions = {}): Promise<T> {
    return this.executeOperation('create', collection, async () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (options.authToken) {
        headers['Authorization'] = `Bearer ${options.authToken}`;
      }

      const response = await directusApiManager.request({
        method: 'POST',
        url: `/items/${collection}`,
        data,
        headers,
        params: this.buildParams(options)
      }, options.userId);

      return response.data.data;
    });
  }

  /**
   * Получает список записей из коллекции Directus
   * @param collection Название коллекции
   * @param options Дополнительные опции запроса
   * @returns Список записей
   */
  async list<T>(collection: string, options: RequestOptions = {}): Promise<T[]> {
    return this.executeOperation('list', collection, async () => {
      const headers: Record<string, string> = {};

      if (options.authToken) {
        headers['Authorization'] = `Bearer ${options.authToken}`;
      }

      const response = await directusApiManager.request({
        method: 'GET',
        url: `/items/${collection}`,
        headers,
        params: this.buildParams(options)
      }, options.userId);

      return response.data.data || [];
    });
  }

  /**
   * Получает конкретную запись из коллекции Directus по ID
   * @param collection Название коллекции
   * @param id ID записи
   * @param options Дополнительные опции запроса
   * @returns Запись или null, если запись не найдена
   */
  async getById<T>(collection: string, id: string | number, options: RequestOptions = {}): Promise<T | null> {
    return this.executeOperation('read', collection, async () => {
      const headers: Record<string, string> = {};

      if (options.authToken) {
        headers['Authorization'] = `Bearer ${options.authToken}`;
      }

      try {
        const response = await directusApiManager.request({
          method: 'GET',
          url: `/items/${collection}/${id}`,
          headers,
          params: this.buildParams(options)
        }, options.userId);

        return response.data.data || null;
      } catch (error: any) {
        // 204 означает "нет содержимого", это нормальный ответ для отсутствующей записи
        if (error.response && error.response.status === 204) {
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
  async update<T>(collection: string, id: string | number, data: Record<string, any>, options: RequestOptions = {}): Promise<T> {
    return this.executeOperation('update', collection, async () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (options.authToken) {
        headers['Authorization'] = `Bearer ${options.authToken}`;
      }

      const response = await directusApiManager.request({
        method: 'PATCH',
        url: `/items/${collection}/${id}`,
        data,
        headers,
        params: this.buildParams(options)
      }, options.userId);

      return response.data.data;
    });
  }

  /**
   * Удаляет запись из коллекции Directus
   * @param collection Название коллекции
   * @param id ID записи
   * @param options Дополнительные опции запроса
   */
  async delete(collection: string, id: string | number, options: RequestOptions = {}): Promise<void> {
    return this.executeOperation('delete', collection, async () => {
      const headers: Record<string, string> = {};

      if (options.authToken) {
        headers['Authorization'] = `Bearer ${options.authToken}`;
      }

      await directusApiManager.request({
        method: 'DELETE',
        url: `/items/${collection}/${id}`,
        headers
      }, options.userId);
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
  async custom<T>(method: string, path: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.executeOperation('custom', path, async () => {
      const headers: Record<string, string> = {};
      
      if (data) {
        headers['Content-Type'] = 'application/json';
      }

      if (options.authToken) {
        headers['Authorization'] = `Bearer ${options.authToken}`;
      }

      const response = await directusApiManager.request({
        method,
        url: path,
        data,
        headers,
        params: this.buildParams(options)
      }, options.userId);

      return response.data;
    });
  }

  /**
   * Формирует параметры запроса на основе предоставленных опций
   * @param options Опции запроса
   * @returns Параметры запроса для axios
   */
  private buildParams(options: RequestOptions): Record<string, any> {
    const params: Record<string, any> = {};

    if (options.fields && options.fields.length > 0) {
      params.fields = options.fields.join(',');
    }

    if (options.sort && options.sort.length > 0) {
      params.sort = options.sort.join(',');
    }

    if (options.limit) {
      params.limit = options.limit;
    }

    if (options.page) {
      params.page = options.page;
    }

    if (options.filter && Object.keys(options.filter).length > 0) {
      params.filter = options.filter;
    }

    if (options.search) {
      params.search = options.search;
    }

    if (options.meta && options.meta.length > 0) {
      params.meta = options.meta.join(',');
    }

    if (options.deep && Object.keys(options.deep).length > 0) {
      params.deep = options.deep;
    }

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
      log(`Executing ${operation} operation on collection "${collection}"`, this.logPrefix);
      const result = await executor();
      log(`Successfully executed ${operation} operation on collection "${collection}"`, this.logPrefix);
      return result;
    } catch (error: any) {
      log(`Error executing ${operation} operation on collection "${collection}": ${error.message}`, this.logPrefix);
      console.error(`DirectusCrud error (${operation} on ${collection}):`, error);
      
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      
      throw new Error(`Failed to ${operation} ${collection}: ${error.message}`);
    }
  }

  /**
   * Получает токен авторизации из Directus
   * @param email Email пользователя
   * @param password Пароль пользователя
   * @returns Информация о токене
   */
  async login(email: string, password: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires: number;
  }> {
    return this.executeOperation('custom', 'auth/login', async () => {
      const response = await directusApiManager.request({
        method: 'POST',
        url: '/auth/login',
        data: { email, password },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const { access_token, refresh_token, expires } = response.data.data;
      return { access_token, refresh_token, expires };
    });
  }

  /**
   * Обновляет токен авторизации с помощью refresh token
   * @param refreshToken Refresh token
   * @returns Новый access token и информация о нем
   */
  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires: number;
  }> {
    return this.executeOperation('custom', 'auth/refresh', async () => {
      const response = await directusApiManager.request({
        method: 'POST',
        url: '/auth/refresh',
        data: { refresh_token: refreshToken },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const { access_token, refresh_token, expires } = response.data.data;
      return { access_token, refresh_token, expires };
    });
  }

  /**
   * Получает информацию о текущем пользователе
   * @param options Опции запроса с токеном
   * @returns Информация о пользователе
   */
  async getCurrentUser(options: RequestOptions): Promise<any> {
    return this.executeOperation('custom', 'users/me', async () => {
      const headers: Record<string, string> = {};

      if (options.authToken) {
        headers['Authorization'] = `Bearer ${options.authToken}`;
      }

      const response = await directusApiManager.request({
        method: 'GET',
        url: '/users/me',
        headers
      }, options.userId);

      return response.data.data;
    });
  }
}

// Экспортируем экземпляр класса для использования в приложении
export const directusCrud = new DirectusCrud();