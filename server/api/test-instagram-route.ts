/**
 * Тестовый маршрут для проверки публикации в Instagram и сохранения URL
 */
import express, { Request, Response } from 'express';
import { socialPublishingWithImgurService } from '../services/social-publishing-with-imgur';
import { instagramService } from '../services/social/instagram-service';
import { log } from '../utils/logger';
import type { CampaignContent } from '../../shared/schema';
import axios from 'axios';

// Функция для регистрации тестового маршрута
export function registerTestInstagramRoute(app: express.Express) {
  console.log('Регистрация тестового маршрута для Instagram');

  // Маршрут для прямой публикации в Instagram с сохранением результата
  app.post('/api/test/instagram-publish', async (req: Request, res: Response) => {
    const { contentId } = req.body;

    if (!contentId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Необходимо указать contentId' 
      });
    }

    log(`[Test Route] Тестовая публикация в Instagram для контента: ${contentId}`, 'instagram-test');

    try {
      // 1. Получаем системный токен
      const systemToken = await getSystemToken();
      
      if (!systemToken) {
        return res.status(500).json({
          success: false,
          error: 'Не удалось получить системный токен'
        });
      }

      // 2. Получаем данные контента из Directus
      const content = await fetchContent(contentId, systemToken);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          error: 'Не удалось найти контент'
        });
      }

      // 3. Получаем данные кампании для настроек соцсетей
      const campaign = await fetchCampaign(content.campaignId, systemToken);
      
      if (!campaign || !campaign.social_media_settings) {
        return res.status(404).json({
          success: false,
          error: 'Не удалось получить настройки социальных сетей'
        });
      }

      // 4. Подготавливаем социальные настройки
      const socialSettings = prepareSocialSettings(campaign);

      // 5. Публикуем в Instagram
      const result = await instagramService.publishToPlatform(content, 'instagram', socialSettings);
      
      log(`[Test Route] Результат публикации в Instagram: ${JSON.stringify(result)}`, 'instagram-test');

      // 6. Обновляем статус публикации
      if (result) {
        const updatedContent = await socialPublishingWithImgurService.updatePublicationStatus(
          contentId,
          'instagram',
          result
        );

        // 7. Получаем финальный контент для проверки
        const finalContent = await fetchContent(contentId, systemToken);

        return res.json({
          success: true,
          publication: result,
          updatedContent: updatedContent,
          finalContent: finalContent,
          socialPlatforms: finalContent?.socialPlatforms || {},
          instagram: finalContent?.socialPlatforms?.instagram || null
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Публикация не вернула результат'
        });
      }
    } catch (error: any) {
      console.error('Ошибка в тестовом маршруте Instagram:', error);
      
      return res.status(500).json({
        success: false,
        error: `Ошибка при публикации: ${error.message}`,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Маршрут для проверки только сохранения URL
  app.post('/api/test/save-instagram-url', async (req: Request, res: Response) => {
    const { contentId, postUrl, messageId } = req.body;

    if (!contentId || !postUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Необходимо указать contentId и postUrl' 
      });
    }

    try {
      // 1. Сначала получаем системный токен
      log('1. Получение системного токена для запроса к Directus', 'instagram-test');
      const systemToken = await getSystemToken();
      
      if (!systemToken) {
        log('Ошибка: Не удалось получить системный токен', 'instagram-test');
        return res.status(500).json({
          success: false,
          error: 'Не удалось получить системный токен'
        });
      }
      
      log(`Токен получен успешно (первые 6 символов: ${systemToken.substring(0, 6)}...)`, 'instagram-test');
      
      // 2. Получаем текущее состояние контента
      log(`2. Получение текущего состояния контента ${contentId}`, 'instagram-test');
      const initialContent = await fetchContent(contentId, systemToken);
      
      if (!initialContent) {
        log(`Ошибка: Не удалось получить начальное состояние контента ${contentId}`, 'instagram-test');
        return res.status(404).json({
          success: false,
          error: 'Не удалось получить начальное состояние контента'
        });
      }
      
      log('Начальное состояние получено успешно', 'instagram-test');
      log(`Текущие платформы: ${Object.keys(initialContent.socialPlatforms || {}).join(', ')}`, 'instagram-test');
      
      // 3. Обновляем статус публикации с тестовым URL
      log('3. Обновление статуса публикации', 'instagram-test');
      const updatedContent = await socialPublishingWithImgurService.updatePublicationStatus(
        contentId,
        'instagram',
        {
          platform: 'instagram',
          status: 'published',
          publishedAt: new Date(),
          postUrl: postUrl,
          ...(messageId ? { messageId } : {})
        }
      );
      
      if (!updatedContent) {
        log('Ошибка: Не удалось обновить статус публикации', 'instagram-test');
        return res.status(500).json({
          success: false,
          error: 'Не удалось обновить статус публикации',
          initial: initialContent
        });
      }
      
      log('Статус публикации обновлен успешно', 'instagram-test');

      // 4. Получаем финальный контент для проверки
      log('4. Получение финального состояния контента', 'instagram-test');
      const finalContent = await fetchContent(contentId, systemToken);
      
      if (!finalContent) {
        log('Ошибка: Не удалось получить финальное состояние контента', 'instagram-test');
        return res.status(500).json({
          success: true,
          error: 'Не удалось получить финальное состояние контента',
          updatedContent: updatedContent,
          initial: initialContent
        });
      }
      
      log('Финальное состояние получено успешно', 'instagram-test');
      log(`Финальные платформы: ${Object.keys(finalContent.socialPlatforms || {}).join(', ')}`, 'instagram-test');
      
      // 5. Проверяем, что URL сохранился
      const instagramPlatform = finalContent.socialPlatforms?.instagram;
      log(`5. Результат проверки URL: ${instagramPlatform?.postUrl === postUrl ? 'УСПЕШНО' : 'ОШИБКА'}`, 'instagram-test');
      
      if (instagramPlatform?.postUrl === postUrl) {
        log(`URL ${postUrl} успешно сохранен для Instagram`, 'instagram-test');
      } else {
        log(`Ошибка: URL не сохранен. Ожидали: ${postUrl}, Получили: ${instagramPlatform?.postUrl || 'null'}`, 'instagram-test');
      }

      return res.json({
        success: true,
        updatedContent: updatedContent,
        finalContent: finalContent,
        socialPlatforms: finalContent?.socialPlatforms || {},
        instagram: finalContent?.socialPlatforms?.instagram || null
      });
    } catch (error: any) {
      log(`КРИТИЧЕСКАЯ ОШИБКА при сохранении URL: ${error.message}`, 'instagram-test');
      console.error('Ошибка при сохранении URL:', error);
      
      return res.status(500).json({
        success: false,
        error: `Ошибка при сохранении URL: ${error.message}`
      });
    }
  });

  // Тестовый маршрут для публикации сторис в Instagram
  app.post('/api/test/instagram-stories', async (req: Request, res: Response) => {
    const { contentId } = req.body;

    if (!contentId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Необходимо указать contentId' 
      });
    }

    log(`[Test Route] Тестовая публикация сторис в Instagram для контента: ${contentId}`, 'instagram-stories-test');

    try {
      // 1. Получаем системный токен
      const systemToken = await getSystemToken();
      
      if (!systemToken) {
        return res.status(500).json({
          success: false,
          error: 'Не удалось получить системный токен'
        });
      }

      // 2. Получаем данные контента из Directus
      const content = await fetchContent(contentId, systemToken);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          error: 'Не удалось найти контент'
        });
      }

      // 3. Получаем данные кампании для настроек соцсетей
      const campaign = await fetchCampaign(content.campaignId, systemToken);
      
      if (!campaign || !campaign.social_media_settings) {
        return res.status(404).json({
          success: false,
          error: 'Не удалось получить настройки социальных сетей'
        });
      }

      // 4. Подготавливаем социальные настройки
      const socialSettings = prepareSocialSettings(campaign) || {};
      
      // Проверяем наличие настроек Instagram
      if (!socialSettings.instagram) {
        log(`[Test Route] Ошибка: Не найдены настройки Instagram в кампании`, 'instagram-stories-test');
        
        // Добавляем заглушку для тестовых целей, чтобы обойти ошибку socialSettings is not defined
        socialSettings.instagram = {
          token: process.env.INSTAGRAM_TEST_TOKEN || null,
          accessToken: process.env.INSTAGRAM_TEST_TOKEN || null,
          businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || null
        };
        
        log(`[Test Route] Предупреждение: Используются тестовые настройки Instagram из переменных окружения`, 'instagram-stories-test');
      }

      // Логируем все возможные поля с медиафайлами для подробной диагностики
      const mediaFields = {
        id: content.id,
        campaignId: content.campaignId,
        contentType: content.contentType,
        status: content.status,
        title: content.title ? (content.title.length > 50 ? content.title.substring(0, 50) + '...' : content.title) : null,
        
        // Все доступные URL
        imageUrl: content.imageUrl,
        videoUrl: content.videoUrl,
        
        // Дополнительные изображения (camelCase)
        hasAdditionalImages: !!content.additionalImages && Array.isArray(content.additionalImages) && content.additionalImages.length > 0,
        additionalImagesLength: Array.isArray(content.additionalImages) ? content.additionalImages.length : 0,
        additionalImagesContent: Array.isArray(content.additionalImages) && content.additionalImages.length > 0 
          ? content.additionalImages.map(img => ({
              type: typeof img,
              isObject: typeof img === 'object',
              url: typeof img === 'object' ? img?.url || null : null,
              file: typeof img === 'object' ? img?.file || null : null,
              mediaType: typeof img === 'object' ? img?.type || null : null,
              value: typeof img === 'string' ? img : null
            }))
          : null,
        
        // Дополнительное медиа (camelCase)
        hasAdditionalMedia: !!content.additionalMedia && Array.isArray(content.additionalMedia) && content.additionalMedia.length > 0,
        additionalMediaLength: Array.isArray(content.additionalMedia) ? content.additionalMedia.length : 0,
        additionalMediaContent: Array.isArray(content.additionalMedia) && content.additionalMedia.length > 0
          ? content.additionalMedia.map(media => ({
              type: typeof media,
              isObject: typeof media === 'object',
              url: typeof media === 'object' ? media?.url || null : null,
              file: typeof media === 'object' ? media?.file || null : null,
              mediaType: typeof media === 'object' ? media?.type || null : null,
              value: typeof media === 'string' ? media : null
            }))
          : null,
        
        // Дополнительные изображения (snake_case)
        hasAdditionalImageWithUnderscore: !!content.additional_images && Array.isArray(content.additional_images) && content.additional_images.length > 0,
        additionalImagesWithUnderscoreLength: Array.isArray(content.additional_images) ? content.additional_images.length : 0,
        additionalImagesWithUnderscoreContent: Array.isArray(content.additional_images) && content.additional_images.length > 0
          ? content.additional_images.map(img => ({
              type: typeof img,
              isObject: typeof img === 'object',
              url: typeof img === 'object' ? img?.url || null : null,
              file: typeof img === 'object' ? img?.file || null : null,
              mediaType: typeof img === 'object' ? img?.type || null : null,
              value: typeof img === 'string' ? img : null
            }))
          : null,
        
        contentExcerpt: content.content ? content.content.substring(0, 100) + (content.content.length > 100 ? '...' : '') : null
      };
      
      log(`[Test Route] Медиа для сторис: ${JSON.stringify(mediaFields, null, 2)}`, 'instagram-stories-test');

      // 5. Получаем настройки Instagram
      if (!socialSettings.instagram) {
        return res.status(400).json({
          success: false,
          error: 'Отсутствуют настройки для Instagram',
          socialSettings
        });
      }

      // Проверяем и логируем настройки Instagram
      const instagramSettings = socialSettings.instagram;
      const instToken = instagramSettings.accessToken || instagramSettings.token;
      const businessId = instagramSettings.businessAccountId || instagramSettings.instagramBusinessId;
      
      if (!instToken || !businessId) {
        return res.status(400).json({
          success: false,
          error: 'Отсутствуют обязательные параметры Instagram API (token или businessAccountId)',
          token: !!instToken,
          businessId: !!businessId,
          settings: JSON.stringify({
            token: instToken ? 'Присутствует' : 'Отсутствует',
            businessId: businessId ? 'Присутствует' : 'Отсутствует'
          })
        });
      }

      // 6. Подготавливаем конфигурацию для публикации сторис
      const instagramConfig = {
        token: instToken,
        accessToken: instToken,
        businessAccountId: businessId
      };
      
      log(`[Test Route] Настройки Instagram для сторис: ${JSON.stringify({
        tokenLength: instToken ? instToken.length : 0,
        businessId: businessId
      })}`, 'instagram-stories-test');

      // Дополнительное логирование для проверки наличия медиа для публикации
      log(`[Test Route] Проверка наличия медиа для публикации:
        - imageUrl: ${content.imageUrl ? 'Да' : 'Нет'}
        - videoUrl: ${content.videoUrl ? 'Да' : 'Нет'}
        - additionalImages: ${Array.isArray(content.additionalImages) ? `Массив с ${content.additionalImages.length} элементами` : 'Нет'}
        - additional_images: ${Array.isArray(content.additional_images) ? `Массив с ${content.additional_images.length} элементами` : 'Нет'}
        - additionalMedia: ${Array.isArray(content.additionalMedia) ? `Массив с ${content.additionalMedia.length} элементами` : 'Нет'}
      `, 'instagram-stories-test');

      // 7. Публикуем сторис через сервис Instagram
      log(`[Test Route] Вызов instagramService.publishStory...`, 'instagram-stories-test');
      const result = await instagramService.publishStory(content, instagramConfig, socialSettings);
      log(`[Test Route] instagramService.publishStory вернул результат: ${JSON.stringify(result)}`, 'instagram-stories-test');
      
      log(`[Test Route] Результат публикации сторис в Instagram: ${JSON.stringify(result)}`, 'instagram-stories-test');

      // 8. Обновляем статус публикации
      if (result) {
        const updatedContent = await socialPublishingWithImgurService.updatePublicationStatus(
          contentId,
          'instagram',
          result
        );

        // 9. Получаем финальный контент для проверки
        const finalContent = await fetchContent(contentId, systemToken);

        return res.json({
          success: true,
          publication: result,
          updatedContent: updatedContent,
          finalContent: finalContent,
          socialPlatforms: finalContent?.socialPlatforms || {},
          instagram: finalContent?.socialPlatforms?.instagram || null
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Публикация не вернула результат'
        });
      }
    } catch (error: any) {
      console.error('Ошибка в тестовом маршруте Instagram Stories:', error);
      
      return res.status(500).json({
        success: false,
        error: `Ошибка при публикации сторис: ${error.message}`,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  console.log('Тестовый маршрут для Instagram зарегистрирован');
}

// Вспомогательные функции
async function getSystemToken(): Promise<string | null> {
  try {
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL;
    const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD;
    
    if (!adminEmail || !adminPassword) {
      log('Отсутствуют учетные данные администратора для Directus', 'auth');
      return null;
    }
    
    const response = await axios.post(`${directusUrl}/auth/login`, {
      email: adminEmail,
      password: adminPassword
    });
    
    if (response?.data?.data?.access_token) {
      return response.data.data.access_token;
    }
    
    return null;
  } catch (error: any) {
    log(`Ошибка при получении системного токена: ${error.message}`, 'auth');
    return null;
  }
}

async function fetchContent(contentId: string, token: string): Promise<CampaignContent | null> {
  try {
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    
    const response = await axios.get(`${directusUrl}/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response?.data?.data) {
      return null;
    }
    
    const directusItem = response.data.data;
    
    // Преобразуем Directus формат в наш внутренний формат
    const content: CampaignContent = {
      id: directusItem.id,
      userId: directusItem.user_id,
      campaignId: directusItem.campaign_id,
      title: directusItem.title,
      content: directusItem.content,
      contentType: directusItem.content_type,
      imageUrl: directusItem.image_url,
      videoUrl: directusItem.video_url,
      additionalImages: directusItem.additional_images || null,
      additionalMedia: directusItem.additional_media || null,
      status: directusItem.status,
      prompt: directusItem.prompt || null,
      keywords: directusItem.keywords || [],
      hashtags: directusItem.hashtags || [],
      links: directusItem.links || [],
      createdAt: directusItem.date_created ? new Date(directusItem.date_created) : null,
      publishedAt: directusItem.published_at ? new Date(directusItem.published_at) : null,
      scheduledAt: directusItem.scheduled_at ? new Date(directusItem.scheduled_at) : null,
      socialPlatforms: parseSocialPlatforms(directusItem.social_platforms),
      metadata: directusItem.metadata || {}
    };
    
    return content;
  } catch (error: any) {
    log(`Ошибка при получении контента: ${error.message}`, 'fetch-content');
    return null;
  }
}

async function fetchCampaign(campaignId: string, token: string): Promise<any | null> {
  try {
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    
    const response = await axios.get(`${directusUrl}/items/user_campaigns/${campaignId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response?.data?.data) {
      return null;
    }
    
    return response.data.data;
  } catch (error: any) {
    log(`Ошибка при получении кампании: ${error.message}`, 'fetch-campaign');
    return null;
  }
}

function parseSocialPlatforms(data: any): Record<string, any> {
  if (!data) {
    return {};
  }
  
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }
  
  if (typeof data === 'object') {
    return data;
  }
  
  return {};
}

function prepareSocialSettings(campaign: any): any {
  const settings: any = {};

  // Обработка настроек соцсетей
  try {
    if (campaign.social_media_settings) {
      let socialSettings;
      
      if (typeof campaign.social_media_settings === 'string') {
        socialSettings = JSON.parse(campaign.social_media_settings);
      } else {
        socialSettings = campaign.social_media_settings;
      }
      
      // Передаем все настройки соцсетей
      if (socialSettings.telegram) {
        settings.telegram = socialSettings.telegram;
      }
      
      if (socialSettings.instagram) {
        settings.instagram = socialSettings.instagram;
      }
      
      if (socialSettings.vk) {
        settings.vk = socialSettings.vk;
      }
      
      if (socialSettings.facebook) {
        settings.facebook = socialSettings.facebook;
      }
    }
  } catch (error) {
    log(`Ошибка при подготовке настроек соцсетей: ${error}`, 'social-settings');
  }
  
  // Резервное использование системных настроек
  const socialNetworks = process.env.SOCIAL_NETWORKS;
  
  if (socialNetworks) {
    try {
      const networksConfig = JSON.parse(socialNetworks);
      
      if (!settings.telegram && networksConfig.telegram) {
        settings.telegram = networksConfig.telegram;
      }
      
      if (!settings.instagram && networksConfig.instagram) {
        settings.instagram = networksConfig.instagram;
      }
      
      if (!settings.vk && networksConfig.vk) {
        settings.vk = networksConfig.vk;
      }
      
      if (!settings.facebook && networksConfig.facebook) {
        settings.facebook = networksConfig.facebook;
      }
    } catch (error) {
      log(`Ошибка при парсинге SOCIAL_NETWORKS: ${error}`, 'social-settings');
    }
  }
  
  return settings;
}