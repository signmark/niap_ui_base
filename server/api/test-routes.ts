/**
 * Тестовые маршруты API
 * Используются для тестирования различных функций без изменения основного кода
 */
import express, { Request, Response } from 'express';
import { telegramService } from '../services/social/telegram-service';

// Создаем роутер для тестовых маршрутов
const testRouter = express.Router();

/**
 * Тестовый маршрут для проверки отправки сообщений в Telegram
 * POST /api/test/telegram-post
 */
testRouter.post('/telegram-post', async (req: Request, res: Response) => {
  try {
    const { text, chatId, token, imageUrl, additionalImages } = req.body;
    
    // Проверяем наличие обязательных параметров
    if (!text || !chatId || !token) {
      return res.status(400).json({
        success: false,
        error: 'Обязательные параметры: text, chatId и token'
      });
    }
    
    // Формируем тестовый контент
    const testContent = {
      id: 'test-id',
      title: 'Тестовый заголовок',
      text,
      image_url: imageUrl || '',
      additional_images: additionalImages || [],
      status: 'draft',
      user_id: 'test-user',
      campaign_id: 'test-campaign',
      social_platforms: ['telegram'],
    };
    
    // Отправляем тестовое сообщение в Telegram
    const result = await telegramService.publishToTelegram(testContent, {
      token,
      chatId
    });
    
    // Логируем результат для отладки
    console.log(`[Test API] Результат отправки в Telegram: ${JSON.stringify(result)}`);
    
    // Возвращаем обработанный результат
    return res.json({
      success: true,
      messageId: result.messageId,
      postUrl: result.postUrl,
      platform: result.platform,
      status: result.status,
      data: result
    });
  } catch (error: any) {
    console.error('Ошибка при отправке сообщения в Telegram:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Тестовый маршрут для проверки форматирования URL Telegram
 * GET /api/test/telegram-url
 */
testRouter.get('/telegram-url', (req: Request, res: Response) => {
  try {
    const { chatId, messageId, chatUsername } = req.query;
    
    // Проверяем наличие обязательных параметров
    if (!chatId) {
      return res.status(400).json({
        success: false,
        error: 'Обязательный параметр: chatId'
      });
    }
    
    // Форматируем chatId для API
    let formattedChatId = chatId as string;
    if (formattedChatId.startsWith('@')) {
      formattedChatId = formattedChatId.substring(1);
    } else if (formattedChatId.startsWith('-100')) {
      formattedChatId = formattedChatId.substring(4);
    }
    
    // Форматируем URL
    const url = telegramService.formatTelegramUrl(
      chatId as string,
      formattedChatId,
      messageId ? Number(messageId) : undefined,
      chatUsername as string | undefined
    );
    
    // Возвращаем результат
    return res.json({
      success: true,
      data: {
        url,
        originalChatId: chatId,
        formattedChatId,
        messageId: messageId || null,
        chatUsername: chatUsername || null
      }
    });
  } catch (error: any) {
    console.error('Ошибка при форматировании URL Telegram:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

export default testRouter;