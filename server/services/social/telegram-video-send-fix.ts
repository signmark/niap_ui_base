/**
 * Исправление для отправки видео в Telegram
 * Код содержит исправленную реализацию метода publishToTelegram
 * для корректной отправки локальных видеофайлов
 */

import axios from 'axios';
import { log } from '../../utils/logger';
import { CampaignContent, SocialPublication } from '@shared/schema';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Отправляет локальное видео в Telegram
 * @param videoUrl Путь к локальному видеофайлу
 * @param chatId ID чата Telegram
 * @param token Токен бота Telegram
 * @param caption Подпись к видео
 * @returns Результат отправки видео
 */
export async function sendLocalVideoToTelegram(
  videoUrl: string,
  chatId: string,
  token: string,
  caption: string = ''
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  try {
    log(`Отправка локального видео в Telegram: ${videoUrl} в чат ${chatId}`, 'social-publishing');
    
    // Проверяем валидность chat_id
    let formattedChatId = chatId;
    if (!formattedChatId.startsWith('@') && !formattedChatId.startsWith('-')) {
      formattedChatId = `-100${formattedChatId}`;
      log(`Преобразован chatId для канала: ${formattedChatId}`, 'social-publishing');
    }
    
    // Формируем URL запроса
    const apiUrl = `https://api.telegram.org/bot${token}/sendVideo`;
    
    // Подготавливаем данные формы
    const formData = new FormData();
    formData.append('chat_id', formattedChatId);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    
    // Проверяем существование файла
    // Определяем возможные пути к файлу
    const possiblePaths = [
      videoUrl,
      videoUrl.startsWith('/') ? `.${videoUrl}` : `/${videoUrl}`,
      videoUrl.startsWith('.') ? videoUrl : `./${videoUrl}`
    ];
    
    let fileFound = false;
    
    for (const possiblePath of possiblePaths) {
      log(`Проверка наличия файла по пути: ${possiblePath}`, 'social-publishing');
      if (fs.existsSync(possiblePath)) {
        log(`Файл найден по пути: ${possiblePath}`, 'social-publishing');
        // Читаем файл в буфер
        const videoBuffer = fs.readFileSync(possiblePath);
        const fileName = path.basename(possiblePath);
        
        // Добавляем видео в форму
        formData.append('video', videoBuffer, { filename: fileName });
        log(`Видео добавлено в форму, размер: ${videoBuffer.length} байт`, 'social-publishing');
        fileFound = true;
        break;
      }
    }
    
    if (!fileFound) {
      log(`Ошибка: видеофайл не найден по указанным путям: ${possiblePaths.join(', ')}`, 'social-publishing');
      return { success: false, error: 'Видеофайл не найден' };
    }
    
    // Отправляем запрос
    log(`Отправка запроса на публикацию видео в Telegram`, 'social-publishing');
    const response = await axios.post(apiUrl, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 60000, // Увеличенный таймаут для загрузки видео
    });
    
    // Проверяем результат
    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      log(`Видео успешно отправлено в Telegram, messageId: ${messageId}`, 'social-publishing');
      return { success: true, messageId };
    } else {
      log(`Ошибка при отправке видео в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
      return { success: false, error: JSON.stringify(response.data) };
    }
  } catch (error: any) {
    log(`Исключение при отправке видео в Telegram: ${error.message}`, 'social-publishing');
    
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      return { success: false, error: JSON.stringify(error.response.data) };
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Создает URL для сообщения в Telegram с учетом типа чата (канал, группа, приватный чат)
 * @param chatId Исходный ID чата
 * @param formattedChatId Форматированный ID чата для API запросов
 * @param messageId ID сообщения
 * @returns URL сообщения в Telegram
 */
export function formatTelegramUrl(chatId: string, formattedChatId: string, messageId: number | string, chatUsername?: string): string {
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

/**
 * Публикует контент (включая видео) в Telegram
 * Исправленная версия с поддержкой локальных видеофайлов
 * @param content Контент для публикации
 * @param telegramSettings Настройки Telegram API
 * @returns Результат публикации
 */
export async function publishToTelegramFixed(
  content: CampaignContent,
  telegramSettings: { token: string | null; chatId: string | null }
): Promise<SocialPublication> {
  // ID последнего сообщения для формирования ссылки
  let lastMessageId: number | string | undefined;
  // Храним username канала, если его удастся получить
  let chatUsername: string | undefined;
  
  try {
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

    // Пытаемся определить username канала/группы
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
    
    // Проверяем наличие видео
    if (content.videoUrl) {
      log(`Обнаружено видео в контенте: ${content.videoUrl}`, 'social-publishing');
      
      // Проверяем, является ли это локальным путем
      const isLocalVideoPath = content.videoUrl.startsWith('/') || content.videoUrl.startsWith('./');
      
      if (isLocalVideoPath) {
        log(`Отправка локального видео в Telegram: ${content.videoUrl}`, 'social-publishing');
        
        // Отправляем локальное видео в Telegram
        const videoResult = await sendLocalVideoToTelegram(
          content.videoUrl,
          chatId,
          token,
          formattedText
        );
        
        if (videoResult.success && videoResult.messageId) {
          // Сохраняем ID сообщения для формирования URL
          lastMessageId = videoResult.messageId;
          
          // Форматируем URL для Telegram
          let formattedChatId = chatId;
          if (!formattedChatId.startsWith('@') && !formattedChatId.startsWith('-')) {
            formattedChatId = `-100${formattedChatId}`;
          }
          
          const postUrl = formatTelegramUrl(chatId, formattedChatId, lastMessageId, chatUsername);
          
          log(`Видео успешно опубликовано в Telegram: ${postUrl}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            postUrl,
            messageId: lastMessageId.toString()
          };
        } else {
          // Если не удалось отправить видео, логируем ошибку
          log(`Ошибка при отправке видео в Telegram: ${videoResult.error || 'неизвестная ошибка'}`, 'social-publishing');
          
          // Пытаемся отправить сообщение без видео (только текст)
          log(`Попытка отправить сообщение без видео`, 'social-publishing');
          
          try {
            // Формируем URL запроса
            const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
            
            // Проверяем валидность chat_id
            let formattedChatId = chatId;
            if (!formattedChatId.startsWith('@') && !formattedChatId.startsWith('-')) {
              formattedChatId = `-100${formattedChatId}`;
            }
            
            // Подготавливаем данные запроса
            const data = {
              chat_id: formattedChatId,
              text: formattedText,
              parse_mode: 'HTML'
            };
            
            // Отправляем запрос
            const response = await axios.post(apiUrl, data);
            
            // Проверяем успешность отправки
            if (response.data && response.data.ok) {
              lastMessageId = response.data.result.message_id;
              
              // Форматируем URL для Telegram
              const postUrl = formatTelegramUrl(chatId, formattedChatId, lastMessageId, chatUsername);
              
              log(`Текстовое сообщение успешно отправлено в Telegram: ${postUrl}`, 'social-publishing');
              
              return {
                platform: 'telegram',
                status: 'published',
                publishedAt: new Date(),
                postUrl,
                messageId: lastMessageId.toString()
              };
            } else {
              log(`Ошибка при отправке текстового сообщения в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
              
              return {
                platform: 'telegram',
                status: 'failed',
                publishedAt: null,
                error: `Ошибка при отправке сообщения: ${JSON.stringify(response.data)}`
              };
            }
          } catch (error: any) {
            log(`Исключение при отправке текстового сообщения в Telegram: ${error.message}`, 'social-publishing');
            
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: `Ошибка: ${error.message}`
            };
          }
        }
      } else {
        // Это URL видео, пытаемся отправить его через Telegram API
        log(`Отправка видео по URL: ${content.videoUrl}`, 'social-publishing');
        
        try {
          // Формируем URL запроса
          const apiUrl = `https://api.telegram.org/bot${token}/sendVideo`;
          
          // Проверяем валидность chat_id
          let formattedChatId = chatId;
          if (!formattedChatId.startsWith('@') && !formattedChatId.startsWith('-')) {
            formattedChatId = `-100${formattedChatId}`;
          }
          
          // Подготавливаем данные запроса
          const data = {
            chat_id: formattedChatId,
            video: content.videoUrl,
            caption: formattedText,
            parse_mode: 'HTML'
          };
          
          // Отправляем запрос
          const response = await axios.post(apiUrl, data);
          
          // Проверяем успешность отправки
          if (response.data && response.data.ok) {
            lastMessageId = response.data.result.message_id;
            
            // Форматируем URL для Telegram
            const postUrl = formatTelegramUrl(chatId, formattedChatId, lastMessageId, chatUsername);
            
            log(`Видео по URL успешно отправлено в Telegram: ${postUrl}`, 'social-publishing');
            
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              postUrl,
              messageId: lastMessageId.toString()
            };
          } else {
            log(`Ошибка при отправке видео по URL в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
            
            // Пытаемся отправить просто текст
            return await sendTextFallback(token, chatId, formattedText, chatUsername);
          }
        } catch (error: any) {
          log(`Исключение при отправке видео по URL в Telegram: ${error.message}`, 'social-publishing');
          
          // Пытаемся отправить просто текст
          return await sendTextFallback(token, chatId, formattedText, chatUsername);
        }
      }
    } else if (content.imageUrl) {
      // Отправка изображения с подписью
      log(`Отправка изображения в Telegram: ${content.imageUrl}`, 'social-publishing');
      
      try {
        // Формируем URL запроса
        const apiUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
        
        // Проверяем валидность chat_id
        let formattedChatId = chatId;
        if (!formattedChatId.startsWith('@') && !formattedChatId.startsWith('-')) {
          formattedChatId = `-100${formattedChatId}`;
        }
        
        // Подготавливаем данные запроса
        const data = {
          chat_id: formattedChatId,
          photo: content.imageUrl,
          caption: formattedText,
          parse_mode: 'HTML'
        };
        
        // Отправляем запрос
        const response = await axios.post(apiUrl, data);
        
        // Проверяем успешность отправки
        if (response.data && response.data.ok) {
          lastMessageId = response.data.result.message_id;
          
          // Форматируем URL для Telegram
          const postUrl = formatTelegramUrl(chatId, formattedChatId, lastMessageId, chatUsername);
          
          log(`Изображение успешно отправлено в Telegram: ${postUrl}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            postUrl,
            messageId: lastMessageId.toString()
          };
        } else {
          log(`Ошибка при отправке изображения в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
          
          // Пытаемся отправить просто текст
          return await sendTextFallback(token, chatId, formattedText, chatUsername);
        }
      } catch (error: any) {
        log(`Исключение при отправке изображения в Telegram: ${error.message}`, 'social-publishing');
        
        // Пытаемся отправить просто текст
        return await sendTextFallback(token, chatId, formattedText, chatUsername);
      }
    } else {
      // Отправка простого текстового сообщения
      return await sendTextFallback(token, chatId, formattedText, chatUsername);
    }
  } catch (error: any) {
    log(`Общая ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
    
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка: ${error.message}`
    };
  }
}

/**
 * Отправляет текстовое сообщение в Telegram (используется как запасной вариант)
 */
async function sendTextFallback(
  token: string,
  chatId: string,
  text: string,
  chatUsername?: string
): Promise<SocialPublication> {
  try {
    log(`Отправка текстового сообщения в Telegram`, 'social-publishing');
    
    // Формируем URL запроса
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    
    // Проверяем валидность chat_id
    let formattedChatId = chatId;
    if (!formattedChatId.startsWith('@') && !formattedChatId.startsWith('-')) {
      formattedChatId = `-100${formattedChatId}`;
    }
    
    // Подготавливаем данные запроса
    const data = {
      chat_id: formattedChatId,
      text: text,
      parse_mode: 'HTML'
    };
    
    // Отправляем запрос
    const response = await axios.post(apiUrl, data);
    
    // Проверяем успешность отправки
    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      
      // Форматируем URL для Telegram
      const postUrl = formatTelegramUrl(chatId, formattedChatId, messageId, chatUsername);
      
      log(`Текстовое сообщение успешно отправлено в Telegram: ${postUrl}`, 'social-publishing');
      
      return {
        platform: 'telegram',
        status: 'published',
        publishedAt: new Date(),
        postUrl,
        messageId: messageId.toString()
      };
    } else {
      log(`Ошибка при отправке текстового сообщения в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
      
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при отправке сообщения: ${JSON.stringify(response.data)}`
      };
    }
  } catch (error: any) {
    log(`Исключение при отправке текстового сообщения в Telegram: ${error.message}`, 'social-publishing');
    
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка: ${error.message}`
    };
  }
}