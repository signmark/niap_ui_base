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
  let postPermalink = '';
  let postId = '';
  
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
    const additionalImages = content.additionalImages || [];
    
    // Определяем тип контента для публикации
    const hasImages = imageUrl || (additionalImages && additionalImages.length > 0);
    const isCarousel = imageUrl && additionalImages && additionalImages.length > 0;
    
    log.info(`[Facebook Direct] Тип публикации: ${isCarousel ? 'карусель' : (hasImages ? 'пост с изображением' : 'текстовый пост')}`);
    
    if (isCarousel) {
      log.info(`[Facebook Direct] Найдено ${additionalImages.length + 1} изображений для карусели`);
    }
    
    // Версия Facebook Graph API
    const apiVersion = 'v17.0';
    
    // Выбираем тип публикации на основе наличия изображений
    if (isCarousel) {
      // Публикуем карусель (альбом) с несколькими изображениями
      log.info(`[Facebook Direct] Публикация карусели с ${additionalImages.length + 1} изображениями`);
      
      // Для карусели сначала создаем альбом
      const albumUrl = `https://graph.facebook.com/${apiVersion}/${facebookPageId}/albums`;
      const albumData = {
        name: content.title || 'Новый альбом',
        message: message,
        access_token: facebookAccessToken
      };
      
      log.info('[Facebook Direct] Создание альбома для карусели');
      const albumResponse = await axios.post(albumUrl, albumData);
      const albumId = albumResponse.data.id;
      log.info(`[Facebook Direct] Альбом успешно создан, ID: ${albumId}`);
      
      // Теперь добавляем все изображения в альбом
      const photoUrl = `https://graph.facebook.com/${apiVersion}/${albumId}/photos`;
      
      // Сначала добавляем основное изображение
      const mainPhotoData = {
        url: imageUrl,
        access_token: facebookAccessToken
      };
      
      log.info(`[Facebook Direct] Добавление основного изображения ${imageUrl} в альбом`);
      await axios.post(photoUrl, mainPhotoData);
      
      // Затем добавляем дополнительные изображения
      for (const additionalImageUrl of additionalImages) {
        const additionalPhotoData = {
          url: additionalImageUrl,
          access_token: facebookAccessToken
        };
        
        log.info(`[Facebook Direct] Добавление дополнительного изображения ${additionalImageUrl} в альбом`);
        await axios.post(photoUrl, additionalPhotoData);
      }
      
      // Для альбома используем его ID
      postId = albumId;
      
      // Для альбомов формат ссылки другой
      postPermalink = `https://facebook.com/media/set/?set=a.${albumId}`;
      log.info(`[Facebook Direct] Карусель успешно опубликована, permalink: ${postPermalink}`);
    }
    else if (imageUrl) {
      // Публикуем пост с одним изображением
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
      const response = await axios.post(photoUrl, photoData);
      log.info(`[Facebook Direct] Ответ от API Facebook (публикация с изображением): ${JSON.stringify(response.data)}`);
      
      postId = response.data.id;
    } else {
      // Публикуем обычный текстовый пост
      const feedUrl = `https://graph.facebook.com/${apiVersion}/${facebookPageId}/feed`;
      const postData = {
        message: message,
        access_token: facebookAccessToken
      };
      
      log.info(`[Facebook Direct] Отправка запроса к Facebook API для текстового поста: ${feedUrl}`);
      const response = await axios.post(feedUrl, postData);
      log.info(`[Facebook Direct] Ответ от API Facebook (текстовый пост): ${JSON.stringify(response.data)}`);
      
      postId = response.data.id;
    }
    
    log.info(`[Facebook Direct] Пост успешно создан, ID: ${postId}`);
    
    // Формируем ссылку на пост если она еще не задана (для карусели уже задана)
    if (!postPermalink) {
      // Пост в Facebook часто имеет формат ID типа '[pageId]_[postId]'
      if (postId.includes('_')) {
        // Если ID уже содержит ID страницы (формат pageId_postId)
        postPermalink = `https://facebook.com/${postId}`;
      } else {
        // Формируем полную ссылку на основе ID страницы и поста
        postPermalink = `https://facebook.com/${facebookPageId}/posts/${postId}`;
      }
    }
    
    log.info(`[Facebook Direct] Ссылка на опубликованный пост: ${postPermalink}`);
    
    // Обновляем статус публикации контента в Directus
    await updateSocialPlatformsStatus(contentId, adminToken, postPermalink);
    
    return res.json({ 
      success: true,
      message: 'Пост успешно опубликован в Facebook',
      postId: postId,
      permalink: postPermalink
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
      publishedAt: new Date().toISOString(),
      permalink: permalink || '' // Добавляем ссылку на пост, если она предоставлена
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