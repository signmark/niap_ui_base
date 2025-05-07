/**
 * Маршруты для работы с контентом
 */
import express from 'express';
import { directusAuthManager } from '../services/directus-auth-manager';
import { directusCrud } from '../services/directus-crud';
import { log } from '../utils/logger';

const router = express.Router();

/**
 * Получение данных контента по ID
 */
router.get('/content/:id', async (req, res) => {
  try {
    const contentId = req.params.id;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'ID контента не указан'
      });
    }
    
    log(`Запрос данных контента по ID: ${contentId}`);
    
    // Используем токен из сессии или административный токен
    // Пробуем извлечь токен из заголовка Authorization
    let token: string | null = null;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Пробуем получить админский токен
      const adminSession = await directusAuthManager.getAdminSession();
      if (adminSession?.token) {
        token = adminSession.token;
      }
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Не авторизован'
      });
    }
    
    // Получаем данные контента через Directus API
    const contentData = await directusCrud.read('campaign_content', contentId, token);
    
    if (!contentData) {
      return res.status(404).json({
        success: false,
        error: 'Контент не найден'
      });
    }
    
    log(`Данные контента успешно получены: ${contentId}`);
    
    // Возвращаем только необходимые поля для генерации изображений
    return res.json({
      success: true,
      data: {
        id: contentData.id,
        title: contentData.title,
        content: contentData.content,
        prompt: contentData.prompt,
        imageUrl: contentData.imageUrl,
        contentType: contentData.contentType
      }
    });
  } catch (error) {
    log(`Ошибка при получении данных контента: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при получении данных контента'
    });
  }
});

export default router;