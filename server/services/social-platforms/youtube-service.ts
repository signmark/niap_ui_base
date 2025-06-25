/**
 * YouTube Data API v3 Service
 * Handles video uploads and publishing to YouTube
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

interface YouTubeConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken?: string;
  refreshToken?: string;
  channelId: string;
}

interface VideoUploadOptions {
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus: 'private' | 'public' | 'unlisted';
  videoFile: Buffer | string; // File path or buffer
  thumbnailFile?: Buffer | string;
}

export class YouTubeService {
  private oauth2Client: OAuth2Client;
  private youtube: any;

  constructor(private config: YouTubeConfig) {
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    if (config.accessToken) {
      this.oauth2Client.setCredentials({
        access_token: config.accessToken,
        refresh_token: config.refreshToken,
      });
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });
  }

  /**
   * Генерирует URL для OAuth авторизации
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.force-ssl'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Заставляет Google запросить refresh token
    });
  }

  /**
   * Обменивает authorization code на токены
   */
  async exchangeCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error('Не удалось получить access token');
      }

      this.oauth2Client.setCredentials(tokens);

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || ''
      };
    } catch (error) {
      console.error('Ошибка при обмене кода на токены:', error);
      throw new Error('Ошибка авторизации YouTube');
    }
  }

  /**
   * Обновляет access token используя refresh token
   */
  async refreshAccessToken(): Promise<string> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      
      if (!credentials.access_token) {
        throw new Error('Не удалось обновить access token');
      }

      return credentials.access_token;
    } catch (error) {
      console.error('Ошибка при обновлении токена:', error);
      throw new Error('Ошибка обновления токена YouTube');
    }
  }

  /**
   * Загружает видео на YouTube
   */
  async uploadVideo(options: VideoUploadOptions): Promise<{ videoId: string; videoUrl: string }> {
    try {
      const videoResource = {
        snippet: {
          title: options.title,
          description: options.description,
          tags: options.tags || [],
          categoryId: options.categoryId || '22', // People & Blogs по умолчанию
          channelId: this.config.channelId
        },
        status: {
          privacyStatus: options.privacyStatus,
        },
      };

      const media = {
        body: typeof options.videoFile === 'string' 
          ? require('fs').createReadStream(options.videoFile)
          : require('stream').Readable.from(options.videoFile)
      };

      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        resource: videoResource,
        media: media,
      });

      const videoId = response.data.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      // Загружаем обложку если предоставлена
      if (options.thumbnailFile && videoId) {
        await this.uploadThumbnail(videoId, options.thumbnailFile);
      }

      return { videoId, videoUrl };
    } catch (error) {
      console.error('Ошибка при загрузке видео на YouTube:', error);
      throw new Error('Ошибка загрузки видео на YouTube');
    }
  }

  /**
   * Загружает обложку для видео
   */
  async uploadThumbnail(videoId: string, thumbnailFile: Buffer | string): Promise<void> {
    try {
      const media = {
        body: typeof thumbnailFile === 'string' 
          ? require('fs').createReadStream(thumbnailFile)
          : require('stream').Readable.from(thumbnailFile)
      };

      await this.youtube.thumbnails.set({
        videoId: videoId,
        media: media,
      });
    } catch (error) {
      console.error('Ошибка при загрузке обложки:', error);
      // Не бросаем ошибку, так как это не критично
    }
  }

  /**
   * Получает информацию о канале
   */
  async getChannelInfo(): Promise<any> {
    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics'],
        id: [this.config.channelId],
      });

      return response.data.items?.[0] || null;
    } catch (error) {
      console.error('Ошибка при получении информации о канале:', error);
      throw new Error('Ошибка получения данных канала');
    }
  }

  /**
   * Проверяет валидность токенов
   */
  async validateTokens(): Promise<boolean> {
    try {
      await this.getChannelInfo();
      return true;
    } catch (error) {
      return false;
    }
  }
}