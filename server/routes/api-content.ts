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
    let token: string | null = null;
    try {
      // Получаем административный токен
      const adminSession = await directusAuthManager.getAdminSession();
      if (adminSession) {
        token = adminSession.token;
        log(`Получен административный токен для запроса данных контента`);
      }
    } catch (authError) {
      log(`Ошибка при получении административного токена: ${authError instanceof Error ? authError.message : String(authError)}`);
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Не удалось получить токен авторизации'
      });
    }
    
    // Получаем данные контента через DirectusCrud
    try {
      // Используем getById метод из DirectusCrud, который уже работает в других частях системы
      const contentData = await directusCrud.getById('campaign_content', contentId, { authToken: token });
      
      // Если данные успешно получены, формируем ответ
      if (contentData) {
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
      } else {
        return res.status(404).json({
          success: false,
          error: 'Контент не найден'
        });
      }
    } catch (apiError: any) {
      log(`Ошибка API при получении данных контента: ${apiError.message}`);
      if (apiError.response) {
        log(`Статус ошибки: ${apiError.response.status}`);
        if (apiError.response.data) {
          log(`Данные ошибки: ${JSON.stringify(apiError.response.data)}`);
        }
      }
      
      return res.status(500).json({
        success: false,
        error: 'Ошибка при получении данных контента через API'
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