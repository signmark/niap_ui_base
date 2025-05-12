import axios from 'axios';
import { log } from '../../utils/logger';
import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { BaseSocialService } from './base-service';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

// Вспомогательная функция для задержки выполнения кода
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Сервис для публикации контента в Instagram
 */
export class InstagramService extends BaseSocialService {
  /**
   * Публикует сторис в Instagram
   * @param content Контент для публикации
   * @param instagramSettings Настройки Instagram API
   * @param socialMediaSettings Настройки социальных медиа
   * @returns Результат публикации
   */
  async publishStory(
    content: CampaignContent,
    instagramSettings: { token: string | null; accessToken: string | null; businessAccountId: string | null },
    socialMediaSettings: SocialMediaSettings | undefined
  ): Promise<SocialPublication> {
    try {
      // Более подробное логирование
      log(`[Instagram Stories] Началась публикация сторис с параметрами:
      - Токен: ${instagramSettings.token ? 'Задан (первые 10 символов: ' + instagramSettings.token.substr(0, 10) + '...)' : 'Отсутствует'}
      - Access Токен: ${instagramSettings.accessToken ? 'Задан (первые 10 символов: ' + instagramSettings.accessToken.substr(0, 10) + '...)' : 'Отсутствует'}
      - Business Account ID: ${instagramSettings.businessAccountId || 'отсутствует'}
      - Тип контента: ${content.contentType}
      - ID контента: ${content.id}
      - Передан объект socialMediaSettings: ${socialMediaSettings ? 'Да' : 'Нет'}`, 'instagram');
      
      // Проверяем наличие socialMediaSettings
      if (!socialMediaSettings) {
        log(`[Instagram] Предупреждение: socialMediaSettings не определен, будет использована пустая конфигурация`, 'instagram');
        socialMediaSettings = {}; // Устанавливаем пустой объект по умолчанию
      }
      
      // Проверяем наличие необходимых параметров
      if (!instagramSettings.token && !instagramSettings.accessToken || !instagramSettings.businessAccountId) {
        log(`Ошибка публикации сторис в Instagram: отсутствуют настройки. Token/accessToken: ${instagramSettings.token || instagramSettings.accessToken ? 'задан' : 'отсутствует'}, Business Account ID: ${instagramSettings.businessAccountId ? 'задан' : 'отсутствует'}`, 'instagram');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Отсутствуют настройки Instagram API (токен или ID бизнес-аккаунта)'
        };
      }

      // Используем token или accessToken
      const token = instagramSettings.token || instagramSettings.accessToken;
      const businessAccountId = instagramSettings.businessAccountId;

      log(`[Instagram] Начинаем публикацию сторис в Instagram c бизнес-аккаунтом: ${businessAccountId}`, 'instagram');

      // РАСШИРЕННАЯ ПРОВЕРКА МЕДИА ДЛЯ СТОРИС
      // Проверка стандартных полей медиа
      let hasMedia = Boolean(content.imageUrl || content.videoUrl);
      // Определяем тип контента для сторис
      const isStoriesContent = content.contentType === 'stories';
      
      // СПЕЦИАЛЬНАЯ ОБРАБОТКА JSON-ОБЪЕКТОВ В ФОРМАТЕ ["url": "...", "type": "image"]
      // Проверяем поле additionalImages - массив JSON объектов как на скриншоте
      if (!hasMedia && content.additionalImages) {
        log(`[Instagram] Проверка поля additionalImages на формат JSON-объектов с url и type...`, 'instagram');
        
        // Если это строка, пытаемся парсить её как JSON
        if (typeof content.additionalImages === 'string') {
          try {
            log(`[Instagram] additionalImages является строкой, пробуем парсить JSON...`, 'instagram');
            content.additionalImages = JSON.parse(content.additionalImages);
            log(`[Instagram] additionalImages успешно преобразован из JSON в объект`, 'instagram');
          } catch (e) {
            log(`[Instagram] Ошибка при парсинге JSON в additionalImages: ${e.message}`, 'instagram', 'warn');
          }
        }
        
        // Теперь проверяем, является ли поле массивом объектов с полем url
        if (Array.isArray(content.additionalImages) && content.additionalImages.length > 0) {
          // Детальное логирование первого элемента
          const firstItem = content.additionalImages[0];
          log(`[Instagram] Первый элемент additionalImages: ${JSON.stringify(firstItem)}`, 'instagram');
          
          // Проверяем наличие поля url у первого элемента массива
          if (typeof firstItem === 'object' && firstItem && firstItem.url) {
            log(`[Instagram] ОБНАРУЖЕН URL В ОБЪЕКТЕ ФОРМАТА {url, type}: ${firstItem.url}`, 'instagram');
            // Используем найденный URL как основной для публикации
            content.imageUrl = firstItem.url;
            hasMedia = true;
            log(`[Instagram] Установлен imageUrl из additionalImages[0].url: ${content.imageUrl}`, 'instagram');
          }
        }
      }
      
      // Аналогичная проверка для поля additional_images (с подчеркиванием)
      if (!hasMedia && content.additional_images) {
        log(`[Instagram] Проверка поля additional_images на формат JSON-объектов с url и type...`, 'instagram');
        
        // Если это строка, пытаемся парсить её как JSON
        if (typeof content.additional_images === 'string') {
          try {
            log(`[Instagram] additional_images является строкой, пробуем парсить JSON...`, 'instagram');
            content.additional_images = JSON.parse(content.additional_images);
            log(`[Instagram] additional_images успешно преобразован из JSON в объект`, 'instagram');
          } catch (e) {
            log(`[Instagram] Ошибка при парсинге JSON в additional_images: ${e.message}`, 'instagram', 'warn');
          }
        }
        
        // Теперь проверяем, является ли поле массивом объектов с полем url
        if (Array.isArray(content.additional_images) && content.additional_images.length > 0) {
          // Детальное логирование первого элемента
          const firstItem = content.additional_images[0];
          log(`[Instagram] Первый элемент additional_images: ${JSON.stringify(firstItem)}`, 'instagram');
          
          // Проверяем наличие поля url у первого элемента массива
          if (typeof firstItem === 'object' && firstItem && firstItem.url) {
            log(`[Instagram] ОБНАРУЖЕН URL В ОБЪЕКТЕ ФОРМАТА {url, type}: ${firstItem.url}`, 'instagram');
            // Используем найденный URL как основной для публикации
            content.imageUrl = firstItem.url;
            hasMedia = true;
            log(`[Instagram] Установлен imageUrl из additional_images[0].url: ${content.imageUrl}`, 'instagram');
          }
        }
      }
      
      // Логируем тип контента и начинаем поиск медиа
      log(`[Instagram Stories] Тип контента: ${content.contentType}, isStoriesContent: ${isStoriesContent}`, 'instagram');
      
      // ПОДРОБНОЕ ЛОГИРОВАНИЕ ВСЕХ ПОЛЕЙ КОНТЕНТА ДЛЯ ОТЛАДКИ
      log(`[Instagram Stories] ДИАГНОСТИКА: Доступные поля в контенте:
        id: ${content.id || 'отсутствует'}
        contentType: ${content.contentType || 'отсутствует'}
        Текст заголовка: ${content.title ? content.title.substring(0, 50) + '...' : 'отсутствует'}
        Текст контента: ${content.content ? content.content.substring(0, 50) + '...' : 'отсутствует'}
        imageUrl: ${content.imageUrl || 'отсутствует'}
        videoUrl: ${content.videoUrl || 'отсутствует'}
        additionalImages: ${content.additionalImages ? (typeof content.additionalImages === 'string' ? 'строка (возможно JSON)' : (Array.isArray(content.additionalImages) ? `массив (${content.additionalImages.length} элементов)` : typeof content.additionalImages)) : 'отсутствует'}
        additionalMedia: ${content.additionalMedia ? (typeof content.additionalMedia === 'string' ? 'строка (возможно JSON)' : (Array.isArray(content.additionalMedia) ? `массив (${content.additionalMedia.length} элементов)` : typeof content.additionalMedia)) : 'отсутствует'}
        mediaFiles: ${content.mediaFiles ? (Array.isArray(content.mediaFiles) ? `массив (${content.mediaFiles.length} элементов)` : typeof content.mediaFiles) : 'отсутствует'}
        media: ${content.media ? (typeof content.media === 'string' ? 'строка (возможно JSON)' : typeof content.media) : 'отсутствует'}
        storyMedia: ${content.storyMedia ? (typeof content.storyMedia === 'string' ? 'строка (возможно JSON)' : typeof content.storyMedia) : 'отсутствует'}
        storiesMedia: ${content.storiesMedia ? (typeof content.storiesMedia === 'string' ? 'строка (возможно JSON)' : typeof content.storiesMedia) : 'отсутствует'}
        additional_images: ${content.additional_images ? (typeof content.additional_images === 'string' ? 'строка (возможно JSON)' : (Array.isArray(content.additional_images) ? `массив (${content.additional_images.length} элементов)` : typeof content.additional_images)) : 'отсутствует'}
      `, 'instagram');
      
      try {
        // Если основные поля пусты - ищем в дополнительных полях
        if (!hasMedia) {
          log(`[Instagram Stories] imageUrl и videoUrl отсутствуют, проверяем дополнительные поля`, 'instagram');
          
          // Обрабатываем JSON-строки в полях с медиа - с расширенным логированием
          function tryParseJson(value, fieldName) {
            if (!value) return null;
            
            if (typeof value === 'string' && (value.trim().startsWith('[') || value.trim().startsWith('{'))) {
              try {
                log(`[Instagram Stories] Попытка распарсить JSON в поле ${fieldName}`, 'instagram');
                const parsed = JSON.parse(value);
                log(`[Instagram Stories] Успешно распарсили JSON в поле ${fieldName}: ${typeof parsed === 'object' ? (Array.isArray(parsed) ? `массив (${parsed.length} элементов)` : 'объект') : typeof parsed}`, 'instagram');
                return parsed;
              } catch (e) {
                log(`[Instagram Stories] Ошибка парсинга JSON в поле ${fieldName}: ${e.message}`, 'instagram');
                return value;
              }
            }
            return value;
          }
          
          // Расширенный список полей с медиа для проверки
          const fieldChecklist = [
            { field: 'additionalMedia', value: content.additionalMedia },
            { field: 'additionalImages', value: content.additionalImages },
            { field: 'additional_images', value: content.additional_images },
            { field: 'mediaFiles', value: content.mediaFiles },
            { field: 'media', value: content.media },
            { field: 'storyMedia', value: content.storyMedia },
            { field: 'storiesMedia', value: content.storiesMedia },
            { field: 'storyMediaFiles', value: content.storyMediaFiles },
            { field: 'story_media', value: content.story_media }
          ];
          
          // Перебираем все возможные поля и пытаемся распарсить JSON
          const parsedFields = fieldChecklist.map(item => ({
            field: item.field,
            value: tryParseJson(item.value, item.field)
          })).filter(item => item.value !== null);
          
          // Расширенная функция для извлечения URL из различных структур данных
          function extractMediaUrl(mediaField, fieldName) {
            if (!mediaField) return null;
            
            // Логируем тип обрабатываемого значения
            log(`[Instagram Stories] Обработка поля ${fieldName}: ${typeof mediaField} ${Array.isArray(mediaField) ? `(массив из ${mediaField.length} элементов)` : ''}`, 'instagram');
            
            // Если это массив
            if (Array.isArray(mediaField) && mediaField.length > 0) {
              // Перебираем все элементы в поисках медиа
              for (let i = 0; i < mediaField.length; i++) {
                const item = mediaField[i];
                // Если элемент - строка
                if (typeof item === 'string' && item.trim()) {
                  log(`[Instagram Stories] Найден URL в массиве ${fieldName}[${i}]: ${item.substring(0, 50)}...`, 'instagram');
                  return item.trim();
                }
                // Если элемент - объект
                else if (typeof item === 'object' && item) {
                  // Проверяем все возможные поля с URL
                  const possibleUrlFields = ['url', 'file', 'src', 'path', 'uri', 'link', 'href', 'image', 'video'];
                  for (const urlField of possibleUrlFields) {
                    if (item[urlField] && typeof item[urlField] === 'string' && item[urlField].trim()) {
                      log(`[Instagram Stories] Найден URL в ${fieldName}[${i}].${urlField}: ${item[urlField].substring(0, 50)}...`, 'instagram');
                      return item[urlField].trim();
                    }
                  }
                  
                  // Проверяем вложенные объекты на уровень глубже
                  if (item.image && typeof item.image === 'object' && item.image.url) {
                    log(`[Instagram Stories] Найден URL в ${fieldName}[${i}].image.url: ${item.image.url.substring(0, 50)}...`, 'instagram');
                    return item.image.url;
                  }
                  if (item.video && typeof item.video === 'object' && item.video.url) {
                    log(`[Instagram Stories] Найден URL в ${fieldName}[${i}].video.url: ${item.video.url.substring(0, 50)}...`, 'instagram');
                    return item.video.url;
                  }
                }
              }
            }
            // Если это объект с URL
            else if (typeof mediaField === 'object' && mediaField) {
              // Проверяем все возможные поля с URL
              const possibleUrlFields = ['url', 'file', 'src', 'path', 'uri', 'link', 'href', 'image', 'video'];
              for (const urlField of possibleUrlFields) {
                if (mediaField[urlField]) {
                  if (typeof mediaField[urlField] === 'string' && mediaField[urlField].trim()) {
                    log(`[Instagram Stories] Найден URL в ${fieldName}.${urlField}: ${mediaField[urlField].substring(0, 50)}...`, 'instagram');
                    return mediaField[urlField].trim();
                  } else if (typeof mediaField[urlField] === 'object' && mediaField[urlField] && mediaField[urlField].url) {
                    log(`[Instagram Stories] Найден URL в ${fieldName}.${urlField}.url: ${mediaField[urlField].url.substring(0, 50)}...`, 'instagram');
                    return mediaField[urlField].url;
                  }
                }
              }
              
              // Проверяем вложенные объекты
              if (mediaField.image && typeof mediaField.image === 'object' && mediaField.image.url) {
                log(`[Instagram Stories] Найден URL в ${fieldName}.image.url: ${mediaField.image.url.substring(0, 50)}...`, 'instagram');
                return mediaField.image.url;
              }
              if (mediaField.video && typeof mediaField.video === 'object' && mediaField.video.url) {
                log(`[Instagram Stories] Найден URL в ${fieldName}.video.url: ${mediaField.video.url.substring(0, 50)}...`, 'instagram');
                return mediaField.video.url;
              }
            }
            // Если это строка (URL)
            else if (typeof mediaField === 'string' && mediaField.trim()) {
              log(`[Instagram Stories] Найден URL в ${fieldName}: ${mediaField.substring(0, 50)}...`, 'instagram');
              return mediaField.trim();
            }
            return null;
          }
          
          // Ищем медиа-URL в каждом распарсенном поле
          let mediaUrl = null;
          for (const parsedField of parsedFields) {
            const extractedUrl = extractMediaUrl(parsedField.value, parsedField.field);
            if (extractedUrl) {
              mediaUrl = extractedUrl;
              log(`[Instagram Stories] Найден медиа-URL в поле ${parsedField.field}: ${mediaUrl.substring(0, 50)}...`, 'instagram');
              break;
            }
          }
          
          // Если ничего не нашли, проверяем непарсенные поля напрямую
          if (!mediaUrl) {
            for (const item of fieldChecklist) {
              if (!item.value) continue;
              
              const extractedUrl = extractMediaUrl(item.value, item.field);
              if (extractedUrl) {
                mediaUrl = extractedUrl;
                log(`[Instagram Stories] Найден медиа-URL в непарсенном поле ${item.field}: ${mediaUrl.substring(0, 50)}...`, 'instagram');
                break;
              }
            }
          }
          
          // Если нашли медиа, сохраняем его
          if (mediaUrl) {
            log(`[Instagram Stories] УСПЕХ! Найдено медиа: ${mediaUrl.substring(0, 100)}...`, 'instagram');
            // По умолчанию считаем, что это изображение
            content.imageUrl = mediaUrl;
            hasMedia = true;
          } else {
            log(`[Instagram Stories] ПРЕДУПРЕЖДЕНИЕ: Не удалось найти медиа в контенте. Публикация будет отклонена.`, 'instagram', 'warn');
          }
        }
      } catch (error) {
        log(`[Instagram Stories] Ошибка при обработке медиа: ${error.message}`, 'instagram', 'error');
      }
      
      // Более подробное логирование состояния медиа перед проверкой
      log(`[Instagram Debug] Итоговое состояние медиа-файлов:
      - hasMedia: ${hasMedia}
      - imageUrl: ${content.imageUrl || 'не задан'}
      - videoUrl: ${content.videoUrl || 'не задан'}
      - additionalImages: ${content.additionalImages ? (Array.isArray(content.additionalImages) ? `${content.additionalImages.length} файлов` : 'не является массивом') : 'не задан'}
      - additionalMedia: ${content.additionalMedia ? (Array.isArray(content.additionalMedia) ? `${content.additionalMedia.length} файлов` : 'не является массивом') : 'не задан'}
      - Тип контента: ${content.contentType}
      - Это сторис: ${isStoriesContent}`, 'instagram');
      
      // Проверка особенно строгая для контента типа "stories"
      if (!hasMedia) {
        // Проверка полей, которые могли быть пропущены при первоначальной проверке
        if (content.id === 'e8936ebf-75d3-4dd1-9f85-1970f186b219') {
          // Специальная расширенная диагностика для проблемного контента
          log(`[Instagram Stories] 📢 РАСШИРЕННАЯ ДИАГНОСТИКА для контента ID ${content.id}`, 'instagram', 'warn');
          
          // Проверяем поле storyMediaFiles с повышенной тщательностью
          if (content.storyMediaFiles) {
            log(`[Instagram Stories] Проверка storyMediaFiles: ${typeof content.storyMediaFiles}`, 'instagram');
            try {
              let mediaData = content.storyMediaFiles;
              
              // Пытаемся распарсить, если это строка
              if (typeof mediaData === 'string') {
                mediaData = JSON.parse(mediaData);
                log(`[Instagram Stories] storyMediaFiles распарсен в: ${JSON.stringify(mediaData).substring(0, 200)}...`, 'instagram');
              }
              
              // Если это массив или объект, ищем URL
              if (mediaData && typeof mediaData === 'object') {
                if (Array.isArray(mediaData) && mediaData.length > 0) {
                  for (const item of mediaData) {
                    if (typeof item === 'string' && item.includes('http')) {
                      content.imageUrl = item.trim();
                      hasMedia = true;
                      log(`[Instagram Stories] Найден URL в storyMediaFiles: ${content.imageUrl}`, 'instagram', 'warn');
                      break;
                    } else if (typeof item === 'object' && item && item.url) {
                      content.imageUrl = item.url.trim();
                      hasMedia = true;
                      log(`[Instagram Stories] Найден URL в storyMediaFiles[].url: ${content.imageUrl}`, 'instagram', 'warn');
                      break;
                    }
                  }
                } else if (mediaData.url) {
                  content.imageUrl = mediaData.url.trim();
                  hasMedia = true;
                  log(`[Instagram Stories] Найден URL в storyMediaFiles.url: ${content.imageUrl}`, 'instagram', 'warn');
                }
              }
            } catch (e) {
              log(`[Instagram Stories] Ошибка при обработке storyMediaFiles: ${e.message}`, 'instagram', 'warn');
            }
          }
        }
        
        // Если медиа до сих пор не найдено
        if (!hasMedia) {
          let errorMessage = 'Для публикации в Instagram необходимо изображение или видео';
          if (isStoriesContent) {
            errorMessage = 'Для публикации сторис в Instagram необходимо указать изображение или видео. Пожалуйста, добавьте медиафайл в разделе "Медиа для сторис" перед публикацией.';
          }
          return {
            platform: 'instagram',
            status: 'failed',
            error: errorMessage,
            publishedAt: null,
          };
        }
      }

      // ВАЖНО: В производственном режиме не используются заглушки (mock)
      // Только если специально указан тестовый режим в .env и мы в режиме разработки
      if (process.env.INSTAGRAM_TEST_MODE === 'mock' && process.env.NODE_ENV === 'development') {
        log(`[Instagram] Тестовый режим в среде разработки: возвращаем фиктивный результат без реального обращения к API`, 'instagram', 'warn');
        log(`[Instagram] В ПРОИЗВОДСТВЕННОЙ СРЕДЕ ЗАГЛУШКИ ДОЛЖНЫ БЫТЬ ОТКЛЮЧЕНЫ`, 'instagram', 'warn');
        return {
          platform: 'instagram',
          status: 'published',
          publishedAt: new Date(),
          postUrl: `https://www.instagram.com/stories/user_test_${Date.now()}/`
        };
      }
      
      // Для сервера разработки добавляем дополнительную проверку тестового контента
      if (process.env.NODE_ENV === 'development' && process.env.INSTAGRAM_TEST_CONTENT_ID && content.id === process.env.INSTAGRAM_TEST_CONTENT_ID) {
        log(`[Instagram] Обнаружен тестовый контент с ID: ${content.id}. Пропускаем реальное обращение к API только для этого контента.`, 'instagram', 'warn');
        return {
          platform: 'instagram',
          status: 'published',
          publishedAt: new Date(),
          postUrl: `https://www.instagram.com/stories/dev_test_${Date.now()}/`
        };
      }
      
      // Базовый URL для Graph API
      const baseUrl = 'https://graph.facebook.com/v17.0';

      // Шаг 1: Создание контейнера для сторис
      let mediaType: string;
      let mediaUrl: string;
      let caption: string = '';

      // Если есть контент, форматируем его для Instagram
      if (content.content) {
        const formattedText = this.formatTextForInstagram(content.content);
        if (formattedText.length > 0) {
          caption = formattedText.slice(0, 2200); // Ограничение для подписи сторис
        }
      }

      // Вспомогательная функция для определения типа медиа по URL или объекту
      /**
       * Универсальная функция для определения типа медиа файла
       * Обрабатывает различные форматы объектов и URL
       * @param mediaItem - Медиа-объект или URL-строка
       * @returns 'VIDEO' или 'IMAGE' в зависимости от определения типа
       */
      function determineMediaType(mediaItem: string | any): string {
        try {
          // Более подробное логирование с безопасной обработкой данных
          if (typeof mediaItem === 'string') {
            const safeString = mediaItem.substring(0, 30) + (mediaItem.length > 30 ? '...' : '');
            log(`[Instagram Debug] Определение типа для строки: "${safeString}"`, 'instagram');
          } else if (typeof mediaItem === 'object' && mediaItem !== null) {
            let safeObject;
            try {
              safeObject = JSON.stringify(mediaItem).substring(0, 150) + '...';
            } catch (jsonError) {
              safeObject = '[Объект невозможно преобразовать в JSON]';
            }
            log(`[Instagram Debug] Определение типа для объекта: ${safeObject}`, 'instagram');
            
            // Если объект содержит тип медиа, выведем его
            if (mediaItem.type) {
              log(`[Instagram Debug] Объект содержит явно указанный тип: ${mediaItem.type}`, 'instagram');
            }
            
            // Выведем ключи объекта для анализа
            try {
              const keys = Object.keys(mediaItem);
              log(`[Instagram Debug] Ключи объекта (${keys.length}): ${keys.join(', ')}`, 'instagram');
            } catch (keysError) {
              log(`[Instagram Debug] Не удалось получить ключи объекта: ${keysError.message}`, 'instagram', 'error');
            }
          } else {
            log(`[Instagram Debug] Определение типа для: ${typeof mediaItem}`, 'instagram');
          }
          
          // Обработка null или undefined значений
          if (mediaItem === null || mediaItem === undefined) {
            log(`[Instagram Debug] Получен null/undefined, по умолчанию будет использован тип IMAGE`, 'instagram');
            return 'IMAGE';
          }
          
          // Обработка объектов
          if (typeof mediaItem !== 'string') {
            // Если это массив, обрабатываем первый элемент
            if (Array.isArray(mediaItem)) {
              log(`[Instagram Debug] Обнаружен массив с ${mediaItem.length} элементами`, 'instagram');
              if (mediaItem.length === 0) {
                log(`[Instagram Debug] Получен пустой массив, по умолчанию будет использован тип IMAGE`, 'instagram');
                return 'IMAGE';
              }
              log(`[Instagram Debug] Обрабатываю первый элемент массива`, 'instagram');
              return determineMediaType(mediaItem[0]);
            }
            
            // Обработка специального случая для объекта с вложенным URL
            if (mediaItem.url && typeof mediaItem.url === 'object' && mediaItem.url.url) {
              log(`[Instagram Debug] Обнаружен вложенный URL в объекте: ${mediaItem.url.url}`, 'instagram');
              if (typeof mediaItem.url.url === 'string') {
                return determineMediaTypeFromUrl(mediaItem.url.url);
              }
            }
            
            // Если это объект, проверяем различные поля для определения типа
            if (mediaItem && typeof mediaItem === 'object') {
              // 1. Проверка явного поля type или media_type
              const typeFields = ['type', 'media_type', 'mediaType', 'media-type'];
              for (const field of typeFields) {
                if (mediaItem[field]) {
                  const typeStr = String(mediaItem[field]).toLowerCase();
                  if (typeStr === 'video' || typeStr.includes('video')) {
                    log(`[Instagram Debug] Тип определен из объекта: VIDEO (из поля ${field}: ${mediaItem[field]})`, 'instagram');
                    return 'VIDEO';
                  }
                  if (typeStr === 'image' || typeStr.includes('image') || typeStr === 'photo' || typeStr.includes('photo')) {
                    log(`[Instagram Debug] Тип определен из объекта: IMAGE (из поля ${field}: ${mediaItem[field]})`, 'instagram');
                    return 'IMAGE';
                  }
                }
              }
              
              // 2. Проверка полей MIME типа
              const mimeFields = ['mime', 'mimeType', 'mime_type', 'content-type', 'contentType'];
              for (const field of mimeFields) {
                if (mediaItem[field]) {
                  const mimeStr = String(mediaItem[field]).toLowerCase();
                  if (mimeStr.includes('video/')) {
                    log(`[Instagram Debug] Тип определен из объекта: VIDEO (из поля ${field}: ${mimeStr})`, 'instagram');
                    return 'VIDEO';
                  }
                  if (mimeStr.includes('image/')) {
                    log(`[Instagram Debug] Тип определен из объекта: IMAGE (из поля ${field}: ${mimeStr})`, 'instagram');
                    return 'IMAGE';
                  }
                }
              }
              
              // 3. Проверка на основе имени файла
              const fileNameFields = ['filename', 'fileName', 'name', 'file_name', 'title'];
              for (const field of fileNameFields) {
                if (mediaItem[field] && typeof mediaItem[field] === 'string') {
                  const filename = String(mediaItem[field]).toLowerCase();
                  log(`[Instagram Debug] Проверка имени файла: ${filename}`, 'instagram');
                  
                  // Проверка по расширению файла
                  const videoExtensions = ['.mp4', '.mov', '.avi', '.mpeg', '.mpg', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
                  if (videoExtensions.some(ext => filename.endsWith(ext))) {
                    log(`[Instagram Debug] Тип определен по имени файла: VIDEO (${filename})`, 'instagram');
                    return 'VIDEO';
                  }
                  
                  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif', '.ico', '.heic', '.heif'];
                  if (imageExtensions.some(ext => filename.endsWith(ext))) {
                    log(`[Instagram Debug] Тип определен по имени файла: IMAGE (${filename})`, 'instagram');
                    return 'IMAGE';
                  }
                }
              }
              
              // 4. Проверка URL-подобных полей
              const possibleUrlFields = ['url', 'file', 'src', 'source', 'path', 'link', 'href', 'uri', 'location'];
              for (const field of possibleUrlFields) {
                if (mediaItem[field]) {
                  // Если поле - строка
                  if (typeof mediaItem[field] === 'string') {
                    log(`[Instagram Debug] Определение типа по полю ${field} (строка): ${mediaItem[field].substring(0, 30)}...`, 'instagram');
                    const typeByUrl = determineMediaTypeFromUrl(mediaItem[field]);
                    return typeByUrl;
                  } 
                  // Если поле - объект с URL
                  else if (typeof mediaItem[field] === 'object' && mediaItem[field] !== null) {
                    // Если объект имеет свойство url
                    if (mediaItem[field].url && typeof mediaItem[field].url === 'string') {
                      log(`[Instagram Debug] Определение типа по вложенному полю ${field}.url: ${mediaItem[field].url.substring(0, 30)}...`, 'instagram');
                      const typeByUrl = determineMediaTypeFromUrl(mediaItem[field].url);
                      return typeByUrl;
                    }
                  }
                }
              }
              
              log(`[Instagram Debug] Не удалось определить тип из объекта. Используем IMAGE по умолчанию.`, 'instagram');
            }
            
            // Если мы не смогли определить тип из объекта, используем тип по умолчанию
            return 'IMAGE';
          }
          
          // Если mediaItem - строка, определяем тип по URL
          return determineMediaTypeFromUrl(mediaItem);
        } catch (error) {
          log(`[Instagram Debug] Ошибка при определении типа медиа: ${error.message}`, 'instagram', 'error');
          // В случае ошибки возвращаем тип по умолчанию
          return 'IMAGE';
        }
      }
      
      /**
       * Вспомогательная функция для определения типа медиа по URL
       * @param url - URL медиа-файла
       * @returns 'VIDEO', 'IMAGE' или null, если не удалось определить тип
       */
      function determineMediaTypeFromUrl(url: string): string {
        try {
          if (!url || typeof url !== 'string') {
            log(`[Instagram Debug] URL не является строкой или пустой, возвращаю IMAGE по умолчанию`, 'instagram');
            return 'IMAGE';
          }
          
          // Безопасная копия URL для логирования
          const safeUrl = url.substring(0, 100) + (url.length > 100 ? '...' : '');
          log(`[Instagram Debug] Анализ URL для определения типа: ${safeUrl}`, 'instagram');
          
          const urlLower = url.toLowerCase();
          
          // Очищаем URL от query-параметров и хэшей для более точного определения
          const cleanUrl = urlLower.split('?')[0].split('#')[0];
          
          // 1. Проверка по расширению файла
          const videoExtensions = [
            '.mp4', '.mov', '.avi', '.mpeg', '.mpg', '.wmv', 
            '.flv', '.webm', '.mkv', '.m4v', '.ts', '.3gp'
          ];
          
          // Проверка по расширению в конце URL
          if (videoExtensions.some(ext => cleanUrl.endsWith(ext))) {
            log(`[Instagram Debug] Тип определен по расширению файла: VIDEO (расширение: ${cleanUrl.split('.').pop()})`, 'instagram');
            return 'VIDEO';
          }
          
          const imageExtensions = [
            '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', 
            '.bmp', '.tiff', '.tif', '.ico', '.heic', '.heif'
          ];
          
          if (imageExtensions.some(ext => cleanUrl.endsWith(ext))) {
            log(`[Instagram Debug] Тип определен по расширению файла: IMAGE (расширение: ${cleanUrl.split('.').pop()})`, 'instagram');
            return 'IMAGE';
          }
          
          // 2. Проверка по паттернам в URL - часто файл не имеет явного расширения,
          // но URL содержит паттерны, которые могут помочь определить тип
          
          // Регулярные выражения для выявления паттернов медиа-файлов
          const videoPatterns = [
            /\/video\//i,
            /\/videos\//i,
            /type=video/i,
            /media_type=video/i,
            /\.mp4($|\?)/i,
            /\.mov($|\?)/i,
            /\.avi($|\?)/i,
          ];
          
          for (const pattern of videoPatterns) {
            if (pattern.test(urlLower)) {
              log(`[Instagram Debug] Тип определен по паттерну в URL: VIDEO (паттерн: ${pattern})`, 'instagram');
              return 'VIDEO';
            }
          }
          
          const imagePatterns = [
            /\/image\//i,
            /\/images\//i,
            /type=image/i,
            /media_type=image/i,
            /\.jpg($|\?)/i,
            /\.jpeg($|\?)/i,
            /\.png($|\?)/i,
            /\.gif($|\?)/i,
          ];
          
          for (const pattern of imagePatterns) {
            if (pattern.test(urlLower)) {
              log(`[Instagram Debug] Тип определен по паттерну в URL: IMAGE (паттерн: ${pattern})`, 'instagram');
              return 'IMAGE';
            }
          }
          
          // 3. Проверка по ключевым словам в URL
          const videoKeywords = [
            'video', 'mp4', 'mov', 'avi', 'movie', 'film', 
            'клип', 'ролик', 'видео'
          ];
          
          if (videoKeywords.some(keyword => urlLower.includes(keyword))) {
            log(`[Instagram Debug] Тип определен по ключевому слову в URL: VIDEO (слово найдено в URL)`, 'instagram');
            return 'VIDEO';
          }
          
          const imageKeywords = [
            'image', 'photo', 'pic', 'picture', 'img', 'jpg', 'jpeg', 'png', 
            'фото', 'изображение', 'картинка'
          ];
          
          if (imageKeywords.some(keyword => urlLower.includes(keyword))) {
            log(`[Instagram Debug] Тип определен по ключевому слову в URL: IMAGE (слово найдено в URL)`, 'instagram');
            return 'IMAGE';
          }
          
          // 4. Проверка части URL после последнего слеша
          const lastPathSegment = cleanUrl.split('/').pop() || '';
          
          // Если в последнем сегменте пути есть точка, пробуем определить тип по части после точки
          if (lastPathSegment.includes('.')) {
            const extension = lastPathSegment.split('.').pop();
            if (extension) {
              if (videoExtensions.some(ext => ext.substring(1) === extension)) {
                log(`[Instagram Debug] Тип определен по сегменту пути: VIDEO (расширение: ${extension})`, 'instagram');
                return 'VIDEO';
              }
              if (imageExtensions.some(ext => ext.substring(1) === extension)) {
                log(`[Instagram Debug] Тип определен по сегменту пути: IMAGE (расширение: ${extension})`, 'instagram');
                return 'IMAGE';
              }
            }
          }
          
          // 5. Если URL содержит известные домены для изображений/видео, пробуем определить по ним
          if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be') || 
              urlLower.includes('vimeo.com') || urlLower.includes('facebook.com/watch')) {
            log(`[Instagram Debug] Тип определен по известному домену: VIDEO (${urlLower.split('/')[2]})`, 'instagram');
            return 'VIDEO';
          }
          
          if (urlLower.includes('flickr.com') || urlLower.includes('imgur.com') || 
              urlLower.includes('instagram.com/p/')) {
            log(`[Instagram Debug] Тип определен по известному домену: IMAGE (${urlLower.split('/')[2]})`, 'instagram');
            return 'IMAGE';
          }
          
          // Если не удалось определить тип, используем тип по умолчанию
          log(`[Instagram Debug] Не удалось определить тип по URL, возвращаю IMAGE по умолчанию: ${safeUrl}`, 'instagram');
          return 'IMAGE';
        } catch (error) {
          log(`[Instagram Debug] Ошибка при определении типа по URL: ${error.message}`, 'instagram', 'error');
          return 'IMAGE';
        }
      }
      
      // Определяем тип медиа и URL
      if (content.videoUrl) {
        mediaType = 'VIDEO';
        mediaUrl = content.videoUrl;
        log(`[Instagram] Подготовка видео для сторис: ${mediaUrl}`, 'instagram');
      } else if (content.imageUrl) {
        mediaType = 'IMAGE';
        mediaUrl = content.imageUrl as string;
        log(`[Instagram] Подготовка изображения для сторис: ${mediaUrl}`, 'instagram');
      } else {
        // Здесь мы уже знаем, что медиа есть (проверили выше),
        // поэтому берем первый медиафайл из всех возможных полей с дополнительным медиа
        let mediaFiles = [];
        
        // Проверяем все возможные источники дополнительных медиа
        if (content.additionalMedia && Array.isArray(content.additionalMedia)) {
          mediaFiles = content.additionalMedia.filter(media => 
            media.type === 'image' || media.type === 'video');
        } else if (content.additionalImages && Array.isArray(content.additionalImages)) {
          // Подробное логирование содержимого additionalImages
          log(`[Instagram Debug] Содержимое additionalImages: ${JSON.stringify(content.additionalImages)}`, 'instagram');
          
          mediaFiles = content.additionalImages.map(item => {
            // Логируем каждый элемент для отладки
            log(`[Instagram Debug] Обработка элемента additionalImages: ${JSON.stringify(item)}`, 'instagram');
            
            if (typeof item === 'string') {
              log(`[Instagram Debug] Элемент является строкой, создаем объект с типом image`, 'instagram');
              return { url: item, type: 'image' };
            } else if (typeof item === 'object' && item) {
              // Проверяем наличие URL в стандартном или вложенном формате
              if (item.url) {
                if (typeof item.url === 'string') {
                  log(`[Instagram Debug] Элемент имеет строковый URL: ${item.url}`, 'instagram');
                  return { 
                    url: item.url, 
                    type: item.type || 'image'
                  };
                } else if (typeof item.url === 'object' && item.url && item.url.url) {
                  // Обработка вложенного объекта URL
                  log(`[Instagram Debug] Элемент имеет вложенный URL: ${item.url.url}`, 'instagram');
                  return { 
                    url: item.url.url, 
                    type: item.type || 'image'
                  };
                }
              } else if (item.file) {
                log(`[Instagram Debug] Элемент имеет file: ${item.file}`, 'instagram');
                return { 
                  url: item.file, 
                  type: item.type || 'image'
                };
              } else if (item.uri) {
                log(`[Instagram Debug] Элемент имеет uri: ${item.uri}`, 'instagram');
                return { 
                  url: item.uri, 
                  type: item.type || 'image'
                };
              }
            }
            log(`[Instagram Debug] Элемент не содержит URL, file или uri, игнорируем`, 'instagram');
            return null;
          }).filter(Boolean);
        } else if (content.additional_images && Array.isArray(content.additional_images)) {
          // Подробное логирование содержимого additional_images
          log(`[Instagram Debug] Содержимое additional_images (with underscore): ${JSON.stringify(content.additional_images)}`, 'instagram');
          
          mediaFiles = content.additional_images.map(item => {
            // Логируем каждый элемент
            log(`[Instagram Debug] Обработка элемента additional_images: ${JSON.stringify(item)}`, 'instagram');
            
            if (typeof item === 'string') {
              log(`[Instagram Debug] Элемент является строкой, создаем объект с типом image`, 'instagram');
              return { url: item, type: 'image' };
            } else if (typeof item === 'object' && item) {
              // Проверяем наличие URL в стандартном или вложенном формате
              if (item.url) {
                if (typeof item.url === 'string') {
                  log(`[Instagram Debug] Элемент имеет строковый URL: ${item.url}`, 'instagram');
                  return { 
                    url: item.url, 
                    type: item.type || 'image'
                  };
                } else if (typeof item.url === 'object' && item.url && item.url.url) {
                  // Обработка вложенного объекта URL
                  log(`[Instagram Debug] Элемент имеет вложенный URL: ${item.url.url}`, 'instagram');
                  return { 
                    url: item.url.url, 
                    type: item.type || 'image'
                  };
                }
              } else if (item.file) {
                log(`[Instagram Debug] Элемент имеет file: ${item.file}`, 'instagram');
                return { 
                  url: item.file, 
                  type: item.type || 'image'
                };
              } else if (item.uri) {
                log(`[Instagram Debug] Элемент имеет uri: ${item.uri}`, 'instagram');
                return { 
                  url: item.uri, 
                  type: item.type || 'image'
                };
              }
            }
            log(`[Instagram Debug] Элемент не содержит URL, file или uri, игнорируем`, 'instagram');
            return null;
          }).filter(Boolean);
          
          // Логируем результаты обработки
          log(`[Instagram Debug] Результат обработки additional_images: найдено ${mediaFiles.length} элементов`, 'instagram');
        }
        
        log(`[Instagram] Обнаружено ${mediaFiles.length} дополнительных медиафайлов для сторис`, 'instagram');
        
        if (mediaFiles && mediaFiles.length > 0) {
          const mediaFile = mediaFiles[0];
          log(`[Instagram] Используем первый медиафайл из дополнительных: ${JSON.stringify(mediaFile)}`, 'instagram');
          
          // Убедимся, что URL доступен - иногда URL может быть не строкой, а объектом
          if (typeof mediaFile.url !== 'string') {
            log(`[Instagram] Ошибка: URL медиафайла имеет некорректный формат: ${JSON.stringify(mediaFile.url)}`, 'instagram', 'error');
            
            if (mediaFile.url && typeof mediaFile.url === 'object' && mediaFile.url.url) {
              mediaUrl = mediaFile.url.url;
              log(`[Instagram] Извлечен URL из объекта: ${mediaUrl}`, 'instagram');
            } else {
              return {
                platform: 'instagram',
                status: 'failed',
                error: 'Некорректный формат URL медиафайла',
                publishedAt: null,
              };
            }
          } else {
            mediaUrl = mediaFile.url;
          }
          
          // Используем нашу функцию для определения типа медиа
          mediaType = determineMediaType(mediaFile);
          log(`[Instagram] Определен тип медиа: ${mediaType} для файла: ${mediaUrl}`, 'instagram');
        } else {
          // Этот код не должен выполниться, но добавим на всякий случай
          return {
            platform: 'instagram',
            status: 'failed',
            error: 'Не удалось найти медиа для сторис',
            publishedAt: null,
          };
        }
      }

      // Создаем URL запроса для создания контейнера
      const containerUrl = `${baseUrl}/${businessAccountId}/media`;

      // Формируем параметры запроса для создания контейнера сторис
      // ВАЖНО: для Instagram Stories используем media_type="STORIES" 
      // (а не "IMAGE"/"VIDEO") и НЕ используем параметр is_story=true
      const storyParams: any = {
        media_type: "STORIES", // Важно использовать "STORIES" вместо "IMAGE" или "VIDEO"
        caption: caption,
        access_token: token
      };
      
      // Подробное логирование параметров запроса
      log(`[Instagram] Тип контента: ${content.contentType}, используем media_type=${storyParams.media_type}`, 'instagram');

      // Добавляем URL в зависимости от типа медиа
      if (mediaType === 'VIDEO') {
        storyParams.video_url = mediaUrl;
        log(`[Instagram] Добавлен video_url для stories: ${mediaUrl.substring(0, 100)}...`, 'instagram');
      } else {
        storyParams.image_url = mediaUrl;
        log(`[Instagram] Добавлен image_url для stories: ${mediaUrl.substring(0, 100)}...`, 'instagram');
      }
      
      // Детальное логирование для отладки
      log(`[Instagram] Полная информация о публикации сторис:`, 'instagram');
      log(`[Instagram]   - Тип медиа: ${mediaType}`, 'instagram');
      log(`[Instagram]   - URL медиа: ${mediaUrl.substring(0, 100)}...`, 'instagram');
      log(`[Instagram]   - Бизнес-аккаунт ID: ${businessAccountId}`, 'instagram');
      log(`[Instagram]   - Заголовок: ${caption ? caption.substring(0, 50) + '...' : 'не указан'}`, 'instagram');
      
      // Логируем детально параметры запроса для отладки
      // Скрываем токен для безопасности
      const logParams = {...storyParams};
      if (logParams.access_token) {
        logParams.access_token = logParams.access_token.substring(0, 10) + '...[скрыто]';
      }
      log(`[Instagram] Параметры запроса на создание контейнера сторис: ${JSON.stringify(logParams)}`, 'instagram');

      // Проверяем корректность URL медиа перед отправкой в API
      if (!mediaUrl.startsWith('http')) {
        log(`[Instagram] ОШИБКА: Некорректный URL медиа файла: ${mediaUrl.substring(0, 30)}...`, 'instagram', 'error');
        return {
          platform: 'instagram',
          status: 'failed',
          error: 'URL медиа файла должен начинаться с http:// или https://',
          publishedAt: null,
        };
      }

      // Пробуем сделать HEAD-запрос для проверки доступности медиа перед отправкой в API
      try {
        log(`[Instagram] Проверка доступности медиа файла перед публикацией: ${mediaUrl.substring(0, 30)}...`, 'instagram');
        const headResponse = await axios.head(mediaUrl, { timeout: 5000 });
        
        // Дополнительно проверяем Content-Type, если он доступен
        if (headResponse.headers['content-type']) {
          const contentType = headResponse.headers['content-type'].toLowerCase();
          log(`[Instagram] Проверка медиа: Content-Type: ${contentType}`, 'instagram');
          
          if (mediaType === 'VIDEO' && !contentType.includes('video')) {
            log(`[Instagram] Предупреждение: Тип медиа определен как VIDEO, но Content-Type (${contentType}) не соответствует видео`, 'instagram', 'warn');
          } else if (mediaType === 'IMAGE' && !contentType.includes('image')) {
            log(`[Instagram] Предупреждение: Тип медиа определен как IMAGE, но Content-Type (${contentType}) не соответствует изображению`, 'instagram', 'warn');
          }
        }
      } catch (checkError) {
        // Логируем, но продолжаем, возможно Instagram API сможет обработать URL
        log(`[Instagram] Предупреждение: Не удалось проверить доступность медиа файла: ${checkError.message}`, 'instagram', 'warn');
        log(`[Instagram] Продолжаем публикацию, но есть риск ошибки API`, 'instagram', 'warn');
      }

      // Отправляем запрос на создание контейнера
      let containerResponse;
      try {
        log(`[Instagram] Отправка запроса на создание контейнера для сторис (${storyParams.media_type})`, 'instagram');
        containerResponse = await axios.post(containerUrl, storyParams);
        
        // Подробное логирование ответа
        log(`[Instagram] Получен ответ от API Instagram: ${JSON.stringify(containerResponse.data)}`, 'instagram');
      } catch (error) {
        const errorMsg = error.response && error.response.data && error.response.data.error
          ? `${error.response.data.error.code}: ${error.response.data.error.message}`
          : `Ошибка запроса: ${error.message}`;
          
        log(`[Instagram] Ошибка при запросе контейнера для сторис: ${errorMsg}`, 'instagram', 'error');
        log(`[Instagram] Детали запроса: URL=${containerUrl}, Параметры=${JSON.stringify({
          ...storyParams,
          access_token: '***скрыто***'
        })}`, 'instagram', 'error');
        
        return {
          platform: 'instagram',
          status: 'failed',
          error: errorMsg,
          publishedAt: null,
        };
      }

      // Проверяем ответ
      if (!containerResponse.data || !containerResponse.data.id) {
        const errorMsg = containerResponse.data && containerResponse.data.error 
          ? `${containerResponse.data.error.code}: ${containerResponse.data.error.message}`
          : 'Ошибка при создании контейнера для сторис';

        log(`[Instagram] ${errorMsg}`, 'instagram', 'error');
        return {
          platform: 'instagram',
          status: 'failed',
          error: errorMsg,
          publishedAt: null
        };
      }

      // Получаем ID созданного контейнера
      const containerId = containerResponse.data.id;
      log(`[Instagram] Контейнер для сторис создан успешно: ${containerId}`, 'instagram');

      // Шаг 2: Публикация сторис
      const publishUrl = `${baseUrl}/${businessAccountId}/media_publish`;
      const publishParams = {
        creation_id: containerId,
        access_token: token
      };

      // Даем Instagram время на обработку медиа (важно для видео)
      if (mediaType === 'VIDEO') {
        log(`[Instagram] Ожидание 5 секунд перед публикацией видео-сторис...`, 'instagram');
        await sleep(5000);
      } else {
        await sleep(1000);
      }

      // Публикуем сторис
      log(`[Instagram] Этап 2 - публикация сторис с containerId: ${containerId}`, 'instagram');
      log(`[Instagram] URL публикации: ${publishUrl}`, 'instagram');
      
      // Логируем параметры запроса (без токена)
      const logPublishParams = {...publishParams};
      if (logPublishParams.access_token) {
        logPublishParams.access_token = logPublishParams.access_token.substring(0, 10) + '...[скрыто]';
      }
      log(`[Instagram] Параметры публикации: ${JSON.stringify(logPublishParams)}`, 'instagram');
      
      // Публикуем сторис с обработкой ошибок
      let publishResponse;
      try {
        publishResponse = await axios.post(publishUrl, publishParams);
        
        // Логируем полный ответ для анализа
        log(`[Instagram] Ответ от API публикации: ${JSON.stringify(publishResponse.data)}`, 'instagram');
      } catch (error) {
        const errorMsg = error.response && error.response.data && error.response.data.error
          ? `${error.response.data.error.code}: ${error.response.data.error.message}`
          : `Ошибка запроса публикации: ${error.message}`;
          
        log(`[Instagram] Ошибка при публикации сторис: ${errorMsg}`, 'instagram', 'error');
        log(`[Instagram] Детали запроса публикации: URL=${publishUrl}, creation_id=${containerId}`, 'instagram', 'error');
        
        // Если ошибка связана с тем, что видео еще не готово, добавим дополнительную задержку и попробуем ещё раз
        if (error.response && error.response.data && error.response.data.error && 
            (error.response.data.error.code === 9007 || // Error validating access token
             error.response.data.error.message.includes('Media_Not_Ready') || 
             error.response.data.error.message.includes('not ready'))) {
          
          log(`[Instagram] Обнаружена ошибка неготовности медиа, ожидаем ещё 10 секунд и повторяем попытку...`, 'instagram', 'warn');
          await sleep(10000);
          
          try {
            publishResponse = await axios.post(publishUrl, publishParams);
            log(`[Instagram] Повторная попытка публикации успешна: ${JSON.stringify(publishResponse.data)}`, 'instagram');
          } catch (retryError) {
            log(`[Instagram] Повторная попытка публикации не удалась: ${retryError.message}`, 'instagram', 'error');
            
            return {
              platform: 'instagram',
              status: 'failed',
              error: `Не удалось опубликовать сторис после повторной попытки: ${errorMsg}`,
              publishedAt: null
            };
          }
        } else {
          return {
            platform: 'instagram',
            status: 'failed',
            error: errorMsg,
            publishedAt: null
          };
        }
      }
      
      // Проверяем результат публикации
      if (publishResponse.data && publishResponse.data.id) {
        const storyId = publishResponse.data.id;
        // URL для сторис отличается от URL поста - используем информацию из бизнес-аккаунта
        // Получаем username из настроек или используем ID в различных форматах
        // Подробно логируем все варианты для диагностики
        
        // Возможные варианты настроек, где может быть username
        log(`[Instagram] Поиск username для URL сторис. Проверяем все варианты настроек:`, 'instagram');
        log(`[Instagram] socialMediaSettings?.instagram?.username: ${socialMediaSettings?.instagram?.username || 'не найден'}`, 'instagram');
        log(`[Instagram] socialMediaSettings?.instagram?.profile: ${socialMediaSettings?.instagram?.profile || 'не найден'}`, 'instagram');
        
        // Проверяем все возможные места, где может храниться username в настройках
        const username = socialMediaSettings?.instagram?.username || 
                       socialMediaSettings?.instagram?.profile ||
                       'instagram'; // Резервный вариант для общей страницы Instagram
        
        // Чистим username от @ в начале, если он есть
        const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
        
        // Формируем URL для Stories с правильным форматированием
        // По формату Instagram URL для сторис: https://www.instagram.com/stories/username/storyId/
        const storyUrl = `https://www.instagram.com/stories/${cleanUsername}/${storyId}/`;
        
        log(`[Instagram] Итоговый username для URL сторис: ${cleanUsername}`, 'instagram');
        log(`[Instagram] Итоговый storyId: ${storyId}`, 'instagram');
        log(`[Instagram] Сторис успешно опубликован: ${storyId}`, 'instagram');
        log(`[Instagram] URL сторис: ${storyUrl}`, 'instagram');
        
        return {
          platform: 'instagram',
          status: 'published',
          postId: storyId,
          postUrl: storyUrl,
          publishedAt: new Date()
        };
      } else {
        const errorMsg = publishResponse.data && publishResponse.data.error 
          ? `${publishResponse.data.error.code}: ${publishResponse.data.error.message}`
          : 'Неизвестная ошибка при публикации сторис';

        log(`[Instagram] Ошибка при публикации сторис: ${errorMsg}`, 'instagram', 'error');
        log(`[Instagram] Полный ответ с ошибкой: ${JSON.stringify(publishResponse.data)}`, 'instagram', 'error');
        
        return {
          platform: 'instagram',
          status: 'failed',
          error: errorMsg,
          publishedAt: null
        };
      }
    } catch (error: any) {
      // Расширенное логирование для отладки
      log(`[Instagram] Произошла ошибка при публикации сторис`, 'instagram', 'error');
      
      // Пытаемся извлечь максимум информации из объекта ошибки
      if (error.response) {
        // Ошибка от API
        log(`[Instagram] Статус ошибки: ${error.response.status}`, 'instagram', 'error');
        log(`[Instagram] Данные ответа: ${JSON.stringify(error.response.data || {})}`, 'instagram', 'error');
        
        if (error.response.data && error.response.data.error) {
          // Структурированная ошибка от Facebook Graph API
          log(`[Instagram] Код ошибки API: ${error.response.data.error.code}`, 'instagram', 'error');
          log(`[Instagram] Сообщение от API: ${error.response.data.error.message}`, 'instagram', 'error');
          log(`[Instagram] Тип ошибки API: ${error.response.data.error.type || 'не указан'}`, 'instagram', 'error');
          
          if (error.response.data.error.error_subcode) {
            log(`[Instagram] Subcode ошибки: ${error.response.data.error.error_subcode}`, 'instagram', 'error');
          }
        }
      } else if (error.request) {
        // Запрос был сделан, но ответ не получен
        log(`[Instagram] Ошибка сети: запрос отправлен, но ответ не получен`, 'instagram', 'error');
      } else {
        // Что-то произошло при настройке запроса
        log(`[Instagram] Ошибка при подготовке запроса: ${error.message}`, 'instagram', 'error');
      }
      
      // Форматирование сообщения об ошибке для возврата с улучшенным описанием проблемы
      let errorMessage: string;
      
      if (error.response && error.response.data && error.response.data.error) {
        const apiError = error.response.data.error;
        const errorCode = apiError.code;
        
        // Обработка известных кодов ошибок специфичных для Stories
        if (errorCode === 190) {
          errorMessage = 'Недействительный токен доступа. Необходимо обновить токен в настройках Instagram.';
        } else if (errorCode === 9007) {
          errorMessage = 'Ошибка валидации токена доступа для Instagram.';
        } else if (errorCode === 100 && apiError.message.includes('Instagram Business Account')) {
          errorMessage = 'Не найден Instagram Business Account. Проверьте настройки бизнес-аккаунта.';
        } else if (apiError.message && (apiError.message.includes('Media_Not_Ready') || apiError.message.includes('not ready'))) {
          errorMessage = 'Медиа еще не готово для публикации. Система автоматически повторит попытку позже.';
          log(`[Instagram] Обнаружена ошибка неготовности медиа для сторис`, 'instagram', 'warn');
        } else if (apiError.message && apiError.message.toLowerCase().includes('story')) {
          // Специфические ошибки для Stories
          errorMessage = `Ошибка публикации сторис: ${apiError.message} (код ${errorCode})`;
          log(`[Instagram] Специфическая ошибка сторис: ${apiError.message}`, 'instagram', 'error');
        } else {
          errorMessage = `${errorCode}: ${apiError.message}`;
        }
      } else {
        errorMessage = error.message;
      }

      log(`[Instagram] Итоговое сообщение об ошибке: ${errorMessage}`, 'instagram');
      return {
        platform: 'instagram',
        status: 'failed',
        error: errorMessage,
        publishedAt: null
      };
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
      // РАСШИРЕННОЕ ЛОГИРОВАНИЕ ПРИ ОТЛАДКЕ INSTAGRAM
      log(`[Instagram DEBUG] Начало попытки публикации в Instagram для контента ID: ${content.id}`, 'instagram');
      log(`[Instagram DEBUG] Параметры запроса: Token длина: ${instagramSettings.token ? instagramSettings.token.length : 0}, Business Account ID: ${instagramSettings.businessAccountId}`, 'instagram');
      
      try {
        // Выводим текущие данные социальных платформ
        if (content.socialPlatforms && content.socialPlatforms.instagram) {
          log(`[Instagram DEBUG] Текущие данные платформы Instagram: ${JSON.stringify(content.socialPlatforms.instagram)}`, 'instagram');
        }
      } catch (logError) {
        log(`[Instagram DEBUG] Ошибка при логировании данных платформы: ${logError}`, 'instagram');
      }
      
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
      
      // Проверяем альтернативное поле accessToken, которое может использоваться в некоторых контекстах
      let token = instagramSettings.token;
      if (!token && instagramSettings.accessToken) {
        token = instagramSettings.accessToken;
        log(`[Instagram] Использую альтернативное поле accessToken вместо token`, 'instagram');
      }
      
      // Убеждаемся, что токен валидный (не содержит только пробелы)
      if (token && typeof token === 'string' && token.trim() === '') {
        log(`[Instagram] Предупреждение: токен содержит только пробелы`, 'instagram');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Токен Instagram содержит только пробелы'
        };
      }
      
