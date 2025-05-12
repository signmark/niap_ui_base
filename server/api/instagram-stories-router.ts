/**
 * Маршрутизатор для публикации Instagram Stories
 * 
 * Этот файл отвечает за обработку запросов на публикацию Instagram Stories
 */

import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { log } from '../utils/logger';
import { storage } from '../storage';
import { instagramService } from '../services/social/instagram-service';
import { directusApi } from '../lib/directus';

/**
 * Регистрирует маршруты для публикации Instagram Stories
 * @param app Express приложение
 */
export function registerInstagramStoriesRoutes(app: express.Express) {
  log('Регистрация маршрутов для Instagram Stories', 'instagram-stories');
  
  // Эндпоинт для публикации сторис в Instagram
  app.post('/api/publish/instagram-stories', authMiddleware, async (req, res) => {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId'
      });
    }
    
    try {
      log(`[Instagram Stories] Запрос на публикацию сторис для контента: ${contentId}`, 'instagram-stories');
      
      // 1. Получаем токен администратора для доступа к API
      const adminToken = await storage.getAdminToken();
      if (!adminToken) {
        log(`[Instagram Stories] Ошибка: не удалось получить токен администратора`, 'instagram-stories', 'error');
        return res.status(500).json({
          success: false,
          error: 'Ошибка авторизации при получении данных контента'
        });
      }
      
      // 2. Получаем данные контента из Directus
      log(`[Instagram Stories] Получение данных контента из Directus: ${contentId}`, 'instagram-stories');
      const contentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      const content = contentResponse.data?.data;
      if (!content) {
        log(`[Instagram Stories] Ошибка: не удалось найти контент с ID ${contentId}`, 'instagram-stories', 'error');
        return res.status(404).json({
          success: false,
          error: 'Контент не найден'
        });
      }
      
      // 3. Получаем данные кампании для настроек соцсетей
      log(`[Instagram Stories] Получение данных кампании: ${content.campaignId}`, 'instagram-stories');
      const campaignResponse = await directusApi.get(`/items/user_campaigns/${content.campaignId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      const campaign = campaignResponse.data?.data;
      if (!campaign) {
        log(`[Instagram Stories] Ошибка: не удалось найти кампанию с ID ${content.campaignId}`, 'instagram-stories', 'error');
        return res.status(404).json({
          success: false,
          error: 'Кампания не найдена'
        });
      }
      
      // 4. Получаем настройки Instagram из настроек кампании
      log(`[Instagram Stories] Извлечение настроек Instagram из данных кампании`, 'instagram-stories');
      const socialSettings = campaign.social_media_settings || {};
      
      if (!socialSettings.instagram) {
        log(`[Instagram Stories] Ошибка: отсутствуют настройки Instagram в кампании`, 'instagram-stories', 'error');
        return res.status(400).json({
          success: false,
          error: 'Отсутствуют настройки Instagram в кампании'
        });
      }
      
      // 5. Подготавливаем конфигурацию Instagram
      const instagramSettings = socialSettings.instagram;
      const instToken = instagramSettings.accessToken || instagramSettings.token;
      const businessId = instagramSettings.businessAccountId || instagramSettings.instagramBusinessId;
      
      if (!instToken || !businessId) {
        log(`[Instagram Stories] Ошибка: отсутствуют необходимые параметры Instagram API`, 'instagram-stories', 'error');
        return res.status(400).json({
          success: false,
          error: 'Отсутствуют обязательные параметры Instagram API (token или businessAccountId)'
        });
      }
      
      // 6. Подготавливаем конфигурацию для publishStory
      const instagramConfig = {
        token: instToken,
        accessToken: instToken,
        businessAccountId: businessId
      };
      
      log(`[Instagram Stories] Настройки Instagram подготовлены, публикуем сторис...`, 'instagram-stories');
      
      // 7. Публикуем сторис в Instagram
      const result = await instagramService.publishStory(content, instagramConfig, socialSettings);
      
      log(`[Instagram Stories] Результат публикации: ${JSON.stringify(result)}`, 'instagram-stories');
      
      // 8. Если публикация успешна, обновляем статус в Directus
      if (result.status === 'published') {
        log(`[Instagram Stories] Публикация успешна, обновляем статус контента в Directus`, 'instagram-stories');
        
        // Формируем данные для обновления контента с расширенной информацией
        const updateData = {
          socialPlatforms: {
            ...(content.socialPlatforms || {}),
            instagram_stories: {
              status: 'published',
              postId: result.storyId || result.postId, // Приоритет storyId из расширенного ответа
              postUrl: result.storyUrl || result.postUrl,
              platform: 'instagram_stories',
              publishedAt: new Date().toISOString(),
              // Дополнительные поля для улучшенного отслеживания
              mediaContainerId: result.mediaContainerId,
              igUsername: result.igUsername,
              creationTime: result.creationTime || new Date().toISOString()
            }
          }
        };
        
        log(`[Instagram Stories] Данные для обновления контента: ${JSON.stringify(updateData)}`, 'instagram-stories');
        
        // Обновляем контент в Directus
        await directusApi.patch(`/items/campaign_content/${contentId}`, updateData, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        log(`[Instagram Stories] Статус контента успешно обновлен в Directus`, 'instagram-stories');
      }
      
      return res.json({
        success: true,
        result,
        contentId,
        campaignId: content.campaignId
      });
    } catch (error) {
      log(`[Instagram Stories] Ошибка при публикации: ${error.message || error}`, 'instagram-stories', 'error');
      return res.status(500).json({
        success: false,
        error: `Ошибка при публикации: ${error.message || 'Неизвестная ошибка'}`
      });
    }
  });
  
  // Эндпоинт для получения статуса публикации сторис
  app.get('/api/publish/instagram-stories/:contentId/status', authMiddleware, async (req, res) => {
    const { contentId } = req.params;
    
    try {
      log(`[Instagram Stories] Запрос статуса публикации для контента: ${contentId}`, 'instagram-stories');
      
      // Получаем токен администратора для доступа к API
      const adminToken = await storage.getAdminToken();
      if (!adminToken) {
        return res.status(500).json({
          success: false,
          error: 'Ошибка авторизации при получении данных контента'
        });
      }
      
      // Получаем данные контента из Directus
      const contentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      const content = contentResponse.data?.data;
      if (!content) {
        return res.status(404).json({
          success: false,
          error: 'Контент не найден'
        });
      }
      
      // Получаем статус публикации в Instagram
      const instagramStoriesStatus = content.socialPlatforms?.instagram_stories || null;
      
      return res.json({
        success: true,
        status: instagramStoriesStatus,
        contentId
      });
    } catch (error) {
      log(`[Instagram Stories] Ошибка при получении статуса: ${error.message || error}`, 'instagram-stories', 'error');
      return res.status(500).json({
        success: false,
        error: `Ошибка при получении статуса: ${error.message || 'Неизвестная ошибка'}`
      });
    }
  });
}