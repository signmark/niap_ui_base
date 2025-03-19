import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { log } from './vite';

// Создаем кэш для хранения токенов авторизации
interface AuthTokenCache {
  [userId: string]: {
    token: string;
    expiresAt: number;
  };
}

// Класс для управления Directus API запросами
class DirectusApiManager {
  private readonly baseURL: string;
  private authTokenCache: AuthTokenCache = {};
  private axiosInstance: AxiosInstance;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    
    // Создаем Axios инстанс
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Добавляем интерцептор для обработки ошибок
    this.axiosInstance.interceptors.response.use(
      response => response,
      error => {
        console.error('Directus API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            params: error.config?.params
          }
        });
        
        // Детальная информация об ошибке для отладки
        if (error.response?.status === 401) {
          console.error('Directus API error details:', {
            status: error.response.status,
            data: error.response.data,
            config: {
              url: error.config.url,
              method: error.config.method,
              params: error.config.params
            }
          });
          log('Ошибка авторизации при запросе к Directus API', 'directus');
        }
        
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
   */
  cacheAuthToken(userId: string, token: string, expiresIn: number = 3600): void {
    this.authTokenCache[userId] = {
      token,
      expiresAt: Date.now() + (expiresIn * 1000)
    };
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
   * Получает базовый Axios инстанс для прямого использования
   */
  get instance(): AxiosInstance {
    return this.axiosInstance;
  }
  
  /**
   * Получает токен из кэша для заданного пользователя
   * @param userId ID пользователя
   * @returns Объект с токеном и датой истечения, или null если токен не найден
   */
  getCachedToken(userId: string): { token: string; expiresAt: number } | null {
    if (this.authTokenCache[userId] && this.authTokenCache[userId].expiresAt > Date.now()) {
      return this.authTokenCache[userId];
    }
    return null;
  }
}

// Создаем экземпляр менеджера Directus API
const directusApiManager = new DirectusApiManager();

// Экспортируем базовый Axios инстанс для обратной совместимости
export const directusApi = directusApiManager.instance;

// Экспортируем менеджер для расширенных возможностей
export { directusApiManager };

export default directusApi;