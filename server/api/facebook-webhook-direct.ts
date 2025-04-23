import { Router } from 'express';
import axios from 'axios';
import log from '../utils/logger';
import { storage } from '../storage';

const router = Router();

/**
 * Маршрут для прямой публикации в Facebook без использования n8n
 * Данный маршрут полностью заменяет использование n8n для Facebook
 */
router.post('/', async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ 
        success: false,
        error: 'Не указан ID контента для публикации в Facebook' 
      });
    }
    
    log.info(`[Facebook Direct] Начало прямой публикации контента ${contentId} в Facebook`);
    
    // Получаем данные контента из Directus через storage интерфейс
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN || 'zQJK4b84qrQeuTYS2-x9QqpEyDutJGsb';
    const content = await storage.getCampaignContentById(contentId, adminToken);
    
    if (!content) {
      log.error(`[Facebook Direct] Контент с ID ${contentId} не найден в Directus`);
      return res.status(404).json({ 
        success: false,
        error: 'Контент не найден в базе данных' 
      });
    }
    
    log.info(`[Facebook Direct] Получен контент для публикации: ${JSON.stringify({
      id: content.id,
      title: content.title,
      contentType: content.contentType,
      hasImage: !!content.imageUrl
    })}`);
    
    // Формируем данные для публикации в Facebook
    // Facebook API требует accessToken и другие параметры
    const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    const facebookPageId = process.env.FACEBOOK_PAGE_ID;
    
    if (!facebookAccessToken || !facebookPageId) {
      log.error('[Facebook Direct] Отсутствуют токен доступа или ID страницы Facebook');
      return res.status(400).json({ 
        success: false,
        error: 'Не настроены учетные данные Facebook (токен и/или ID страницы)' 
      });
    }
    
    // Подготавливаем данные для публикации
    const message = content.content;
    const imageUrl = content.imageUrl;
    
    // Для простоты сначала сделаем текстовый пост
    // В будущем можно добавить логику для разных типов контента
    
    // Публикуем текстовый пост
    const apiVersion = 'v17.0'; // Версия Facebook Graph API
    const url = `https://graph.facebook.com/${apiVersion}/${facebookPageId}/feed`;
    
    const postData = {
      message: message,
      access_token: facebookAccessToken
    };
    
    // Отправляем запрос к Facebook API
    let response;
    
    // Если есть изображение, публикуем пост с изображением
    if (imageUrl) {
      log.info(`[Facebook Direct] Публикация с изображением: ${imageUrl}`);
      
      // Создаем URL для публикации с изображением
      const photoUrl = `https://graph.facebook.com/${apiVersion}/${facebookPageId}/photos`;
      
      // Подготавливаем данные для поста с изображением
      const photoData = {
        url: imageUrl,  // URL изображения
        caption: message, // Подпись к изображению (текст поста)
        access_token: facebookAccessToken
      };
      
      log.info(`[Facebook Direct] Отправка запроса на публикацию с изображением: ${photoUrl}`);
      response = await axios.post(photoUrl, photoData);
      log.info(`[Facebook Direct] Ответ от API Facebook (публикация с изображением): ${JSON.stringify(response.data)}`);
    } else {
      // Публикуем обычный текстовый пост
      log.info(`[Facebook Direct] Отправка запроса к Facebook API для текстового поста: ${url}`);
      response = await axios.post(url, postData);
      log.info(`[Facebook Direct] Ответ от API Facebook (текстовый пост): ${JSON.stringify(response.data)}`);
    }
    
    // Получаем ID созданного поста
    const postId = response.data.id;
    log.info(`[Facebook Direct] Пост успешно создан, ID: ${postId}`);
    
    // Формируем ссылку на пост
    let permalink;
    
    // Пост в Facebook часто имеет формат ID типа '[pageId]_[postId]'
    // Формируем ссылку на основе ID страницы и поста
    if (postId.includes('_')) {
      // Если ID уже содержит ID страницы (формат pageId_postId)
      permalink = `https://facebook.com/${postId}`;
    } else {
      // Формируем полную ссылку на основе ID страницы и поста
      permalink = `https://facebook.com/${facebookPageId}/posts/${postId}`;
    }
    
    log.info(`[Facebook Direct] Ссылка на опубликованный пост: ${permalink}`);
    
    // Обновляем статус публикации контента в Directus
    await updateSocialPlatformsStatus(contentId, adminToken, permalink);
    
    return res.json({ 
      success: true,
      message: 'Пост успешно опубликован в Facebook',
      postId: postId,
      permalink: permalink
    });
  } catch (error: any) {
    log.error(`[Facebook Direct] Ошибка при публикации: ${error.message}`);
    
    if (error.response) {
      log.error(`[Facebook Direct] Детали ошибки Facebook API: ${JSON.stringify(error.response.data)}`);
    }
    
    return res.status(500).json({ 
      success: false,
      error: `Ошибка при публикации в Facebook: ${error.message}` 
    });
  }
});

/**
 * Обновляет статус публикации в Directus
 * @param contentId ID контента для обновления
 * @param token Токен для доступа к Directus API
 * @param permalink Ссылка на опубликованный пост (опционально)
 */
async function updateSocialPlatformsStatus(contentId: string, token: string, permalink?: string) {
  try {
    // Получаем текущие данные контента
    const content = await storage.getCampaignContentById(contentId, token);
    
    if (!content) {
      log.error(`[Facebook Direct] Не удалось получить контент для обновления статуса: ${contentId}`);
      return;
    }
    
    // Получаем текущее состояние socialPlatforms
    let socialPlatforms = content.socialPlatforms as Record<string, any> || {};
    
    // Если socialPlatforms - строка, парсим JSON
    if (typeof socialPlatforms === 'string') {
      try {
        socialPlatforms = JSON.parse(socialPlatforms);
      } catch (e) {
        socialPlatforms = {};
      }
    }
    
    // Обновляем статус Facebook
    socialPlatforms.facebook = {
      status: 'published',
      publishedAt: new Date().toISOString()
    };
    
    // Обновляем контент в Directus
    await storage.updateCampaignContent(contentId, { 
      socialPlatforms: socialPlatforms
    }, token);
    
    log.info(`[Facebook Direct] Статус публикации обновлен в Directus: ${contentId}`);
  } catch (error: any) {
    log.error(`[Facebook Direct] Ошибка при обновлении статуса: ${error.message}`);
  }
}

export default router;