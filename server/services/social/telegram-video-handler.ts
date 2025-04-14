import axios from 'axios';
import { log } from '../../utils/logger';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

/**
 * Отправляет видео в Telegram
 * @param videoUrl URL видео для отправки
 * @param caption Подпись к видео (опционально)
 * @param chatId ID чата Telegram
 * @param token Токен бота Telegram
 * @param baseAppUrl Базовый URL приложения для формирования полных путей к локальным видео
 * @returns Результат отправки видео
 */
export async function sendVideoToTelegram(
  videoUrl: string, 
  caption: string | null, 
  chatId: string, 
  token: string,
  baseAppUrl: string
): Promise<{ success: boolean, result?: any, error?: string, messageId?: number | string }> {
  try {
    log(`Отправка видео в Telegram: ${videoUrl}`, 'social-publishing');
    
    // Формируем полный URL, если это локальный путь
    let fullVideoUrl = videoUrl;
    if (!videoUrl.startsWith('http')) {
      fullVideoUrl = `${baseAppUrl}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;
      log(`Исправлен URL для видео: ${fullVideoUrl}`, 'social-publishing');
    }
    
    // Ограничиваем длину подписи (Telegram ограничивает подписи до 1024 символов)
    let formattedCaption = '';
    if (caption && caption.trim() !== '') {
      formattedCaption = caption.length > 1024 ? caption.substring(0, 1021) + '...' : caption;
      if (caption.length > 1024) {
        log(`Подпись для видео обрезана до 1024 символов`, 'social-publishing');
      }
    }
    
    const baseUrl = `https://api.telegram.org/bot${token}`;
    
    // Создаем объект FormData для отправки файла
    const formData = new FormData();
    formData.append('chat_id', chatId);
    
    // Если есть подпись, добавляем ее
    if (formattedCaption) {
      formData.append('caption', formattedCaption);
      formData.append('parse_mode', 'HTML');
    }
    
    // Проверяем, локальный ли это файл или удаленный URL
    if (videoUrl.startsWith('http')) {
      // Для удаленного URL скачиваем файл сначала
      log(`Скачивание видео с удаленного URL: ${fullVideoUrl}`, 'social-publishing');
      try {
        const response = await fetch(fullVideoUrl);
        if (!response.ok) {
          throw new Error(`Ошибка при скачивании видео: ${response.status} ${response.statusText}`);
        }
        
        const buffer = await response.buffer();
        formData.append('video', buffer, { filename: 'video.mp4' });
        
        log(`Видео успешно скачано, размер: ${buffer.length} байт`, 'social-publishing');
      } catch (downloadError) {
        log(`Ошибка при скачивании видео: ${downloadError}`, 'social-publishing');
        // Если не удалось скачать, попробуем передать URL напрямую
        formData.append('video', fullVideoUrl);
      }
    } else {
      // Для локального файла
      try {
        // Извлекаем локальный путь к файлу
        const localPath = videoUrl.replace(baseAppUrl, '');
        const absolutePath = path.resolve(`.${localPath}`);
        
        log(`Чтение локального файла видео: ${absolutePath}`, 'social-publishing');
        
        if (fs.existsSync(absolutePath)) {
          const videoBuffer = fs.readFileSync(absolutePath);
          const fileName = path.basename(absolutePath);
          
          formData.append('video', videoBuffer, { filename: fileName });
          log(`Локальный файл видео успешно прочитан, размер: ${videoBuffer.length} байт`, 'social-publishing');
        } else {
          log(`Файл видео не найден: ${absolutePath}`, 'social-publishing');
          throw new Error(`Файл видео не найден: ${absolutePath}`);
        }
      } catch (fileError) {
        log(`Ошибка при чтении файла видео: ${fileError}`, 'social-publishing');
        // В случае ошибки с файлом, пробуем передать URL
        formData.append('video', fullVideoUrl);
      }
    }
    
    // Отправляем запрос с FormData
    log(`Отправка запроса на ${baseUrl}/sendVideo с использованием FormData`, 'social-publishing');
    const response = await axios.post(`${baseUrl}/sendVideo`, formData, {
      headers: formData.getHeaders(),
      timeout: 60000 // Увеличенный таймаут для больших видео
    });
    
    // Проверяем успешность запроса
    if (response.status === 200 && response.data && response.data.ok) {
      const messageId = response.data?.result?.message_id;
      log(`Видео успешно отправлено в Telegram, ID сообщения: ${messageId}`, 'social-publishing');
      
      return {
        success: true,
        result: response.data,
        messageId
      };
    } else {
      log(`Ошибка при отправке видео в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
      return {
        success: false,
        error: `API Error: ${JSON.stringify(response.data)}`
      };
    }
  } catch (error: any) {
    const errorMessage = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    log(`Исключение при отправке видео в Telegram: ${errorMessage}`, 'social-publishing');
    
    return {
      success: false,
      error: `Exception: ${errorMessage}`
    };
  }
}