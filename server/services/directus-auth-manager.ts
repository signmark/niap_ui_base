import { directusCrud } from './directus-crud';
import { directusApiManager } from '../directus';
import { DirectusAuthResult, DirectusUser } from './directus-types';
import { log } from '../utils/logger';
import { EventEmitter } from 'events';

/**
 * Информация о токене и пользователе
 */
interface SessionInfo {
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
  user?: DirectusUser;
}

// Создаем глобальный эмиттер событий для коммуникации между компонентами
if (!global.directusEventEmitter) {
  global.directusEventEmitter = new EventEmitter();
  // Увеличиваем лимит слушателей, так как у нас может быть много компонентов,
  // подписанных на события авторизации
  global.directusEventEmitter.setMaxListeners(50);
}

/**
 * Менеджер авторизации и сессий пользователей для Directus
 */
export class DirectusAuthManager {
  private logPrefix: string = 'directus-auth';
  private sessionCache: Record<string, SessionInfo> = {};
  private sessionRefreshIntervalMs: number = 5 * 60 * 1000; // 5 минут
  private sessionRefreshIntervalId?: NodeJS.Timeout;
  private refreshingTokens: Set<string> = new Set(); // Отслеживание активных обновлений токенов
  private maxRefreshAttempts: number = 3; // Максимальное количество попыток обновления
  private refreshAttempts: Record<string, number> = {}; // Счетчики попыток по пользователям
  
  constructor() {
    log('DirectusAuthManager initialized', this.logPrefix);
    this.startSessionRefreshInterval();
    this.setupEventListeners();
  }
  
