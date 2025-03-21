/**
 * Типы для работы с Directus API
 */
import { log } from '../utils/logger';
import { directusApiManager } from '../directus';
import { DirectusRequestOptions } from './directus-types';

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
      const response = await directusApiManager.request({
        url: `/items/${collection}`,
        method: 'post',
        data
      }, authToken || userId);

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
      
      const response = await directusApiManager.request({
        url: `/items/${collection}`,
        method: 'get',
        params
      }, authToken || userId);

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
      
      try {
        const response = await directusApiManager.request({
          url: `/items/${collection}/${id}`,
          method: 'get'
        }, authToken || userId);

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
      
      const response = await directusApiManager.request({
        url: `/items/${collection}/${id}`,
        method: 'patch',
        data
      }, authToken || userId);

      return response.data.data;
    });
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
      
      await directusApiManager.request({
        url: `/items/${collection}/${id}`,
        method: 'delete'
      }, authToken || userId);
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
      
      const response = await directusApiManager.request({
        url: '/users/me',
        method: 'get'
      }, authToken || userId);

      return response.data.data;
    });
  }
}

export const directusCrud = new DirectusCrud();