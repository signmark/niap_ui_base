/**
 * Патч для сервиса Telegram для обработки локальных видеофайлов
 * 
 * ИНСТРУКЦИЯ ПО ИНТЕГРАЦИИ:
 * 
 * 1. В файле server/services/social/telegram-service.ts найдите метод publishToTelegram
 * 2. Замените его содержимое кодом из этого файла
 * 3. Либо используйте этот патч как отдельный сервис
 */

import axios from 'axios';
import { log } from '../../utils/logger';
import { CampaignContent, SocialMediaSettings, SocialPublication } from '@shared/schema';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

// Патч для основного метода публикации в Telegram
// Заменяет метод publishToTelegram в классе TelegramService

/**
 * Публикует контент в Telegram с поддержкой локальных видеофайлов
 * @param content Контент для публикации
 * @param telegramSettings Настройки Telegram API
 * @returns Результат публикации
 */
async function publishToTelegramPatch(
  content: CampaignContent,
  telegramSettings: { token: string | null; chatId: string | null }
): Promise<SocialPublication> {
  // ID последнего сообщения для формирования ссылки
  let lastMessageId: number | string | undefined;
  // Храним username канала, если его удастся получить
  let chatUsername: string | undefined;
  
  try {
    log(`[PATCHED] Публикация контента в Telegram с поддержкой локальных видео`, 'social-publishing');
    
    // Проверяем наличие необходимых параметров
    if (!telegramSettings.token || !telegramSettings.chatId) {
      log(`Ошибка публикации в Telegram: отсутствуют настройки. Token: ${telegramSettings.token ? 'задан' : 'отсутствует'}, ChatID: ${telegramSettings.chatId ? 'задан' : 'отсутствует'}`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Missing Telegram API settings (token or chatId)'
      };
    }
    
    const token = telegramSettings.token;
    const chatId = telegramSettings.chatId;

    // Пытаемся определить username канала/группы для более красивых URL
    try {
      const chatInfoUrl = `https://api.telegram.org/bot${token}/getChat`;
      const chatInfoResponse = await axios.post(chatInfoUrl, { chat_id: chatId });
      
      if (chatInfoResponse.data && chatInfoResponse.data.ok && chatInfoResponse.data.result) {
        // Если у канала/группы есть username, сохраняем его для формирования URL
        if (chatInfoResponse.data.result.username) {
          chatUsername = chatInfoResponse.data.result.username;
          log(`Получен username канала/группы: ${chatUsername}`, 'social-publishing');
        }
      }
    } catch (error) {
      log(`Ошибка при запросе информации о чате: ${error instanceof Error ? error.message : String(error)}`, 'social-publishing');
    }
    
    // Подготавливаем текст для отправки
    let text = '';
    
    // Если есть заголовок, добавляем его в начало сообщения
    if (content.title) {
      text += `<b>${content.title}</b>\n\n`;
    }
    
    // Добавляем основной текст контента
    if (content.content) {
      text += content.content;
    }
    
    // Обрабатываем хэштеги
    if (content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0) {
      const formattedHashtags = content.hashtags
        .filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
        .map(tag => tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`);
      
      if (formattedHashtags.length > 0) {
        text += '\n\n' + formattedHashtags.join(' ');
      }
    }
    
    // Форматируем текст с учетом ограничений Telegram
    // максимальная длина подписи к видео/фото - 1024 символа
    const maxCaptionLength = 1024;
    const formattedText = text.length > maxCaptionLength 
      ? text.substring(0, maxCaptionLength - 3) + '...' 
      : text;
    
    log(`Подготовлен текст для публикации в Telegram (${formattedText.length} символов)`, 'social-publishing');
    
    // Проверяем наличие видео в контенте
    if (content.videoUrl) {
      log(`[PATCHED] Обнаружено видео в контенте: ${content.videoUrl}`, 'social-publishing');
      
      // Проверяем, является ли это локальным путем
      const isLocalVideoPath = typeof content.videoUrl === 'string' && 
        (content.videoUrl.startsWith('/') || content.videoUrl.startsWith('./'));
      
      // ОСНОВНОЕ ИЗМЕНЕНИЕ: Поддержка локальных видеофайлов
      if (isLocalVideoPath) {
        log(`[PATCHED] Обработка локального видеофайла: ${content.videoUrl}`, 'social-publishing');
        
        // Формируем URL запроса
        const apiUrl = `https://api.telegram.org/bot${token}/sendVideo`;
        
        // Проверяем валидность chat_id
        let formattedChatId = chatId;
        if (!formattedChatId.startsWith('@') && !formattedChatId.startsWith('-')) {
          formattedChatId = `-100${formattedChatId}`;
        }
        
        // Подготавливаем данные формы для отправки файла
        const formData = new FormData();
        formData.append('chat_id', formattedChatId);
        formData.append('caption', formattedText);
        formData.append('parse_mode', 'HTML');
        
        // Определяем возможные пути к файлу
        const possiblePaths = [
          content.videoUrl,
          content.videoUrl.startsWith('/') ? `.${content.videoUrl}` : `/${content.videoUrl}`,
          content.videoUrl.startsWith('.') ? content.videoUrl : `./${content.videoUrl}`
        ];
        
        let fileFound = false;
        
        for (const possiblePath of possiblePaths) {
          log(`[PATCHED] Проверка наличия файла по пути: ${possiblePath}`, 'social-publishing');
          
          if (fs.existsSync(possiblePath)) {
            log(`[PATCHED] Файл найден по пути: ${possiblePath}`, 'social-publishing');
            
            // Читаем файл в буфер
            const videoBuffer = fs.readFileSync(possiblePath);
            const fileName = path.basename(possiblePath);
            
            // Добавляем видео в форму
            formData.append('video', videoBuffer, { filename: fileName });
            log(`[PATCHED] Видео добавлено в форму, размер: ${videoBuffer.length} байт`, 'social-publishing');
            fileFound = true;
            break;
          }
        }
        
        if (!fileFound) {
          log(`[PATCHED] Ошибка: видеофайл не найден по указанным путям: ${possiblePaths.join(', ')}`, 'social-publishing');
          
          // Пытаемся отправить текстовое сообщение вместо видео
          log(`[PATCHED] Отправка текстового сообщения вместо видео`, 'social-publishing');
          
          // Формируем URL запроса для текстового сообщения
          const textApiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
          
          // Подготавливаем данные запроса
          const textData = {
            chat_id: formattedChatId,
            text: formattedText + '\n\n⚠️ Видео не найдено по указанному пути.',
            parse_mode: 'HTML'
          };
          
          // Отправляем запрос
          const textResponse = await axios.post(textApiUrl, textData);
          
          if (textResponse.data && textResponse.data.ok) {
            lastMessageId = textResponse.data.result.message_id;
            
            // Форматируем URL для Telegram
            const postUrl = formatTelegramUrl(chatId, formattedChatId, lastMessageId, chatUsername);
            
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              postUrl,
              messageId: lastMessageId.toString()
            };
          } else {
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: 'Failed to send message, video file not found'
            };
          }
        }
        
        // Отправляем запрос с видеофайлом
        log(`[PATCHED] Отправка запроса на публикацию видео в Telegram`, 'social-publishing');
        
        const response = await axios.post(apiUrl, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 60000, // Увеличенный таймаут для загрузки видео
        });
        
        // Проверяем результат
        if (response.data && response.data.ok) {
          lastMessageId = response.data.result.message_id;
          
          // Форматируем URL для Telegram
          const postUrl = formatTelegramUrl(chatId, formattedChatId, lastMessageId, chatUsername);
          
          log(`[PATCHED] Видео успешно отправлено в Telegram: ${postUrl}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            postUrl,
            messageId: lastMessageId.toString()
          };
        } else {
          log(`[PATCHED] Ошибка при отправке видео в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: `Failed to send video: ${JSON.stringify(response.data)}`
          };
        }
      } else {
        // Обработка видео по URL (существующий код)
        log(`Отправка видео по внешнему URL: ${content.videoUrl}`, 'social-publishing');
        // Здесь должен быть код для отправки видео по URL
        // ...
      }
    }
    
    // Остальной код publishToTelegram остается без изменений
    // ...
    
    // Возвращаем заглушку, если мы дошли до этой точки
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: 'Implementation incomplete'
    };
  } catch (error: any) {
    log(`[PATCHED] Общая ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
    
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Error: ${error.message}`
    };
  }
}