  /**
   * Настраивает слушатели событий для взаимодействия с другими компонентами
   */
  private setupEventListeners(): void {
    // Обработка запросов на обновление токена от directusApiManager
    global.directusEventEmitter.on('refresh-token-needed', async (userId: string) => {
      log(`Получено событие refresh-token-needed для пользователя ${userId}`, this.logPrefix);
      
      // Проверяем, не обрабатывается ли уже запрос на обновление токена для этого пользователя
      if (this.refreshingTokens.has(userId)) {
        log(`Обновление токена для пользователя ${userId} уже в процессе`, this.logPrefix);
        return;
      }
      
      // Проверяем, не превышено ли количество попыток обновления
      if (this.refreshAttempts[userId] && this.refreshAttempts[userId] >= this.maxRefreshAttempts) {
        log(`Превышено максимальное количество попыток обновления токена для пользователя ${userId}`, this.logPrefix);
        
        // Уведомляем систему о неудачном обновлении токена
        directusApiManager.handleTokenRefreshFailed(userId, new Error('Превышено максимальное количество попыток обновления токена'));
        
        // Сбрасываем кэш токена
        delete this.sessionCache[userId];
        directusApiManager.clearAuthTokenCache(userId);
        
        // Сбрасываем счетчик попыток
        delete this.refreshAttempts[userId];
        return;
      }
      
      // Отмечаем, что начали обрабатывать запрос на обновление токена
      this.refreshingTokens.add(userId);
      
      try {
        // Получаем текущую сессию
        const sessionInfo = this.sessionCache[userId];
        
        if (!sessionInfo) {
          log(`Нет сохраненной сессии для пользователя ${userId}`, this.logPrefix);
          throw new Error('Нет сохраненной сессии');
        }
        
        // Если сессия не имеет refreshToken, пробуем выполнить полную аутентификацию
        if (!sessionInfo.refreshToken) {
          log(`Отсутствует refresh token для пользователя ${userId}, попытка повторной авторизации`, this.logPrefix);
          
          // Пробуем получить токен админа, если userId совпадает с админским
          if (process.env.DIRECTUS_ADMIN_EMAIL && this.isAdminId(userId)) {
            log(`Попытка получить токен администратора для пользователя ${userId}`, this.logPrefix);
            const adminSession = await this.getAdminSession();
            
            if (adminSession) {
              // Уведомляем систему об успешном обновлении токена
              directusApiManager.handleTokenRefreshed(
                userId,
                adminSession.token,
                '', // Нет refresh token для админа
                24 * 60 * 60 // 24 часа
              );
              
              // Удаляем пользователя из списка обрабатываемых
              this.refreshingTokens.delete(userId);
              
              // Сбрасываем счетчик попыток
              delete this.refreshAttempts[userId];
              
              return;
            }
          }
          
          // Если не удалось получить токен админа или это не админский userId,
          // сообщаем о неудаче
          directusApiManager.handleTokenRefreshFailed(userId, new Error('Отсутствует refresh token'));
          
          // Удаляем пользователя из списка обрабатываемых
          this.refreshingTokens.delete(userId);
          
          // Увеличиваем счетчик попыток
          this.refreshAttempts[userId] = (this.refreshAttempts[userId] || 0) + 1;
          
          return;
        }
        
        // Обновляем токен с помощью refresh token
        log(`Обновление токена для пользователя ${userId} с помощью refresh token`, this.logPrefix);
        const refreshResult = await directusCrud.refreshToken(sessionInfo.refreshToken);
        
        // Обновляем информацию о сессии
        this.sessionCache[userId] = {
          ...sessionInfo,
          token: refreshResult.access_token,
          refreshToken: refreshResult.refresh_token,
          expiresAt: Date.now() + (refreshResult.expires * 1000)
        };
        
        // Обновляем кэш в Directus API Manager
        directusApiManager.cacheAuthToken(
          userId, 
          refreshResult.access_token, 
          refreshResult.expires, 
          refreshResult.refresh_token
        );
        
        // Уведомляем систему об успешном обновлении токена
        directusApiManager.handleTokenRefreshed(
          userId,
          refreshResult.access_token,
          refreshResult.refresh_token,
          refreshResult.expires
        );
        
        // Сбрасываем счетчик попыток
        delete this.refreshAttempts[userId];
        
        log(`Токен для пользователя ${userId} успешно обновлен`, this.logPrefix);
      } catch (error) {
        log(`Ошибка при обновлении токена для пользователя ${userId}: ${error}`, this.logPrefix);
        
        // Увеличиваем счетчик попыток
        this.refreshAttempts[userId] = (this.refreshAttempts[userId] || 0) + 1;
        
        // Уведомляем систему о неудачном обновлении токена
        directusApiManager.handleTokenRefreshFailed(userId, error);
        
        // Если превышено максимальное количество попыток, сбрасываем кэш
        if (this.refreshAttempts[userId] >= this.maxRefreshAttempts) {
          log(`Превышено максимальное количество попыток обновления токена для пользователя ${userId}`, this.logPrefix);
          delete this.sessionCache[userId];
          directusApiManager.clearAuthTokenCache(userId);
          delete this.refreshAttempts[userId];
        }
      } finally {
        // В любом случае удаляем пользователя из списка обрабатываемых
        this.refreshingTokens.delete(userId);
      }
    });
  }
  
  /**
   * Проверяет, является ли указанный userId идентификатором администратора
   * @param userId ID пользователя для проверки
   * @returns true, если это ID администратора
   */
  private isAdminId(userId: string): boolean {
    // Если в кэше сессий есть пользователь с таким ID и он помечен как администратор
    if (this.sessionCache[userId]?.user?.role === 'admin') {
      return true;
    }
    
    // Проверяем, совпадает ли ID с полученным ранее ID администратора
    // (в зависимости от логики вашего приложения этот метод может быть расширен)
    return false;
  }

