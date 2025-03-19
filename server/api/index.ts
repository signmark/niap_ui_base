import { Router } from 'express';
import publishedRoutes from './published-routes';
import { registerPublishingRoutes } from './publishing-routes';

/**
 * Создает и регистрирует все API маршруты
 * @returns Экземпляр роутера Express с зарегистрированными маршрутами
 */
export function createApiRouter(): Router {
  const router = Router();
  
  // Регистрируем маршруты для публикации контента
  registerPublishingRoutes(router);
  
  // Регистрируем маршруты для работы с опубликованным контентом
  router.use(publishedRoutes);
  
  return router;
}