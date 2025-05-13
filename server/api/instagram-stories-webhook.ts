import { Router, Request, Response } from 'express';
import axios from 'axios';
import { log } from '../utils/logger';
import { directusApiManager } from '../directus';

const router = Router();

/**
 * Обработчик для публикации Instagram Stories через n8n webhook
 * POST /api/instagram-stories-webhook
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { contentId } = req.body;

    if (!contentId) {
      log(`Ошибка: отсутствует ID контента в запросе на публикацию Instagram Stories`, 'instagram-webhook');
      return res.status(400).json({
        success: false,
        error: 'Отсутствует ID контента в запросе'
      });
    }

    log(`Запрос на публикацию Instagram Stories для контента ${contentId}`, 'instagram-webhook');

    // Загружаем данные контента из Directus
    // Сначала авторизуемся в Directus
    const directusEmail = process.env.DIRECTUS_EMAIL || 'lbrspb@gmail.com';
    const directusPassword = process.env.DIRECTUS_PASSWORD;
    
    try {
      // Выполняем авторизацию
      const authResponse = await directusApiManager.post('/auth/login', {
        email: directusEmail,
        password: directusPassword
      });
      
      if (!authResponse.data || !authResponse.data.data || !authResponse.data.data.access_token) {
        log(`Ошибка авторизации в Directus: ${JSON.stringify(authResponse.data)}`, 'instagram-webhook');
        return res.status(500).json({
          success: false,
          error: 'Ошибка авторизации в Directus'
        });
      }
      
      const accessToken = authResponse.data.data.access_token;
      
      // Теперь используем токен для запроса данных контента
      try {
        const directusResponse = await directusApiManager.get(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        // Полный лог ответа от Directus для отладки
        log(`Структура ответа от Directus: ${JSON.stringify(Object.keys(directusResponse))}`, 'instagram-webhook');
        log(`Структура directusResponse.data: ${JSON.stringify(directusResponse.data ? Object.keys(directusResponse.data) : 'нет данных')}`, 'instagram-webhook');
        
        if (!directusResponse.data) {
          log(`Пустой ответ от Directus API: ${JSON.stringify(directusResponse)}`, 'instagram-webhook');
          throw new Error('Пустой ответ от Directus API');
        }
        
        const contentData = directusResponse.data.data;
        
        // Дополнительный лог для отладки
        log(`Получены данные контента: ${JSON.stringify(contentData)}`, 'instagram-webhook');
      } catch (error: any) {
        log(`Ошибка при получении данных из Directus: ${error.message}`, 'instagram-webhook');
        return res.status(500).json({
          success: false,
          error: `Ошибка при получении данных из Directus: ${error.message}`
        });
      }
      
      // Используем переменную из внешнего контекста
      const contentData = directusResponse.data.data;
      
      if (!contentData) {
        log(`Ошибка: не удалось найти контент с ID ${contentId}`, 'instagram-webhook');
        return res.status(404).json({
          success: false,
          error: `Контент с ID ${contentId} не найден`
        });
      }

      // Проверяем тип контента
      if (contentData.contentType !== 'stories') {
        log(`Ошибка: неверный тип контента для Instagram Stories: ${contentData.contentType}`, 'instagram-webhook');
        return res.status(400).json({
          success: false,
          error: `Неверный тип контента для Instagram Stories: ${contentData.contentType}`
        });
      }

      // Проверяем наличие изображений или видео
      if (!contentData.imageUrl && !contentData.videoUrl && 
          (!contentData.additionalImages || contentData.additionalImages.length === 0)) {
        log(`Ошибка: отсутствуют медиа-файлы для публикации Instagram Stories`, 'instagram-webhook');
        return res.status(400).json({
          success: false,
          error: 'Для Instagram Stories необходимо изображение или видео'
        });
      }

      // Адрес webhook для n8n
      const n8nWebhookUrl = process.env.INSTAGRAM_STORIES_WEBHOOK_URL || 'https://n8n.nplanner.ru/webhook-test/publish-instagram-stories';
      
      // Подготавливаем данные для отправки в n8n
      const dataForN8n = {
        contentId,
        title: contentData.title,
        content: contentData.content,
        imageUrl: contentData.imageUrl,
        additionalImages: contentData.additionalImages || [],
        videoUrl: contentData.videoUrl,
        additionalVideos: contentData.additionalVideos || [],
        metadata: contentData.metadata || {},
        campaignId: contentData.campaignId,
        // Добавляем дополнительные поля для n8n
        requestTimestamp: Date.now(),
        source: 'smm-manager'
      };

      // Отправляем данные на webhook
      log(`Отправка данных на n8n webhook: ${n8nWebhookUrl}`, 'instagram-webhook');
      const webhookResponse = await axios.post(n8nWebhookUrl, dataForN8n);

      if (webhookResponse.status >= 200 && webhookResponse.status < 300) {
        log(`Данные успешно отправлены на n8n webhook, ответ: ${JSON.stringify(webhookResponse.data)}`, 'instagram-webhook');
        
        // Обновляем статус публикации в Directus
        const socialPublications = contentData.socialPublications || {};
        const now = new Date().toISOString();
        
        // Добавляем или обновляем статус публикации для Instagram
        socialPublications.instagram = {
          platform: 'instagram',
          status: 'pending',
          message: 'Контент отправлен на публикацию в Instagram Stories',
          requestedAt: now,
          publishedAt: null,
          url: null
        };

        // Обновляем данные в Directus
        await directusApiManager.post(`/items/campaign_content/${contentId}`, {
          socialPublications
        });

        return res.json({
          success: true,
          message: 'Запрос на публикацию Instagram Stories отправлен успешно',
          result: {
            platform: 'instagram',
            status: 'pending',
            publishedAt: null,
            message: 'Запрос на публикацию Instagram Stories отправлен'
          }
        });
      } else {
        log(`Ошибка при отправке данных на n8n webhook: ${webhookResponse.status} ${webhookResponse.statusText}`, 'instagram-webhook');
        return res.status(500).json({
          success: false,
          error: `Ошибка при отправке данных на n8n webhook: ${webhookResponse.status} ${webhookResponse.statusText}`
        });
      }
    } catch (error: any) {
      log(`Ошибка при обращении к Directus API: ${error.message}`, 'instagram-webhook');
      return res.status(500).json({
        success: false,
        error: `Ошибка при обращении к Directus API: ${error.message}`
      });
    }
  } catch (error: any) {
    log(`Исключение при обработке запроса на публикацию Instagram Stories: ${error.message}`, 'instagram-webhook');
    console.error('Error publishing Instagram Stories:', error);
    
    return res.status(500).json({
      success: false,
      error: `Ошибка при публикации Instagram Stories: ${error.message}`
    });
  }
});

export default router;