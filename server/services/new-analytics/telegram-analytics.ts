/**
 * Сервис для получения реальной аналитики из Telegram
 * Использует Telegram Bot API для получения актуальных данных по просмотрам и реакциям сообщений
 */

import axios from 'axios';
import logger from '../../utils/logger';

// Интерфейс для формата данных аналитики Telegram
interface TelegramAnalytics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagementRate: number;
  lastUpdated: string;
}

// Интерфейс для данных о сообщениях из Telegram
interface TelegramMessageData {
  views: number; // Количество просмотров
  reactions?: { // Реакции (лайки) с emoji
    type: string;
    count: number;
  }[];
  forward_count?: number; // Количество пересылок (репостов)
  reply_count?: number; // Количество ответов (комментариев)
}

/**
 * Класс для работы с аналитикой Telegram
 */
export class TelegramAnalyticsService {
  
  /**
   * Получает аналитику для опубликованного сообщения в Telegram
   * @param botToken Токен бота Telegram
   * @param chatId ID чата, в котором опубликовано сообщение
   * @param messageId ID сообщения в чате
   * @returns Объект с данными аналитики или null в случае ошибки
   */
  async getMessageAnalytics(
    botToken: string,
    chatId: string,
    messageId: number | string
  ): Promise<TelegramAnalytics | null> {
    try {
      // Формируем ID чата для API Telegram
      const formattedChatId = this.formatChatId(chatId);
      
      // Получаем информацию о сообщении через API Telegram
      const response = await this.getMessageInfo(botToken, formattedChatId, messageId);
      
      if (!response || !response.data || !response.data.result) {
        logger.warn(`Не удалось получить информацию о сообщении: ${chatId}/${messageId}`, 'telegram-analytics');
        return null;
      }
      
      // Извлекаем статистику из ответа API
      const messageData = response.data.result as TelegramMessageData;
      
      // Считаем общее количество лайков из реакций
      // В новых версиях Telegram есть реакции в виде эмодзи
      let likes = 0;
      if (messageData.reactions && messageData.reactions.length > 0) {
        // Суммируем все реакции под сообщением
        likes = messageData.reactions.reduce((sum, reaction) => sum + reaction.count, 0);
      }
      
      logger.log(`Получены реакции для сообщения ${chatId}/${messageId}: ${JSON.stringify(messageData.reactions)}`, 'telegram-analytics');
      
      // Получаем другие метрики
      const views = messageData.views || 0;
      const shares = messageData.forward_count || 0;
      
      // Комментарии возможны только в группах с включенными комментариями
      // На скриншоте видно, что у сообщений нет комментариев
      // Используем reply_count только если он точно есть в ответе API
      const comments = messageData.reply_count !== undefined ? messageData.reply_count : 0;
      
      // В Telegram нет прямых кликов по постам без ссылок
      // Для постов со ссылками можно было бы оценить клики, но пока ставим 0
      const clicks = 0;
      
      // Расчет метрики вовлеченности (engagement rate)
      // (лайки + комментарии + репосты) / просмотры * 100%
      const engagementRate = views > 0
        ? Math.round(((likes + comments + shares) / views) * 100)
        : 0;
      
      // Формируем объект аналитики
      const analytics: TelegramAnalytics = {
        views,
        likes,
        comments,
        shares,
        clicks,
        engagementRate,
        lastUpdated: new Date().toISOString()
      };
      
      logger.log(`Получена аналитика Telegram для сообщения ${chatId}/${messageId}: ${views} просмотров, ${likes} лайков`, 'telegram-analytics');
      
      return analytics;
    } catch (error: any) {
      logger.error(`Ошибка при получении аналитики Telegram: ${error.message}`, error, 'telegram-analytics');
      return null;
    }
  }
  
  /**
   * Получает информацию о сообщении из Telegram API
   * @param botToken Токен бота Telegram
   * @param chatId ID чата (формат для API)
   * @param messageId ID сообщения
   * @returns Ответ API Telegram
   */
  private async getMessageInfo(
    botToken: string,
    chatId: string,
    messageId: number | string
  ): Promise<any> {
    try {
      // Формируем URL запроса к Telegram API
      const url = `https://api.telegram.org/bot${botToken}/getMessageInfo`;
      
      // Формируем параметры запроса
      const params = {
        chat_id: chatId,
        message_id: messageId
      };
      
      // Выполняем запрос к API
      return await axios.get(url, { params });
    } catch (error: any) {
      // Если API getMessageInfo не доступен, пробуем получить данные через getMessage
      try {
        const url = `https://api.telegram.org/bot${botToken}/getMessage`;
        const params = {
          chat_id: chatId,
          message_id: messageId
        };
        
        return await axios.get(url, { params });
      } catch (secondError: any) {
        logger.error(`Ошибка при получении данных сообщения Telegram: ${secondError.message}`, secondError, 'telegram-analytics');
        return null;
      }
    }
  }
  
  /**
   * Форматирует ID чата для использования в API Telegram
   * @param chatId ID чата в любом формате (@username или числовой id)
   * @returns Отформатированный ID чата для API
   */
  private formatChatId(chatId: string): string {
    // Если chatId начинается с '@', это username канала
    // В этом случае оставляем как есть
    if (chatId.startsWith('@')) {
      return chatId;
    }
    
    // Если это не числовой ID, возвращаем как есть
    if (isNaN(Number(chatId))) {
      return chatId;
    }
    
    // Если это числовой ID, возвращаем строку
    return chatId.toString();
  }
  
  /**
   * Извлекает ID сообщения и чата из URL публикации Telegram
   * @param postUrl URL публикации, например https://t.me/channel_name/123
   * @returns Объект с chatId и messageId или null
   */
  extractTelegramIds(postUrl: string): { chatId: string, messageId: string } | null {
    try {
      // Проверяем, что URL существует и относится к Telegram
      if (!postUrl || !postUrl.includes('t.me/')) {
        return null;
      }
      
      // Регулярное выражение для извлечения chatId и messageId из URL
      // Поддерживает форматы:
      // - https://t.me/channel_name/123
      // - https://t.me/c/1234567890/123
      const regex = /t\.me\/(?:c\/)?([^/]+)\/(\d+)/;
      const match = postUrl.match(regex);
      
      if (!match || match.length < 3) {
        return null;
      }
      
      const chatId = match[1].startsWith('c/') ? match[1].substring(2) : match[1];
      const messageId = match[2];
      
      // Для приватных чатов (формат c/1234567890), добавляем префикс -100
      if (chatId.match(/^\d+$/) && !chatId.startsWith('-')) {
        return {
          chatId: `-100${chatId}`,
          messageId
        };
      }
      
      // Для публичных каналов добавляем @ если его нет
      if (!chatId.startsWith('@') && !chatId.match(/^-\d+$/)) {
        return {
          chatId: `@${chatId}`,
          messageId
        };
      }
      
      return { chatId, messageId };
    } catch (error) {
      logger.error(`Ошибка при извлечении Telegram ID из URL: ${error}`, error, 'telegram-analytics');
      return null;
    }
  }
}

// Экспортируем экземпляр сервиса
export const telegramAnalyticsService = new TelegramAnalyticsService();