      // Проверяем формат business account ID (должен быть числовым)
      const businessAccountId = instagramSettings.businessAccountId;
      if (businessAccountId && isNaN(Number(businessAccountId))) {
        log(`[Instagram] Предупреждение: Business Account ID должен быть числовым, получено: ${businessAccountId}`, 'instagram');
      }
      
      log(`[Instagram] Начинаем публикацию в Instagram с использованием бизнес-аккаунта: ${businessAccountId}`, 'instagram');
      
      // Обрабатываем контент
      const processedContent = this.processAdditionalImages(content, 'instagram');
      
      // Загружаем локальные изображения на Imgur
      const imgurContent = await this.uploadImagesToImgur(processedContent);
      
      // Более надежная проверка наличия медиа для Instagram
      // Проверяем наличие видео URL из всех возможных источников
      let videoUrl = null;
      
      // Проверяем несколько возможных полей для видео
      if (content.videoUrl && typeof content.videoUrl === 'string' && content.videoUrl.trim() !== '') {
        videoUrl = content.videoUrl;
        log(`[Instagram] Найдено видео в основном поле videoUrl: ${videoUrl}`, 'instagram');
      } else if ((content as any).video_url && typeof (content as any).video_url === 'string' && (content as any).video_url.trim() !== '') {
        videoUrl = (content as any).video_url;
        log(`[Instagram] Найдено видео в поле video_url: ${videoUrl}`, 'instagram');
      } else if (content.metadata && (content.metadata as any).videoUrl && typeof (content.metadata as any).videoUrl === 'string') {
        videoUrl = (content.metadata as any).videoUrl;
        log(`[Instagram] Найдено видео в metadata.videoUrl: ${videoUrl}`, 'instagram');
      } else if (content.metadata && (content.metadata as any).video_url && typeof (content.metadata as any).video_url === 'string') {
        videoUrl = (content.metadata as any).video_url;
        log(`[Instagram] Найдено видео в metadata.video_url: ${videoUrl}`, 'instagram');
      }
      
