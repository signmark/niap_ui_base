/**
 * Тестовые маршруты API
 * Используются для тестирования различных функций без изменения основного кода
 */
import express, { Request, Response } from 'express';
import { telegramService } from '../services/social/telegram-service';
import { DatabaseStorage } from '../storage';

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

/**
 * Тестовый маршрут для проверки исправления незакрытых HTML-тегов
 * POST /api/test/fix-html-tags
 */
testRouter.post('/fix-html-tags', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    // Проверяем наличие обязательных параметров
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Обязательный параметр: text'
      });
    }
    
    console.log(`[Test API] Запрос на исправление HTML-тегов`);
    console.log(`[Test API] Исходный текст: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    
    // Используем функцию из сервиса для исправления тегов
    // Создаем временный экземпляр TelegramService для доступа к приватным методам
    const tempTelegramService = telegramService as any;
    
    // Применяем оба метода исправления тегов для сравнения
    const fixedWithBasic = tempTelegramService.fixUnclosedTags(text);
    const fixedWithAggressive = tempTelegramService.aggressiveTagFixer(text);
    
    // Форматируем текст для Telegram
    const preparedForTelegram = tempTelegramService.prepareTelegramText(text);
    
    // Возвращаем результаты всех трех методов
    return res.json({
      success: true,
      originalText: text,
      fixedWithBasic,
      fixedWithAggressive,
      preparedForTelegram,
      comparison: {
        originalLength: text.length,
        basicFixLength: fixedWithBasic.length,
        aggressiveFixLength: fixedWithAggressive.length,
        preparedForTelegramLength: preparedForTelegram.length
      }
    });
  } catch (error: any) {
    console.error('[Test API] Ошибка при исправлении HTML-тегов:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Тестовый маршрут для проверки HTML-форматирования с использованием настроек кампании
 * POST /api/test/telegram-html
 */
testRouter.post('/telegram-html', async (req: Request, res: Response) => {
  // Устанавливаем правильный Content-Type для ответа
  res.setHeader('Content-Type', 'application/json');
  try {
    const { text, campaignId } = req.body;
    
    // Проверяем наличие обязательных параметров
    if (!text || !campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Обязательные параметры: text и campaignId'
      });
    }
    
    console.log(`[Test API] Запрос на тестирование HTML-форматирования для кампании ${campaignId}`);
    
    // Получаем настройки кампании и токен администратора
    const storage = new DatabaseStorage();
    
    // Получаем токен администратора
    const adminToken = await storage.getAdminToken();
    console.log(`[Test API] Токен администратора: ${adminToken ? 'получен' : 'не получен'}`);
    
    const campaign = await storage.getCampaignById(campaignId);
    
    if (!campaign || !campaign.settings) {
      return res.status(404).json({
        success: false,
        error: 'Кампания не найдена или не имеет настроек'
      });
    }
    
    console.log(`[Test API] Получены настройки кампании: ${JSON.stringify(campaign.settings)}`);
    
    // Проверяем настройки Telegram
    if (!campaign.settings.telegram || !campaign.settings.telegram.token || !campaign.settings.telegram.chatId) {
      return res.status(400).json({
        success: false,
        error: 'В настройках кампании отсутствуют настройки Telegram'
      });
    }
    
    // Формируем тестовый контент
    const testContent = {
      id: `test-${Date.now()}`,
      title: 'Тест HTML-форматирования',
      content: text,
      contentType: 'text',
      imageUrl: '',
      additionalImages: [],
      status: 'draft',
      userId: 'test-user',
      campaignId: campaignId,
      socialPlatforms: ['telegram'],
      createdAt: new Date(),
      hashtags: [],
      links: [],
      metadata: {}
    };
    
    // Отправляем тестовое сообщение в Telegram с настройками из кампании
    const result = await telegramService.publishToTelegram(testContent, {
      token: campaign.settings.telegram.token,
      chatId: campaign.settings.telegram.chatId
    });
    
    // Логируем результат для отладки
    console.log(`[Test API] Результат отправки HTML-сообщения: ${JSON.stringify(result)}`);
    
    // Возвращаем результат
    return res.json({
      success: true,
      postUrl: result.postUrl,
      platform: result.platform,
      status: result.status,
      data: result
    });
  } catch (error: any) {
    console.error('[Test API] Ошибка при тестировании HTML-форматирования:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

export default testRouter;