/**
 * Вспомогательная функция для форматирования URL Telegram с учетом разных форматов chat ID
 * @param chatId Исходный chat ID (может быть @username или числовым ID)
 * @param formattedChatId Форматированный chat ID для API запросов
 * @param messageId ID сообщения для создания прямой ссылки (ОБЯЗАТЕЛЬНЫЙ параметр)
 * @returns Корректно форматированный URL
 */
function formatTelegramUrl(chatId: string, formattedChatId: string, messageId: number | string, chatUsername?: string): string {
  log(`Форматирование Telegram URL: chatId=${chatId}, formattedChatId=${formattedChatId}, messageId=${messageId}, username=${chatUsername || 'не указан'}`, 'social-publishing');
  
  // В соответствии с требованиями, messageId должен всегда присутствовать в URL
  if (!messageId) {
    log(`ОШИБКА: messageId не указан при формировании URL - это недопустимо`, 'social-publishing');
    throw new Error('MessageId is required for Telegram URL formation');
  }
  
  // Если известен username чата, используем его (для публичных каналов и групп)
  if (chatUsername || (chatId && chatId.startsWith('@'))) {
    const username = chatUsername || chatId.substring(1);
    return `https://t.me/${username}/${messageId}`;
  }
  
  // Для каналов и супергрупп с ID вида -100XXXXXX
  if (formattedChatId.startsWith('-100')) {
    // Удаляем префикс -100 для URL
    const channelId = formattedChatId.substring(4);
    return `https://t.me/c/${channelId}/${messageId}`;
  }
  
  // Для групп с ID вида -XXXXXX (не супергруппы)
  if (formattedChatId.startsWith('-')) {
    // Удаляем только минус для URL
    const groupId = formattedChatId.substring(1);
    return `https://t.me/c/${groupId}/${messageId}`;
  }
  
  // Для личных чатов - такой URL не будет работать как ссылка, но формально он правильный
  return `https://t.me/c/${formattedChatId}/${messageId}`;
}