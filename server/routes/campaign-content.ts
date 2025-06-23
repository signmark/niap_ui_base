/**
 * API маршруты для работы с контентом кампаний
 * Сохранение видео и других типов контента в campaign_content
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { directusCrud } from '../services/directus-crud';
import { log } from '../utils/logger';

const router = Router();
const logPrefix = 'campaign-content-api';

// Создание нового контента в кампании
router.post('/', authMiddleware, async (req, res) => {
  try {
    log(`Creating campaign content`, logPrefix);
    const {
      campaign_id,
      content_type,
      text_content,
      video_url,
      thumbnail_url,
      platforms,
      scheduled_time,
      metadata,
      status = 'draft'
    } = req.body;

    // Проверяем обязательные поля
    if (!campaign_id || !content_type) {
      return res.status(400).json({
        success: false,
        error: 'campaign_id и content_type обязательны'
      });
    }

    // Подготавливаем данные для сохранения
    const contentData = {
      campaign_id,
      content_type,
      text_content: text_content || '',
      video_url: video_url || null,
      thumbnail_url: thumbnail_url || null,
      platforms: typeof platforms === 'string' ? platforms : JSON.stringify(platforms || {}),
      scheduled_time: scheduled_time || null,
      metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {}),
      status,
      user_created: req.user?.id
    };

    log(`Saving content data: ${JSON.stringify(contentData)}`, logPrefix);

    // Сохраняем в Directus через CRUD сервис с админскими правами
    const result = await directusCrud.create('campaign_content', contentData, {
      authToken: null // Принудительно используем админский токен
    });
    
    log(`Campaign content created successfully: ${JSON.stringify(result)}`, logPrefix);
    res.json({
      success: true,
      data: result,
      message: 'Контент кампании успешно создан'
    });
  } catch (error) {
    log(`Exception in campaign content creation: ${(error as Error).message}`, logPrefix);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Получение контента кампании
router.get('/:campaignId', authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    log(`Fetching content for campaign: ${campaignId}`, logPrefix);

    const result = await directusCrud.list('campaign_content', {
      filter: { campaign_id: { _eq: campaignId } },
      sort: ['-date_created']
    }, {
      authToken: null // Принудительно используем админский токен
    });

    res.json({
      success: true,
      data: result || []
    });
  } catch (error) {
    log(`Exception in campaign content fetch: ${(error as Error).message}`, logPrefix);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Обновление контента
router.patch('/:contentId', authMiddleware, async (req, res) => {
  try {
    const { contentId } = req.params;
    const updateData = req.body;

    log(`Updating campaign content: ${contentId}`, logPrefix);

    const result = await directusApiManager.updateRecord('campaign_content', contentId, updateData);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: 'Контент успешно обновлен'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Ошибка обновления контента'
      });
    }
  } catch (error) {
    log(`Exception in campaign content update: ${(error as Error).message}`, logPrefix);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Удаление контента
router.delete('/:contentId', authMiddleware, async (req, res) => {
  try {
    const { contentId } = req.params;

    log(`Deleting campaign content: ${contentId}`, logPrefix);

    const result = await directusApiManager.deleteRecord('campaign_content', contentId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Контент успешно удален'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Ошибка удаления контента'
      });
    }
  } catch (error) {
    log(`Exception in campaign content deletion: ${(error as Error).message}`, logPrefix);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

export default router;