  /**
   * Авторизует пользователя и сохраняет информацию о сессии
   * @param email Email пользователя
   * @param password Пароль пользователя
   * @returns Информация о пользователе и токене
   */
  async login(email: string, password: string): Promise<{
    userId: string;
    token: string;
    refreshToken: string;
    user: DirectusUser;
  }> {
    try {
      log(`Attempting to log in user: ${email}`, this.logPrefix);
      
      const authResult = await directusCrud.login(email, password);
      
      // Получаем информацию о пользователе
      const user = await directusCrud.getCurrentUser({
        authToken: authResult.access_token
      });
      
      // Кэшируем сессию
      this.sessionCache[user.id] = {
        userId: user.id,
        token: authResult.access_token,
        refreshToken: authResult.refresh_token,
        expiresAt: Date.now() + (authResult.expires * 1000),
        user
      };
      
      // Кэшируем токен в Directus API Manager для обратной совместимости
      directusApiManager.cacheAuthToken(user.id, authResult.access_token, authResult.expires);
      
      log(`User ${email} (${user.id}) successfully logged in`, this.logPrefix);
      
      return {
        userId: user.id,
        token: authResult.access_token,
        refreshToken: authResult.refresh_token,
        user
      };
    } catch (error) {
      log(`Error during login for user ${email}: ${(error as Error).message}`, this.logPrefix);
      throw new Error(`Failed to login: ${(error as Error).message}`);
    }
  }

  /**
   * Обновляет токен пользователя по refresh token
   * @param userId ID пользователя
   * @returns Обновленная информация о токене
   */
  async refreshSession(userId: string): Promise<{ token: string; expiresAt: number } | null> {
    // Проверяем, не обрабатывается ли уже запрос на обновление токена для этого пользователя
    if (this.refreshingTokens.has(userId)) {
      log(`Обновление токена для пользователя ${userId} уже в процессе`, this.logPrefix);
      return null;
    }
    
    // Проверяем, не превышено ли количество попыток обновления
    if (this.refreshAttempts[userId] && this.refreshAttempts[userId] >= this.maxRefreshAttempts) {
      log(`Превышено максимальное количество попыток обновления токена для пользователя ${userId}`, this.logPrefix);
      
      // В случае превышения лимита попыток, удаляем сессию и очищаем счетчик
      delete this.sessionCache[userId];
      directusApiManager.clearAuthTokenCache(userId);
      delete this.refreshAttempts[userId];
      
      return null;
    }
    
    // Отмечаем, что начали обрабатывать запрос на обновление токена
    this.refreshingTokens.add(userId);
    
    try {
      const sessionInfo = this.sessionCache[userId];
      
      if (!sessionInfo || !sessionInfo.refreshToken) {
        log(`No refresh token available for user ${userId}`, this.logPrefix);
        
        // Если это админский ID, пробуем получить сессию администратора
        if (this.isAdminId(userId)) {
          log(`Попытка получить токен администратора для пользователя ${userId}`, this.logPrefix);
          const adminSession = await this.getAdminSession();
          
          if (adminSession) {
            // Уведомляем систему об успешном обновлении токена
            directusApiManager.handleTokenRefreshed(
              userId,
              adminSession.token,
              '', // Нет refresh token для админа
              24 * 60 * 60 // 24 часа
            );
            
            // Создаем новую сессию в кэше
            this.sessionCache[userId] = {
              userId,
              token: adminSession.token,
              refreshToken: '',
              expiresAt: Date.now() + (24 * 60 * 60 * 1000),
              user: {
                id: userId,
                email: process.env.DIRECTUS_ADMIN_EMAIL || 'admin@example.com',
                first_name: 'Admin',
                last_name: 'User',
                role: 'admin'
              }
            };
            
            // Сбрасываем счетчик попыток
            delete this.refreshAttempts[userId];
            
            return {
              token: adminSession.token,
              expiresAt: Date.now() + (24 * 60 * 60 * 1000)
            };
          }
        }
        
        // Если не удалось получить токен админа или это не админский userId,
        // увеличиваем счетчик неудачных попыток
        this.refreshAttempts[userId] = (this.refreshAttempts[userId] || 0) + 1;
        
        return null;
      }
      
      log(`Refreshing session for user ${userId}`, this.logPrefix);
      
      const authResult = await directusCrud.refreshToken(sessionInfo.refreshToken);
      
      // Обновляем информацию о сессии
      this.sessionCache[userId] = {
        ...sessionInfo,
        token: authResult.access_token,
        refreshToken: authResult.refresh_token,
        expiresAt: Date.now() + (authResult.expires * 1000)
      };
      
      // Обновляем кэш в Directus API Manager с обновленным refresh token
      directusApiManager.cacheAuthToken(
        userId, 
        authResult.access_token, 
        authResult.expires, 
        authResult.refresh_token
      );
      
      // Сбрасываем счетчик попыток
      delete this.refreshAttempts[userId];
      
      log(`Session for user ${userId} successfully refreshed`, this.logPrefix);
      
      return {
        token: authResult.access_token,
        expiresAt: Date.now() + (authResult.expires * 1000)
      };
    } catch (error) {
      log(`Error refreshing session for user ${userId}: ${(error as Error).message}`, this.logPrefix);
      
      // Увеличиваем счетчик неудачных попыток
      this.refreshAttempts[userId] = (this.refreshAttempts[userId] || 0) + 1;
      
      // Если превышено максимальное количество попыток, удаляем сессию
      if (this.refreshAttempts[userId] >= this.maxRefreshAttempts) {
        log(`Превышено максимальное количество попыток обновления токена для пользователя ${userId}. Очищаем кэш.`, this.logPrefix);
        delete this.sessionCache[userId];
        directusApiManager.clearAuthTokenCache(userId);
        delete this.refreshAttempts[userId];
      }
      
      return null;
    } finally {
      // В любом случае удаляем пользователя из списка обрабатываемых
      this.refreshingTokens.delete(userId);
    }
  }

