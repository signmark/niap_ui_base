import axios from 'axios';
import { log } from '../../utils/logger';
import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { BaseSocialService } from './base-service';
import path from 'path';
import { videoProcessorService } from '../video-processor';

/**
 * Сервис для публикации контента в Instagram
 */
export class InstagramService extends BaseSocialService {
  /**
   * Проверяет валидность URL видео
   * @param url URL видео
   * @returns true, если URL предположительно валидный
   */
  private isValidVideoUrl(url: string): boolean {
    try {
      // Проверяем на null или undefined
      if (!url) {
        log(`[Instagram] URL видео null или undefined`, 'instagram');
        return false;
      }

      // Проверяем формат URL
      try {
        new URL(url);
      } catch (e) {
        log(`[Instagram] Невалидный формат URL: ${url}`, 'instagram');
        return false;
      }

      // Проверяем расширение файла
      const extension = path.extname(url.split('?')[0]).toLowerCase();
      const validExtensions = ['.mp4', '.mov', '.avi', '.wmv'];
      
      if (!validExtensions.includes(extension)) {
        log(`[Instagram] Предупреждение: Расширение файла ${extension} может не поддерживаться Instagram`, 'instagram');
        // Возвращаем true, даже если расширение не в списке, но логируем предупреждение
        return true;
      }

      return true;
    } catch (error) {
      log(`[Instagram] Ошибка при проверке URL видео: ${error}`, 'instagram');
      return false;
    }
  }
  /**
   * Проверяет статус обработки видео и публикует его, когда оно готово
   * @param containerId ID контейнера медиа
   * @param token Токен доступа Instagram API
   * @param businessAccountId ID бизнес-аккаунта
   * @returns Результат публикации
   */
  private async checkAndPublishVideo(containerId: string, token: string, businessAccountId: string): Promise<SocialPublication> {
    // Базовый URL для проверки статуса и публикации
    const baseUrl = `https://graph.facebook.com/v18.0`;
    // URL для получения статуса обработки видео
    const statusUrl = `${baseUrl}/${containerId}?fields=status_code,status&access_token=${token}`;
    // URL для публикации контейнера
    const publishUrl = `${baseUrl}/${businessAccountId}/media_publish?access_token=${token}`;
    
    // Максимальное количество попыток проверки статуса
    const maxRetries = 12;
    // Начальная задержка между проверками статуса (в мс)
    let delay = 10000; // 10 секунд
    
    log(`[Instagram] Начинаем проверку статуса обработки видео для контейнера ${containerId}`, 'instagram');
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Ждем перед проверкой статуса
        await new Promise(resolve => setTimeout(resolve, delay));
        
        log(`[Instagram] Попытка ${i+1}/${maxRetries}: проверка статуса видео ${containerId}`, 'instagram');
        
        // Проверяем статус обработки видео
        const statusResponse = await axios.get(statusUrl, {
          timeout: 30000
        });
        
        // Логируем ответ для отладки
        log(`[Instagram] Статус видео: ${JSON.stringify(statusResponse.data)}`, 'instagram');
        
        // Проверяем, завершена ли обработка видео
        if (statusResponse.data && statusResponse.data.status_code === 'FINISHED') {
          log(`[Instagram] Видео успешно обработано, публикуем`, 'instagram');
          
          // Публикуем обработанное видео
          const publishResponse = await axios.post(publishUrl, {
            creation_id: containerId
          }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
          });
          
          log(`[Instagram] Ответ публикации: ${JSON.stringify(publishResponse.data)}`, 'instagram');
          
          // Проверяем успешность публикации
          if (publishResponse.data && publishResponse.data.id) {
            // Получаем ID публикации
            const postId = publishResponse.data.id;
            // Получаем permalink на основе ID
            const permalink = await this.getInstagramPermalink(postId, token);
            
            return {
              platform: 'instagram',
              status: 'published',
              publishedAt: new Date(),
              postId: postId,
              postUrl: permalink || undefined
            };
          } else {
            return {
              platform: 'instagram',
              status: 'failed',
              publishedAt: null,
              postId: containerId,
              error: 'Ошибка публикации видео после обработки: отсутствует ID публикации'
            };
          }
        } else if (statusResponse.data && statusResponse.data.status_code === 'ERROR') {
          // Если статус ERROR, прекращаем попытки
          return {
            platform: 'instagram',
            status: 'failed',
            publishedAt: null,
            postId: containerId,
            error: `Ошибка обработки видео: ${statusResponse.data.status || 'неизвестная ошибка'}`
          };
        } else if (statusResponse.data && statusResponse.data.status_code === 'IN_PROGRESS') {
          // Если видео все еще обрабатывается, увеличиваем задержку для следующей попытки
          delay = Math.min(delay * 1.5, 60000); // Максимум 60 секунд между проверками
          log(`[Instagram] Видео все еще обрабатывается, следующая проверка через ${delay/1000} секунд`, 'instagram');
        } else {
          // Неизвестный статус
          log(`[Instagram] Неизвестный статус обработки видео: ${statusResponse.data?.status_code || 'статус не получен'}`, 'instagram');
        }
      } catch (error: any) {
        log(`[Instagram] Ошибка при проверке статуса видео: ${error.message}`, 'instagram');
        // Если ошибка в API, продолжаем попытки
        if (error.response) {
          log(`[Instagram] Ответ API при ошибке: ${JSON.stringify(error.response.data)}`, 'instagram');
        }
      }
    }
    
    // Если после всех попыток видео не опубликовано
    return {
      platform: 'instagram',
      status: 'failed',
      publishedAt: null,
      postId: containerId,
      error: 'Превышено максимальное количество попыток проверки статуса видео'
    };
  }
  
  /**
   * Получает permalink публикации из ответа API Instagram
   * @param postId ID публикации
   * @param token Токен доступа
   * @returns URL публикации или null в случае ошибки
   */
  private async getInstagramPermalink(postId: string, token: string): Promise<string | null> {
    try {
      const url = `https://graph.facebook.com/v18.0/${postId}?fields=permalink&access_token=${token}`;
      
      log(`[Instagram] Запрос permalink для публикации ${postId}`, 'instagram');
      
      const response = await axios.get(url, {
        timeout: 30000
      });
      
      if (response.data && response.data.permalink) {
        log(`[Instagram] Получен permalink: ${response.data.permalink}`, 'instagram');
        return response.data.permalink;
      } else {
        log(`[Instagram] Ответ API не содержит permalink: ${JSON.stringify(response.data)}`, 'instagram');
        return null;
      }
    } catch (error: any) {
      log(`[Instagram] Ошибка при получении permalink: ${error.message}`, 'instagram');
      return null;
    }
  }
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
      
      // Проверяем наличие медиа-контента (для Instagram обязательно)
      const isVideo = content.contentType === 'video-text' || content.contentType === 'video';
      
      if (!isVideo && !imgurContent.imageUrl) {
        log(`[Instagram] Ошибка публикации: отсутствует медиа-контент (изображение или видео)`, 'instagram');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Отсутствует медиа-контент для публикации в Instagram. Необходимо добавить изображение или видео.'
        };
      }
      
      // Проверяем, есть ли видео URL при типе контента video/video-text
      if (isVideo && !content.videoUrl) {
        log(`[Instagram] Ошибка публикации: тип контента указан как видео, но URL видео отсутствует`, 'instagram');
        
        // Если нет видео, но есть изображение, продолжаем с публикацией изображения
        if (imgurContent.imageUrl) {
          log(`[Instagram] Найдено резервное изображение, продолжаем с ним вместо видео`, 'instagram');
        } else {
          return {
            platform: 'instagram',
            status: 'failed',
            publishedAt: null,
            error: 'Для публикации видео в Instagram необходимо указать URL видео.'
          };
        }
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
        // Обновляем до v18.0 (самой последней версии) для лучшей поддержки REELS
        const baseUrl = 'https://graph.facebook.com/v18.0';
        
        // Формируем URL запроса для создания контейнера
        const containerUrl = `${baseUrl}/${businessAccountId}/media`;
        
        // Проверяем тип контента для определения правильного метода публикации (изображение или видео)
        const isVideo = content.contentType === 'video-text' || content.contentType === 'video';
        
        // Подготавливаем параметры запроса в зависимости от типа контента
        let containerParams: any = {
          caption: caption,
          access_token: token
        };
        
        // Добавляем ссылку на медиа в зависимости от типа (изображение или видео)
        if (isVideo && content.videoUrl) {
          log(`[Instagram] Обнаружено видео для публикации: ${content.videoUrl.substring(0, 50)}...`, 'instagram');
          
          // Проверка URL видео
          if (!this.isValidVideoUrl(content.videoUrl)) {
            log(`[Instagram] Предупреждение: URL видео может быть некорректным: ${content.videoUrl}`, 'instagram');
          }
          
          // Обрабатываем видео для оптимальной совместимости с Instagram, только если доступен ffmpeg
          let videoUrl = content.videoUrl;
          try {
            log(`[Instagram] Проверка доступности ffmpeg...`, 'instagram');
            const ffmpegAvailable = await videoProcessorService.checkFfmpegAvailability();
            
            if (ffmpegAvailable) {
              log(`[Instagram] Начинаем обработку видео для совместимости с Instagram Reels...`, 'instagram');
              const processedVideoUrl = await videoProcessorService.processVideoForSocialMedia(content.videoUrl, 'instagram');
              
              if (processedVideoUrl) {
                log(`[Instagram] Видео успешно обработано: ${processedVideoUrl.substring(0, 50)}...`, 'instagram');
                videoUrl = processedVideoUrl;
              } else {
                log(`[Instagram] Ошибка при обработке видео, используем оригинальный URL`, 'instagram');
              }
            } else {
              log(`[Instagram] ffmpeg не доступен, используем оригинальный URL видео`, 'instagram');
            }
          } catch (error: any) {
            log(`[Instagram] Ошибка при обработке видео: ${error.message}. Используем оригинальный URL`, 'instagram');
          }
          
          containerParams.video_url = videoUrl;
          // Используем REELS вместо VIDEO для соответствия требованиям Instagram API
          containerParams.media_type = 'REELS';
          // Добавляем параметры, специфичные для REELS
          containerParams.thumb_offset = 0;
          containerParams.share_to_feed = true;
          
          // Добавляем дополнительные параметры для улучшения совместимости
          containerParams.is_carousel_item = false;
          
          // Добавляем расширенное логирование для отладки
          log(`[Instagram] Параметры запроса для видео: ${JSON.stringify(containerParams)}`, 'instagram');
        } else {
          // Если это не видео или видео отсутствует, используем изображение
          if (imgurContent.imageUrl) {
            log(`[Instagram] Публикация с изображением: ${imgurContent.imageUrl.substring(0, 50)}...`, 'instagram');
          } else {
            log(`[Instagram] Предупреждение: URL изображения отсутствует или null`, 'instagram');
          }
          containerParams.image_url = imgurContent.imageUrl;
        }
        
        // Отправляем запрос на создание контейнера с увеличенными таймаутами для видео
        log(`[Instagram] Отправка запроса на создание контейнера для ${isVideo ? 'видео' : 'изображения'}`, 'instagram');
        
        try {
          const containerResponse = await axios.post(
            containerUrl, 
            containerParams, 
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: isVideo ? 120000 : 60000 // Увеличенный таймаут для видео (2 минуты)
            }
          );
          
          log(`[Instagram] Ответ API (создание контейнера): ${JSON.stringify(containerResponse.data)}`, 'instagram');
          
          // Проверка на наличие содержательного ответа
          if (!containerResponse.data) {
            throw new Error('Получен пустой ответ от Instagram API при создании контейнера');
          }
          
          // Проверяем успешность создания контейнера
          if (!containerResponse.data.id) {
            // Пытаемся найти описание ошибки в ответе
            const errorMsg = containerResponse.data.error ? 
              `${containerResponse.data.error.code}: ${containerResponse.data.error.message}` : 
              'Неизвестная ошибка при создании контейнера';
            
            throw new Error(errorMsg);
          }
          
          // Преобразуем ответ API в формат SocialPublication
          if (containerResponse.data && containerResponse.data.id) {
            // Сохраняем ID контейнера для дальнейшего использования
            const containerId = containerResponse.data.id;
            
            // Для видео необходимо проверить статус обработки и затем опубликовать
            if (isVideo) {
              log(`[Instagram] Видео создано в контейнере ${containerId}, ожидаем обработки...`, 'instagram');
              
              // Проверяем статус обработки видео
              try {
                const result = await this.checkAndPublishVideo(containerId, token, businessAccountId);
                return result;
              } catch (error: any) {
                log(`[Instagram] Ошибка при публикации видео после создания контейнера: ${error.message}`, 'instagram');
                return {
                  platform: 'instagram',
                  status: 'failed',
                  publishedAt: null,
                  postId: containerId,
                  error: `Ошибка при публикации видео: ${error.message}`
                };
              }
            } else {
              // Для изображений также нужно выполнить публикацию контейнера
              log(`[Instagram] Изображение создано в контейнере ${containerId}, публикуем...`, 'instagram');
              
              try {
                // Формируем URL для публикации контейнера (согласно документации Instagram Graph API)
                const publishUrl = `${baseUrl}/${businessAccountId}/media_publish`;
                
                // Отправляем запрос на публикацию контейнера
                const publishResponse = await axios.post(
                  publishUrl,
                  {
                    creation_id: containerId,
                    access_token: token
                  },
                  {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                  }
                );
                
                log(`[Instagram] Ответ API (публикация изображения): ${JSON.stringify(publishResponse.data)}`, 'instagram');
                
                // Проверяем успешность публикации
                if (publishResponse.data && publishResponse.data.id) {
                  // Получаем permalink публикации
                  const permalink = await this.getInstagramPermalink(publishResponse.data.id, token);
                  
                  return {
                    platform: 'instagram', 
                    status: 'published',
                    publishedAt: new Date(),
                    postId: publishResponse.data.id,
                    url: permalink || undefined,
                    error: null
                  };
                } else {
                  return {
                    platform: 'instagram', 
                    status: 'pending',
                    publishedAt: null,
                    postId: containerId,
                    error: null
                  };
                }
              } catch (error: any) {
                log(`[Instagram] Ошибка при публикации изображения после создания контейнера: ${error.message}`, 'instagram');
                return {
                  platform: 'instagram',
                  status: 'failed',
                  publishedAt: null,
                  postId: containerId,
                  error: `Ошибка при публикации изображения: ${error.message}`
                };
              }
            }
          } else {
            return {
              platform: 'instagram',
              status: 'failed',
              publishedAt: null,
              error: 'Ошибка создания контейнера: неверный формат ответа API'
            };
          }
        } catch (error: any) {
          log(`[Instagram] Ошибка при создании контейнера: ${error.message}`, 'instagram');
          
          // Если ошибка связана с видео, пробуем загрузить изображение вместо него
          if (isVideo && imgurContent.imageUrl !== null && imgurContent.imageUrl !== undefined) {
            log(`[Instagram] Попытка создать контейнер с изображением вместо видео`, 'instagram');
            
            // Изменяем параметры запроса на изображение - создаем новый объект параметров
            // Это избавляет от возможных проблем с оставшимися свойствами от видео
            containerParams = {
              caption: caption,
              access_token: token,
              image_url: imgurContent.imageUrl
            };
            
            // Повторно отправляем запрос с изображением
            const fallbackResponse = await axios.post(
              containerUrl, 
              containerParams, 
              {
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000
              }
            );
            
            log(`[Instagram] Ответ API при резервной загрузке изображения: ${JSON.stringify(fallbackResponse.data)}`, 'instagram');
            
            // Преобразуем ответ API в формат SocialPublication
            if (fallbackResponse.data && fallbackResponse.data.id) {
              const containerId = fallbackResponse.data.id;
              
              // Публикуем контейнер с изображением
              try {
                // Формируем URL для публикации контейнера
                const publishUrl = `${baseUrl}/${businessAccountId}/media_publish`;
                
                // Отправляем запрос на публикацию контейнера
                const publishResponse = await axios.post(
                  publishUrl,
                  {
                    creation_id: containerId,
                    access_token: token
                  },
                  {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                  }
                );
                
                log(`[Instagram] Ответ API (публикация резервного изображения): ${JSON.stringify(publishResponse.data)}`, 'instagram');
                
                // Проверяем успешность публикации
                if (publishResponse.data && publishResponse.data.id) {
                  // Получаем permalink публикации
                  const permalink = await this.getInstagramPermalink(publishResponse.data.id, token);
                  
                  return {
                    platform: 'instagram', 
                    status: 'published',
                    publishedAt: new Date(),
                    postId: publishResponse.data.id,
                    url: permalink || undefined,
                    error: null
                  };
                }
              } catch (pubError: any) {
                log(`[Instagram] Ошибка при публикации резервного изображения: ${pubError.message}`, 'instagram');
              }
              
              // Если публикация не удалась, возвращаем статус pending
              return {
                platform: 'instagram', 
                status: 'pending',
                publishedAt: null,
                postId: containerId,
                error: null
              };
            } else {
              return {
                platform: 'instagram',
                status: 'failed',
                publishedAt: null,
                error: 'Ошибка создания резервного контейнера: неверный формат ответа API'
              };
            }
          }
          
          // Если это не видео или нет резервного изображения, прокидываем ошибку дальше
          throw error;
        }
        
        // Этот код никогда не должен выполняться, так как выше мы либо возвращаем containerResponse, либо выбрасываем исключение
        log(`[Instagram] Критическая ошибка в логике кода: продолжение выполнения после return/throw`, 'instagram');
        
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Внутренняя ошибка в логике кода'
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
  // Здесь определяем возвращаемый тип в соответствии с базовым классом
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