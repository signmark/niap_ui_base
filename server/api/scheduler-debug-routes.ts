/**
 * Маршруты для отладки планировщика публикаций
 */
import express, { Request, Response } from 'express';
import axios from 'axios';
import { directusCrud } from '../services/directus-crud';

// Создаем новый роутер
const router = express.Router();

/**
 * Специальный маршрут для проверки и исправления статусов будущих публикаций
 * 
 * @route GET /api/scheduler/debug/:contentId
 */
router.get('/debug/:contentId', async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;
    if (!contentId) {
      return res.status(400).json({ error: 'Не указан ID контента' });
    }
    
    console.log(`[DEBUG] Запрос специальной проверки статуса для контента ${contentId}`);

    // Авторизуемся как администратор через DirectusCrud
    const adminToken = await directusCrud.getAdminToken();
    
    if (!adminToken) {
      console.log(`[DEBUG] Не удалось получить токен администратора`);
      return res.status(500).json({ error: 'Не удалось получить токен администратора' });
    }
    
    console.log(`[DEBUG] Успешно получен токен администратора`);
    
    // Получаем данные контента
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    const contentResponse = await axios.get(`${directusUrl}/items/campaign_content/${contentId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const contentData = contentResponse.data.data;
    console.log(`[DEBUG] Получены данные контента "${contentData.title}" (статус: ${contentData.status})`);
    
    // Проверяем, запланирован ли контент на будущее время
    const now = new Date();
    const scheduledTime = contentData.scheduled_at ? new Date(contentData.scheduled_at) : null;
    const isScheduledForFuture = scheduledTime && scheduledTime > now;
    
    console.log(`[DEBUG] Текущее время: ${now.toISOString()}`);
    console.log(`[DEBUG] Запланированное время: ${scheduledTime ? scheduledTime.toISOString() : 'не указано'}`);
    console.log(`[DEBUG] Запланирован на будущее: ${isScheduledForFuture ? 'ДА' : 'НЕТ'}`);
    
    // Анализируем статусы платформ
    const socialPlatforms = contentData.social_platforms || {};
    console.log(`[DEBUG] Данные платформ: ${JSON.stringify(socialPlatforms)}`);
    
    const problemPlatforms = [];
    
    // Если контент запланирован на будущее, проверяем на несоответствия
    if (isScheduledForFuture) {
      for (const [platform, data] of Object.entries(socialPlatforms)) {
        if (data && data.status === 'published') {
          problemPlatforms.push(platform);
          console.log(`[DEBUG] ПРОБЛЕМА: Платформа ${platform} имеет статус 'published', хотя публикация запланирована на будущее`);
        }
      }
      
      if (problemPlatforms.length > 0) {
        console.log(`[DEBUG] Найдено ${problemPlatforms.length} проблемных платформ: ${problemPlatforms.join(', ')}`);
        
        // Исправляем статусы проблемных платформ
        const fixedPlatforms = {...socialPlatforms};
        for (const platform of problemPlatforms) {
          if (fixedPlatforms[platform]) {
            fixedPlatforms[platform].status = 'pending';
          }
        }
        
        console.log(`[DEBUG] Исправленные данные платформ: ${JSON.stringify(fixedPlatforms)}`);
        
        // Обновляем данные в Directus
        await axios.patch(`${directusUrl}/items/campaign_content/${contentId}`, {
          social_platforms: fixedPlatforms
        }, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        console.log(`[DEBUG] Статусы платформ успешно исправлены`);
        
        return res.json({
          success: true,
          message: 'Обнаружены и исправлены проблемы со статусами платформ',
          contentId,
          problemPlatforms,
          isScheduledForFuture,
          currentTime: now.toISOString(),
          scheduledTime: scheduledTime ? scheduledTime.toISOString() : null
        });
      } else {
        console.log(`[DEBUG] Проблемы со статусами платформ не обнаружены`);
        return res.json({
          success: true,
          message: 'Проблемы со статусами платформ не обнаружены',
          contentId,
          isScheduledForFuture,
          currentTime: now.toISOString(),
          scheduledTime: scheduledTime ? scheduledTime.toISOString() : null
        });
      }
    } else {
      console.log(`[DEBUG] Контент не запланирован на будущее, проверка не требуется`);
      return res.json({
        success: true,
        message: 'Контент не запланирован на будущее, проверка не требуется',
        contentId,
        isScheduledForFuture,
        currentTime: now.toISOString(),
        scheduledTime: scheduledTime ? scheduledTime.toISOString() : null
      });
    }
  } catch (error) {
    console.error(`[DEBUG ERROR] ${error}`);
    return res.status(500).json({ error: 'Ошибка при проверке статуса', message: error.message });
  }
});

// Экспортируем функцию для регистрации маршрутов
export function registerSchedulerDebugRoutes(app: express.Express) {
  app.use('/api/scheduler', router);
  console.log('Scheduler debug routes registered');
}