  /**
   * Получает текущую сессию пользователя
   * @param userId ID пользователя
   * @returns Информация о сессии или null, если сессия не найдена
   */
  getSession(userId: string): SessionInfo | null {
    const session = this.sessionCache[userId];
    
    if (!session) {
      return null;
    }
    
    // Проверяем, не истек ли токен
    if (session.expiresAt <= Date.now()) {
      log(`Session for user ${userId} has expired`, this.logPrefix);
      return null;
    }
    
    return session;
  }

  /**
   * Получает токен авторизации для пользователя
   * @param userId ID пользователя
   * @param autoRefresh Автоматически обновлять токен, если он истек
   * @returns Токен авторизации или null, если токен не найден
   */
  async getAuthToken(userId: string, autoRefresh: boolean = true): Promise<string | null> {
    // Проверяем, есть ли действующая сессия в кэше
    const session = this.getSession(userId);
    
    if (session) {
      log(`Found valid session for user ${userId}`, this.logPrefix);
      return session.token;
    }
    
    // Проверяем, есть ли токен в directusApiManager
    let cachedToken = null;
    
    try {
      cachedToken = directusApiManager.getCachedToken(userId);
      
      if (cachedToken) {
        // Если токен все еще действителен
        if (cachedToken.expiresAt > Date.now()) {
          log(`Found valid token in directusApiManager cache for user ${userId}`, this.logPrefix);
          
          // Кэшируем его локально для будущих вызовов
          this.sessionCache[userId] = {
            userId,
            token: cachedToken.token,
            refreshToken: cachedToken.refreshToken || '', // Добавляем refreshToken если он есть
            expiresAt: cachedToken.expiresAt,
            user: undefined
          };
          
          return cachedToken.token;
        }
        // Если токен истек, но есть refresh token - возможно потребуется обновление
        else if (cachedToken.refreshToken) {
          log(`Found expired token with refresh token in directusApiManager cache for user ${userId}`, this.logPrefix);
          
          // Кэшируем его локально для будущих вызовов и обновления
          this.sessionCache[userId] = {
            userId,
            token: cachedToken.token,
            refreshToken: cachedToken.refreshToken,
            expiresAt: cachedToken.expiresAt,
            user: undefined
          };
          
          // Здесь мы не возвращаем токен, а продолжаем выполнение,
          // чтобы запустить процесс обновления если autoRefresh=true
        }
      }
    } catch (error) {
      log(`Error when trying to get token from directusApiManager: ${error}`, this.logPrefix);
    }
    
    // Если требуется автоматическое обновление и у нас есть кэш, который можно обновить
    if (autoRefresh) {
      // Проверяем, не запущен ли уже процесс обновления токена
      if (this.refreshingTokens.has(userId)) {
        log(`Token refresh for user ${userId} is already in progress, waiting...`, this.logPrefix);
        
        // Создаем промис, который разрешится, когда обновление завершится
        const refreshPromise = new Promise<string | null>((resolve) => {
          // Создаем обработчик события обновления токена
          const refreshHandler = (refreshedUserId: string, success: boolean, token: string) => {
            if (refreshedUserId === userId) {
              // Удаляем обработчик, чтобы избежать утечек памяти
              global.directusEventEmitter.off('token-refreshed', refreshHandler);
              
              if (success) {
                resolve(token);
              } else {
                resolve(null);
              }
            }
          };
          
          // Устанавливаем таймаут для предотвращения бесконечного ожидания
          const timeoutId = setTimeout(() => {
            global.directusEventEmitter.off('token-refreshed', refreshHandler);
            log(`Token refresh timeout for user ${userId}`, this.logPrefix);
            resolve(null);
          }, 10000); // 10 секунд таймаут
          
          // Подписываемся на событие обновления токена
          global.directusEventEmitter.once('token-refreshed', refreshHandler);
        });
        
        return refreshPromise;
      }
      
      log(`No valid session found, attempting to refresh for user ${userId}`, this.logPrefix);
      
      // Инициируем процесс обновления токена
      const refreshedSession = await this.refreshSession(userId);
      
      if (refreshedSession) {
        // Оповещаем о успешном обновлении токена
        global.directusEventEmitter.emit('token-refreshed', userId, true, refreshedSession.token);
        return refreshedSession.token;
      } else {
        // Если у нас есть пользователь админ, пробуем получить новую сессию для него
        if (process.env.DIRECTUS_ADMIN_EMAIL && this.isAdminId(userId)) {
          log(`Attempting to get a new admin session for user ${userId}`, this.logPrefix);
          const adminSession = await this.getAdminSession();
          
          if (adminSession) {
            global.directusEventEmitter.emit('token-refreshed', userId, true, adminSession.token);
            return adminSession.token;
          }
        }
        
        // Оповещаем о неудачном обновлении токена
        global.directusEventEmitter.emit('token-refreshed', userId, false, '');
      }
    }
    
    log(`No valid token found for user ${userId}`, this.logPrefix);
    return null;
  }

