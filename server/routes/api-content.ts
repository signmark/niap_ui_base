/**
 * Маршруты для работы с контентом
 */
import express from 'express';
import { directusAuthManager } from '../services/directus-auth-manager';
import { directusApi } from '../lib/directus';
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
    
    // Пробуем получить свежий административный токен
    try {
      // Обновляем токен авторизации администратора, чтобы гарантировать, что он не истёк
      // Принудительно получаем новую сессию, игнорируя кэш
      await directusAuthManager.refreshAdminAuth();
      log(`Принудительно обновлен токен авторизации администратора`);
      
      const adminSession = await directusAuthManager.getAdminSession();
      if (!adminSession || !adminSession.token) {
        throw new Error('Не удалось получить токен авторизации после обновления');
      }
      
      // Теперь используем свежий токен для запроса данных
      log(`Используем свежий токен для запроса данных контента`);
      const response = await directusApi.get(`/items/campaign_content/${contentId}`, {
        headers: { 'Authorization': `Bearer ${adminSession.token}` }
      });
      
      // Проверяем ответ
      if (!response.data || !response.data.data) {
        return res.status(404).json({
          success: false,
          error: 'Контент не найден'
        });
      }
      
      const contentData: any = response.data.data;
      log(`Данные контента успешно получены: ${contentId}`);
      
      // Возвращаем только необходимые поля для генерации изображений
      return res.json({
        success: true,
        data: {
          id: contentData.id,
          title: contentData.title, 
          content: contentData.content,
          prompt: contentData.prompt,
          imageUrl: contentData.image_url || contentData.imageUrl,
          contentType: contentData.content_type || contentData.contentType
        }
      });
    } catch (directusError: any) {
      log(`Ошибка при работе с Directus API: ${directusError.message}`);
      if (directusError.response) {
        log(`Статус ошибки: ${directusError.response.status}`);
        if (directusError.response.data) {
          log(`Данные ошибки: ${JSON.stringify(directusError.response.data)}`);
        }
      }
      
      return res.status(500).json({
        success: false,
        error: 'Ошибка при получении данных контента через API',
        details: directusError.message
      });
    }
  } catch (error) {
    log(`Ошибка при получении данных контента: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при получении данных контента'
    });
  }
});

export default router;