import { directusCrud } from './directus-crud';
import { directusApiManager } from '../directus';
import { DirectusAuthResult, DirectusUser } from './directus-types';
import { log } from '../utils/logger';

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

/**
 * Менеджер авторизации и сессий пользователей для Directus
 */
export class DirectusAuthManager {
  private logPrefix: string = 'directus-auth';
  private sessionCache: Record<string, SessionInfo> = {};
  private sessionRefreshIntervalMs: number = 5 * 60 * 1000; // 5 минут
  private sessionRefreshIntervalId?: NodeJS.Timeout;
  private static instance: DirectusAuthManager;
  
  constructor() {
    log('DirectusAuthManager initialized', this.logPrefix);
    this.startSessionRefreshInterval();
  }
  
  /**
   * Получает единственный экземпляр класса (Singleton pattern)
   * @returns Экземпляр DirectusAuthManager
   */
  public static getInstance(): DirectusAuthManager {
    if (!DirectusAuthManager.instance) {
      DirectusAuthManager.instance = new DirectusAuthManager();
    }
    return DirectusAuthManager.instance;
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
    try {
      const sessionInfo = this.sessionCache[userId];
      
      if (!sessionInfo || !sessionInfo.refreshToken) {
        log(`No refresh token available for user ${userId}`, this.logPrefix);
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
      
      // Обновляем кэш в Directus API Manager для обратной совместимости
      directusApiManager.cacheAuthToken(userId, authResult.access_token, authResult.expires);
      
      log(`Session for user ${userId} successfully refreshed`, this.logPrefix);
      
      return {
        token: authResult.access_token,
        expiresAt: Date.now() + (authResult.expires * 1000)
      };
    } catch (error) {
      log(`Error refreshing session for user ${userId}: ${(error as Error).message}`, this.logPrefix);
      
      // В случае ошибки удаляем сессию
      delete this.sessionCache[userId];
      directusApiManager.clearAuthTokenCache(userId);
      
      return null;
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
    const session = this.getSession(userId);
    
    if (session) {
      log(`Found valid session for user ${userId}`, this.logPrefix);
      return session.token;
    }
    
    // Проверим токен у других компонентов, которые могут его кэшировать
    try {
      // Проверяем, можем ли мы получить токен напрямую из directusApiManager
      // Используем импортированный экземпляр вместо глобального, чтобы избежать ошибок типизации
      if (directusApiManager && typeof directusApiManager.getCachedToken === 'function') {
        const cachedToken = directusApiManager.getCachedToken(userId);
        if (cachedToken) {
          log(`Found token in directusApiManager cache for user ${userId}`, this.logPrefix);
          
          // Кэшируем его локально для будущих вызовов
          this.sessionCache[userId] = {
            userId,
            token: cachedToken.token,
            refreshToken: '', // У нас нет refresh token из кэша API Manager
            expiresAt: cachedToken.expiresAt || (Date.now() + 3600 * 1000),
            user: undefined
          };
          
          return cachedToken.token;
        }
      }
    } catch (error) {
      log(`Error when trying to get token from directusApiManager: ${error}`, this.logPrefix);
    }
    
    if (autoRefresh) {
      log(`No valid session found, attempting to refresh for user ${userId}`, this.logPrefix);
      const refreshedSession = await this.refreshSession(userId);
      
      if (refreshedSession) {
        return refreshedSession.token;
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
   * Получает сессию администратора для системных операций
   * @returns Информация о сессии администратора или null, если не удалось получить токен
   */
  async getAdminSession(): Promise<{ userId: string; token: string } | null> {
    // Получаем ID администратора из переменных окружения
    const adminUserId = process.env.DIRECTUS_ADMIN_USER_ID || '53921f16-f51d-4591-80b9-8caa4fde4d13';
    
    // Проверяем, есть ли уже активная сессия для админа
    const session = this.getSession(adminUserId);
    if (session) {
      log(`Found existing admin session for ${adminUserId}`, this.logPrefix);
      return {
        userId: adminUserId,
        token: session.token
      };
    }
    
    // Пытаемся получить токен из окружения
    const staticToken = process.env.DIRECTUS_ADMIN_TOKEN;
    if (staticToken) {
      log(`Using static admin token from environment variables`, this.logPrefix);
      
      // Сохраняем токен в кэше
      this.sessionCache[adminUserId] = {
        userId: adminUserId,
        token: staticToken,
        refreshToken: '',
        expiresAt: Date.now() + 3600 * 1000, // 1 час
        user: undefined
      };
      
      return {
        userId: adminUserId,
        token: staticToken
      };
    }
    
    // Если нет статического токена, пытаемся авторизоваться
    const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL;
    const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD;
    
    if (adminEmail && adminPassword) {
      try {
        log(`Attempting to login as admin with credentials`, this.logPrefix);
        const loginResult = await this.login(adminEmail, adminPassword);
        
        return {
          userId: loginResult.userId,
          token: loginResult.token
        };
      } catch (error) {
        log(`Failed to login as admin: ${error}`, this.logPrefix);
      }
    }
    
    // Последний вариант - попытаться найти токен в кэше API Manager
    try {
      const cachedToken = directusApiManager.getCachedToken(adminUserId);
      if (cachedToken) {
        log(`Found cached admin token in API Manager`, this.logPrefix);
        return {
          userId: adminUserId,
          token: cachedToken.token
        };
      }
    } catch (error) {
      log(`Error accessing cached admin token: ${error}`, this.logPrefix);
    }
    
    log(`Could not obtain an admin session`, this.logPrefix);
    return null;
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