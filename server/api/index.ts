import { Router } from 'express';
import { registerCampaignRoutes } from './campaign-routes';
import { registerContentRoutes } from './content-routes';
import { registerWordStatRoutes } from './wordstat-routes';
import { registerPublishedRoutes } from './published-routes';
import { log } from '../utils/logger';

export function registerAPIRoutes(app: Router) {
  log('Starting route registration...', 'api');
  
  // Регистрируем все API маршруты
  registerCampaignRoutes(app);
  registerContentRoutes(app);
  registerWordStatRoutes(app);
  registerPublishedRoutes(app);
  
  log('Route registration completed', 'api');
}