/**
 * Сервис для обновления YouTube OAuth токенов
 */
import axios from 'axios';
import { log } from '../utils/logger';

export interface YouTubeTokens {
  accessToken: string;
  refreshToken?: string; // Может не прийти новый
  expiresIn: number;
  expiresAt: number;
}

export class YouTubeTokenRefresh {
  private clientId = process.env.GOOGLE_CLIENT_ID;
  private clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  /**
   * Обновляет access token через refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<YouTubeTokens> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET должны быть настроены');
    }

    if (!refreshToken) {
      throw new Error('Refresh token не предоставлен');
    }

    try {
      log(`Обновление YouTube access token через refresh token`, 'youtube-auth');
      
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const data = response.data;
      
      if (!data.access_token) {
        throw new Error('Не удалось получить новый access token');
      }

      const expiresIn = data.expires_in || 3600; // По умолчанию 1 час
      const expiresAt = Date.now() + (expiresIn * 1000);

      log(`YouTube access token успешно обновлен, истекает через ${expiresIn} секунд`, 'youtube-auth');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Используем старый, если новый не пришел
        expiresIn: expiresIn,
        expiresAt: expiresAt
      };

    } catch (error: any) {
      if (error.response?.data?.error) {
        const errorData = error.response.data;
        log(`Ошибка обновления YouTube токена: ${errorData.error} - ${errorData.error_description}`, 'youtube-auth');
        
        if (errorData.error === 'invalid_grant') {
          throw new Error('Refresh token истек или недействителен. Требуется повторная авторизация');
        }
      }
      
      log(`Ошибка при обновлении YouTube токена: ${error.message}`, 'youtube-auth');
      throw error;
    }
  }

  /**
   * Проверяет, нужно ли обновить токен (за 5 минут до истечения)
   */
  shouldRefreshToken(expiresAt: number): boolean {
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    return expiresAt < fiveMinutesFromNow;
  }

  /**
   * Автоматически обновляет токен если нужно
   */
  async refreshIfNeeded(currentTokens: { accessToken: string; refreshToken: string; expiresAt: number }): Promise<YouTubeTokens | null> {
    if (!this.shouldRefreshToken(currentTokens.expiresAt)) {
      return null; // Обновление не требуется
    }

    log(`YouTube токен истекает, автоматическое обновление...`, 'youtube-auth');
    return await this.refreshAccessToken(currentTokens.refreshToken);
  }
}