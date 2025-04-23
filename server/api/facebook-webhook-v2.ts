import { Router } from 'express';
import axios from 'axios';
import log from '../utils/logger';
import { directusApi } from '../lib/directus';
import { URLSearchParams } from 'url';

const router = Router();

/**
 * Маршрут для прямой публикации в Facebook без использования n8n
 * Данный маршрут полностью заменяет использование n8n для Facebook
 * с учетом изменений в Facebook Graph API v19.0+
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
    const campaignResponse = await directusApi.get(`/items/campaigns/${content.campaign_id}`, {
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
    
    // Извлекаем настройки Facebook из кампании или переменных окружения
    let userAccessToken = '';
    let pageId = '';
    
    // Проверяем различные пути для настроек
    if (campaign?.settings?.facebook) {
      userAccessToken = campaign.settings.facebook.token || '';
      pageId = campaign.settings.facebook.pageId || '';
      log.info('[Facebook Direct] Использованы настройки из settings.facebook');
    } else if (campaign?.social_media_settings?.facebook) {
      userAccessToken = campaign.social_media_settings.facebook.token || '';
      pageId = campaign.social_media_settings.facebook.pageId || '';
      log.info('[Facebook Direct] Использованы настройки из social_media_settings.facebook');
    } else {
      // Фоллбэк на переменные окружения
      userAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || '';
      pageId = process.env.FACEBOOK_PAGE_ID || '';
      log.info('[Facebook Direct] Использованы настройки из переменных окружения');
    }
    
    if (!userAccessToken || !pageId) {
      log.error('[Facebook Direct] Отсутствуют токен доступа или ID страницы Facebook');
      return res.status(400).json({ 
        success: false,
        error: 'Не настроены учетные данные Facebook (токен и/или ID страницы)' 
      });
    }
    
    log.info(`[Facebook Direct] Настройки: токен ${userAccessToken.substring(0, 10)}... и страница ${pageId}`);
    
    // Подготавливаем данные для публикации
    const message = content.content.replace(/<[^>]*>/g, ''); // Удаляем HTML-разметку
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
    
    // Если additionalImages не массив, конвертируем в массив
    if (!Array.isArray(additionalImages)) {
      additionalImages = additionalImages ? [additionalImages] : [];
    }
    
    // Определяем тип контента для публикации
    const hasImages = imageUrl || (additionalImages && additionalImages.length > 0);
    const isCarousel = imageUrl && additionalImages && additionalImages.length > 0;
    
    log.info(`[Facebook Direct] Тип публикации: ${isCarousel ? 'карусель' : (hasImages ? 'пост с изображением' : 'текстовый пост')}`);
    
    if (isCarousel) {
      log.info(`[Facebook Direct] Найдено ${additionalImages.length + 1} изображений для карусели`);
    }
    
    // Современная версия Facebook Graph API
    const apiVersion = 'v19.0';
    
    // Получаем токен страницы для публикации от имени страницы
    const pageAccessToken = await getPageAccessToken(userAccessToken, pageId, apiVersion);
    
    try {
      // Выбираем тип публикации на основе наличия изображений
      if (isCarousel) {
        // Публикуем карусель как альбом
        const carouselResult = await publishCarousel(
          apiVersion, 
          pageId, 
          pageAccessToken, 
          message, 
          imageUrl, 
          additionalImages, 
          content.title || 'Новый альбом'
        );
        
        postId = carouselResult.id;
        postPermalink = carouselResult.permalink;
        
      } else if (imageUrl) {
        // Публикуем пост с одним изображением
        const imageResult = await publishImagePost(
          apiVersion,
          pageId,
          pageAccessToken,
          message,
          imageUrl
        );
        
        postId = imageResult.id;
        postPermalink = imageResult.permalink;
        
      } else {
        // Публикуем обычный текстовый пост
        const textResult = await publishTextPost(
          apiVersion,
          pageId,
          pageAccessToken,
          message
        );
        
        postId = textResult.id;
        postPermalink = textResult.permalink;
      }
      
      log.info(`[Facebook Direct] Пост успешно опубликован: ID=${postId}, URL=${postPermalink}`);
      
    } catch (publishError: any) {
      log.error(`[Facebook Direct] Ошибка при публикации: ${publishError.message}`);
      
      if (publishError.response?.data) {
        log.error(`[Facebook Direct] Детали ошибки API: ${JSON.stringify(publishError.response.data)}`);
      }
      
      // Пробуем запасной вариант - простой текстовый пост
      log.info('[Facebook Direct] Пробуем запасной вариант - текстовый пост со ссылками');
      
      let fallbackMessage = message;
      
      if (imageUrl) {
        fallbackMessage += `\n\nИзображение: ${imageUrl}`;
      }
      
      if (additionalImages && additionalImages.length > 0) {
        fallbackMessage += `\n\nДополнительные изображения:\n${additionalImages.join('\n')}`;
      }
      
      const fallbackResult = await publishTextPost(
        apiVersion,
        pageId,
        pageAccessToken,
        fallbackMessage
      );
      
      postId = fallbackResult.id;
      postPermalink = fallbackResult.permalink;
      
      log.info(`[Facebook Direct] Запасной вариант успешно опубликован: ID=${postId}, URL=${postPermalink}`);
    }
    
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
 * Получает токен страницы для публикации от имени страницы
 * @param userAccessToken Токен пользователя Facebook
 * @param pageId ID страницы Facebook
 * @param apiVersion Версия Facebook Graph API
 * @returns Токен страницы для публикации
 */
