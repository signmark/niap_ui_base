import express from 'express';
import publishingRoutes from './routes-publishing';
import { logger } from './utils/logger';

/**
 * Регистрирует маршруты для публикации в социальные сети
 * 
 * @param app Экземпляр приложения Express
 */
export function registerPublishingRoutes(app: express.Express): void {
  logger.info('[Publishing] Регистрация маршрутов для публикации контента');
  
  // Подключаем маршруты для публикации с префиксом /api
  app.use('/api', publishingRoutes);
  
  logger.info('[Publishing] Маршруты для публикации контента успешно зарегистрированы');
}