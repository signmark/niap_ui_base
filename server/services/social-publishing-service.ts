import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';
import { getOptimizedImagePath } from './cdn-service';

const log = (message: string) => logger.info(`[SocialPublishingService] ${message}`);
const errorLog = (message: string) => logger.error(`[SocialPublishingService] ${message}`);

// Типы платформ для публикации
export type SocialPlatform = 'telegram' | 'vk' | 'instagram' | 'facebook';

// Интерфейс для структуры контента
export interface Content {
  id: string;
  title?: string;
  text?: string;
  content?: string; // Может использоваться вместо text в зависимости от источника
  contentType?: string;
  imageUrl?: string;
  videoUrl?: string;
  additionalImages?: string[];
  keywords?: string[];
  socialPlatforms?: Record<string, any>;
  [key: string]: any;
}

/**
 * Публикует контент в указанную социальную сеть
 * @param platform Целевая социальная платформа
 * @param contentId ID контента для публикации (если известен)
 * @param content Объект с контентом (в случае, если contentId не указан)
 * @returns Результат публикации
 */
export async function publishToSocialNetwork(
  platform: SocialPlatform,
  contentId?: string,
  content?: Content
): Promise<any> {
  try {
    log(`Подготовка к публикации контента на платформе ${platform}`);

    // Если contentId указан, но контент не передан, то нужно получить контент по ID
    // В этом примере просто возвращаем ошибку, т.к. мы не реализуем полную интеграцию с Directus
    if (contentId && !content) {
      throw new Error('Не реализовано: получение контента по ID из Directus API');
    }

    // Проверяем наличие контента
    if (!content) {
      throw new Error('Контент не указан');
    }

    // Определяем текст публикации
    let text = '';
    if (content.text) {
      text = content.text;
    } else if (content.content) {
      // Если есть content, но нет text, используем content
      // При необходимости можно добавить очистку от HTML-тегов
      text = content.content.replace(/<[^>]*>/g, '');
    }

    // Если есть заголовок, добавляем его в начало текста (если текст не содержит заголовок)
    if (content.title && !text.includes(content.title)) {
      text = `${content.title}\n\n${text}`;
    }

    // Получаем полные пути к изображениям
    const imageUrls: string[] = [];
    
    // Основное изображение
    if (content.imageUrl) {
      try {
        const imagePath = getOptimizedImagePath(content.imageUrl);
        if (fs.existsSync(imagePath)) {
          imageUrls.push(imagePath);
        } else {
          log(`Основное изображение не найдено по пути: ${imagePath}`);
        }
      } catch (error) {
        errorLog(`Ошибка при обработке основного изображения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      }
    }
    
    // Дополнительные изображения
    if (Array.isArray(content.additionalImages) && content.additionalImages.length > 0) {
      for (const imageUrl of content.additionalImages) {
        if (imageUrl) {
          try {
            const imagePath = getOptimizedImagePath(imageUrl);
            if (fs.existsSync(imagePath)) {
              imageUrls.push(imagePath);
            } else {
              log(`Дополнительное изображение не найдено по пути: ${imagePath}`);
            }
          } catch (error) {
            errorLog(`Ошибка при обработке дополнительного изображения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
          }
        }
      }
    }

    // В зависимости от платформы вызываем соответствующую функцию
    switch (platform) {
      case 'telegram':
        return await publishToTelegram(text, imageUrls);
      case 'vk':
        return await publishToVK(text, imageUrls);
      case 'instagram':
        return await publishToInstagram(text, imageUrls);
      case 'facebook':
        return await publishToFacebook(text, imageUrls);
      default:
        throw new Error(`Неподдерживаемая платформа: ${platform}`);
    }
  } catch (error) {
    errorLog(`Ошибка публикации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    throw error;
  }
}

/**
 * Публикует контент в Telegram
 * @param text Текст для публикации
 * @param imagePaths Массив путей к изображениям
 * @returns Результат публикации
 */
async function publishToTelegram(text: string, imagePaths: string[]): Promise<any> {
  try {
    log(`Публикация в Telegram: ${text.substring(0, 50)}... с ${imagePaths.length} изображениями`);

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      throw new Error('Не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в переменных окружения');
    }

    // Базовый URL для API Telegram
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}`;

    // Если изображений нет, отправляем просто текст
    if (imagePaths.length === 0) {
      const response = await axios.post(`${telegramApiUrl}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      });
      
      log('Текст успешно опубликован в Telegram');
      return response.data;
    }

    // Если есть только одно изображение, отправляем его с текстом
    if (imagePaths.length === 1) {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      
      // Добавляем текст, если он есть
      if (text) {
        formData.append('caption', text);
        formData.append('parse_mode', 'HTML');
      }
      
      // Добавляем изображение
      formData.append('photo', new Blob([fs.readFileSync(imagePaths[0])]));
      
      const response = await axios.post(`${telegramApiUrl}/sendPhoto`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      log('Изображение с текстом успешно опубликовано в Telegram');
      return response.data;
    }

    // Если есть несколько изображений, отправляем их как медиа-группу
    const media = imagePaths.map((imagePath, index) => {
      // Только к первому изображению добавляем подпись
      const caption = index === 0 ? text : '';
      return {
        type: 'photo',
        media: `attach://photo${index}`,
        caption: caption,
        parse_mode: 'HTML'
      };
    });

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('media', JSON.stringify(media));
    
    // Добавляем все изображения
    imagePaths.forEach((imagePath, index) => {
      formData.append(`photo${index}`, new Blob([fs.readFileSync(imagePath)]));
    });
    
    const response = await axios.post(`${telegramApiUrl}/sendMediaGroup`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    log('Группа изображений успешно опубликована в Telegram');
    return response.data;
  } catch (error) {
    errorLog(`Ошибка публикации в Telegram: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    throw new Error(`Не удалось опубликовать в Telegram: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
  }
}

/**
 * Публикует контент в ВКонтакте (заглушка)
 * @param text Текст для публикации
 * @param imagePaths Массив путей к изображениям
 * @returns Результат публикации
 */
async function publishToVK(text: string, imagePaths: string[]): Promise<any> {
  log(`Публикация в ВКонтакте: ${text.substring(0, 50)}... с ${imagePaths.length} изображениями`);
  // Пока это заглушка, здесь будет реальная реализация публикации в VK
  return {
    success: true,
    platform: 'vk',
    message: 'Функциональность публикации в ВКонтакте будет реализована позднее',
    meta: {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      imagesCount: imagePaths.length
    }
  };
}

/**
 * Публикует контент в Instagram (заглушка)
 * @param text Текст для публикации
 * @param imagePaths Массив путей к изображениям
 * @returns Результат публикации
 */
async function publishToInstagram(text: string, imagePaths: string[]): Promise<any> {
  log(`Публикация в Instagram: ${text.substring(0, 50)}... с ${imagePaths.length} изображениями`);
  // Пока это заглушка, здесь будет реальная реализация публикации в Instagram
  return {
    success: true,
    platform: 'instagram',
    message: 'Функциональность публикации в Instagram будет реализована позднее',
    meta: {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      imagesCount: imagePaths.length
    }
  };
}

/**
 * Публикует контент в Facebook (заглушка)
 * @param text Текст для публикации
 * @param imagePaths Массив путей к изображениям
 * @returns Результат публикации
 */
async function publishToFacebook(text: string, imagePaths: string[]): Promise<any> {
  log(`Публикация в Facebook: ${text.substring(0, 50)}... с ${imagePaths.length} изображениями`);
  // Пока это заглушка, здесь будет реальная реализация публикации в Facebook
  return {
    success: true,
    platform: 'facebook',
    message: 'Функциональность публикации в Facebook будет реализована позднее',
    meta: {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      imagesCount: imagePaths.length
    }
  };
}