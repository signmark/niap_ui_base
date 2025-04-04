import { Router } from 'express';
import { imgurUploaderService } from './services/imgur-uploader';
import { socialPublishingWithImgurService } from './services/social-publishing-with-imgur';
import { storage } from './storage';

/**
 * Маршруты для работы с загрузкой изображений на Imgur
 */
export function registerImgurRoutes(router: Router) {
  // Маршрут для загрузки изображения по URL
  router.post('/api/imgur/upload-from-url', async (req, res) => {
    try {
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ 
          success: false, 
          error: 'Отсутствует URL изображения' 
        });
      }
      
      const imgurUrl = await imgurUploaderService.uploadImageFromUrl(imageUrl);
      
      if (!imgurUrl) {
        return res.status(500).json({ 
          success: false, 
          error: 'Не удалось загрузить изображение на Imgur' 
        });
      }
      
      return res.status(200).json({ 
        success: true, 
        data: { url: imgurUrl } 
      });
    } catch (error) {
      console.error('Ошибка при загрузке изображения на Imgur:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Ошибка при загрузке изображения: ${error}` 
      });
    }
  });
  
  // Маршрут для загрузки нескольких изображений по URL
  router.post('/api/imgur/upload-multiple', async (req, res) => {
    try {
      const { imageUrls } = req.body;
      
      if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Отсутствует массив URL изображений' 
        });
      }
      
      const imgurUrls = await imgurUploaderService.uploadMultipleImagesFromUrls(imageUrls);
      
      return res.status(200).json({ 
        success: true, 
        data: { 
          urls: imgurUrls,
          totalUploaded: imgurUrls.length,
          totalRequested: imageUrls.length
        } 
      });
    } catch (error) {
      console.error('Ошибка при загрузке изображений на Imgur:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Ошибка при загрузке изображений: ${error}` 
      });
    }
  });
  
  // Маршрут для универсальной публикации контента через Imgur
  router.post('/api/imgur/publish-content', async (req, res) => {
    try {
      const { contentId, platform, settings, userId } = req.body;
      
      if (!contentId) {
        return res.status(400).json({
          success: false,
          error: 'Не указан ID контента'
        });
      }
      
      if (!platform) {
        return res.status(400).json({
          success: false,
          error: 'Не указана платформа для публикации'
        });
      }
      
      // Проверяем настройки в зависимости от платформы
      if (platform === 'telegram' && (!settings?.telegram?.token || !settings?.telegram?.chatId)) {
        return res.status(400).json({
          success: false,
          error: 'Не указаны настройки Telegram (токен или ID чата)'
        });
      }
      
      if (platform === 'vk' && (!settings?.vk?.token || !settings?.vk?.groupId)) {
        return res.status(400).json({
          success: false,
          error: 'Не указаны настройки VK (токен или ID группы)'
        });
      }
      
      // Получаем контент из базы данных
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        return res.status(404).json({
          success: false,
          error: `Контент с ID ${contentId} не найден`
        });
      }
      
      // Если передан userId, добавляем его в контент
      if (userId) {
        content.userId = userId;
      }
      
      // Публикуем контент на выбранной платформе
      let result;
      
      if (platform === 'telegram') {
        result = await socialPublishingWithImgurService.publishToTelegram(
          content,
          settings?.telegram
        );
      } else {
        return res.status(400).json({
          success: false,
          error: `Неподдерживаемая платформа: ${platform}`
        });
      }
      
      return res.status(200).json({
        success: result.status === 'published',
        data: result
      });
    } catch (error) {
      console.error(`Ошибка при публикации контента: ${error}`);
      return res.status(500).json({
        success: false,
        error: `Ошибка при публикации контента: ${error}`
      });
    }
  });
  
  // Маршрут для тестирования публикации в Telegram с использованием Imgur
  router.post('/api/imgur/test-telegram-publication', async (req, res) => {
    try {
      const { contentId, telegramToken, telegramChatId } = req.body;
      
      if (!contentId) {
        return res.status(400).json({
          success: false,
          error: 'Не указан ID контента'
        });
      }
      
      if (!telegramToken || !telegramChatId) {
        return res.status(400).json({
          success: false,
          error: 'Не указаны настройки Telegram (токен или ID чата)'
        });
      }
      
      // Получаем контент из базы данных
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        return res.status(404).json({
          success: false,
          error: `Контент с ID ${contentId} не найден`
        });
      }
      
      // Публикуем контент в Telegram через сервис с поддержкой Imgur
      const result = await socialPublishingWithImgurService.publishToTelegram(
        content,
        {
          token: telegramToken,
          chatId: telegramChatId
        }
      );
      
      return res.status(200).json({
        success: result.status === 'published',
        data: result
      });
    } catch (error) {
      console.error('Ошибка при тестировании публикации в Telegram:', error);
      return res.status(500).json({
        success: false,
        error: `Ошибка при тестировании публикации: ${error}`
      });
    }
  });
  
  console.log('Imgur routes registered');
}