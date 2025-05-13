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
    // Получаем токен администратора
    const adminToken = await directusCrud.getToken();
    
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

/**
 * Маршрут для проверки и исправления всех запланированных публикаций
 * 
 * @route GET /api/scheduler/check-all-scheduled
 */
router.get('/check-all-scheduled', async (req: Request, res: Response) => {
  try {
    console.log(`[DEBUG] Запущена проверка ВСЕХ запланированных публикаций`);
    
    // Получаем токен администратора
    const adminToken = await directusCrud.getToken();
    
    if (!adminToken) {
      console.log(`[DEBUG] Не удалось получить токен администратора`);
      return res.status(500).json({ error: 'Не удалось получить токен администратора' });
    }
    
    console.log(`[DEBUG] Успешно получен токен администратора`);
    
    // Получаем текущую дату/время
    const now = new Date();
    
    // Получаем все запланированные публикации (со статусом scheduled и draft+pending)
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    
    // Проверяем публикации со статусом scheduled
    console.log(`[DEBUG] Поиск публикаций со статусом 'scheduled'...`);
    const scheduledResponse = await axios.get(`${directusUrl}/items/campaign_content`, {
      params: {
        filter: {
          status: {
            _eq: 'scheduled'
          },
          scheduled_at: {
            _gt: now.toISOString()
          }
        },
        limit: 100
      },
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    // Публикации со статусом draft, имеющие платформы в статусе pending
    console.log(`[DEBUG] Поиск публикаций со статусом 'draft' и платформами в статусе 'pending'...`);
    const draftPendingResponse = await axios.get(`${directusUrl}/items/campaign_content`, {
      params: {
        filter: {
          status: {
            _eq: 'draft'
          }
        },
        limit: 100
      },
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    // Объединяем результаты
    const scheduledItems = scheduledResponse.data.data || [];
    const draftItems = draftPendingResponse.data.data || [];
    
    // Отфильтруем публикации draft, у которых есть платформы в статусе pending
    const draftWithPendingPlatforms = draftItems.filter((item: any) => {
      const platforms = item.social_platforms || {};
      return Object.values(platforms).some((platform: any) => 
        platform && typeof platform === 'object' && platform.status === 'pending'
      );
    });
    
    const allScheduledItems = [...scheduledItems, ...draftWithPendingPlatforms];
    
    console.log(`[DEBUG] Найдено ${scheduledItems.length} публикаций со статусом 'scheduled'`);
    console.log(`[DEBUG] Найдено ${draftWithPendingPlatforms.length} публикаций со статусом 'draft' и платформами 'pending'`);
    console.log(`[DEBUG] Всего публикаций для проверки: ${allScheduledItems.length}`);
    
    if (allScheduledItems.length === 0) {
      return res.json({
        success: true,
        message: 'Запланированные публикации не найдены',
        itemsCount: 0
      });
    }
    
    // Проверяем каждую публикацию
    const results = [];
    const fixedItems = [];
    
    for (const item of allScheduledItems) {
      const itemId = item.id;
      const title = item.title;
      const scheduledTime = item.scheduled_at ? new Date(item.scheduled_at) : null;
      const isScheduledForFuture = scheduledTime && scheduledTime > now;
      
      console.log(`[DEBUG] Проверка контента "${title}" (ID: ${itemId})`);
      console.log(`[DEBUG] Запланировано на: ${scheduledTime ? scheduledTime.toISOString() : 'не указано'}`);
      console.log(`[DEBUG] Запланирован на будущее: ${isScheduledForFuture ? 'ДА' : 'НЕТ'}`);
      
      // Анализируем статусы платформ
      const socialPlatforms = item.social_platforms || {};
      const problemPlatforms = [];
      
      // Если контент запланирован на будущее, проверяем на несоответствия
      if (isScheduledForFuture) {
        for (const [platform, data] of Object.entries(socialPlatforms)) {
          if (data && typeof data === 'object' && (data as any).status === 'published') {
            problemPlatforms.push(platform);
            console.log(`[DEBUG] ПРОБЛЕМА: Платформа ${platform} имеет статус 'published', хотя публикация запланирована на будущее`);
          }
        }
        
        if (problemPlatforms.length > 0) {
          console.log(`[DEBUG] Найдено ${problemPlatforms.length} проблемных платформ для контента ${itemId}: ${problemPlatforms.join(', ')}`);
          
          // Исправляем статусы проблемных платформ
          const fixedPlatforms = {...socialPlatforms};
          for (const platform of problemPlatforms) {
            if (fixedPlatforms[platform]) {
              (fixedPlatforms[platform] as any).status = 'pending';
            }
          }
          
          // Обновляем данные в Directus
          await axios.patch(`${directusUrl}/items/campaign_content/${itemId}`, {
            social_platforms: fixedPlatforms
          }, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
          });
          
          console.log(`[DEBUG] Статусы платформ успешно исправлены для контента ${itemId}`);
          fixedItems.push({
            id: itemId,
            title,
            problemPlatforms,
            scheduledTime: scheduledTime ? scheduledTime.toISOString() : null
          });
        }
        
        results.push({
          id: itemId,
          title,
          scheduledTime: scheduledTime ? scheduledTime.toISOString() : null,
          problemPlatforms,
          fixed: problemPlatforms.length > 0
        });
      }
    }
    
    return res.json({
      success: true,
      message: `Проверка завершена. Исправлено ${fixedItems.length} из ${allScheduledItems.length} публикаций`,
      itemsChecked: allScheduledItems.length,
      itemsFixed: fixedItems.length,
      fixedItems,
      details: results
    });
  } catch (error: any) {
    console.error(`[DEBUG ERROR] ${error.message || error}`);
    return res.status(500).json({ 
      error: 'Ошибка при проверке запланированных публикаций', 
      message: error.message || String(error) 
    });
  }
});

// Экспортируем функцию для регистрации маршрутов
export function registerSchedulerDebugRoutes(app: express.Express) {
  app.use('/api/scheduler', router);
  console.log('Scheduler debug routes registered');
}