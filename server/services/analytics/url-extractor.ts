/**
 * Утилиты для извлечения идентификаторов из URL социальных сетей
 * Используются для получения идентификаторов постов для аналитики
 */

import { log } from '../../utils/logger';

/**
 * Извлекает идентификаторы чата и сообщения из URL Telegram
 * @param telegramUrl URL сообщения Telegram
 * @returns Объект с идентификаторами или null в случае ошибки
 */
export function extractTelegramIds(telegramUrl: string): { chatId: string, messageId: string } | null {
  try {
    // Поддерживаем различные форматы URL Telegram
    // Формат 1: https://t.me/c/1234567890/123
    // Формат 2: https://t.me/channel_name/123
    // Формат 3: https://t.me/channel_name/123?comment=456
    
    // Проверка на пустой или некорректный URL
    if (!telegramUrl || !telegramUrl.includes('t.me')) {
      log.warn(`[url-extractor] Некорректный URL Telegram: ${telegramUrl}`);
      return null;
    }
    
    try {
      const url = new URL(telegramUrl);
      
      if (!url.pathname.includes('/')) {
        log.warn(`[url-extractor] Некорректный формат пути URL Telegram: ${telegramUrl}`);
        return null;
      }
      
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      // Получаем chatId и messageId в зависимости от формата URL
      let chatId: string;
      let messageId: string;
      
      if (pathParts[0] === 'c') {
        // Приватный канал или чат: /c/1234567890/123
        chatId = pathParts[1];
        messageId = pathParts[2];
        
        // Для приватных каналов нужно добавить -100 в начало
        if (!chatId.startsWith('-100')) {
          chatId = `-100${chatId}`;
        }
      } else {
        // Публичный канал: /channel_name/123
        chatId = `@${pathParts[0]}`;
        messageId = pathParts[1];
      }
      
      if (!chatId || !messageId) {
        log.warn(`[url-extractor] Не удалось извлечь идентификаторы из URL Telegram: ${telegramUrl}`);
        return null;
      }
      
      return { chatId, messageId };
    } catch (urlError: any) {
      // Если URL некорректный, пытаемся разобрать его вручную
      log.warn(`[url-extractor] Ошибка разбора URL, пытаемся разобрать вручную: ${telegramUrl}`);
      
      // Проверяем, содержит ли URL информацию о чате и сообщении
      const match = telegramUrl.match(/t\.me\/(c\/)?([^/]+)\/(\d+)/);
      if (match) {
        const isPrivate = match[1] === 'c/';
        let chatId = match[2];
        const messageId = match[3];
        
        if (isPrivate && !chatId.startsWith('-100')) {
          chatId = `-100${chatId}`;
        } else if (!isPrivate) {
          chatId = `@${chatId}`;
        }
        
        return { chatId, messageId };
      }
    }
    
    log.warn(`[url-extractor] Не удалось извлечь идентификаторы из URL Telegram: ${telegramUrl}`);
    return null;
  } catch (error: any) {
    log.error(`[url-extractor] Ошибка извлечения идентификаторов Telegram: ${error.message}`);
    return null;
  }
}

/**
 * Извлекает идентификаторы владельца и поста из URL ВКонтакте
 * @param vkUrl URL поста ВКонтакте
 * @returns Объект с идентификаторами или null в случае ошибки
 */
export function extractVkIds(vkUrl: string): { ownerId: string, postId: string } | null {
  try {
    // Поддерживаем различные форматы URL ВКонтакте
    // Формат 1: https://vk.com/wall-12345_67890
    // Формат 2: https://vk.com/club12345?w=wall-12345_67890
    // Формат 3: https://vk.com/public12345?w=wall-12345_67890
    
    // Ищем идентификатор записи в формате wall-12345_67890 или wall12345_67890
    const wallMatch = vkUrl.match(/wall(-?\d+)_(\d+)/);
    
    if (!wallMatch || wallMatch.length < 3) {
      log.warn(`[url-extractor] Некорректный формат URL ВКонтакте: ${vkUrl}`);
      return null;
    }
    
    const ownerId = wallMatch[1]; // Может быть отрицательным для групп
    const postId = wallMatch[2];
    
    return { ownerId, postId };
  } catch (error: any) {
    log.error(`[url-extractor] Ошибка извлечения идентификаторов ВКонтакте: ${error.message}`);
    return null;
  }
}

/**
 * Извлекает идентификатор медиа из URL Instagram
 * @param instagramUrl URL публикации Instagram
 * @returns Идентификатор медиа или null в случае ошибки
 */
export function extractInstagramId(instagramUrl: string): string | null {
  try {
    // Поддерживаем различные форматы URL Instagram
    // Формат 1: https://www.instagram.com/p/CqAbCdEfGhI/
    // Формат 2: https://www.instagram.com/reel/CqAbCdEfGhI/
    // Формат 3: https://www.instagram.com/tv/CqAbCdEfGhI/
    
    const url = new URL(instagramUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Проверяем, что URL содержит /p/, /reel/ или /tv/
    if (['p', 'reel', 'tv'].includes(pathParts[0]) && pathParts.length >= 2) {
      // Возвращаем идентификатор медиа
      return pathParts[1];
    }
    
    log.warn(`[url-extractor] Некорректный формат URL Instagram: ${instagramUrl}`);
    return null;
  } catch (error: any) {
    log.error(`[url-extractor] Ошибка извлечения идентификатора Instagram: ${error.message}`);
    return null;
  }
}

/**
 * Извлекает идентификатор поста из URL Facebook
 * @param facebookUrl URL публикации Facebook
 * @returns Идентификатор поста или null в случае ошибки
 */
export function extractFacebookId(facebookUrl: string): string | null {
  try {
    // Поддерживаем различные форматы URL Facebook
    // Формат 1: https://www.facebook.com/username/posts/12345678901234567
    // Формат 2: https://www.facebook.com/groups/groupname/posts/12345678901234567
    // Формат 3: https://www.facebook.com/permalink.php?story_fbid=12345678901234567&id=100012345678901
    
    const url = new URL(facebookUrl);
    
    // Вариант 1: URL с /posts/
    if (url.pathname.includes('/posts/')) {
      const postIdMatch = url.pathname.match(/\/posts\/(\d+)/);
      if (postIdMatch && postIdMatch[1]) {
        return postIdMatch[1];
      }
    }
    
    // Вариант 2: URL с story_fbid в query parameters
    if (url.pathname.includes('/permalink.php') && url.searchParams.has('story_fbid')) {
      return url.searchParams.get('story_fbid');
    }
    
    // Вариант 3: URL с /photos/ 
    if (url.pathname.includes('/photos/')) {
      const photoIdMatch = url.pathname.match(/\/photos(?:\/[a-z.]+)?\/(\d+)/i);
      if (photoIdMatch && photoIdMatch[1]) {
        return photoIdMatch[1];
      }
    }
    
    // Вариант 4: URL с /videos/
    if (url.pathname.includes('/videos/')) {
      const videoIdMatch = url.pathname.match(/\/videos(?:\/[a-z.]+)?\/(\d+)/i);
      if (videoIdMatch && videoIdMatch[1]) {
        return videoIdMatch[1];
      }
    }
    
    log.warn(`[url-extractor] Некорректный формат URL Facebook: ${facebookUrl}`);
    return null;
  } catch (error: any) {
    log.error(`[url-extractor] Ошибка извлечения идентификатора Facebook: ${error.message}`);
    return null;
  }
}