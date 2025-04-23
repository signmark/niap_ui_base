import { Router } from 'express';
import axios from 'axios';
import log from '../utils/logger';
import { directusApi } from '../lib/directus';

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
    
    // Получаем данные контента из Directus
    // Получаем токен из активных сессий администратора через DirectusAuthManager
    const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
    
    // Получаем токен из активных сессий администратора или используем токен из переменных окружения
    let adminToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
    const sessions = directusAuthManager.getAllActiveSessions();
    
    if (sessions.length > 0) {
      // Берем самый свежий токен из активных сессий
      adminToken = sessions[0].token;
      log.info(`[Facebook Direct] Используется токен администратора из активной сессии`);
    } else {
      log.info(`[Facebook Direct] Активные сессии не найдены, используется токен из переменных окружения`);
    }
    
    if (!adminToken) {
      throw new Error('Отсутствует административный токен для Directus API');
    }
    
    const contentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    if (!contentResponse.data?.data) {
      log.error(`[Facebook Direct] Контент с ID ${contentId} не найден в Directus`);
      return res.status(404).json({ 
        success: false,
        error: 'Контент не найден в базе данных' 
      });
    }
    
    const content = contentResponse.data.data;
    
    log.info(`[Facebook Direct] Получен контент для публикации: ${JSON.stringify({
      id: content.id,
      title: content.title,
      contentType: content.content_type,
      hasImage: !!content.image_url
    })}`);
    
    // Получаем информацию о кампании для получения настроек Facebook
    if (!content.campaign_id) {
      log.error(`[Facebook Direct] Контент ${contentId} не содержит campaign_id`);
      return res.status(400).json({ 
        success: false,
        error: 'Не указан ID кампании в контенте' 
      });
    }
    
    // Получаем данные кампании для извлечения настроек Facebook
    const campaignResponse = await directusApi.get(`/items/user_campaigns/${content.campaign_id}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    if (!campaignResponse.data?.data) {
      log.error(`[Facebook Direct] Кампания с ID ${content.campaign_id} не найдена`);
      return res.status(400).json({ 
        success: false,
        error: 'Кампания не найдена' 
      });
    }
    
    const campaign = campaignResponse.data.data;
    log.info(`[Facebook Direct] Получены данные кампании: "${campaign.name}"`);
    
    // Извлекаем настройки Facebook из кампании
    let socialSettings = campaign.social_media_settings || {};
    
    // Если socialSettings - строка, парсим JSON
    if (typeof socialSettings === 'string') {
      try {
        socialSettings = JSON.parse(socialSettings);
      } catch (e) {
        socialSettings = {};
      }
    }
    
    const facebookSettings = socialSettings.facebook || {};
    
    const facebookAccessToken = facebookSettings.token;
    const facebookPageId = facebookSettings.pageId;
    
    if (!facebookAccessToken || !facebookPageId) {
      log.error('[Facebook Direct] Отсутствуют токен доступа или ID страницы Facebook в настройках кампании');
      return res.status(400).json({ 
        success: false,
        error: 'Не настроены учетные данные Facebook (токен и/или ID страницы) в настройках кампании' 
      });
    }
    
    log.info(`[Facebook Direct] Используются настройки из кампании: токен ${facebookAccessToken.substring(0, 10)}... и страница ${facebookPageId}`);
    
    
    // Подготавливаем данные для публикации
    const message = content.content;
    const imageUrl = content.image_url;
    
    // Обрабатываем additional_images, если они есть
    let additionalImages = content.additional_images || [];
    
    // Если additionalImages - строка, парсим JSON
    if (typeof additionalImages === 'string') {
      try {
        additionalImages = JSON.parse(additionalImages);
      } catch (e) {
        additionalImages = [];
      }
    }
    
    // Определяем тип контента для публикации
    const hasImages = imageUrl || (additionalImages && additionalImages.length > 0);
    const isCarousel = imageUrl && additionalImages && additionalImages.length > 0;
    
    log.info(`[Facebook Direct] Тип публикации: ${isCarousel ? 'карусель' : (hasImages ? 'пост с изображением' : 'текстовый пост')}`);
    
    if (isCarousel) {
      log.info(`[Facebook Direct] Найдено ${additionalImages.length + 1} изображений для карусели`);
    }
    
    // Версия Facebook Graph API
    const apiVersion = 'v17.0';

    // Проверяем права токена
    log.info(`[Facebook Direct] Проверка прав токена Facebook`);
    try {
      // Проверка прав токена
      const permissionsUrl = `https://graph.facebook.com/${apiVersion}/me/permissions`;
      const permissionsResponse = await axios.get(permissionsUrl, {
        params: { access_token: facebookAccessToken }
      });
      
      log.info(`[Facebook Direct] Права токена Facebook: ${JSON.stringify(permissionsResponse.data)}`);
      
      // Проверка, что токен имеет доступ к странице
      const pagesUrl = `https://graph.facebook.com/${apiVersion}/me/accounts`;
      const pagesResponse = await axios.get(pagesUrl, {
        params: { access_token: facebookAccessToken }
      });
      
      log.info(`[Facebook Direct] Доступные страницы: ${JSON.stringify(pagesResponse.data)}`);
      
      // Найти нужную страницу и получить её токен
      let pageToken = facebookAccessToken;
      const pages = pagesResponse.data.data || [];
      
      for(const page of pages) {
        if(page.id === facebookPageId) {
          pageToken = page.access_token;
          log.info(`[Facebook Direct] Найден токен для страницы ${facebookPageId}`);
          break;
        }
      }
      
      if(pageToken !== facebookAccessToken) {
        log.info(`[Facebook Direct] Используется токен страницы вместо пользовательского токена`);
      }
      
      // Используем токен страницы для всех последующих запросов
      facebookAccessToken = pageToken;
    } catch(permError: any) {
      log.error(`[Facebook Direct] Ошибка при проверке прав токена: ${permError.message}`);
      if(permError.response?.data) {
        log.error(`[Facebook Direct] Детали ошибки: ${JSON.stringify(permError.response.data)}`);
      }
    }

    // Выбираем тип публикации на основе наличия изображений
    if (isCarousel) {
      // Публикуем карусель (альбом) с несколькими изображениями
      log.info(`[Facebook Direct] Публикация карусели с ${additionalImages.length + 1} изображениями`);
      
      try {
        // Современный подход - использование batch requests или создание поста с несколькими изображениями
        // Для карусели сначала создаем альбом
        const feedUrl = `https://graph.facebook.com/${apiVersion}/${facebookPageId}/feed`;
        
        // Подготавливаем прикрепленные медиафайлы
        const attachedMedia = [];
        
        // Загружаем каждое изображение отдельно
        const uploadUrl = `https://graph.facebook.com/${apiVersion}/${facebookPageId}/photos`;
        
        // Сначала загружаем основное изображение
        log.info(`[Facebook Direct] Загрузка основного изображения карусели: ${imageUrl}`);
        const mainPhotoData = {
          url: imageUrl,
          published: false,  // Важно - не публиковать сразу
          access_token: facebookAccessToken
        };
        
        const mainPhotoResponse = await axios.post(uploadUrl, mainPhotoData);
        const mainPhotoId = mainPhotoResponse.data.id;
        log.info(`[Facebook Direct] Основное изображение загружено, ID: ${mainPhotoId}`);
        attachedMedia.push({ media_fbid: mainPhotoId });
        
        // Загружаем дополнительные изображения
        for (const additionalImageUrl of additionalImages) {
          log.info(`[Facebook Direct] Загрузка дополнительного изображения карусели: ${additionalImageUrl}`);
          const photoData = {
            url: additionalImageUrl,
            published: false,  // Не публиковать сразу
            access_token: facebookAccessToken
          };
          
          const photoResponse = await axios.post(uploadUrl, photoData);
          const photoId = photoResponse.data.id;
          log.info(`[Facebook Direct] Дополнительное изображение загружено, ID: ${photoId}`);
          attachedMedia.push({ media_fbid: photoId });
        }
        
        // Теперь создаем пост с прикрепленными изображениями
        const postData = {
          message: message,
          attached_media: attachedMedia,
          access_token: facebookAccessToken
        };
        
        log.info(`[Facebook Direct] Создание карусельного поста с ${attachedMedia.length} изображениями`);
        const response = await axios.post(feedUrl, postData);
        log.info(`[Facebook Direct] Ответ от API Facebook (карусельный пост): ${JSON.stringify(response.data)}`);
        
        postId = response.data.id;
        postPermalink = `https://facebook.com/${postId}`;
        log.info(`[Facebook Direct] Карусель успешно опубликована, permalink: ${postPermalink}`);
      } catch (carouselError: any) {
        log.error(`[Facebook Direct] Ошибка при публикации карусели: ${carouselError.message}`);
        
        if (carouselError.response?.data) {
          log.error(`[Facebook Direct] Детали ошибки API Facebook: ${JSON.stringify(carouselError.response.data)}`);
          
          // Если нет прав на публикацию карусели, пробуем обычный пост с изображением
          log.info(`[Facebook Direct] Пробуем опубликовать как обычный пост с изображением`);
          
          // Публикуем пост с одним изображением
          log.info(`[Facebook Direct] Публикация с первым изображением: ${imageUrl}`);
          
          const feedUrl = `https://graph.facebook.com/${apiVersion}/${facebookPageId}/feed`;
          const postData = {
            message: message + "\n\n[Примечание: изображения из карусели доступны по ссылкам в посте]",
            link: imageUrl,
            access_token: facebookAccessToken
          };
          
          log.info(`[Facebook Direct] Отправка запроса для поста с ссылкой: ${feedUrl}`);
          const response = await axios.post(feedUrl, postData);
          log.info(`[Facebook Direct] Ответ от API Facebook (обычный пост): ${JSON.stringify(response.data)}`);
          
          postId = response.data.id;
          postPermalink = `https://facebook.com/${postId}`;
        } else {
          throw carouselError;
        }
      }
    }
    else if (imageUrl) {
      // Публикуем пост с одним изображением
      log.info(`[Facebook Direct] Публикация с изображением: ${imageUrl}`);
      
      try {
        // Современный подход - создание поста в feed с приложенной фотографией
        // Сначала загружаем фото, но не публикуем его
        const uploadUrl = `https://graph.facebook.com/${apiVersion}/${facebookPageId}/photos`;
        const uploadData = {
          url: imageUrl,
          published: false,  // Важно - не публиковать сразу
          access_token: facebookAccessToken
        };
        
        log.info(`[Facebook Direct] Загрузка изображения без публикации: ${uploadUrl}`);
        const uploadResponse = await axios.post(uploadUrl, uploadData);
        const photoId = uploadResponse.data.id;
        log.info(`[Facebook Direct] Изображение загружено, ID: ${photoId}`);
        
        // Теперь создаем пост с приложенным фото
        const feedUrl = `https://graph.facebook.com/${apiVersion}/${facebookPageId}/feed`;
        const postData = {
          message: message,
          attached_media: [{ media_fbid: photoId }],
          access_token: facebookAccessToken
        };
        
        log.info(`[Facebook Direct] Создание поста с приложенным изображением: ${feedUrl}`);
        const response = await axios.post(feedUrl, postData);
        log.info(`[Facebook Direct] Ответ от API Facebook (пост с изображением): ${JSON.stringify(response.data)}`);
        
        postId = response.data.id;
      } catch (photoError: any) {
        log.error(`[Facebook Direct] Ошибка при публикации с изображением: ${photoError.message}`);
        
        if (photoError.response?.data) {
          log.error(`[Facebook Direct] Детали ошибки API Facebook: ${JSON.stringify(photoError.response.data)}`);
          
          // Если нет прав на приложенные медиа, пробуем опубликовать обычный пост со ссылкой
          log.info(`[Facebook Direct] Пробуем опубликовать как обычный пост со ссылкой на изображение`);
          
          const feedUrl = `https://graph.facebook.com/${apiVersion}/${facebookPageId}/feed`;
          const postData = {
            message: message,
            link: imageUrl,
            access_token: facebookAccessToken
          };
          
          log.info(`[Facebook Direct] Отправка запроса для поста с ссылкой: ${feedUrl}`);
          const response = await axios.post(feedUrl, postData);
          log.info(`[Facebook Direct] Ответ от API Facebook (пост со ссылкой): ${JSON.stringify(response.data)}`);
          
          postId = response.data.id;
        } else {
          throw photoError;
        }
      }
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
    // Проверяем токен, и если он недействительный, получаем новый
    try {
      // Проверяем валидность токена через простой запрос
      await directusApi.get('/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      log.info(`[Facebook Direct] Токен валиден, продолжаем обновление статуса`);
    } catch (tokenError) {
      log.warn(`[Facebook Direct] Предоставленный токен не валиден, получаем новый`);
      
      // Получаем новый токен из директус-менеджера
      const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
      const sessions = directusAuthManager.getAllActiveSessions();
      
      if (sessions.length > 0) {
        token = sessions[0].token;
        log.info(`[Facebook Direct] Получен новый токен из активной сессии для обновления статуса`);
      } else {
        throw new Error('Не удалось получить действительный токен для обновления статуса публикации');
      }
    }
    
    // Получаем текущие данные контента
    const contentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!contentResponse.data?.data) {
      log.error(`[Facebook Direct] Не удалось получить контент для обновления статуса: ${contentId}`);
      return;
    }
    
    const content = contentResponse.data.data;
    
    // Получаем текущее состояние socialPlatforms
    let socialPlatforms = content.social_platforms || {};
    
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
    await directusApi.patch(`/items/campaign_content/${contentId}`, {
      social_platforms: socialPlatforms
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    log.info(`[Facebook Direct] Статус публикации обновлен в Directus: ${contentId}`);
  } catch (error: any) {
    log.error(`[Facebook Direct] Ошибка при обновлении статуса: ${error.message}`);
    
    if (error.response) {
      log.error(`[Facebook Direct] Детали ошибки Directus API: ${JSON.stringify(error.response.data)}`);
    }
  }
}

export default router;