  /**
   * Завершает сессию пользователя
   * @param userId ID пользователя
   */
  logout(userId: string): void {
    if (this.sessionCache[userId]) {
      delete this.sessionCache[userId];
      directusApiManager.clearAuthTokenCache(userId);
      log(`Session for user ${userId} terminated`, this.logPrefix);
    }
  }

  /**
   * Проверяет и обновляет истекающие сессии
   */
  private async refreshExpiringSessions(): Promise<void> {
    log('Checking for expiring sessions', this.logPrefix);
    
    const now = Date.now();
    const expirationThreshold = now + (30 * 60 * 1000); // 30 минут до истечения
    
    for (const userId in this.sessionCache) {
      const session = this.sessionCache[userId];
      
      // Если сессия истекает в ближайшие 30 минут, обновляем её
      if (session.expiresAt < expirationThreshold) {
        log(`Session for user ${userId} is expiring soon, refreshing`, this.logPrefix);
        await this.refreshSession(userId);
      }
    }
  }

  /**
   * Запускает интервал обновления сессий
   */
  private startSessionRefreshInterval(): void {
    if (this.sessionRefreshIntervalId) {
      clearInterval(this.sessionRefreshIntervalId);
    }
    
    this.sessionRefreshIntervalId = setInterval(
      () => this.refreshExpiringSessions(),
      this.sessionRefreshIntervalMs
    );
    
    log(`Session refresh interval started (${this.sessionRefreshIntervalMs}ms)`, this.logPrefix);
  }

