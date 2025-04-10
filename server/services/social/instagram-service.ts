import axios from 'axios';
import { log } from '../../utils/logger';
import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { BaseSocialService } from './base-service';

/**
 * Сервис для публикации контента в Instagram
 */
export class InstagramService extends BaseSocialService {
  /**
   * Форматирует текст для публикации в Instagram
   * @param content Исходный текст контента
   * @returns Отформатированный текст для Instagram
   */
  private formatTextForInstagram(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }
    
    try {
      // Instagram не поддерживает HTML-теги, удаляем их
      let formattedText = content
        // Удаляем HTML-теги и заменяем их на обычный текст
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>([^]*?)<\/p>/g, '$1\n\n')
        .replace(/<div>([^]*?)<\/div>/g, '$1\n')
        .replace(/<h[1-6]>([^]*?)<\/h[1-6]>/g, '$1\n\n')
        .replace(/<li>(.*?)<\/li>/g, '• $1\n')
        .replace(/<ul>(.*?)<\/ul>/g, '$1\n')
        .replace(/<ol>(.*?)<\/ol>/g, '$1\n')
        
        // Замена HTML-тегов форматирования на обычный текст
        .replace(/<b>(.*?)<\/b>/g, '$1')
        .replace(/<strong>(.*?)<\/strong>/g, '$1')
        .replace(/<i>(.*?)<\/i>/g, '$1')
        .replace(/<em>(.*?)<\/em>/g, '$1')
        
