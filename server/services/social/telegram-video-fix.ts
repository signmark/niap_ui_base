/**
 * Модуль для исправления обработки видео в Telegram
 * Обеспечивает корректную отправку локальных видеофайлов в Telegram
 */

import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { log } from '../../utils/logger';

/**
 * Отправляет видео в Telegram
 * @param chatId ID чата Telegram
 * @param token Токен бота Telegram
 * @param videoUrl URL видео или путь к локальному файлу
 * @param caption Текстовая подпись к видео
 * @returns Результат отправки видео
 */
export async function sendVideoToTelegram(
  chatId: string,
  token: string,
  videoUrl: string,
  caption: string = ''
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  try {
    log(`Отправка видео в Telegram: ${videoUrl} в чат ${chatId}`, 'social-publishing');
    
    // Формируем URL запроса
    const apiUrl = `https://api.telegram.org/bot${token}/sendVideo`;
    
    // Проверяем валидность chat_id
    let formattedChatId = chatId;
    if (!formattedChatId.startsWith('@') && !formattedChatId.startsWith('-')) {
      formattedChatId = `-100${formattedChatId}`;
      log(`Преобразован chatId для канала: ${formattedChatId}`, 'social-publishing');
    }
    
    // Подготавливаем данные формы
    const formData = new FormData();
    formData.append('chat_id', formattedChatId);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    formData.append('disable_notification', 'false');
    
    // Определяем, локальный файл или URL
    const isLocalFile = videoUrl.startsWith('/') || videoUrl.startsWith('./');
    
    if (isLocalFile) {
      log(`Отправка локального файла: ${videoUrl}`, 'social-publishing');
      
      // Если это путь к локальному файлу, проверяем его существование
      // В пути может отсутствовать ведущий слеш, нужно обработать оба варианта
      const possiblePaths = [
        videoUrl,
        videoUrl.startsWith('/') ? `.${videoUrl}` : `/${videoUrl}`,
        videoUrl.startsWith('.') ? videoUrl : `./${videoUrl}`
      ];
      
      let fileFound = false;
      
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          // Если файл существует, читаем его и добавляем в форму
          const videoBuffer = fs.readFileSync(possiblePath);
          const fileName = path.basename(possiblePath);
          
          formData.append('video', videoBuffer, { filename: fileName });
          log(`Видео найдено и прочитано: ${possiblePath}, размер: ${videoBuffer.length} байт`, 'social-publishing');
          fileFound = true;
          break;
        }
      }
      
      if (!fileFound) {
        log(`Локальный файл не найден: проверены пути ${possiblePaths.join(', ')}`, 'social-publishing');
        return { success: false, error: 'Локальный файл не найден' };
      }
    } else {
      // Если это URL, добавляем его напрямую
      log(`Отправка видео по URL: ${videoUrl}`, 'social-publishing');
      formData.append('video', videoUrl);
    }
    
    // Отправляем запрос
    const response = await axios.post(apiUrl, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
    
    // Проверяем успешность отправки
    if (response.status === 200 && response.data && response.data.ok) {
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