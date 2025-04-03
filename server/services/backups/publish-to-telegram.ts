import axios from 'axios';
import { log } from '../../utils/logger';
import { CampaignContent, SocialMediaSettings, SocialPublication } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';
import { uploadTelegramImageFromUrl } from './upload-telegram-image';

/**
 * Публикует контент в Telegram
 * @param content Контент для публикации
 * @param telegramSettings Настройки Telegram API
 * @param processImageUrl Функция для обработки URL изображения
 * @param processAdditionalImages Функция для обработки дополнительных изображений
 * @param formatHtmlContent Функция для форматирования HTML-контента
 * @returns Результат публикации
 */
export async function publishToTelegram(
  content: CampaignContent,
  telegramSettings: SocialMediaSettings['telegram'] | undefined,
  processImageUrl: (url: string, platform: string) => string,
  processAdditionalImages: (content: CampaignContent, platform: string) => CampaignContent,
  formatHtmlContent: (content: string, platform: 'telegram' | 'vk' | 'facebook' | 'instagram') => string
): Promise<SocialPublication> {
  log(`▶️ Начата публикация в Telegram. Контент ID: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
  log(`▶️ Настройки для публикации в Telegram: chatId=${telegramSettings?.chatId ? telegramSettings.chatId.substring(0, 6) + '...' : 'не задан'}, token=${telegramSettings?.token ? telegramSettings.token.substring(0, 6) + '...' : 'не задан'}`, 'social-publishing');
  
  if (!telegramSettings?.token || !telegramSettings?.chatId) {
    log(`❌ ОШИБКА: Отсутствуют настройки для Telegram (token=${!!telegramSettings?.token}, chatId=${!!telegramSettings?.chatId})`, 'social-publishing');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: 'Отсутствуют настройки для Telegram (токен или ID чата)'
    };
  }

  try {
    const { token, chatId } = telegramSettings;
    log(`Публикация в Telegram. Контент: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
    log(`Публикация в Telegram. Чат: ${chatId}, Токен: ${token.substring(0, 6)}...`, 'social-publishing');

    // Обрабатываем поле additionalImages в контенте
    content = processAdditionalImages(content, 'telegram');
    
    // Форматируем HTML-контент для Telegram с сохранением структуры
    const formattedText = formatHtmlContent(content.content, 'telegram');
    log(`Форматированный текст для Telegram: длина ${formattedText.length} символов`, 'social-publishing');
    
    // Публикация в зависимости от типа контента
    if (content.contentType === 'text') {
      log(`Публикация текстового контента в Telegram (ID: ${content.id})`, 'social-publishing');
      
      // Базовый URL для API Telegram
      const baseUrl = 'https://api.telegram.org/bot';
      
      // Отправляем текстовый контент с форматированием HTML
      const response = await axios.post(`${baseUrl}${token}/sendMessage`, {
        chat_id: chatId,
        text: formattedText,
        parse_mode: 'HTML',
        disable_web_page_preview: false // Разрешаем предпросмотр веб-страниц в ссылках
      });
      
      log(`Успешная публикация в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
      
      // Получаем URL поста из ответа API
      const messageId = response.data.result.message_id;
      // Формируем URL поста в Telegram (формат t.me/c/channelid/messageid)
      const postUrl = chatId.startsWith('@')
        ? `https://t.me/${chatId.substring(1)}`
        : chatId.startsWith('-100')
          ? `https://t.me/c/${chatId.substring(4)}/${messageId}`
          : null;
          
      log(`URL поста в Telegram: ${postUrl}`, 'social-publishing');
      
      return {
        platform: 'telegram',
        status: 'published',
        publishedAt: new Date(),
        publishedUrl: postUrl,
        postId: messageId?.toString() || null
      };
    } 
    else if (content.contentType === 'image') {
      log(`Публикация изображения в Telegram (ID: ${content.id})`, 'social-publishing');
      
      // Проверка наличия изображения
      if (!content.imageUrl) {
        log(`Ошибка: Отсутствует URL изображения для публикации в Telegram`, 'social-publishing');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: 'Отсутствует URL изображения'
        };
      }
      
      // Обрабатываем URL изображения для проксирования через наш сервер
      const processedImageUrl = processImageUrl(content.imageUrl, 'telegram');
      log(`Обработанный URL изображения для Telegram: ${processedImageUrl}`, 'social-publishing');
      
      // Базовый URL для API Telegram
      const baseUrl = 'https://api.telegram.org/bot';
      
      try {
        // Отправляем изображение с подписью
        const response = await uploadTelegramImageFromUrl(
          processedImageUrl,
          chatId,
          formattedText, // Используем форматированный HTML-текст как подпись
          token,
          baseUrl
        );
        
        log(`Успешная публикация изображения в Telegram: ${JSON.stringify(response)}`, 'social-publishing');
        
        // Получаем данные о публикации из ответа API
        const messageId = response.result.message_id;
        
        // Формируем URL поста в Telegram (формат t.me/c/channelid/messageid)
        const postUrl = chatId.startsWith('@')
          ? `https://t.me/${chatId.substring(1)}`
          : chatId.startsWith('-100')
            ? `https://t.me/c/${chatId.substring(4)}/${messageId}`
            : null;
            
        log(`URL поста с изображением в Telegram: ${postUrl}`, 'social-publishing');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          publishedUrl: postUrl,
          postId: messageId?.toString() || null
        };
      } catch (uploadError: any) {
        log(`Ошибка при загрузке изображения в Telegram: ${uploadError.message}`, 'social-publishing');
        
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка загрузки изображения: ${uploadError.message}`
        };
      }
    }
    else if (content.contentType === 'carousel') {
      log(`Публикация карусели в Telegram (ID: ${content.id})`, 'social-publishing');
      
      // Проверяем наличие основного изображения или дополнительных изображений
      if (!content.imageUrl && (!content.additionalImages || content.additionalImages.length === 0)) {
        log(`Ошибка: Отсутствуют изображения для карусели в Telegram`, 'social-publishing');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: 'Отсутствуют изображения для карусели'
        };
      }
      
      // Собираем все URL изображений
      const imageUrls: string[] = [];
      
      // Добавляем основное изображение, если оно есть
      if (content.imageUrl) {
        imageUrls.push(processImageUrl(content.imageUrl, 'telegram'));
      }
      
      // Добавляем дополнительные изображения
      if (content.additionalImages && Array.isArray(content.additionalImages) && content.additionalImages.length > 0) {
        content.additionalImages.forEach((imgUrl) => {
          if (typeof imgUrl === 'string' && imgUrl.trim()) {
            imageUrls.push(processImageUrl(imgUrl, 'telegram'));
          } else if (typeof imgUrl === 'object' && imgUrl.url) {
            imageUrls.push(processImageUrl(imgUrl.url, 'telegram'));
          }
        });
      }
      
      log(`Всего изображений для карусели в Telegram: ${imageUrls.length}`, 'social-publishing');
      
      if (imageUrls.length === 0) {
        log(`Ошибка: После обработки не найдено валидных URL изображений для карусели`, 'social-publishing');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: 'Нет валидных URL изображений для карусели'
        };
      }
      
      // Создаем временные файлы для каждого изображения
      const tempFiles: string[] = [];
      const mediaItems: {index: number, messageId: number}[] = [];
      
      try {
        // Создаем временную директорию
        const tempDir = path.join(os.tmpdir(), 'telegram_carousel');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Скачиваем каждое изображение во временный файл и отправляем отдельно
        for (let i = 0; i < imageUrls.length; i++) {
          const url = imageUrls[i];
          const timestamp = Date.now();
          const randomString = Math.random().toString(36).substring(2, 10);
          const tempFilePath = path.join(tempDir, `telegram_carousel_${i}_${timestamp}_${randomString}.jpg`);
          
          try {
            // Скачиваем изображение
            log(`Скачивание изображения ${i+1}/${imageUrls.length} для карусели: ${url.substring(0, 100)}...`, 'social-publishing');
            const response = await axios.get(url, {
              responseType: 'arraybuffer',
              timeout: 30000,
              headers: {
                'Accept': 'image/*',
                'User-Agent': 'Mozilla/5.0 SMM Planner Bot'
              }
            });
            
            // Проверяем размер
            const dataSize = response.data.length;
            if (dataSize === 0) {
              log(`ОШИБКА: Скачан пустой файл (0 байт) для изображения ${i+1}`, 'social-publishing');
              continue; // Пропускаем это изображение
            }
            
            // Сохраняем файл
            fs.writeFileSync(tempFilePath, Buffer.from(response.data));
            log(`Сохранено изображение ${i+1} во временный файл: ${tempFilePath}`, 'social-publishing');
            tempFiles.push(tempFilePath);
            
            // Создаем FormData для каждого изображения
            const formData = new FormData();
            formData.append('chat_id', chatId);
            
            // Первое изображение с подписью, остальные без
            if (i === 0) {
              formData.append('caption', formattedText);
              formData.append('parse_mode', 'HTML');
            }
            
            // Добавляем файл
            const fileStream = fs.createReadStream(tempFilePath);
            formData.append('photo', fileStream, { filename: `image_${timestamp}_${i}.jpg` });
            
            // Отправляем изображение в Telegram
            try {
              const baseUrl = 'https://api.telegram.org/bot';
              const uploadResponse = await axios.post(`${baseUrl}${token}/sendPhoto`, formData, {
                headers: {
                  ...formData.getHeaders(),
                  'Accept': 'application/json'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 30000
              });
              
              fileStream.destroy(); // Закрываем стрим
              
              log(`Успешно отправлено изображение ${i+1} в Telegram`, 'social-publishing');
              
              // Добавляем полученное медиа-ID в массив для формирования группы
              mediaItems.push({
                index: i,
                messageId: uploadResponse.data.result.message_id
              });
            } catch (uploadError: any) {
              fileStream.destroy(); // Обязательно закрываем стрим при ошибке
              log(`Ошибка при отправке изображения ${i+1} в Telegram: ${uploadError.message}`, 'social-publishing');
              if (uploadError.response) {
                log(`Данные ошибки: ${JSON.stringify(uploadError.response.data)}`, 'social-publishing');
              }
            }
          } catch (downloadError: any) {
            log(`Ошибка при скачивании изображения ${i+1} для карусели: ${downloadError.message}`, 'social-publishing');
          }
        }
        
        // Удаляем временные файлы
        tempFiles.forEach(file => {
          try {
            fs.unlinkSync(file);
            log(`Удален временный файл: ${file}`, 'social-publishing');
          } catch (unlinkError) {
            log(`Ошибка при удалении временного файла: ${unlinkError}`, 'social-publishing');
          }
        });
        
        // Проверяем, успешно ли загружены какие-либо изображения
        if (mediaItems.length === 0) {
          log(`Ошибка: Не удалось отправить ни одно изображение для карусели`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: 'Не удалось отправить ни одно изображение для карусели'
          };
        }
        
        // Сортируем медиа-элементы по индексу
        mediaItems.sort((a, b) => a.index - b.index);
        
        // Формируем URL первого поста для возврата
        // Формируем URL поста в Telegram (формат t.me/c/channelid/messageid)
        const firstMessageId = mediaItems[0]?.messageId;
        const postUrl = chatId.startsWith('@')
          ? `https://t.me/${chatId.substring(1)}`
          : chatId.startsWith('-100')
            ? `https://t.me/c/${chatId.substring(4)}/${firstMessageId}`
            : null;
            
        log(`URL первого изображения карусели в Telegram: ${postUrl}`, 'social-publishing');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          publishedUrl: postUrl,
          postId: firstMessageId?.toString() || null
        };
        
      } catch (carouselError: any) {
        // Удаляем все временные файлы
        tempFiles.forEach(file => {
          try {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
          } catch (e) {
            // Игнорируем ошибки при очистке
          }
        });
        
        log(`Ошибка при публикации карусели в Telegram: ${carouselError.message}`, 'social-publishing');
        
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка публикации карусели: ${carouselError.message}`
        };
      }
    }
    
    // Если тип контента не поддерживается
    log(`Неподдерживаемый тип контента для Telegram: ${content.contentType}`, 'social-publishing');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Неподдерживаемый тип контента: ${content.contentType}`
    };
  } catch (error: any) {
    log(`Общая ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
    
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка публикации: ${error.message}`
    };
  }
}