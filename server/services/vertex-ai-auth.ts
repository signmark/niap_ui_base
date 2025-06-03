import { GoogleAuth } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import * as logger from '../utils/logger';

/**
 * Сервис для аутентификации с Google Cloud Vertex AI
 */
export class VertexAIAuth {
  private auth: GoogleAuth | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  
  constructor() {
    this.initializeAuth();
  }
  
  /**
   * Инициализирует Google Auth с сервисным аккаунтом
   */
  private initializeAuth(): void {
    try {
      const serviceAccountPath = path.join(process.cwd(), 'google-service-account.json');
      
      if (fs.existsSync(serviceAccountPath)) {
        // Используем файл сервисного аккаунта
        this.auth = new GoogleAuth({
          keyFile: serviceAccountPath,
          scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        logger.log('[vertex-ai-auth] Аутентификация инициализирована с сервисным аккаунтом', 'gemini');
      } else {
        // Пытаемся использовать переменные окружения
        this.auth = new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        logger.log('[vertex-ai-auth] Аутентификация инициализирована через переменные окружения', 'gemini');
      }
    } catch (error) {
      logger.error(`[vertex-ai-auth] Ошибка инициализации аутентификации: ${(error as Error).message}`, 'gemini');
      this.auth = null;
    }
  }
  
  /**
   * Получает актуальный access token
   * @returns Access token или null если не удалось получить
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.auth) {
      logger.error('[vertex-ai-auth] Аутентификация не инициализирована', 'gemini');
      return null;
    }
    
    try {
      // Проверяем, действителен ли текущий токен
      const now = Date.now();
      if (this.accessToken && this.tokenExpiry > now + 60000) { // 1 минута запас
        return this.accessToken;
      }
      
      // Получаем новый токен
      const client = await this.auth.getClient();
      const accessTokenResponse = await client.getAccessToken();
      
      if (accessTokenResponse.token) {
        this.accessToken = accessTokenResponse.token;
        // Устанавливаем время истечения токена (обычно 1 час)
        this.tokenExpiry = now + (3600 * 1000); // 1 час
        
        logger.log('[vertex-ai-auth] Получен новый access token', 'gemini');
        return this.accessToken;
      }
      
      logger.error('[vertex-ai-auth] Не удалось получить access token', 'gemini');
      return null;
    } catch (error) {
      logger.error(`[vertex-ai-auth] Ошибка получения access token: ${(error as Error).message}`, 'gemini');
      return null;
    }
  }
  
  /**
   * Проверяет доступность аутентификации
   * @returns true если аутентификация работает
   */
  async isAvailable(): Promise<boolean> {
    const token = await this.getAccessToken();
    return token !== null;
  }
}

// Экспортируем глобальный экземпляр
export const vertexAIAuth = new VertexAIAuth();