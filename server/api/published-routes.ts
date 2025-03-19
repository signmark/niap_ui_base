import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { directusAuthManager } from '../services/directus-auth-manager';
import { log } from '../utils/logger';

/**
 * Регистрирует маршруты для работы с опубликованным контентом
 * @param router Экземпляр роутера Express
 */
export function registerPublishedRoutes(router: Router): void {
  console.log('[express] Регистрация маршрутов для работы с опубликованным контентом...');

  /**
   * Получение опубликованного контента для отображения в календаре
   * Поддерживает фильтрацию по кампании и диапазону дат
   */
  router.get('/published', async (req: Request, res: Response) => {
  try {
    const { campaignId, startDate, endDate } = req.query;
    const userId = req.headers['x-user-id'] as string;
    const authToken = req.headers.authorization?.split(' ')[1];
    
    if (!userId && !authToken) {
      return res.status(401).json({ 
        error: 'Не авторизован: Отсутствует заголовок авторизации или идентификатор пользователя' 
      });
    }
    
    // Если передан authToken, но нет userId, получаем ID пользователя из токена
    let userIdToUse = userId;
    if (!userIdToUse && authToken) {
      const session = Object.values(directusAuthManager['sessionCache']).find(
        s => s.token === authToken
      );
      
      if (session) {
        userIdToUse = session.userId;
      }
    }
    
    if (!userIdToUse) {
      return res.status(401).json({
        error: 'Не удалось определить идентификатор пользователя'
      });
    }
    
    // Получаем опубликованный контент
    const publishedContent = await storage.getPublishedContent(
      userIdToUse,
      campaignId as string | undefined
    );
    
    // Фильтруем по дате, если указаны параметры
    let filteredContent = publishedContent;
    
    if (startDate || endDate) {
      filteredContent = publishedContent.filter(item => {
        if (!item.publishedAt) return false;
        
        const itemDate = new Date(item.publishedAt);
        
        if (startDate && new Date(startDate as string) > itemDate) {
          return false;
        }
        
        if (endDate && new Date(endDate as string) < itemDate) {
          return false;
        }
        
        return true;
      });
    }
    
    // Логируем результаты
    log(`Найдено ${filteredContent.length} опубликованных элементов контента для пользователя ${userIdToUse}`);
    
    return res.status(200).json({
      data: filteredContent
    });
  } catch (error) {
    console.error('Ошибка при получении опубликованного контента:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка сервера при получении опубликованного контента'
    });
  }
});
}