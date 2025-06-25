import axios from 'axios';
import { google } from 'googleapis';
import { log } from '../../utils/logger';
import { CampaignContent, SocialMediaSettings } from '@shared/schema';
import { BaseSocialService } from './base-service';

export class YouTubeService extends BaseSocialService {
  constructor() {
    super('youtube');
  }

  async publishContent(
    content: CampaignContent, 
    campaignSettings: SocialMediaSettings,
    userId: string
  ): Promise<{ success: boolean; postUrl?: string; error?: string }> {
    try {
      log('youtube', `Начинаем публикацию в YouTube для контента ${content.id}`);

      const youtubeSettings = campaignSettings.youtube;
      if (!youtubeSettings?.accessToken || !youtubeSettings?.refreshToken) {
        throw new Error('YouTube OAuth tokens not found');
      }

      // Настройка OAuth2 клиента
      const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        process.env.YOUTUBE_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        access_token: youtubeSettings.accessToken,
        refresh_token: youtubeSettings.refreshToken,
      });

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      // Проверяем наличие видео
      if (!content.video_url) {
        throw new Error('Video URL is required for YouTube publishing');
      }

      // Скачиваем видео для загрузки
      log('youtube', `Скачиваем видео: ${content.video_url}`);
      const videoResponse = await axios.get(content.video_url, {
        responseType: 'stream'
      });

      // Подготавливаем метаданные
      const title = content.title || 'Untitled Video';
      const description = this.stripHtml(content.content || '');
      
      // Подготавливаем теги из keywords
      let tags: string[] = [];
      try {
        if (content.keywords && content.keywords !== '[]') {
          const parsedKeywords = JSON.parse(content.keywords);
          if (Array.isArray(parsedKeywords)) {
            tags = parsedKeywords.slice(0, 10); // YouTube ограничение - 10 тегов
          }
        }
      } catch (e) {
        log('youtube', 'Ошибка парсинга keywords, используем пустые теги');
      }

      log('youtube', `Загружаем видео на YouTube: ${title}`);

      // Загружаем видео
      const uploadResponse = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: title.substring(0, 100), // YouTube ограничение
            description: description.substring(0, 5000), // YouTube ограничение
            tags: tags,
            categoryId: '22', // People & Blogs
            defaultLanguage: 'ru',
            defaultAudioLanguage: 'ru'
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false
          }
        },
        media: {
          body: videoResponse.data
        }
      });

      const videoId = uploadResponse.data.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      log('youtube', `Видео успешно загружено на YouTube: ${videoUrl}`);

      return {
        success: true,
        postUrl: videoUrl
      };

    } catch (error: any) {
      log('youtube', `Ошибка публикации в YouTube: ${error.message}`);
      
      // Обработка ошибок OAuth
      if (error.message?.includes('invalid_grant') || error.message?.includes('Token has been expired')) {
        return {
          success: false,
          error: 'YouTube OAuth токены истекли. Требуется повторная авторизация.'
        };
      }

      // Обработка ошибок квот
      if (error.message?.includes('quotaExceeded')) {
        return {
          success: false,
          error: 'Превышена квота YouTube API. Попробуйте позже.'
        };
      }

      return {
        success: false,
        error: `Ошибка YouTube API: ${error.message}`
      };
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }
}