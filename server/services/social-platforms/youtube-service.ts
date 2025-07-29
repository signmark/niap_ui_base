import axios from 'axios';
import { google } from 'googleapis';
import { log } from '../../utils/logger';
// Типы для YouTube сервиса
interface YouTubeContent {
  id: string;
  title: string;
  content: string;
  video_url: string;
  description?: string;
  videoThumbnail?: string;
  additional_images?: string[];
}
import { BaseSocialService } from './base-service';

export class YouTubeService extends BaseSocialService {
  constructor() {
    super('youtube');
  }

  async publishContent(
    content: any, 
    campaignSettings: any,
    userId: string
  ): Promise<{ success: boolean; postUrl?: string; error?: string; quotaExceeded?: boolean }> {
    try {
      log('youtube', `Начинаем публикацию в YouTube для контента ${content.id}`);
      log('youtube', `Данные контента: ${JSON.stringify(content)}`);

      const youtubeSettings = campaignSettings.youtube;
      log('youtube', `YouTube настройки: ${JSON.stringify(youtubeSettings)}`);
      
      if (!youtubeSettings?.accessToken || !youtubeSettings?.refreshToken) {
        log('youtube', `Отсутствуют YouTube токены. accessToken: ${!!youtubeSettings?.accessToken}, refreshToken: ${!!youtubeSettings?.refreshToken}`);
        throw new Error('YouTube OAuth tokens not found');
      }

      // Настройка OAuth2 клиента
      const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        process.env.YOUTUBE_REDIRECT_URI
      );

      log('youtube', 'Настраиваем OAuth2 клиент и проверяем токены');
      
      oauth2Client.setCredentials({
        access_token: youtubeSettings.accessToken,
        refresh_token: youtubeSettings.refreshToken,
      });

      // ВСЕГДА принудительно обновляем токены перед публикацией
      log('youtube', 'Принудительно обновляем токены для гарантии свежести');
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        log('youtube', 'Токены принудительно обновлены');
        
        // Применяем новые токены немедленно
        oauth2Client.setCredentials({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || youtubeSettings.refreshToken,
        });
        
        // Сохраняем обновленные токены в базу данных
        if (credentials.access_token) {
          log('youtube', 'Сохраняем принудительно обновленные токены в базу данных');
          const updatedSettings = {
            ...campaignSettings.youtube,
            accessToken: credentials.access_token
          };
          
          if (credentials.refresh_token) {
            log('youtube', 'Обновляем также refresh_token при принудительном обновлении');
            updatedSettings.refreshToken = credentials.refresh_token;
          }

          const campaignId = content.campaign_id;
          if (campaignId) {
            const updateResponse = await fetch(`${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                social_media_settings: {
                  ...campaignSettings,
                  youtube: updatedSettings
                }
              })
            });
            
            if (updateResponse.ok) {
              log('youtube', `Принудительно обновленные токены сохранены в кампании ${campaignId}`);
            } else {
              log('youtube', `Ошибка сохранения принудительно обновленных токенов: ${updateResponse.status}`);
            }
          }
        }
        
        log('youtube', 'Токены принудительно обновлены и готовы к использованию');
      } catch (tokenError: any) {
        log('youtube', `Access_token недействителен (${tokenError.message}), обновляем через refresh_token`);
        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          log('youtube', 'Токены успешно обновлены через refresh_token');
          
          // Сохраняем обновленные токены в базу данных
          if (credentials.access_token) {
            log('youtube', 'Сохраняем обновленные токены в базу данных');
            const updatedSettings = {
              ...campaignSettings.youtube,
              accessToken: credentials.access_token
            };
            
            if (credentials.refresh_token) {
              log('youtube', 'Обновляем также refresh_token');
              updatedSettings.refreshToken = credentials.refresh_token;
            }

            const campaignId = content.campaign_id;
            if (campaignId) {
              const updateResponse = await fetch(`${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  social_media_settings: {
                    ...campaignSettings,
                    youtube: updatedSettings
                  }
                })
              });
              
              if (updateResponse.ok) {
                log('youtube', `Обновленные токены сохранены в кампании ${campaignId}`);
              } else {
                log('youtube', `Ошибка сохранения обновленных токенов: ${updateResponse.status}`);
              }
            }
          }
        } catch (refreshError: any) {
          log('youtube', `Критическая ошибка: не удалось обновить токены - ${refreshError.message}`);
          throw new Error('YouTube OAuth токены истекли и не могут быть обновлены. Требуется повторная авторизация.');
        }
      }

      // Автоматически обновляем токен если он истечет во время работы
      oauth2Client.on('tokens', async (tokens) => {
        log('youtube', 'Получены новые токены от Google во время работы');
        if (tokens.access_token) {
          log('youtube', `Обновляем access_token, истекает: ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'неизвестно'}`);
          
          // Сохраняем новые токены в настройки кампании
          try {
            const updatedSettings = {
              ...campaignSettings.youtube,
              accessToken: tokens.access_token
            };
            
            // Обновляем refresh_token если получен новый
            if (tokens.refresh_token) {
              log('youtube', 'Обновляем refresh_token во время работы');
              updatedSettings.refreshToken = tokens.refresh_token;
            }

            // Получаем campaign_id из контента
            const campaignId = content.campaign_id;
            if (campaignId) {
              const updateResponse = await fetch(`${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  social_media_settings: {
                    ...campaignSettings,
                    youtube: updatedSettings
                  }
                })
              });
              
              if (updateResponse.ok) {
                log('youtube', `Токены обновлены в кампании ${campaignId} во время работы`);
              } else {
                log('youtube', `Ошибка сохранения токенов во время работы: ${updateResponse.status} ${updateResponse.statusText}`);
              }
            }
          } catch (error: any) {
            log('youtube', `Ошибка сохранения обновленных токенов во время работы: ${error.message}`);
          }
        }
      });

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      // Проверяем наличие видео
      log('youtube', `Проверяем video_url: ${content.video_url}`);
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
      if (!videoId) {
        throw new Error('YouTube API не вернул ID видео');
      }

      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      log('youtube', `Видео успешно загружено на YouTube: ${videoUrl}`);

      // Проверяем и загружаем обложку, если она есть
      if (content.videoThumbnail || content.additional_images?.[0]) {
        try {
          const thumbnailUrl = content.videoThumbnail || content.additional_images[0];
          log('youtube', `Загружаем обложку для видео: ${thumbnailUrl}`);
          
          // Скачиваем обложку
          const thumbnailResponse = await axios.get(thumbnailUrl, {
            responseType: 'stream'
          });

          // Загружаем обложку через YouTube API
          await youtube.thumbnails.set({
            videoId: videoId,
            media: {
              body: thumbnailResponse.data
            }
          });

          log('youtube', `Обложка успешно установлена для видео ${videoId}`);
        } catch (thumbnailError: any) {
          // Специальная обработка ошибки 403 для миниатюр
          if (thumbnailError.code === 403 && thumbnailError.message?.includes("upload and set custom video thumbnails")) {
            log('youtube', `ПРЕДУПРЕЖДЕНИЕ: Канал не имеет прав для загрузки кастомных миниатюр. Видео опубликовано без обложки.`);
            log('youtube', `Для загрузки кастомных миниатюр необходимо: 1) Верифицировать канал через телефон, 2) Иметь историю загрузок без нарушений`);
          } else {
            log('youtube', `Ошибка установки обложки: ${thumbnailError.message}`);
          }
          // Не падаем, если обложка не загрузилась - видео уже опубликовано
        }
      } else {
        log('youtube', `Обложка не найдена для видео ${videoId}`);
      }

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
      if (error.message?.includes('quotaExceeded') || error.message?.includes('quota')) {
        return {
          success: false,
          error: 'Превышена квота YouTube API. Попробуйте позже.',
          quotaExceeded: true
        };
      }

      // Обработка ошибки лимита загрузок видео
      if (error.message?.includes('exceeded the number of videos')) {
        return {
          success: false,
          error: 'Превышен дневной лимит загрузок видео YouTube. Попробуйте завтра.',
          quotaExceeded: true  // Используем тот же флаг для блокировки повторных попыток
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