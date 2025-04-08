/**
 * Маршрут для тестирования публикации в Telegram через прямой вызов TelegramService
 * Добавляет маршрут /api/test/telegram-post к существующим маршрутам test-routes.ts
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { telegramService } from '../services/social/telegram-service';
import { CampaignContent } from '@shared/schema';

// Создаем роутер
const router = Router();

/**
 * Маршрут для тестирования публикации в Telegram через прямой вызов TelegramService
 * Этот маршрут используется для тестирования исправленного метода publishToPlatform
 * в TelegramService с поддержкой изображений при прямой отправке HTML
 * 
 * Принимает:
 * - content: Текст контента (HTML)
 * - title: Заголовок (опционально)
 * - imageUrl: URL изображения (опционально)
 * - additionalImages: Массив URL дополнительных изображений (опционально)
 * - testToken: Токен Telegram (опционально, по умолчанию из .env)
 * - testChatId: ID чата Telegram (опционально, по умолчанию из .env)
 */
router.post('/telegram-post', async (req: Request, res: Response) => {
  try {
    const { 
      content, 
      title,
      imageUrl,
      additionalImages,
      testToken,
      testChatId 
    } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Отсутствует контент для публикации' 
      });
    }
    
    // Используем указанные параметры или значения по умолчанию из .env
    const token = testToken || process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TEST_TOKEN;
    const chatId = testChatId || process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_TEST_CHAT_ID;
    
    if (!token || !chatId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Отсутствуют настройки Telegram (токен или ID чата)' 
      });
    }
    
    console.log(`[Test API] Тестирование публикации в Telegram, chatId: ${chatId}`);
    
    // Создаем объект контента для публикации
    const contentObject: CampaignContent = {
      id: uuidv4(),
      userId: 'test-user',
      createdAt: new Date(),
      campaignId: 'test-campaign',
      title: title || null,
      content: content,
      contentType: 'html',
      imageUrl: imageUrl || null,
      additionalImages: additionalImages || null,
      videoUrl: null,
      status: 'draft',
      prompt: null,
      hashtags: [],
      keywords: [],
      links: [],
      publishedAt: null,
      scheduledAt: null,
      socialPlatforms: ['telegram'],
      socialPublications: {},
      metadata: {}
    };
    
    // Настройки Telegram
    const telegramSettings = {
      token,
      chatId
    };
    
    // Вызываем метод публикации в TelegramService напрямую
    const result = await telegramService.publishToPlatform(
      contentObject,
      'telegram',
      { telegram: telegramSettings }
    );
    
    console.log(`[Test API] Результат публикации: ${JSON.stringify(result)}`);
    
    return res.json({
      success: true,
      result,
      content: {
        id: contentObject.id,
        title: contentObject.title,
        contentPreview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        imageUrl: contentObject.imageUrl,
        hasAdditionalImages: additionalImages ? additionalImages.length > 0 : false
      }
    });
  } catch (error: any) {
    console.error('[Test API] Ошибка при тестировании публикации в Telegram:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Экспортируем роутер
export default router;