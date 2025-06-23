/**
 * API маршруты для работы с контентом кампаний
 * Сохранение видео и других типов контента в campaign_content
 */
import { Router, Request, Response, NextFunction } from 'express';
import { directusCrud } from '../services/directus-crud';
import { directusApiManager } from '../directus';
import { log } from '../utils/logger';
import axios from 'axios';

// Копируем рабочий authenticateUser из routes.ts
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Токен авторизации не найден' 
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
      const finalUrl = directusUrl.endsWith('/') ? directusUrl : directusUrl + '/';
      
      const response = await axios.get(`${finalUrl}users/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 10000
      });
      
      if (response.data?.data?.id) {
        (req as any).userId = response.data.data.id;
        (req as any).userToken = token;
        next();
      } else {
        return res.status(401).json({ error: 'Недействительный токен' });
      }
    } catch (error: any) {
      return res.status(401).json({ 
        error: 'Ошибка проверки токена',
        details: error.response?.data || error.message 
      });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Ошибка аутентификации' });
  }
};

const router = Router();
const logPrefix = 'campaign-content-api';

// Создание нового контента в кампании
router.post('/', authenticateUser, async (req, res) => {
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

    // Используем userId и userToken из authenticateUser middleware
    const userId = (req as any).userId;
    const userToken = (req as any).userToken;
    
    log(`Creating content for user: ${userId}, token present: ${userToken ? 'yes' : 'no'}`, logPrefix);
    
    // Заменяем "authenticated-user" на реальный userId
    contentData.user_created = userId;
    
    const result = await directusCrud.create('campaign_content', contentData, {
      authToken: userToken
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
router.get('/:campaignId', authenticateUser, async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    log(`Fetching content for campaign: ${campaignId}`, logPrefix);

    // Используем токен пользователя как в других маршрутах  
    const userToken = (req as any).userToken;
    const result = await directusCrud.list('campaign_content', {
      filter: { campaign_id: { _eq: campaignId } },
      sort: ['-date_created']
    }, {
      authToken: userToken
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
router.patch('/:contentId', authenticateUser, async (req, res) => {
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
router.delete('/:contentId', authenticateUser, async (req, res) => {
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