import express from 'express';
import { storage } from '../storage';
import log from '../utils/logger';
import { SocialPlatform } from '../services/social';
import { SocialMediaSettings } from '../../shared/schemas/social-media-settings';
import { createOrUpdateTelegramService } from '../services/social/telegram-service';

const router = express.Router();

/**
 * API для тестирования сохранения данных социальных платформ
 */

// Получить текущий контент по ID (для тестирования)
router.get('/platform-test/content/:id', async (req, res) => {
  try {
    const contentId = req.params.id;
    const userId = req.userId;
    
    log.log(`[ТЕСТ ПЕРСИСТЕНТНОСТИ] Запрос контента ${contentId} пользователем ${userId}`, 'platform-test');
    
    // Получаем текущий контент
    const content = await storage.getCampaignContentById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Контент не найден'
      });
    }
    
    log.log(`[ТЕСТ ПЕРСИСТЕНТНОСТИ] Контент ${contentId} найден, платформы: ${
      JSON.stringify(content.socialPlatforms || {})
    }`, 'platform-test');
    
    return res.json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Ошибка при получении контента:', error);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при получении контента'
    });
  }
});

// Инициализировать данные социальных платформ для тестирования
router.post('/platform-test/init/:id', async (req, res) => {
  try {
    const contentId = req.params.id;
    const userId = req.userId;
    
    log.log(`[ТЕСТ ПЕРСИСТЕНТНОСТИ] Инициализация тестовых платформ для ${contentId}`, 'platform-test');
    
    // Получаем текущий контент
    const content = await storage.getCampaignContentById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Контент не найден'
      });
    }
    
    // Создаем тестовые данные для трех платформ
    const testPlatforms = {
      telegram: { status: 'pending' },
      vk: { status: 'pending' },
      instagram: { status: 'pending' }
    };
    
    // Обновляем контент с тестовыми данными
    const updatedContent = await storage.updateCampaignContent(contentId, {
      socialPlatforms: testPlatforms
    });
    
    log.log(`[ТЕСТ ПЕРСИСТЕНТНОСТИ] Платформы инициализированы: ${
      JSON.stringify(updatedContent.socialPlatforms || {})
    }`, 'platform-test');
    
    return res.json({
      success: true,
      data: updatedContent
    });
  } catch (error) {
    console.error('Ошибка при инициализации тестовых платформ:', error);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при инициализации тестовых платформ'
    });
  }
});

// Публиковать в Telegram для теста персистентности
router.post('/platform-test/publish-telegram/:id', async (req, res) => {
  try {
    const contentId = req.params.id;
    const userId = req.userId;
    
    log.log(`[ТЕСТ ПЕРСИСТЕНТНОСТИ] Тестовая публикация ${contentId} в Telegram`, 'platform-test');
    
    // Получаем текущий контент
    const content = await storage.getCampaignContentById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Контент не найден'
      });
    }
    
    // Логируем данные платформ ДО публикации
    log.log(`[ТЕСТ ПЕРСИСТЕНТНОСТИ] Платформы ДО публикации: ${
      JSON.stringify(content.socialPlatforms || {})
    }`, 'platform-test');
    
    // Получаем сервис для Telegram
    const settings: SocialMediaSettings = {
      telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
        username: 'Test'
      }
    };
    
    // Создаем экземпляр сервиса Telegram
    const telegramService = await createOrUpdateTelegramService(settings.telegram);
    
    // Публикуем контент в Telegram
    const result = await telegramService.publishToPlatform(
      content,
      SocialPlatform.Telegram, 
      settings
    );
    
    // Получаем обновленный контент
    const updatedContent = await storage.getCampaignContentById(contentId);
    
    // Логируем данные платформ ПОСЛЕ публикации
    log.log(`[ТЕСТ ПЕРСИСТЕНТНОСТИ] Платформы ПОСЛЕ публикации: ${
      JSON.stringify(updatedContent?.socialPlatforms || {})
    }`, 'platform-test');
    
    return res.json({
      success: true,
      data: {
        result,
        before: content.socialPlatforms,
        after: updatedContent?.socialPlatforms
      }
    });
  } catch (error) {
    console.error('Ошибка при публикации в Telegram:', error);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при публикации в Telegram'
    });
  }
});

export default router;