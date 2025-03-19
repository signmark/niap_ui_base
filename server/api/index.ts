import { Router, Request, Response, NextFunction } from 'express';
import { registerCampaignRoutes } from './campaign-routes';
import { registerContentRoutes } from './content-routes';
import { registerWordStatRoutes } from './wordstat-routes';
import { registerPublishedRoutes } from './published-routes';
import { registerAuthRoutes } from './auth-routes';
import { registerDirectScheduleRoutes } from './direct-schedule-routes';
import { log } from '../utils/logger';
import { authenticateApiRequest } from './middleware/auth';

/* Используем middleware из отдельного файла */

export function registerAPIRoutes(app: Router) {
  log('Starting route registration...', 'api');
  
  // Применяем глобальный middleware аутентификации для всех API маршрутов
  app.use('/api', authenticateApiRequest);
  
  // Регистрируем все API маршруты
  registerAuthRoutes(app); // Важно зарегистрировать маршруты аутентификации
  registerCampaignRoutes(app);
  registerContentRoutes(app);
  registerWordStatRoutes(app);
  registerPublishedRoutes(app);
  registerDirectScheduleRoutes(app);
  
  log('Route registration completed', 'api');
}