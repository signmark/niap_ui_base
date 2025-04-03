/**
 * Тестовые маршруты для проверки публикации в социальные сети
 */

import { Request, Response } from 'express';
import { socialPublishingService } from './services/social-publishing-fix';
import { directusApiManager } from './directus';
import { getTelegramPublisher } from './patches/telegram-publisher-interface';

/**
 * Регистрирует тестовые маршруты для проверки публикации в социальные сети
 * @param app Экземпляр Express приложения
 */
export function registerSocialTestRoutes(app: any) {
  /**
   * Тестовый маршрут для проверки публикации в Telegram
   * Принимает:
   * - imageUrl: URL изображения
   * - text: Текст сообщения
   * - chatId: ID чата Telegram (опционально)
   * - token: Токен бота Telegram (опционально)
   */
  app.post('/api/social-test/telegram', async (req: Request, res: Response) => {
    try {
      const { imageUrl, text, chatId, token } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ success: false, error: 'URL изображения обязателен' });
      }
      
      if (!text) {
        return res.status(400).json({ success: false, error: 'Текст сообщения обязателен' });
      }
      
      // Используем токен и chatId из запроса или значения по умолчанию
      const telegramToken = token || process.env.TELEGRAM_BOT_TOKEN;
      const telegramChatId = chatId || process.env.TELEGRAM_CHAT_ID;
      
      if (!telegramToken || !telegramChatId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Не указаны токен или ID чата Telegram. Укажите их в запросе или настройте переменные окружения.'
        });
      }
      
      // Вызываем метод из сервиса публикации
      const result = await socialPublishingService.uploadTelegramImageFromUrl(
        imageUrl,
        telegramChatId,
        text,
        telegramToken
      );
      
      return res.json({ success: true, result });
    } catch (error) {
      console.error('Ошибка при проверке публикации в Telegram:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Произошла ошибка: ${error.message || error}`
      });
    }
  });
  
  /**
   * Тестовый маршрут для получения токена Directus
   */
  app.get('/api/social-test/directus-token', async (req: Request, res: Response) => {
    try {
      const token = await directusApiManager.getToken();
      
      if (!token) {
        return res.status(500).json({ 
          success: false, 
          error: 'Не удалось получить токен Directus'
        });
      }
      
      return res.json({ 
        success: true, 
        token: `${token.substring(0, 10)}...` // Возвращаем часть токена для безопасности
      });
    } catch (error) {
      console.error('Ошибка при получении токена Directus:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Произошла ошибка: ${error.message || error}`
      });
    }
  });
  
  /**
   * Тестовый маршрут для проверки публикации в Telegram напрямую через улучшенный интерфейс
   * Принимает:
   * - imageUrl: URL изображения
   * - text: Текст сообщения
   * - chatId: ID чата Telegram (опционально)
   * - token: Токен бота Telegram (опционально)
   */
  app.post('/api/social-test/telegram-direct', async (req: Request, res: Response) => {
    try {
      const { imageUrl, text, chatId, token } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ success: false, error: 'URL изображения обязателен' });
      }
      
      if (!text) {
        return res.status(400).json({ success: false, error: 'Текст сообщения обязателен' });
      }
      
      // Используем токен и chatId из запроса или значения по умолчанию
      const telegramToken = token || process.env.TELEGRAM_BOT_TOKEN;
      const telegramChatId = chatId || process.env.TELEGRAM_CHAT_ID;
      
      if (!telegramToken || !telegramChatId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Не указаны токен или ID чата Telegram. Укажите их в запросе или настройте переменные окружения.'
        });
      }
      
      // Получаем экземпляр TelegramPublisher с улучшенным интерфейсом
      const telegramPublisher = await getTelegramPublisher();
      
      if (!telegramPublisher) {
        return res.status(500).json({
          success: false,
          error: 'Не удалось создать экземпляр TelegramPublisher'
        });
      }
      
      console.log(`Отправка изображения напрямую через улучшенный интерфейс: ${imageUrl} в чат: ${telegramChatId}`);
      
      // Отправляем изображение через улучшенный интерфейс
      const result = await telegramPublisher.sendDirectusImageToTelegram(
        imageUrl,
        telegramChatId,
        text,
        telegramToken
      );
      
      return res.json({ 
        success: true, 
        message: 'Изображение успешно отправлено через улучшенный интерфейс',
        result
      });
    } catch (error: any) {
      console.error('Ошибка при прямой отправке в Telegram:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Произошла ошибка: ${error?.message || error}`
      });
    }
  });
}