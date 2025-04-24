/**
 * Модуль для получения аналитики из Telegram
 */

import axios from 'axios';
import { log } from '../../utils/logger';

/**
 * Получает статистику сообщения из Telegram
 * @param chatId ID чата или канала
 * @param messageId ID сообщения
 * @param botToken Токен бота Telegram из настроек кампании
 * @returns Объект с метриками просмотров и взаимодействий
 */
export async function getTelegramAnalytics(chatId: string, messageId: string, botToken: string): Promise<{
  views: number;
  likes: number;
  comments: number;
  shares: number;
}> {
  try {
    if (!botToken) {
      log.error('[telegram-analytics] Не указан токен бота Telegram');
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
    
    // Если chatId начинается с '@', форматируем его правильно для API запросов
    const formattedChatId = chatId.startsWith('@') ? chatId : chatId;
    
    // Базовый URL для API Telegram
    const baseUrl = `https://api.telegram.org/bot${botToken}`;
    
    // Получаем информацию о сообщении, включая количество просмотров
    const messageResponse = await axios.get(`${baseUrl}/getMessages`, {
      params: {
        chat_id: formattedChatId,
        message_ids: messageId
      }
    });
    
    // Если запрос неуспешен, возвращаем нулевые метрики
    if (!messageResponse.data || !messageResponse.data.ok) {
      log.warn(`[telegram-analytics] Не удалось получить данные сообщения ${messageId} в чате ${chatId}`);
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
    
    // Получаем счетчики сообщения
    const views = messageResponse.data.result[0]?.views || 0;
    
    // Получаем информацию о реакциях (лайках)
    const reactionsResponse = await axios.get(`${baseUrl}/getMessageReactions`, {
      params: {
        chat_id: formattedChatId,
        message_id: messageId
      }
    });
    
    // Подсчитываем количество реакций
    let likes = 0;
    
    if (reactionsResponse.data && reactionsResponse.data.ok && reactionsResponse.data.result) {
      // Суммируем все реакции
      if (Array.isArray(reactionsResponse.data.result)) {
        likes = reactionsResponse.data.result.reduce((total, reaction) => {
          return total + (reaction.total_count || 0);
        }, 0);
      } else if (reactionsResponse.data.result.reactions) {
        likes = reactionsResponse.data.result.reactions.reduce((total, reaction) => {
          return total + (reaction.count || 0);
        }, 0);
      }
    }
    
    // Получаем информацию о комментариях
    // К сожалению, прямого API для получения количества комментариев нет,
    // поэтому пытаемся получить дискуссию если она есть
    const commentsResponse = await axios.get(`${baseUrl}/getDiscussionMessage`, {
      params: {
        chat_id: formattedChatId,
        message_id: messageId
      }
    }).catch(err => {
      // Игнорируем ошибку, так как дискуссия может быть не включена
      return { data: null };
    });
    
    // Приблизительное количество комментариев на основе доступной информации
    let comments = 0;
    
    if (commentsResponse.data && commentsResponse.data.ok && commentsResponse.data.result) {
      comments = commentsResponse.data.result.reply_count || 0;
    }
    
    // Определяем количество репостов (только примерная оценка, 
    // так как Telegram не предоставляет прямой API для этого)
    const shares = 0; // К сожалению, нет прямого способа получить эту информацию
    
    return { views, likes, comments, shares };
  } catch (error: any) {
    log.error(`[telegram-analytics] Ошибка получения аналитики: ${error.message}`);
    return { views: 0, likes: 0, comments: 0, shares: 0 };
  }
}