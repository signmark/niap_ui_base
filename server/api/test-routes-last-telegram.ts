/**
 * Маршрут для проверки последней публикации в Telegram и исправления URL
 */
import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { log } from '../utils/logger';
import { telegramService } from '../services/social/telegram-service';

// Создаем роутер для тестовых маршрутов
const lastTelegramRouter = express.Router();

/**
 * Получение последней публикации в Telegram
 * GET /api/test/last-telegram-publication
 */
lastTelegramRouter.get('/last-telegram-publication', async (req: Request, res: Response) => {
  try {
    // Получаем токен администратора
    const adminToken = await storage.getAdminToken();
    
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: 'Не удалось получить токен администратора'
      });
    }
    
    // Получаем контент из базы с сортировкой по дате создания (самый новый первый)
    const content = await storage.getAllCampaignContent({
      sort: ['-createdAt'],
      limit: 20
    }, adminToken);
    
    if (!content || content.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Контент не найден'
      });
    }
    
    // Ищем первый контент с публикацией в Telegram
    const contentWithTelegram = content.find(item => 
      item.socialPlatforms && 
      typeof item.socialPlatforms === 'object' && 
      item.socialPlatforms.telegram
    );
    
    if (!contentWithTelegram) {
      return res.status(404).json({
        success: false,
        error: 'Контент с публикацией в Telegram не найден'
      });
    }
    
    log(`Найден контент с публикацией в Telegram: ${contentWithTelegram.id}`, 'test');
    
    return res.json({
      success: true,
      data: contentWithTelegram.socialPlatforms,
      contentId: contentWithTelegram.id
    });
  } catch (error: any) {
    log(`Ошибка при получении последней публикации в Telegram: ${error.message}`, 'test');
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Исправление URL для публикации в Telegram
 * POST /api/test/fix-telegram-url
 */
lastTelegramRouter.post('/fix-telegram-url', async (req: Request, res: Response) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Обязательный параметр: contentId'
      });
    }
    
    // Получаем токен администратора
    const adminToken = await storage.getAdminToken();
    
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: 'Не удалось получить токен администратора'
      });
    }
    
    // Получаем контент из базы
    const content = await storage.getCampaignContent(contentId, adminToken);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Контент с ID ${contentId} не найден`
      });
    }
    
    if (!content.socialPlatforms || 
        typeof content.socialPlatforms !== 'object' || 
        !content.socialPlatforms.telegram) {
      return res.status(400).json({
        success: false,
        error: 'Контент не содержит публикации в Telegram'
      });
    }
    
    // Проверяем URL и messageId
    const telegramData = content.socialPlatforms.telegram;
    const chatId = telegramData.chatId || '-1002302366310'; // Используем значение по умолчанию, если не указано
    const messageId = telegramData.messageId;
    const currentUrl = telegramData.postUrl;
    
    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: 'Не найден messageId для публикации Telegram'
      });
    }
    
    log(`Текущий URL: ${currentUrl}, messageId: ${messageId}`, 'test');
    
    // Проверяем, содержит ли текущий URL messageId
    if (currentUrl && currentUrl.includes('/' + messageId)) {
      return res.json({
        success: true,
        message: 'URL уже содержит messageId, исправление не требуется',
        url: currentUrl
      });
    }
    
    // Определяем формат chatId для API
    let formattedChatId = chatId;
    if (formattedChatId.startsWith('-100')) {
      formattedChatId = formattedChatId.substring(4);
    }
    
    // Формируем корректный URL с messageId
    const correctUrl = telegramService.formatTelegramUrl(
      chatId,
      formattedChatId,
      messageId
    );
    
    log(`Сформирован корректный URL: ${correctUrl}`, 'test');
    
    // Обновляем URL в базе данных
    const updatedSocialPlatforms = { ...content.socialPlatforms };
    updatedSocialPlatforms.telegram = {
      ...updatedSocialPlatforms.telegram,
      postUrl: correctUrl
    };
    
    // Сохраняем обновленный URL
    const updatedContent = await storage.updateCampaignContent(contentId, {
      socialPlatforms: updatedSocialPlatforms
    }, adminToken);
    
    if (!updatedContent) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось обновить контент в базе данных'
      });
    }
    
    return res.json({
      success: true,
      message: 'URL публикации в Telegram успешно исправлен',
      oldUrl: currentUrl,
      newUrl: correctUrl,
      data: updatedContent.socialPlatforms
    });
  } catch (error: any) {
    log(`Ошибка при исправлении URL публикации в Telegram: ${error.message}`, 'test');
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Массовое исправление URL для всех публикаций в Telegram
 * POST /api/test/fix-all-telegram-urls
 */
lastTelegramRouter.post('/fix-all-telegram-urls', async (req: Request, res: Response) => {
  try {
    // Получаем токен администратора
    const adminToken = await storage.getAdminToken();
    
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: 'Не удалось получить токен администратора'
      });
    }
    
    // Получаем весь контент из базы, ограничим 200 записями для производительности
    const content = await storage.getAllCampaignContent({
      limit: 200
    }, adminToken);
    
    if (!content || content.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Контент не найден'
      });
    }
    
    // Фильтруем контент с публикациями в Telegram
    const contentWithTelegram = content.filter(item => 
      item.socialPlatforms && 
      typeof item.socialPlatforms === 'object' && 
      item.socialPlatforms.telegram &&
      item.socialPlatforms.telegram.messageId
    );
    
    if (contentWithTelegram.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Контент с публикациями в Telegram не найден'
      });
    }
    
    log(`Найдено ${contentWithTelegram.length} записей с публикациями в Telegram`, 'test');
    
    // Подготавливаем массивы для отслеживания результатов
    const results: any[] = [];
    const errors: any[] = [];
    
    // Обрабатываем каждую запись
    for (const item of contentWithTelegram) {
      try {
        const telegramData = item.socialPlatforms.telegram;
        const chatId = telegramData.chatId || '-1002302366310'; // Используем значение по умолчанию
        const messageId = telegramData.messageId;
        const currentUrl = telegramData.postUrl;
        
        // Проверяем, содержит ли текущий URL messageId
        if (currentUrl && currentUrl.includes('/' + messageId)) {
          // URL уже корректный, пропускаем
          results.push({
            contentId: item.id,
            status: 'skipped',
            message: 'URL уже содержит messageId'
          });
          continue;
        }
        
        // Определяем формат chatId для API
        let formattedChatId = chatId;
        if (formattedChatId.startsWith('-100')) {
          formattedChatId = formattedChatId.substring(4);
        }
        
        // Формируем корректный URL с messageId
        const correctUrl = telegramService.formatTelegramUrl(
          chatId,
          formattedChatId,
          messageId
        );
        
        log(`Контент ${item.id}: исправление URL с ${currentUrl} на ${correctUrl}`, 'test');
        
        // Обновляем URL в базе данных
        const updatedSocialPlatforms = { ...item.socialPlatforms };
        updatedSocialPlatforms.telegram = {
          ...updatedSocialPlatforms.telegram,
          postUrl: correctUrl
        };
        
        // Сохраняем обновленный URL
        const updatedContent = await storage.updateCampaignContent(item.id, {
          socialPlatforms: updatedSocialPlatforms
        }, adminToken);
        
        if (updatedContent) {
          results.push({
            contentId: item.id,
            status: 'fixed',
            oldUrl: currentUrl,
            newUrl: correctUrl
          });
        } else {
          errors.push({
            contentId: item.id,
            error: 'Не удалось обновить контент в базе данных'
          });
        }
      } catch (itemError: any) {
        errors.push({
          contentId: item.id,
          error: itemError.message || 'Неизвестная ошибка'
        });
      }
    }
    
    return res.json({
      success: true,
      message: `Обработано ${contentWithTelegram.length} записей, исправлено ${results.filter(r => r.status === 'fixed').length}, ошибок: ${errors.length}`,
      results,
      errors
    });
  } catch (error: any) {
    log(`Ошибка при массовом исправлении URL публикаций в Telegram: ${error.message}`, 'test');
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

export default lastTelegramRouter;