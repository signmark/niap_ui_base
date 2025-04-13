/**
 * Маршрут для проверки последней публикации в Telegram и исправления URL
 */
import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { log } from '../utils/logger';
import { telegramService } from '../services/social/telegram-service';
import axios from 'axios';

// Добавляем учетные данные администратора Directus из переменных среды
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const DIRECTUS_ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || 'Qtpz3dh7';

const lastTelegramRouter = express.Router();

/**
 * Получает токен администратора Directus напрямую через аутентификацию
 * @returns {Promise<string|null>} Токен администратора или null в случае ошибки
 */
async function getDirectAdminToken(): Promise<string|null> {
  try {
    log(`Попытка аутентификации администратора (${DIRECTUS_ADMIN_EMAIL})`, 'telegram-diagnostics');
    
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: DIRECTUS_ADMIN_EMAIL,
      password: DIRECTUS_ADMIN_PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log(`Администратор успешно аутентифицирован`, 'telegram-diagnostics');
      return response.data.data.access_token;
    }
    
    log(`Ошибка аутентификации администратора: нет токена в ответе`, 'telegram-diagnostics');
    return null;
  } catch (error: any) {
    log(`Ошибка аутентификации администратора: ${error.message}`, 'telegram-diagnostics');
    return null;
  }
}

/**
 * Получение последней публикации в Telegram
 * GET /api/test/last-telegram-publication
 */
lastTelegramRouter.get('/last-telegram-publication', async (req: Request, res: Response) => {
  try {
    // Получаем токен администратора напрямую через API
    const adminToken = await getDirectAdminToken();
    
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: 'Не удалось получить токен администратора'
      });
    }
    
    // Получаем все записи контента напрямую через Directus API
    // Используем полученный adminToken
    let content: any[] = [];
    try {
      log(`Запрос к Directus API для получения контента напрямую`, 'telegram-diagnostics');
      const response = await axios.get(`${DIRECTUS_URL}/items/campaign_content`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        },
        params: {
          limit: 50,
          sort: '-date_created'
        }
      });
      
      content = response.data.data;
      log(`Получено ${content.length} записей контента напрямую через Directus API`, 'telegram-diagnostics');
    } catch (apiError: any) {
      log(`Ошибка при прямом запросе к Directus API: ${apiError.message}`, 'telegram-diagnostics');
      // Пробуем альтернативный метод через storage
      content = await storage.getCampaignContent('53921f16-f51d-4591-80b9-8caa4fde4d13');
      log(`Получено ${content.length} записей контента через storage`, 'telegram-diagnostics');
    }
    
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
    
    // Получаем токен администратора напрямую через API
    const adminToken = await getDirectAdminToken();
    
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: 'Не удалось получить токен администратора'
      });
    }
    
    // Получаем контент из базы напрямую через Directus API
    let content;
    try {
      log(`Прямой запрос к Directus API для получения контента с ID ${contentId}`, 'telegram-diagnostics');
      const response = await axios.get(`${DIRECTUS_URL}/items/campaign_content/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      content = response.data.data;
      log(`Получен контент с ID ${contentId} напрямую через Directus API`, 'telegram-diagnostics');
    } catch (apiError: any) {
      log(`Ошибка при прямом запросе контента через Directus API: ${apiError.message}`, 'telegram-diagnostics');
      // Пробуем альтернативный метод через storage
      content = await storage.getCampaignContentById(contentId, adminToken);
      log(`Получен контент с ID ${contentId} через storage`, 'telegram-diagnostics');
    }
    
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
    // Получаем токен администратора напрямую через API
    const adminToken = await getDirectAdminToken();
    
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: 'Не удалось получить токен администратора'
      });
    }
    
    // Получаем все записи контента напрямую через Directus API
    // Используем полученный adminToken
    let content: any[] = [];
    try {
      log(`Запрос к Directus API для массового исправления URL`, 'telegram-diagnostics');
      const response = await axios.get(`${DIRECTUS_URL}/items/campaign_content`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        },
        params: {
          limit: 100,
          sort: '-date_created',
          filter: { 
            "socialPlatforms": { 
              "_nempty": true 
            }
          }
        }
      });
      
      content = response.data.data;
      log(`Получено ${content.length} записей контента напрямую через Directus API для исправления URL`, 'telegram-diagnostics');
    } catch (apiError: any) {
      log(`Ошибка при прямом запросе к Directus API: ${apiError.message}`, 'telegram-diagnostics');
      // Пробуем альтернативный метод через storage
      content = await storage.getCampaignContent('53921f16-f51d-4591-80b9-8caa4fde4d13');
      log(`Получено ${content.length} записей контента через storage`, 'telegram-diagnostics');
    }
    
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