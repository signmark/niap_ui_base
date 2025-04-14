import axios from 'axios';
import { log } from '../../utils/logger';

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
    
    // Формируем параметры запроса
    const params: any = {
      chat_id: chatId,
      video: fullVideoUrl,
      parse_mode: 'HTML'
    };
    
    // Добавляем подпись, если она есть
    if (formattedCaption) {
      params.caption = formattedCaption;
    }
    
    // Отправляем запрос
    log(`Отправка запроса на ${baseUrl}/sendVideo с параметрами: ${JSON.stringify(params)}`, 'social-publishing');
    const response = await axios.post(`${baseUrl}/sendVideo`, params, {
      timeout: 30000 // Увеличенный таймаут для видео
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