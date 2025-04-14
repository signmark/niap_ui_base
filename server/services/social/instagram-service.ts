import axios from 'axios';
import { log } from '../../utils/logger';
import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { BaseSocialService } from './base-service';
import * as fs from 'fs';
import { existsSync, mkdirSync } from 'fs';
import { videoProcessor } from '../video-processor';

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
   * Убедиться, что директория logs существует
   * @private
   */
  private ensureLogDirectory() {
    try {
      if (!existsSync('logs')) {
        mkdirSync('logs', { recursive: true });
      }
    } catch (err) {
      log(`[Instagram] Ошибка при создании директории для логов: ${err}`, 'instagram');
    }
  }
  
  /**
   * Проверяет и анализирует видео на соответствие требованиям Instagram
   * @param videoUrl URL видео для анализа
   * @returns Объект с результатами анализа или null в случае ошибки
   */
  private async analyzeVideo(videoUrl: string): Promise<{
    isValid: boolean;
    warnings: string[];
    errors: string[];
    metadata?: {
      width?: number;
      height?: number;
      duration?: number;
      aspectRatio?: number;
      size?: number;
    }
  } | null> {
    try {
      // Проверяем доступность URL
      const headResponse = await axios.head(videoUrl, { timeout: 5000 })
        .catch(e => {
          log(`[Instagram] Ошибка доступа к видео: ${e.message}`, 'instagram');
          return null;
        });
      
      if (!headResponse) {
        return {
          isValid: false,
          warnings: [],
          errors: ['Видео недоступно по указанному URL']
        };
      }
      
      // Получаем размер файла
      const contentLength = headResponse.headers['content-length'];
      const sizeMB = contentLength ? parseInt(contentLength) / (1024 * 1024) : 0;
      
      const result = {
        isValid: true,
        warnings: [],
        errors: [],
        metadata: {
          size: sizeMB
        }
      };
      
      // Проверка размера файла
      if (sizeMB > 100) {
        result.warnings.push(`Размер видео (${sizeMB.toFixed(2)} MB) превышает рекомендуемый лимит Instagram (100 MB)`);
        result.isValid = false;
      }
      
      // Попытка получить метаданные через прокси (ffprobe) не реализуется в этой версии,
      // т.к. требует дополнительных серверных компонентов
      
      // Добавляем опциональные предупреждения
      if (sizeMB < 0.5) {
        result.warnings.push(`Размер видео очень маленький (${sizeMB.toFixed(2)} MB), что может привести к низкому качеству изображения`);
      }
      
      return result;
    } catch (error) {
      log(`[Instagram] Ошибка при анализе видео: ${error}`, 'instagram');
      return null;
    }
  }

  /**
   * Безопасная запись в лог-файл
   * @param message Сообщение для записи
   * @private
   */
  private writeToLogFile(message: string) {
    try {
      this.ensureLogDirectory();
      fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] ${message}\n`);
    } catch (err) {
      log(`[Instagram] Ошибка записи в лог-файл: ${err}`, 'instagram');
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
        const baseUrl = 'https://graph.facebook.com/v17.0';
        
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
          
          // Записываем в логи URL видео для отладки
          try {
            this.writeToLogFile(`INSTAGRAM VIDEO URL: ${content.videoUrl}`);
          } catch (e) {
            log(`[Instagram] Ошибка записи URL видео в лог: ${e}`, 'instagram');
          }
          
          // Обрабатываем видео с помощью видео-процессора для приведения к нужному формату
          log(`[Instagram] Оптимизация видео для Instagram...`, 'instagram');
          this.writeToLogFile(`Начинаем оптимизацию видео для Instagram`);
          
          let videoUrl = content.videoUrl;
          try {
            const processedVideoUrl = await videoProcessor.processVideo(content.videoUrl, 'instagram');
            
            if (processedVideoUrl) {
              log(`[Instagram] Видео успешно оптимизировано: ${processedVideoUrl}`, 'instagram');
              this.writeToLogFile(`Видео успешно оптимизировано: ${processedVideoUrl}`);
              
              // Используем оптимизированное видео
              videoUrl = processedVideoUrl;
            } else {
              log(`[Instagram] Не удалось оптимизировать видео, используем оригинал`, 'instagram');
              this.writeToLogFile(`Не удалось оптимизировать видео, используем оригинал`);
            }
          } catch (processingError) {
            log(`[Instagram] Ошибка при обработке видео: ${processingError}`, 'instagram');
            this.writeToLogFile(`Ошибка при обработке видео: ${processingError}`);
          }
          
          // Используем REELS вместо VIDEO согласно новым требованиям API
          containerParams.video_url = videoUrl;
          containerParams.media_type = 'REELS';
          
          // Добавляем параметры, специфичные для REELS
          containerParams.thumb_offset = 0;  // Миниатюра с начала видео
          containerParams.share_to_feed = 'true'; // Публикация и в ленту
          
          this.writeToLogFile(`Используем параметры для REELS: ${JSON.stringify({...containerParams, access_token: 'СКРЫТО'})}`);
          
          // Для видео можно указать thumbnail_url (обложку видео)
          if (imgurContent.imageUrl) {
            log(`[Instagram] Добавляем URL обложки видео: ${imgurContent.imageUrl.substring(0, 50)}...`, 'instagram');
            containerParams.thumbnail_url = imgurContent.imageUrl;
          }
          
          // Проверяем метаданные видео и URL на общедоступность
          try {
            this.writeToLogFile(`Проверка доступности URL видео: ${content.videoUrl}`);
            
            // Анализируем видео с помощью нашей специальной функции
            const videoAnalysis = await this.analyzeVideo(content.videoUrl);
            if (videoAnalysis) {
              // Записываем результаты анализа в лог
              this.writeToLogFile(`Результаты анализа видео: ${JSON.stringify(videoAnalysis)}`);
              
              // Выводим предупреждения в лог
              if (videoAnalysis.warnings.length > 0) {
                videoAnalysis.warnings.forEach(warning => {
                  log(`[Instagram] Предупреждение о видео: ${warning}`, 'instagram');
                  this.writeToLogFile(`ПРЕДУПРЕЖДЕНИЕ: ${warning}`);
                });
              }
              
              // Выводим ошибки в лог
              if (videoAnalysis.errors.length > 0) {
                videoAnalysis.errors.forEach(error => {
                  log(`[Instagram] Ошибка в видео: ${error}`, 'instagram');
                  this.writeToLogFile(`ОШИБКА: ${error}`);
                });
              }
              
              // Если видео невалидно, но у нас есть изображение - предупреждаем о потенциальной замене
              if (!videoAnalysis.isValid && imgurContent.imageUrl) {
                log(`[Instagram] Видео может не соответствовать требованиям Instagram. При ошибке будет использовано запасное изображение.`, 'instagram');
              }
              
              // Если у нас есть метаданные о размере - записываем их
              if (videoAnalysis.metadata?.size) {
                const sizeMB = videoAnalysis.metadata.size;
                this.writeToLogFile(`Размер файла: ${sizeMB.toFixed(2)} MB`);
              }
            }
            
            // Выполняем проверку что video_url доступен публично
            const urlTestResponse = await axios.head(content.videoUrl, { timeout: 5000 })
              .catch(e => {
                log(`[Instagram] Внимание! URL видео может быть недоступен: ${e.message}`, 'instagram');
                this.writeToLogFile(`Ошибка проверки URL: ${e.message}`);
                // Продолжаем выполнение, возможно, Instagram сможет получить доступ
              });
              
            if (urlTestResponse) {
              log(`[Instagram] URL видео проверен, статус: ${urlTestResponse.status}`, 'instagram');
              this.writeToLogFile(`URL доступен, статус: ${urlTestResponse.status}`);
              
              // Проверяем заголовки на наличие Content-Type и Content-Length
              const contentType = urlTestResponse.headers['content-type'];
              const contentLength = urlTestResponse.headers['content-length'];
              
              if (contentType) {
                this.writeToLogFile(`Content-Type: ${contentType}`);
                
                // Проверка на соответствие формату видео
                if (!contentType.includes('video/') && !contentType.includes('application/octet-stream')) {
                  log(`[Instagram] Внимание! URL может не содержать видео (Content-Type: ${contentType})`, 'instagram');
                }
              }
              
              if (contentLength) {
                const sizeMB = parseInt(contentLength) / (1024 * 1024);
                this.writeToLogFile(`Размер файла: ${sizeMB.toFixed(2)} MB`);
                
                // Проверка на размер файла
                if (sizeMB > 100) {
                  log(`[Instagram] Внимание! Размер видео (${sizeMB.toFixed(2)} MB) может превышать допустимый для Instagram`, 'instagram');
                }
                
                // Дополнительное предупреждение о нестандартных соотношениях сторон
                log(`[Instagram] Внимание! Убедитесь, что соотношение сторон видео соответствует требованиям Instagram (рекомендуется 9:16 или 1:1)`, 'instagram');
                this.writeToLogFile(`ВАЖНО: Рекомендуемые соотношения сторон для Instagram Reels: 9:16 (вертикальное) или 1:1 (квадратное)`);
              }
            }
          } catch (checkError: any) {
            log(`[Instagram] Ошибка при проверке URL видео: ${checkError.message}`, 'instagram');
          }
          
          log(`[Instagram] Используем тип медиа REELS для публикации видео`, 'instagram');
        } else {
          // Если это не видео или видео отсутствует, используем изображение
          log(`[Instagram] Публикация с изображением: ${imgurContent.imageUrl?.substring(0, 50) || 'null'}...`, 'instagram');
          
          // Проверка на null чтобы избежать ошибок
          if (imgurContent.imageUrl) {
            containerParams.image_url = imgurContent.imageUrl;
          } else {
            log(`[Instagram] ВНИМАНИЕ: URL изображения пустой!`, 'instagram');
            throw new Error('URL изображения отсутствует');
          }
        }
        
        // Отправляем запрос на создание контейнера с увеличенными таймаутами для видео
        log(`[Instagram] Отправка запроса на создание контейнера для ${isVideo ? 'видео' : 'изображения'}`, 'instagram');
        
        // Функция для обработки ответа создания контейнера
        const processContainerResponse = (response: any) => {
          if (!response.data) {
            throw new Error('Получен пустой ответ от Instagram API при создании контейнера');
          }
          
          if (!response.data.id) {
            // Пытаемся найти описание ошибки в ответе
            const errorMsg = response.data.error ? 
              `${response.data.error.code}: ${response.data.error.message}` : 
              'Неизвестная ошибка при создании контейнера';
            
            throw new Error(errorMsg);
          }
          
          return response.data.id;
        };
        
        // Переменная для хранения ID контейнера
        let containerId: string;
        
        try {
          // Создаем контейнер
          const containerResponse = await axios.post(
            containerUrl, 
            containerParams, 
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: isVideo ? 120000 : 60000 // Увеличенный таймаут для видео (2 минуты)
            }
          );
          
          log(`[Instagram] Ответ API (создание контейнера): ${JSON.stringify(containerResponse.data)}`, 'instagram');
          
          // Пишем логи в файл для диагностики
          this.writeToLogFile(`CONTAINER PARAMS: ${JSON.stringify(containerParams)}`);
          this.writeToLogFile(`CONTAINER RESPONSE: ${JSON.stringify(containerResponse.data)}`);
          
          containerId = processContainerResponse(containerResponse);
          log(`[Instagram] Успешно создан контейнер с ID: ${containerId}`, 'instagram');
          this.writeToLogFile(`CONTAINER ID: ${containerId}`);
        } catch (error: any) {
          log(`[Instagram] Ошибка при создании контейнера: ${error.message}`, 'instagram');
          
          // Записываем ошибку в файл логов
          let logMessage = `INSTAGRAM ERROR: ${error.message}`;
          if (error.response && error.response.data) {
            logMessage += `\nRESPONSE DATA: ${JSON.stringify(error.response.data)}`;
          }
          this.writeToLogFile(logMessage);
          
          // Если ошибка связана с видео, пробуем загрузить изображение вместо него
          if (isVideo && imgurContent.imageUrl) {
            log(`[Instagram] Попытка создать контейнер с изображением вместо видео`, 'instagram');
            
            // Изменяем параметры запроса на изображение
            containerParams.video_url = undefined;
            containerParams.media_type = undefined;
            containerParams.image_url = imgurContent.imageUrl;
            
            try {
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
              
              containerId = processContainerResponse(fallbackResponse);
              log(`[Instagram] Успешно создан резервный контейнер с изображением, ID: ${containerId}`, 'instagram');
            } catch (fallbackError: any) {
              log(`[Instagram] Ошибка при создании резервного контейнера: ${fallbackError.message}`, 'instagram');
              return {
                platform: 'instagram',
                status: 'failed',
                publishedAt: null,
                error: `Ошибка при создании контейнера (даже с резервным изображением): ${fallbackError.message}`
              };
            }
          } else {
            // Если это не видео или нет резервного изображения, возвращаем ошибку
            return {
              platform: 'instagram',
              status: 'failed',
              publishedAt: null,
              error: `Ошибка при создании контейнера: ${error.message}`
            };
          }
        }
        
        log(`[Instagram] Этап 2 - публикация контейнера ${containerId}`, 'instagram');
        
        // Формируем URL запроса для публикации
        const publishUrl = `${baseUrl}/${businessAccountId}/media_publish`;
        
        // Подготавливаем параметры запроса
        const publishParams = {
          creation_id: containerId,
          access_token: token
        };
        
        this.writeToLogFile(`PUBLISH PARAMS: ${JSON.stringify(publishParams)}`);
        
        // Для видео добавляем задержку перед публикацией и механизм повторных попыток
        // Instagram требует значительного времени для обработки видео (особенно REELS)
        if (isVideo) {
          log(`[Instagram] Начало процесса ожидания и проверки готовности видео контейнера`, 'instagram');
          
          // Записываем в лог файл факт начала ожидания
          this.writeToLogFile(`Начало периода ожидания для обработки видео Instagram...`);
          
          // Ожидаем начальные 40 секунд перед первыми проверками статуса
          log(`[Instagram] Начальное ожидание 40 секунд для обработки видео...`, 'instagram');
          this.writeToLogFile(`Начальное ожидание 40 секунд для обработки видео Instagram...`);
          
          await new Promise(resolve => setTimeout(resolve, 40000));
          
          // Проверка статуса контейнера и умная стратегия ожидания
          // Увеличиваем максимальное число проверок для видео Reels
          const maxAttempts = 8; // Реализация до 8 попыток с увеличивающимися интервалами
          let attempts = 0;
          let isReady = false;
          
          // Функция для проверки статуса контейнера
          const checkContainerStatus = async (): Promise<boolean> => {
            try {
              const statusUrl = `${baseUrl}/${containerId}`;
              const statusParams = {
                fields: 'status_code',
                access_token: token
              };
              
              log(`[Instagram] Проверка статуса контейнера ${containerId}...`, 'instagram');
              
              const statusResponse = await axios.get(statusUrl, {
                params: statusParams,
                headers: {
                  'Cache-Control': 'no-cache'
                },
                timeout: 15000 // Увеличенный таймаут для надежности
              });
              
              // Записываем результат в логи
              const statusLogMessage = `Ответ статуса: ${JSON.stringify(statusResponse.data)}`;
              this.writeToLogFile(statusLogMessage);
              
              // Проверяем статус контейнера
              if (statusResponse.data && statusResponse.data.status_code) {
                log(`[Instagram] Получен статус: ${statusResponse.data.status_code}`, 'instagram');
                
                if (statusResponse.data.status_code === 'FINISHED') {
                  return true;
                } else if (statusResponse.data.status_code === 'IN_PROGRESS') {
                  log(`[Instagram] Обработка видео продолжается...`, 'instagram');
                } else if (statusResponse.data.status_code === 'ERROR') {
                  log(`[Instagram] Ошибка обработки видео на стороне Instagram`, 'instagram');
                  this.writeToLogFile(`Instagram вернул статус ERROR для контейнера ${containerId}`);
                  
                  // Проверка дополнительных полей ошибки, если они доступны
                  if (statusResponse.data.status_issues) {
                    log(`[Instagram] Детали ошибки: ${JSON.stringify(statusResponse.data.status_issues)}`, 'instagram');
                    this.writeToLogFile(`Детали ошибки: ${JSON.stringify(statusResponse.data.status_issues)}`);
                  }
                  
                  // Если это видео-контент, пробуем запросить расширенную информацию
                  try {
                    const detailsUrl = `${baseUrl}/${containerId}`;
                    const detailsParams = {
                      fields: 'status_code,status_issues,error_message,video_status,media_type',
                      access_token: token
                    };
                    
                    log(`[Instagram] Запрашиваем расширенные детали ошибки`, 'instagram');
                    
                    const detailsResponse = await axios.get(detailsUrl, {
                      params: detailsParams,
                      timeout: 10000
                    });
                    
                    if (detailsResponse.data) {
                      log(`[Instagram] Расширенные детали: ${JSON.stringify(detailsResponse.data)}`, 'instagram');
                      this.writeToLogFile(`Расширенные детали ошибки: ${JSON.stringify(detailsResponse.data)}`);
                    }
                  } catch (detailsError) {
                    log(`[Instagram] Не удалось получить расширенные детали ошибки: ${detailsError.message}`, 'instagram');
                  }
                  
                  // Возвращаем false, чтобы перейти к альтернативной стратегии публикации
                  return false;
                }
              }
              return false;
            } catch (statusError: any) {
              log(`[Instagram] Ошибка при проверке статуса контейнера: ${statusError.message}`, 'instagram');
              
              // Записываем ошибку в лог
              try {
                const errorLogMessage = `Ошибка при проверке статуса: ${statusError.message}`;
                this.writeToLogFile(errorLogMessage);
                
                // Дополнительно логируем данные ответа при наличии
                if (statusError.response && statusError.response.data) {
                  const responseLogMessage = `Данные ответа: ${JSON.stringify(statusError.response.data)}`;
                  this.writeToLogFile(responseLogMessage);
                }
              } catch (e) {
                log(`[Instagram] Ошибка записи в лог-файл: ${e}`, 'instagram');
              }
              
              return false;
            }
          };
          
          // Цикл проверок с прогрессивным увеличением времени ожидания
          while (attempts < maxAttempts && !isReady) {
            attempts++;
            
            // Проверяем статус контейнера
            isReady = await checkContainerStatus();
            
            if (isReady) {
              this.writeToLogFile(`Контейнер видео готов к публикации после ${attempts} проверки`);
              log(`[Instagram] Контейнер видео готов к публикации после ${attempts} проверки`, 'instagram');
            } else if (attempts < maxAttempts) {
              // Прогрессивно увеличиваем время ожидания с каждой попыткой
              // Первые попытки - 20 сек, затем 30, 40, 50, 60...
              const waitTime = (20000 + (attempts * 10000)); 
              this.writeToLogFile(`Видео не готово, ожидание ещё ${waitTime/1000} секунд перед попыткой ${attempts+1}/${maxAttempts}...`);
              
              log(`[Instagram] Видео не готово, ожидание ${waitTime/1000} секунд перед следующей попыткой...`, 'instagram');
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              this.writeToLogFile(`Последняя попытка публикации после ${maxAttempts} проверок. Пробуем опубликовать, даже если статус не FINISHED`);
              log(`[Instagram] Последняя попытка публикации после ${maxAttempts} проверок. Пробуем опубликовать, даже если статус не FINISHED`, 'instagram');
            }
          }
        }
        
        // Публикуем контейнер
        try {
          log(`[Instagram] Отправка запроса на публикацию контейнера: ${containerId}`, 'instagram');
          
          const publishResponse = await axios.post(
            publishUrl, 
            null, 
            {
              params: publishParams,
              headers: { 'Content-Type': 'application/json' },
              timeout: 60000 // Увеличенный таймаут для надежности
            }
          );
          
          this.writeToLogFile(`PUBLISH RESPONSE: ${JSON.stringify(publishResponse.data)}`);
          
          // Проверяем ответ
          if (publishResponse.data && publishResponse.data.id) {
            const igMediaId = publishResponse.data.id;
            log(`[Instagram] Успешно опубликовано в Instagram, ID: ${igMediaId}`, 'instagram');
            
            // Для получения permalink нужен отдельный запрос
            log(`[Instagram] Этап 3 - получение постоянной ссылки для ${igMediaId}`, 'instagram');
            
            // Запрашиваем данные о посте для получения permalink
            try {
              const mediaInfoUrl = `${baseUrl}/${igMediaId}`;
              const mediaInfoParams = {
                fields: 'id,permalink,media_type,media_url,thumbnail_url',
                access_token: token
              };
              
              const mediaInfoResponse = await axios.get(mediaInfoUrl, {
                params: mediaInfoParams,
                timeout: 30000
              });
              
              this.writeToLogFile(`MEDIA INFO RESPONSE: ${JSON.stringify(mediaInfoResponse.data)}`);
              
              // Получаем permalink
              let permalink = null;
              if (mediaInfoResponse.data && mediaInfoResponse.data.permalink) {
                permalink = mediaInfoResponse.data.permalink;
                log(`[Instagram] Получен permalink: ${permalink}`, 'instagram');
              } else {
                log(`[Instagram] Не удалось получить permalink`, 'instagram');
              }
              
              return {
                platform: 'instagram',
                status: 'published',
                publishedAt: new Date(),
                mediaId: igMediaId,
                url: permalink,
                error: null
              };
            } catch (permalinkError: any) {
              log(`[Instagram] Ошибка при получении permalink: ${permalinkError.message}`, 'instagram');
              
              // Возвращаем успешный результат без permalink
              return {
                platform: 'instagram',
                status: 'published',
                publishedAt: new Date(),
                mediaId: igMediaId,
                url: null,
                error: null
              };
            }
          } else {
            // В редких случаях API может вернуть успешный ответ, но без ID
            log(`[Instagram] Странный ответ от API: ${JSON.stringify(publishResponse.data)}`, 'instagram');
            
            return {
              platform: 'instagram',
              status: 'failed',
              publishedAt: null,
              error: 'Получен неполный ответ от Instagram API'
            };
          }
        } catch (publishError: any) {
          log(`[Instagram] Ошибка при публикации контейнера: ${publishError.message}`, 'instagram');
          
          // Записываем ошибку публикации в лог
          this.writeToLogFile(`PUBLISH ERROR: ${publishError.message}`);
          if (publishError.response && publishError.response.data) {
            this.writeToLogFile(`PUBLISH ERROR DATA: ${JSON.stringify(publishError.response.data)}`);
          }
          
          // Анализируем ошибку на предмет временной недоступности API
          const isTemporaryError = 
            publishError.message.includes('timeout') ||
            publishError.message.includes('rate limit') ||
            (publishError.response && publishError.response.status >= 500) ||
            (publishError.response && publishError.response.data && 
            (publishError.response.data.error?.message?.includes('temporarily') || 
             publishError.response.data.error?.message?.includes('try again'))
            );
          
          return {
            platform: 'instagram',
            status: 'failed',
            publishedAt: null,
            error: `Ошибка при публикации${isTemporaryError ? ' (временная)' : ''}: ${publishError.message}`
          };
        }
      } catch (exception: any) {
        log(`[Instagram] Исключение при публикации: ${exception.message}`, 'instagram');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка при публикации в Instagram: ${exception.message}`
        };
      }
    } catch (error: any) {
      log(`[Instagram] Общая ошибка при публикации: ${error.message}`, 'instagram');
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: `Общая ошибка при публикации в Instagram: ${error.message}`
      };
    }
  }
}

export const instagramService = new InstagramService();