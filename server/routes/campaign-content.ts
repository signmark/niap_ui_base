/**
 * API маршруты для работы с контентом кампаний
 * Сохранение видео и других типов контента в campaign_content
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { directusApiManager } from '../directus';
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

    // Сохраняем в Directus
    const result = await directusApiManager.createRecord('campaign_content', contentData);

    if (result.success) {
      log(`Campaign content created successfully: ${result.data.id}`, logPrefix);
      res.json({
        success: true,
        data: result.data,
        message: 'Контент кампании успешно создан'
      });
    } else {
      log(`Error creating campaign content: ${result.error}`, logPrefix);
      res.status(500).json({
        success: false,
        error: result.error || 'Ошибка создания контента'
      });
    }
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

    const result = await directusApiManager.getRecords('campaign_content', {
      filter: { campaign_id: { _eq: campaignId } },
      sort: ['-date_created']
    });

    if (result.success) {
      res.json({
        success: true,
        data: result.data || []
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Ошибка получения контента'
      });
    }
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