        // Преобразуем ссылки в обычный текст
        .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '$2 ($1)')
        
        // Удаляем все остальные HTML-теги
        .replace(/<[^>]*>/g, '');
      
      // Нормализуем переносы строк (не более 2 подряд)
      formattedText = formattedText.replace(/\n{3,}/g, '\n\n');
      
      // Instagram имеет ограничение на длину текста (2200 символов)
      if (formattedText.length > 2200) {
        formattedText = formattedText.substring(0, 2197) + '...';
        log(`Текст для Instagram был обрезан до 2200 символов`, 'instagram');
      }
      
      return formattedText;
    } catch (error) {
      log(`Ошибка при форматировании текста для Instagram: ${error}`, 'instagram');
      
      // В случае ошибки возвращаем обрезанный исходный текст
      if (content.length > 2200) {
        return content.substring(0, 2197) + '...';
      }
      return content;
    }
  }

  /**
   * Публикует контент в Instagram через Graph API
   * @param content Контент для публикации
   * @param instagramSettings Настройки Instagram API
   * @returns Результат публикации
   */
  async publishToInstagram(
    content: CampaignContent,
    instagramSettings: { token: string | null; accessToken: string | null; businessAccountId: string | null }
  ): Promise<SocialPublication> {
    try {
      // Проверяем наличие необходимых параметров
      if (!instagramSettings.token || !instagramSettings.businessAccountId) {
        log(`Ошибка публикации в Instagram: отсутствуют настройки. Token: ${instagramSettings.token ? 'задан' : 'отсутствует'}, Business Account ID: ${instagramSettings.businessAccountId ? 'задан' : 'отсутствует'}`, 'instagram');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Отсутствуют настройки Instagram API (токен или ID бизнес-аккаунта)'
        };
      }
      
      // Извлекаем параметры
      const token = instagramSettings.token;
      const businessAccountId = instagramSettings.businessAccountId;
      
      log(`[Instagram] Начинаем публикацию в Instagram с использованием бизнес-аккаунта: ${businessAccountId}`, 'instagram');
      
      // Обрабатываем контент
      const processedContent = this.processAdditionalImages(content, 'instagram');
      
      // Загружаем локальные изображения на Imgur
      const imgurContent = await this.uploadImagesToImgur(processedContent);
      
      // Проверяем наличие изображения (для Instagram обязательно)
      if (!imgurContent.imageUrl) {
        log(`[Instagram] Ошибка публикации: отсутствует основное изображение`, 'instagram');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Отсутствует изображение для публикации в Instagram. Необходимо добавить изображение.'
        };
      }
      
      // Подготавливаем текст для отправки
      let caption = '';
      
      // Если есть заголовок, добавляем его в начало сообщения
      if (imgurContent.title) {
        caption += `${imgurContent.title}\n\n`;
      }
      
      // Добавляем основной контент
      const formattedContent = this.formatTextForInstagram(imgurContent.content || '');
      caption += formattedContent;
      
      // Если есть хэштеги, добавляем их в конец сообщения
      if (imgurContent.hashtags && Array.isArray(imgurContent.hashtags) && imgurContent.hashtags.length > 0) {
        const hashtags = imgurContent.hashtags
          .filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
          .map(tag => tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`);
        
        if (hashtags.length > 0) {
          caption += '\n\n' + hashtags.join(' ');
        }
      }
      
      // Публикация в Instagram выполняется в 2 этапа:
      // 1. Отправка запроса на создание контейнера для медиа
      // 2. Публикация контейнера
      
      try {
        log(`[Instagram] Этап 1 - создание контейнера для медиа`, 'instagram');
        
        // Создаем URL для Instagram Graph API
        const baseUrl = 'https://graph.facebook.com/v17.0';
        
        // Формируем URL запроса для создания контейнера
        const containerUrl = `${baseUrl}/${businessAccountId}/media`;
        
        // Подготавливаем параметры запроса
        const containerParams = {
          image_url: imgurContent.imageUrl,
          caption: caption,
          access_token: token
        };
        
        // Отправляем запрос на создание контейнера
        log(`[Instagram] Отправка запроса на создание контейнера с URL изображения: ${imgurContent.imageUrl.substring(0, 50)}...`, 'instagram');
        const containerResponse = await axios.post(
          containerUrl, 
          containerParams, 
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
          }
        );
        
        log(`[Instagram] Ответ API (создание контейнера): ${JSON.stringify(containerResponse.data)}`, 'instagram');
        
        // Проверяем успешность создания контейнера
        if (!containerResponse.data || !containerResponse.data.id) {
          const errorMsg = containerResponse.data.error ? 
            `${containerResponse.data.error.code}: ${containerResponse.data.error.message}` : 
            'Неизвестная ошибка при создании контейнера';
          
          log(`[Instagram] Ошибка при создании контейнера: ${errorMsg}`, 'instagram');
          
          return {
            platform: 'instagram',
            status: 'failed',
            publishedAt: null,
            error: errorMsg
          };
        }
        
        // Получаем ID контейнера
        const containerId = containerResponse.data.id;
        
        log(`[Instagram] Этап 2 - публикация контейнера ${containerId}`, 'instagram');
        
        // Формируем URL запроса для публикации
        const publishUrl = `${baseUrl}/${businessAccountId}/media_publish`;
        
        // Подготавливаем параметры запроса
        const publishParams = {
          creation_id: containerId,
          access_token: token
        };
        
        // Отправляем запрос на публикацию
        const publishResponse = await axios.post(
          publishUrl, 
          publishParams, 
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
          }
        );
        
        log(`[Instagram] Ответ API (публикация): ${JSON.stringify(publishResponse.data)}`, 'instagram');
        
        // Проверяем успешность публикации
        if (!publishResponse.data || !publishResponse.data.id) {
          const errorMsg = publishResponse.data.error ? 
            `${publishResponse.data.error.code}: ${publishResponse.data.error.message}` : 
            'Неизвестная ошибка при публикации';
          
          log(`[Instagram] Ошибка при публикации: ${errorMsg}`, 'instagram');
          
          return {
            platform: 'instagram',
            status: 'failed',
            publishedAt: null,
            error: errorMsg
          };
        }
        
        // Получаем ID публикации
        const igMediaId = publishResponse.data.id;
        
        // Для получения permalink нужен отдельный запрос
        log(`[Instagram] Этап 3 - получение постоянной ссылки для ${igMediaId}`, 'instagram');
        
        // Формируем URL запроса для получения информации о публикации
        const mediaInfoUrl = `${baseUrl}/${igMediaId}`;
        
        // Отправляем запрос
        const mediaInfoResponse = await axios.get(`${mediaInfoUrl}`, {
          params: {
            fields: 'permalink',
            access_token: token
          },
          timeout: 30000
        });
        
        log(`[Instagram] Ответ API (получение информации): ${JSON.stringify(mediaInfoResponse.data)}`, 'instagram');
        
        // Проверяем успешность получения информации
        let postUrl = '';
        
        if (mediaInfoResponse.data && mediaInfoResponse.data.permalink) {
          postUrl = mediaInfoResponse.data.permalink;
          log(`[Instagram] Получена постоянная ссылка: ${postUrl}`, 'instagram');
        } else {
          // Если не удалось получить permalink, используем стандартную форму ссылки
          postUrl = `https://www.instagram.com/p/${igMediaId}/`;
          log(`[Instagram] Не удалось получить permalink, используем стандартную ссылку: ${postUrl}`, 'instagram');
        }
        
        log(`[Instagram] Публикация успешно завершена!`, 'instagram');
        
        return {
          platform: 'instagram',
          status: 'published',
          publishedAt: new Date(),
          postUrl: postUrl
        };
      } catch (error: any) {
        log(`[Instagram] Исключение при публикации: ${error.message}`, 'instagram');
        
        // Дополнительное логирование для ответа API
        if (error.response && error.response.data) {
          log(`[Instagram] Детали ошибки API: ${JSON.stringify(error.response.data)}`, 'instagram');
        }
        
        // Обработка распространенных ошибок
        let errorMessage = `Ошибка при публикации в Instagram: ${error.message}`;
        
        if (error.response?.data?.error) {
          const apiError = error.response.data.error;
          
          if (apiError.code === 190) {
            errorMessage = 'Недействительный токен доступа. Пожалуйста, обновите токен в настройках.';
          } else if (apiError.code === 4) {
            errorMessage = 'Ограничение частоты запросов. Пожалуйста, повторите попытку позже.';
          } else if (apiError.code === 10) {
            errorMessage = 'Ошибка разрешений API. Проверьте, что приложение имеет необходимые разрешения.';
          } else {
            errorMessage = `Ошибка API Instagram: ${apiError.message} (код ${apiError.code})`;
          }
        }
        
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: errorMessage
        };
      }
    } catch (error: any) {
      log(`[Instagram] Общая ошибка при публикации: ${error.message}`, 'instagram');
      
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: `Общая ошибка при публикации: ${error.message}`
      };
    }
  }

  /**
   * Публикует контент в выбранную социальную платформу
   * @param content Контент для публикации
   * @param platform Социальная платформа
   * @param settings Настройки социальных сетей
   * @returns Результат публикации
   */
  public async publishToPlatform(
    content: CampaignContent,
    platform: SocialPlatform,
    settings: SocialMediaSettings
  ): Promise<SocialPublication> {
    if (platform !== 'instagram') {
      return {
        platform: platform, 
        status: 'failed',
        publishedAt: null,
        error: 'Неподдерживаемая платформа для Instagram-сервиса'
      };
    }

    // Проверяем наличие настроек и логируем их для дебага
    const instagramSettings = settings.instagram || { token: null, accessToken: null, businessAccountId: null };
    const hasToken = Boolean(instagramSettings.token);
    const hasBusinessAccountId = Boolean(instagramSettings.businessAccountId);
    
    log(`[Instagram] Настройки: Token: ${hasToken ? 'задан' : 'отсутствует'}, Business Account ID: ${hasBusinessAccountId ? 'задан' : 'отсутствует'}`, 'instagram');

    if (!hasToken || !hasBusinessAccountId) {
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для Instagram (токен или ID бизнес-аккаунта). Убедитесь, что настройки заданы в кампании.'
      };
    }

    // Проверка на undefined для избежания ошибки типизации
    if (!settings.instagram) {
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для Instagram'
      };
    }
    
    return this.publishToInstagram(content, settings.instagram);
  }
}

// Экспортируем экземпляр сервиса для использования в приложении
export const instagramService = new InstagramService();