  /**
   * Получает все активные сессии пользователей
   * @returns Массив информации об активных сессиях
   */
  getAllActiveSessions(): { userId: string; token: string; expiresAt: number }[] {
    const now = Date.now();
    const activeSessions: { userId: string; token: string; expiresAt: number }[] = [];
    
    for (const userId in this.sessionCache) {
      const session = this.sessionCache[userId];
      
      // Проверяем, что сессия действительна
      if (session.expiresAt > now) {
        activeSessions.push({
          userId: session.userId,
          token: session.token,
          expiresAt: session.expiresAt
        });
      }
    }
    
    log(`Found ${activeSessions.length} active sessions`, this.logPrefix);
    return activeSessions;
  }
  
  /**
   * Добавляет сессию администратора в кэш
   * @param session Данные о сессии администратора
   */
  addAdminSession(session: { id: string; token: string; email?: string }): void {
    const userId = session.id;
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 часа
    
    this.sessionCache[userId] = {
      userId,
      token: session.token,
      refreshToken: '',
      expiresAt,
      user: {
        id: userId,
        email: session.email || 'admin@example.com',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      }
    };
    
    // Также сохраняем в кэше API менеджера
    directusApiManager.cacheAuthToken(userId, session.token, expiresAt);
    
    log(`Admin session for user ${userId} added to cache`, this.logPrefix);
  }
  
  /**
   * Интерфейс для авторизации администратора и получения токена
   * @returns Результат авторизации
   */
  async loginAdmin(): Promise<{ success: boolean; token?: string }> {
    try {
      const session = await this.getAdminSession();
      if (!session) {
        return { success: false };
      }
      return { success: true, token: session.token };
    } catch (error) {
      log(`Error during admin login: ${(error as Error).message}`, this.logPrefix);
      return { success: false };
    }
  }

  /**
   * Получает сессию администратора для API запросов
   * @returns Информация о сессии администратора или null, если не удалось получить
   */
  async getAdminSession(): Promise<{ token: string; id: string } | null> {
    try {
      // Пытаемся авторизоваться с учетными данными администратора
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      
      if (!email || !password) {
        log('Missing DIRECTUS_ADMIN_EMAIL or DIRECTUS_ADMIN_PASSWORD environment variables', this.logPrefix);
        return null;
      }
      
      log(`Attempting to login as admin (${email})`, this.logPrefix);
      
      const authResult = await directusCrud.login(email, password);
      
      // Получаем информацию о пользователе администратора
      const adminUser = await directusCrud.getCurrentUser({
        authToken: authResult.access_token
      });
      
      // Сохраняем сессию в кэше
      this.addAdminSession({
        id: adminUser.id,
        token: authResult.access_token,
        email: adminUser.email
      });
      
      log(`Admin login successful (${adminUser.id})`, this.logPrefix);
      
      return {
        token: authResult.access_token,
        id: adminUser.id
      };
    } catch (error) {
      log(`Error getting admin session: ${(error as Error).message}`, this.logPrefix);
      return null;
    }
  }

  /**
   * Останавливает интервал обновления сессий
   */
  dispose(): void {
    if (this.sessionRefreshIntervalId) {
      clearInterval(this.sessionRefreshIntervalId);
      this.sessionRefreshIntervalId = undefined;
      log('Session refresh interval stopped', this.logPrefix);
    }
  }
}

// Экспортируем экземпляр менеджера для использования в приложении
export const directusAuthManager = new DirectusAuthManager();