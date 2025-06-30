import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { log } from './utils/logger';

// Создаем кэш для хранения токенов авторизации
interface AuthTokenCache {
  [userId: string]: {
    token: string;
    refreshToken?: string;  // Добавляем refreshToken в кэш
    expiresAt: number;
  };
}

// Интерфейс для хранения информации о запросах, ожидающих обновления токена
interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  config: AxiosRequestConfig;
}

// Класс для управления Directus API запросами
class DirectusApiManager {
  private readonly baseURL: string;
  private authTokenCache: AuthTokenCache = {};
  private axiosInstance: AxiosInstance;
  private isRefreshingToken: boolean = false;
  private pendingRequests: PendingRequest[] = [];
  private failedRefreshCount: Record<string, number> = {}; // счетчик неудачных попыток обновления токена
  private maxRefreshAttempts: number = 3; // максимальное количество попыток обновления токена

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.DIRECTUS_URL;
    
    // Создаем Axios инстанс
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      // Увеличиваем таймаут для стабильности при медленных соединениях
      timeout: 15000,
    });

    // Добавляем интерцептор для автоматического обновления токенов
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Сбрасываем счетчик неудачных попыток при успешном запросе
        if (response.config.headers?.Authorization) {
          const token = response.config.headers.Authorization.toString().replace('Bearer ', '');
          const userId = this.findUserIdByToken(token);
          if (userId) {
            this.failedRefreshCount[userId] = 0;
          }
        }
        return response;
      },
      async (error: AxiosError) => {
        // Получаем конфигурацию запроса
        const originalConfig = error.config;
        
        // Логируем ошибку для отладки
        if (error.response) {
          log(`Directus API Error: ${error.response.status} - ${error.response.statusText} - ${originalConfig?.url}`, 'directus');
        } else {
          log(`Directus API Error: ${error.message} - ${originalConfig?.url}`, 'directus');
        }
        
        // Если ошибка 401 (Unauthorized) и запрос не связан с авторизацией
        if (
          error.response?.status === 401 && 
          originalConfig && 
          !originalConfig.url?.includes('/auth/login') && 
          !originalConfig.url?.includes('/auth/refresh') &&
          originalConfig.headers
        ) {
          try {
            // Получаем токен из заголовка Authorization
            const token = originalConfig.headers.Authorization?.toString().replace('Bearer ', '');
            if (!token) {
              log('Нет токена в заголовке запроса при получении 401 ошибки', 'directus');
              return Promise.reject(error);
            }
            
            // Находим userId по токену
            const userId = this.findUserIdByToken(token);
            if (!userId) {
              log('Не удалось определить пользователя по токену при 401 ошибке', 'directus');
              return Promise.reject(error);
            }
            
            // Проверяем, не превышено ли количество попыток обновления токена
            if (this.failedRefreshCount[userId] && this.failedRefreshCount[userId] >= this.maxRefreshAttempts) {
              log(`Превышено максимальное количество попыток обновления токена для пользователя ${userId}`, 'directus');
              // Очищаем кэш токена для этого пользователя
              this.clearAuthTokenCache(userId);
              return Promise.reject(error);
            }
            
            // Пытаемся обновить токен
            if (!this.isRefreshingToken) {
              this.isRefreshingToken = true;
              
              // Создаем новый запрос на обновление токена
              try {
                // Для обновления токена нам нужен refresh_token
                // Используем событие, которое будет обработано в directusAuthManager
                log(`Запрос на обновление токена для пользователя ${userId}`, 'directus');
                
                // Здесь нам нужно уведомить систему о необходимости обновить токен
                // Это будет сделано через глобальное событие, которое обрабатывается в DirectusAuthManager
                if (global.directusEventEmitter) {
                  global.directusEventEmitter.emit('refresh-token-needed', userId);
                }
                
                // Добавляем запрос в список ожидающих
                return new Promise((resolve, reject) => {
                  this.pendingRequests.push({
                    resolve,
                    reject,
                    config: originalConfig
                  });
                });
              } catch (refreshError) {
                log(`Ошибка при попытке обновить токен: ${refreshError}`, 'directus');
                this.isRefreshingToken = false;
                
                // Увеличиваем счетчик неудачных попыток
                this.failedRefreshCount[userId] = (this.failedRefreshCount[userId] || 0) + 1;
                
                // Если превышено максимальное количество попыток, сбрасываем кэш
                if (this.failedRefreshCount[userId] >= this.maxRefreshAttempts) {
                  this.clearAuthTokenCache(userId);
                }
                
                return Promise.reject(error);
              }
            } else {
              // Если процесс обновления токена уже идет, добавляем запрос в очередь
              return new Promise((resolve, reject) => {
                this.pendingRequests.push({
                  resolve,
                  reject,
                  config: originalConfig
                });
              });
            }
          } catch (error) {
            log(`Ошибка при обработке 401 в интерцепторе: ${error}`, 'directus');
            return Promise.reject(error);
          }
        }
        
        // Для всех остальных ошибок просто возвращаем отклоненный промис
        return Promise.reject(error);
      }
    );
  }

  /**
   * Выполняет запрос к Directus API с возможностью автоматического добавления токена авторизации
   * @param config Конфигурация запроса
   * @param userId ID пользователя для автоматической подстановки токена
   * @returns Результат запроса
   */
  async request(config: AxiosRequestConfig, userId?: string): Promise<any> {
    // Если предоставлен userId и у нас есть кэшированный токен, используем его
    if (userId && this.authTokenCache[userId]?.token) {
      const cachedAuth = this.authTokenCache[userId];
      
      // Проверяем, не истек ли токен
      if (cachedAuth.expiresAt > Date.now()) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${cachedAuth.token}`
        };
        log(`Используем кэшированный токен для пользователя ${userId}`, 'directus');
      } else {
        log(`Токен для пользователя ${userId} истек, удаляем из кэша`, 'directus');
        delete this.authTokenCache[userId];
      }
    }
    
    return this.axiosInstance(config);
  }

  /**
   * Сохраняет токен авторизации в кэше
   * @param userId ID пользователя
   * @param token Токен авторизации
   * @param expiresIn Время жизни токена в секундах
   * @param refreshToken Токен обновления (опционально)
   */
  cacheAuthToken(userId: string, token: string, expiresIn: number = 3600, refreshToken?: string): void {
    this.authTokenCache[userId] = {
      token,
      expiresAt: Date.now() + (expiresIn * 1000),
      refreshToken
    };
    // Сбрасываем счетчик неудачных попыток при успешном кэшировании токена
    this.failedRefreshCount[userId] = 0;
    log(`Токен авторизации для пользователя ${userId} сохранен в кэше`, 'directus');
  }

  /**
   * Очищает кэш токенов авторизации для пользователя
   * @param userId ID пользователя
   */
  clearAuthTokenCache(userId: string): void {
    if (this.authTokenCache[userId]) {
      delete this.authTokenCache[userId];
      log(`Кэш токенов авторизации для пользователя ${userId} очищен`, 'directus');
    }
  }
  
  /**
   * Обрабатывает успешное обновление токена
   * @param userId ID пользователя
   * @param newToken Новый токен авторизации 
   * @param refreshToken Новый токен обновления
   * @param expiresIn Время жизни в секундах
   */
  handleTokenRefreshed(userId: string, newToken: string, refreshToken: string, expiresIn: number): void {
    // Обновляем кэшированный токен
    this.cacheAuthToken(userId, newToken, expiresIn, refreshToken);
    
    // Сбрасываем флаг обновления
    this.isRefreshingToken = false;
    
    // Обрабатываем все ожидающие запросы с новым токеном
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];
    
    log(`Обработка ${requests.length} ожидающих запросов с обновленным токеном`, 'directus');
    
    requests.forEach(request => {
      // Обновляем токен в заголовке запроса
      request.config.headers = {
        ...request.config.headers,
        'Authorization': `Bearer ${newToken}`
      };
      
      // Отправляем запрос заново
      this.axiosInstance(request.config)
        .then(response => request.resolve(response))
        .catch(error => request.reject(error));
    });
  }
  
  /**
   * Обрабатывает ошибку обновления токена
   * @param userId ID пользователя 
   * @param error Ошибка обновления
   */
  handleTokenRefreshFailed(userId: string, error: any): void {
    // Увеличиваем счетчик неудачных попыток
    this.failedRefreshCount[userId] = (this.failedRefreshCount[userId] || 0) + 1;
    
    // Сбрасываем флаг обновления
    this.isRefreshingToken = false;
    
    log(`Не удалось обновить токен для пользователя ${userId}. Попытка ${this.failedRefreshCount[userId]} из ${this.maxRefreshAttempts}`, 'directus');
    
    // Если превышено максимальное количество попыток, очищаем кэш
    if (this.failedRefreshCount[userId] >= this.maxRefreshAttempts) {
      log(`Превышено максимальное количество попыток обновления токена для пользователя ${userId}. Очищаем кэш.`, 'directus');
      this.clearAuthTokenCache(userId);
    }
    
    // Отклоняем все ожидающие запросы
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];
    
    requests.forEach(request => {
      request.reject(error);
    });
  }
  
  /**
   * Находит userId по токену, просматривая кэш авторизации
   * @param token Токен для поиска
   * @returns ID пользователя или undefined, если не найден
   */
  findUserIdByToken(token: string): string | undefined {
    for (const userId in this.authTokenCache) {
      if (this.authTokenCache[userId].token === token) {
        return userId;
      }
    }
    return undefined;
  }

  /**
   * Получает базовый Axios инстанс для прямого использования
   */
  get instance(): AxiosInstance {
    return this.axiosInstance;
  }
  
  /**
   * Выполняет GET-запрос к Directus API
   * @param url Путь запроса
   * @param config Дополнительная конфигурация запроса
   * @returns Результат запроса
   */
  async get(url: string, config?: AxiosRequestConfig): Promise<any> {
    return this.request({
      method: 'GET',
      url,
      ...config
    });
  }
  
  /**
   * Выполняет POST-запрос к Directus API
   * @param url Путь запроса
   * @param data Данные для отправки
   * @param config Дополнительная конфигурация запроса
   * @returns Результат запроса
   */
  async post(url: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
    return this.request({
      method: 'POST',
      url,
      data,
      ...config
    });
  }
  
  /**
   * Получает токен из кэша для заданного пользователя
   * @param userId ID пользователя
   * @returns Объект с токеном, refreshToken и датой истечения, или null если токен не найден
   */
  getCachedToken(userId: string): { token: string; refreshToken?: string; expiresAt: number } | null {
    if (this.authTokenCache[userId]) {
      // Если токен еще действителен, возвращаем его
      if (this.authTokenCache[userId].expiresAt > Date.now()) {
        return this.authTokenCache[userId];
      } 
      // Даже если токен истек, но у нас есть refreshToken, возвращаем все данные
      // Это позволит вызывающему коду решить, обновлять токен или нет
      else if (this.authTokenCache[userId].refreshToken) {
        return this.authTokenCache[userId];
      }
      // Если токен истек и нет refreshToken, удаляем его из кэша
      else {
        log(`Токен для пользователя ${userId} истек и не имеет refreshToken, удаляем из кэша`, 'directus');
        delete this.authTokenCache[userId];
      }
    }
    return null;
  }
  
  /**
   * Получает токен администратора для системных операций
   * @returns Токен администратора или null в случае ошибки
   */
  async getAdminToken(): Promise<string | null> {
    try {
      const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL;
      const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD;
      const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;

      // Если есть готовый токен в переменных окружения, используем его
      if (adminToken) {
        log('Использую токен администратора из переменных окружения', 'directus');
        return adminToken;
      }

      if (!adminEmail || !adminPassword) {
        log('Отсутствуют учетные данные администратора в переменных окружения', 'directus');
        return null;
      }

      const response = await this.axiosInstance.post('/auth/login', {
        email: adminEmail,
        password: adminPassword
      });

      if (response.data?.data?.access_token) {
        log('Получен административный токен через авторизацию', 'directus');
        return response.data.data.access_token;
      }

      log('Неверный формат ответа при получении административного токена', 'directus');
      return null;
    } catch (error: any) {
      log(`Ошибка при получении административного токена: ${error.message}`, 'directus');
      return null;
    }
  }

  /**
   * Возвращает axios инстанс для работы с Directus API
   * @returns Axios инстанс
   */
  getDirectusClient(): AxiosInstance {
    return this.axiosInstance;
  }
}

// Создаем экземпляр менеджера Directus API
const directusApiManager = new DirectusApiManager();

// Экспортируем базовый Axios инстанс для обратной совместимости
export const directusApi = directusApiManager.instance;

// Экспортируем менеджер для расширенных возможностей
export { directusApiManager };

export default directusApi;