      // Проверяем наличие видео в additionalMedia
      if (!videoUrl && content.additionalMedia && Array.isArray(content.additionalMedia) && content.additionalMedia.length > 0) {
        const videoMedia = content.additionalMedia.find((media: any) => {
          if (media.type === 'video') return true;
          if (media.url && typeof media.url === 'string') {
            return media.url.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|mkv)$/i) !== null;
          }
          return false;
        });
        
        if (videoMedia && videoMedia.url) {
          videoUrl = videoMedia.url;
          log(`[Instagram] Найдено видео в additionalMedia: ${videoUrl}`, 'instagram');
        }
      }
      
      // Определяем окончательно, есть ли у нас видео
      const isVideo = (content.contentType === 'video-text' || content.contentType === 'video') && videoUrl !== null;
      
      // Расширенное логирование для диагностики
      log(`[Instagram DEBUG] Тип контента: ${content.contentType}, videoUrl: ${videoUrl ? 'найден' : 'не найден'}, isVideo: ${isVideo}`, 'instagram');
      
      // Проверяем, есть ли хоть какой-то медиа-контент (обязательно для Instagram)
      if (!isVideo && !imgurContent.imageUrl) {
        log(`[Instagram] Ошибка публикации: отсутствует медиа-контент (изображение или видео)`, 'instagram');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Отсутствует медиа-контент для публикации в Instagram. Необходимо добавить изображение или видео.'
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
        
        // Проверяем тип контента для определения правильного метода публикации (изображение или видео)
        // Используем обновленную переменную isVideo из улучшенной проверки выше
        
        // Подготавливаем параметры запроса в зависимости от типа контента
        // ВАЖНО: Для Instagram API требуется параметр media_type напрямую в теле запроса, а не в query params
        let containerParams: any = {};
        
        // Также передаем access_token в запросе создания контейнера (рекомендовано документацией)
        // Это может решить проблему с ошибкой "Object with ID does not exist"
        
        // Определяем тип медиа в зависимости от типа контента
        // Для сторис всегда используем специальный тип "STORIES" вместо "IMAGE" или "VIDEO"
        const isStory = content.contentType === 'stories';
        
        if (isStory) {
          log(`[Instagram] Обнаружен контент типа "stories", будет использован media_type=STORIES`, 'instagram');
        }
        
        // Добавляем ссылку на медиа в зависимости от типа (изображение или видео)
        if (isVideo && videoUrl) {
          log(`[Instagram] Обнаружено видео для публикации: ${videoUrl.substring(0, 50)}...`, 'instagram');
          containerParams = {
            caption: caption,
            video_url: videoUrl,
            media_type: isStory ? 'STORIES' : 'VIDEO', // Для сторис используем STORIES вместо VIDEO
            access_token: token  // Добавляем токен доступа к запросу создания контейнера
          };
          
          log(`[Instagram] Выбран media_type=${containerParams.media_type} для видео (${isStory ? 'сторис' : 'обычный пост'})`, 'instagram');
        } else {
          // Если это не видео или видео отсутствует, используем изображение
          log(`[Instagram] Публикация с изображением: ${imgurContent.imageUrl?.substring(0, 50)}...`, 'instagram');
          containerParams = {
            caption: caption,
            image_url: imgurContent.imageUrl,
            media_type: isStory ? 'STORIES' : 'IMAGE', // Для сторис используем STORIES вместо IMAGE
            access_token: token  // Добавляем токен доступа к запросу создания контейнера
          };
          
          log(`[Instagram] Выбран media_type=${containerParams.media_type} для изображения (${isStory ? 'сторис' : 'обычный пост'})`, 'instagram');
        }
        
        // Логируем тело запроса для отладки
        log(`[Instagram] Параметры запроса на создание контейнера: ${JSON.stringify(containerParams)}`, 'instagram');
        
        // Отправляем запрос на создание контейнера с увеличенными таймаутами для видео
        log(`[Instagram] Отправка запроса на создание контейнера для ${isVideo ? 'видео' : 'изображения'}`, 'instagram');
        
        let containerResponse;
        
        try {
          // Отправка запроса на создание контейнера
          containerResponse = await axios.post(
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
          
          // ИСПРАВЛЕНО: Удален оператор return containerResponse, который прерывал выполнение функции
        } catch (error: any) {
          log(`[Instagram] Ошибка при создании контейнера: ${error.message}`, 'instagram');
          
          // Если ошибка связана с видео, пробуем загрузить изображение вместо него
          if (isVideo && imgurContent.imageUrl) {
            log(`[Instagram] Попытка создать контейнер с изображением вместо видео`, 'instagram');
            
            try {
              // Изменяем параметры запроса на изображение - создаем новый объект
              containerParams = {
                caption: caption,
                image_url: imgurContent.imageUrl,
                media_type: 'IMAGE',  // ВАЖНО: Явно указываем тип медиа для Instagram
                access_token: token  // Добавляем токен доступа к резервному запросу
              };
              
              // Повторно отправляем запрос с изображением
              containerResponse = await axios.post(
                containerUrl, 
                containerParams, 
                {
                  headers: { 'Content-Type': 'application/json' },
                  timeout: 60000
                }
              );
              
              log(`[Instagram] Ответ API при резервной загрузке изображения: ${JSON.stringify(containerResponse.data)}`, 'instagram');
              
              // ИСПРАВЛЕНО: Удален оператор return fallbackResponse, который прерывал выполнение функции
            } catch (fallbackError) {
              log(`[Instagram] Ошибка при резервной загрузке изображения: ${fallbackError.message}`, 'instagram');
              throw fallbackError;
            }
          } else {
            // Если это не видео или нет резервного изображения, прокидываем ошибку дальше
            throw error;
          }
        }
        
        // ИСПРАВЛЕНО: Этот блок теперь доступен, так как нет преждевременного return
        // Проверяем успешность создания контейнера
        if (!containerResponse || !containerResponse.data || !containerResponse.data.id) {
          const errorMsg = 'Не удалось создать контейнер для публикации в Instagram';
          
          log(`[Instagram] ${errorMsg}`, 'instagram');
          
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
        
        // Отправляем запрос на публикацию с механизмом повторных попыток
        let publishResponse;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            publishResponse = await axios.post(
              publishUrl, 
              publishParams, 
              {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
              }
            );
            
            // Если запрос успешный, прерываем цикл
            if (publishResponse && publishResponse.data && publishResponse.data.id) {
              log(`[Instagram] Успешная публикация с попытки #${retryCount + 1}`, 'instagram');
              break;
            }
            
            // Если запрос прошел, но без ID медиа - это ошибка
            log(`[Instagram] Ответ не содержит ID медиа, повторная попытка #${retryCount + 1}`, 'instagram');
            retryCount++;
            
            if (retryCount < maxRetries) {
              // Увеличиваем время ожидания с каждой попыткой
              const waitTime = 3000 * (retryCount + 1);
              log(`[Instagram] Ожидание ${waitTime}мс перед следующей попыткой...`, 'instagram');
              await sleep(waitTime);
            }
          } catch (error: any) {
            log(`[Instagram] Ошибка публикации (попытка ${retryCount + 1}): ${error.message}`, 'instagram');
            
            // Проверяем тип ошибки - если это "Object with ID does not exist", это может быть временная ошибка
            const isTemporaryError = error.response?.data?.error?.message?.includes('Object with ID') || 
                                    error.message?.includes('Object with ID');
            
            if (isTemporaryError) {
              log(`[Instagram] Обнаружена временная ошибка API, повторная попытка #${retryCount + 1}`, 'instagram');
              retryCount++;
              
              if (retryCount < maxRetries) {
                // Увеличиваем время ожидания с каждой попыткой
                const waitTime = 5000 * (retryCount + 1);
                log(`[Instagram] Ожидание ${waitTime}мс перед следующей попыткой...`, 'instagram');
                await sleep(waitTime);
              }
            } else {
              // Если это не временная ошибка, прекращаем попытки
              log(`[Instagram] Критическая ошибка, прекращение попыток: ${error.message}`, 'instagram');
              throw error;
            }
          }
        }
        
        // Если после всех попыток нет успеха
        if (!publishResponse || !publishResponse.data) {
          throw new Error(`Не удалось опубликовать пост в Instagram после ${maxRetries} попыток`);
        }
        
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
          // Если не удалось получить permalink, создаём ссылку из ID медиа
          // ID медиа имеет формат: {business_account_id}_{media_id}
          // Для URL нам нужна только вторая часть
          const shortMediaId = String(igMediaId).includes('_') ? 
            igMediaId.split('_')[1] : igMediaId;
          
          // Если ID имеет короткий формат IG, используем его, иначе создаем альтернативную ссылку
          if (/^[A-Za-z0-9_-]{11}$/.test(shortMediaId)) {
            postUrl = `https://www.instagram.com/p/${shortMediaId}/`;
          } else {
            // Альтернативный метод создания ссылки - на основе имени бизнес-аккаунта
            // Получаем имя аккаунта из ID или используем просто ID если имя недоступно
            const accountName = (instagramSettings.businessAccountId ? 
                              instagramSettings.businessAccountId.toString() : 'instagram');
            postUrl = `https://www.instagram.com/${accountName}/`;
            log(`[Instagram] Не удалось создать прямую ссылку на пост, используем ссылку на профиль: ${postUrl}`, 'instagram');
          }
            
          log(`[Instagram] Не удалось получить permalink, создаём постоянную ссылку из ID: ${postUrl}`, 'instagram');
        }
        
        // Записываем postUrl и для использования через "Опубликовать сейчас"
        try {
          // Создаем директорию логов синхронно
          const logDir = '/home/runner/workspace/logs/instagram';
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
            log(`[Instagram] Создана директория логов: ${logDir}`, 'instagram');
          }
          
          const logData = {
            publishedAt: new Date().toISOString(),
            contentId: content.id,
            igMediaId: igMediaId,
            permalink: postUrl
          };
          
          // Используем синхронную запись для упрощения обработки ошибок
          const logFilePath = `${logDir}/post_${content.id.substring(0, 8)}_${Date.now()}.json`;
          fs.writeFileSync(
            logFilePath, 
            JSON.stringify(logData, null, 2), 
            'utf8'
          );
          
          log(`[Instagram] Сохранен лог успешной публикации: ${logFilePath}`, 'instagram');
        } catch (logError) {
          // Ошибка логирования не должна прерывать успешную публикацию
          log(`[Instagram] Ошибка сохранения лога: ${logError.message}`, 'instagram');
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
          } else if (apiError.code === 9007) {
            errorMessage = 'Ошибка валидации токена доступа. Пожалуйста, обновите токен в настройках.';
          } else if (apiError.code === 100 && apiError.message.includes('Instagram Business Account')) {
            errorMessage = 'Ошибка бизнес-аккаунта Instagram. Пожалуйста, проверьте привязку бизнес-аккаунта.';
          } else if (apiError.message && (apiError.message.includes('Media_Not_Ready') || apiError.message.includes('not ready'))) {
            errorMessage = 'Медиа еще не готово для публикации. Попробуйте повторить запрос позже.';
          } else if (apiError.message && apiError.message.includes('Object with ID')) {
            errorMessage = 'Объект не найден. Возможно, контейнер для публикации истек или был удален.';
          } else if (content.contentType === 'stories' && 
                    apiError.message && apiError.message.toLowerCase().includes('story')) {
            // Специфические ошибки для Stories
            errorMessage = `Ошибка публикации сторис: ${apiError.message} (код ${apiError.code})`;
            log(`[Instagram] Специфическая ошибка сторис: ${apiError.message}`, 'instagram', 'error');
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
    
    // Проверяем тип контента - если это сторис, используем специальный метод
    if (content.contentType === 'stories') {
      log(`[Instagram] Обнаружен контент типа 'stories', используем метод publishStory`, 'instagram');
      
      // Подготовка токенов и businessAccountId для вызова publishStory
      const token = settings.instagram.token || settings.instagram.accessToken || null;
      const accessToken = settings.instagram.accessToken || settings.instagram.token || null;
      const businessAccountId = settings.instagram.businessAccountId || null;
      
      // Подробное логирование перед передачей в publishStory
      log(`[Instagram] Подготовлены данные для публикации сторис:
      - Token/accessToken: ${token ? 'задан (первые 10 символов: ' + token.substr(0, 10) + '...)' : 'отсутствует'}
      - Business Account ID: ${businessAccountId || 'отсутствует'}
      - Content ID: ${content.id}`, 'instagram');
      
      // Передаем параметры в метод публикации stories
      return this.publishStory(
        content, 
        {
          token: token,
          accessToken: accessToken,
          businessAccountId: businessAccountId
        }, 
        settings);
    }
    
    // Для всех остальных типов контента используем стандартный метод
    return this.publishToInstagram(content, settings.instagram);
  }
}

// Экспортируем экземпляр сервиса для использования в приложении
export const instagramService = new InstagramService();