async function getPageAccessToken(userAccessToken: string, pageId: string, apiVersion: string): Promise<string> {
  try {
    // Проверяем, что у токена есть нужные права
    const permissionsUrl = `https://graph.facebook.com/${apiVersion}/me/permissions`;
    const permissionsResponse = await axios.get(permissionsUrl, {
      params: { access_token: userAccessToken }
    });
    
    log.info(`[Facebook Direct] Права токена Facebook: ${JSON.stringify(permissionsResponse.data)}`);
    
    // Получаем список страниц, к которым у пользователя есть доступ
    const pagesUrl = `https://graph.facebook.com/${apiVersion}/me/accounts`;
    const pagesResponse = await axios.get(pagesUrl, {
      params: { access_token: userAccessToken }
    });
    
    // Находим нужную страницу и получаем её токен
    const pages = pagesResponse.data.data || [];
    let pageAccessToken = userAccessToken;
    
    for (const page of pages) {
      if (page.id === pageId) {
        pageAccessToken = page.access_token;
        log.info(`[Facebook Direct] Найден токен страницы ${pageId}`);
        break;
      }
    }
    
    // Проверяем, что у страницы есть нужные права
    if (pageAccessToken !== userAccessToken) {
      log.info(`[Facebook Direct] Будет использован токен страницы вместо токена пользователя`);
    } else {
      log.warn(`[Facebook Direct] Не найден токен для страницы ${pageId}, используем токен пользователя`);
    }
    
    return pageAccessToken;
  } catch (error: any) {
    log.error(`[Facebook Direct] Ошибка при получении токена страницы: ${error.message}`);
    if (error.response?.data) {
      log.error(`[Facebook Direct] Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    
    // В случае ошибки возвращаем исходный токен
    return userAccessToken;
  }
}

/**
 * Публикует карусель как альбом Facebook
 */
async function publishCarousel(
  apiVersion: string,
  pageId: string,
  pageAccessToken: string,
  message: string,
  imageUrl: string,
  additionalImages: string[],
  title: string
): Promise<{ id: string, permalink: string }> {
  try {
    // Метод 1: Создаем альбом и добавляем в него фото
    log.info('[Facebook Direct] Публикация карусели через создание альбома');
    
    // Создаем альбом
    const albumUrl = `https://graph.facebook.com/${apiVersion}/${pageId}/albums`;
    const albumData = new URLSearchParams();
    albumData.append('name', title);
    albumData.append('message', message);
    albumData.append('access_token', pageAccessToken);
    
    const albumResponse = await axios.post(albumUrl, albumData);
    const albumId = albumResponse.data.id;
    log.info(`[Facebook Direct] Альбом успешно создан, ID: ${albumId}`);
    
    // Добавляем изображения в альбом
    const photoUrl = `https://graph.facebook.com/${apiVersion}/${albumId}/photos`;
    
    // Добавляем основное изображение
    const mainPhotoData = new URLSearchParams();
    mainPhotoData.append('url', imageUrl);
    mainPhotoData.append('access_token', pageAccessToken);
    
    await axios.post(photoUrl, mainPhotoData);
    log.info('[Facebook Direct] Основное изображение добавлено в альбом');
    
    // Добавляем дополнительные изображения
    for (const additionalImageUrl of additionalImages) {
      const additionalPhotoData = new URLSearchParams();
      additionalPhotoData.append('url', additionalImageUrl);
      additionalPhotoData.append('access_token', pageAccessToken);
      
      await axios.post(photoUrl, additionalPhotoData);
      log.info('[Facebook Direct] Дополнительное изображение добавлено в альбом');
    }
    
    // Формируем ссылку на альбом
    const permalink = `https://facebook.com/media/set/?set=a.${albumId}`;
    
    return { id: albumId, permalink };
  } catch (albumError: any) {
    log.error(`[Facebook Direct] Ошибка при создании альбома: ${albumError.message}`);
    
    if (albumError.response?.data) {
      log.error(`[Facebook Direct] Детали ошибки: ${JSON.stringify(albumError.response.data)}`);
    }
    
    // Метод 2: Если с альбомом не получилось, пробуем через attached_media
    log.info('[Facebook Direct] Пробуем метод attached_media для карусели');
    
    try {
      // Загружаем изображения без публикации
      const uploadUrl = `https://graph.facebook.com/${apiVersion}/${pageId}/photos`;
      const attachedMedia = [];
      
      // Загружаем основное изображение
      const mainPhotoData = new URLSearchParams();
      mainPhotoData.append('url', imageUrl);
      mainPhotoData.append('published', 'false');
      mainPhotoData.append('access_token', pageAccessToken);
      
      const mainPhotoResponse = await axios.post(uploadUrl, mainPhotoData);
      attachedMedia.push({ media_fbid: mainPhotoResponse.data.id });
      log.info('[Facebook Direct] Основное изображение загружено');
      
      // Загружаем дополнительные изображения
      for (const additionalImageUrl of additionalImages) {
        const photoData = new URLSearchParams();
        photoData.append('url', additionalImageUrl);
        photoData.append('published', 'false');
        photoData.append('access_token', pageAccessToken);
        
        const photoResponse = await axios.post(uploadUrl, photoData);
        attachedMedia.push({ media_fbid: photoResponse.data.id });
        log.info('[Facebook Direct] Дополнительное изображение загружено');
      }
      
      // Создаем пост с прикрепленными изображениями
      const feedUrl = `https://graph.facebook.com/${apiVersion}/${pageId}/feed`;
      const postData = new URLSearchParams();
      postData.append('message', message);
      
      // Добавляем прикрепленные медиа
      for (let i = 0; i < attachedMedia.length; i++) {
        postData.append(`attached_media[${i}]`, JSON.stringify(attachedMedia[i]));
      }
      
      postData.append('access_token', pageAccessToken);
      
      const response = await axios.post(feedUrl, postData);
      const postId = response.data.id;
      
      // Формируем ссылку на пост
      const permalink = `https://facebook.com/${postId}`;
      
      return { id: postId, permalink };
    } catch (attachedMediaError: any) {
      log.error(`[Facebook Direct] Ошибка с attached_media: ${attachedMediaError.message}`);
      
      if (attachedMediaError.response?.data) {
        log.error(`[Facebook Direct] Детали ошибки: ${JSON.stringify(attachedMediaError.response.data)}`);
      }
      
      // Если и это не сработало, публикуем как обычный пост с изображением
      log.info('[Facebook Direct] Публикуем только основное изображение');
      
      return await publishImagePost(
        apiVersion,
        pageId,
        pageAccessToken,
        message + '\n\n[Примечание: это первое изображение из серии]',
        imageUrl
      );
    }
  }
}

/**
 * Публикует пост с одним изображением
 */
async function publishImagePost(
  apiVersion: string,
  pageId: string,
  pageAccessToken: string,
  message: string,
  imageUrl: string
): Promise<{ id: string, permalink: string }> {
  try {
    // Публикуем изображение напрямую
    log.info(`[Facebook Direct] Публикация поста с изображением: ${imageUrl}`);
    
    const photoUrl = `https://graph.facebook.com/${apiVersion}/${pageId}/photos`;
    const photoData = new URLSearchParams();
    photoData.append('url', imageUrl);
    photoData.append('message', message);
    photoData.append('access_token', pageAccessToken);
    
    const response = await axios.post(photoUrl, photoData);
    const postId = response.data.id;
    
    // Формируем ссылку на пост
    const permalink = `https://facebook.com/${postId}`;
    
    return { id: postId, permalink };
  } catch (photoError: any) {
    log.error(`[Facebook Direct] Ошибка при публикации изображения: ${photoError.message}`);
    
    if (photoError.response?.data) {
      log.error(`[Facebook Direct] Детали ошибки: ${JSON.stringify(photoError.response.data)}`);
    }
    
    // Если не удалось напрямую, пробуем через feed с ссылкой
    log.info('[Facebook Direct] Пробуем публикацию через feed со ссылкой на изображение');
    
    const feedUrl = `https://graph.facebook.com/${apiVersion}/${pageId}/feed`;
    const postData = new URLSearchParams();
    postData.append('message', message);
    postData.append('link', imageUrl);
    postData.append('access_token', pageAccessToken);
    
    const response = await axios.post(feedUrl, postData);
    const postId = response.data.id;
    
    // Формируем ссылку на пост
    const permalink = `https://facebook.com/${pageId}/posts/${postId}`;
    
    return { id: postId, permalink };
  }
}

/**
 * Публикует текстовый пост
 */
async function publishTextPost(
  apiVersion: string,
  pageId: string,
  pageAccessToken: string,
  message: string
): Promise<{ id: string, permalink: string }> {
  // Публикуем обычный текстовый пост
  log.info('[Facebook Direct] Публикация текстового поста');
  
  const feedUrl = `https://graph.facebook.com/${apiVersion}/${pageId}/feed`;
  const postData = new URLSearchParams();
  postData.append('message', message);
  postData.append('access_token', pageAccessToken);
  
  const response = await axios.post(feedUrl, postData);
  const postId = response.data.id;
  
  // Формируем ссылку на пост
  const permalink = `https://facebook.com/${pageId}/posts/${postId}`;
  
  return { id: postId, permalink };
}

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
      } catch (e: any) {
        log.error(`[Facebook Direct] Не удалось разобрать социальные платформы как JSON: ${e.message}`);
        socialPlatforms = {};
      }
    }
    
    // Если socialPlatforms не существует или не является объектом, создаем новый объект
    if (!socialPlatforms || typeof socialPlatforms !== 'object') {
      socialPlatforms = {};
    }
    
    // Обновляем статус Facebook
    socialPlatforms.facebook = {
      ...(socialPlatforms.facebook || {}),
      status: 'published',
      publishedAt: new Date().toISOString(),
      permalink: permalink || ''
    };
    
    // Обновляем контент в Directus
    await directusApi.patch(`/items/campaign_content/${contentId}`, {
      social_platforms: socialPlatforms
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    log.info(`[Facebook Direct] Статус публикации обновлен: Facebook = published`);
    
  } catch (error: any) {
    log.error(`[Facebook Direct] Ошибка при обновлении статуса публикации: ${error.message}`);
    if (error.response?.data) {
      log.error(`[Facebook Direct] Детали ошибки Directus API: ${JSON.stringify(error.response.data)}`);
    }
  }
}

export default router;