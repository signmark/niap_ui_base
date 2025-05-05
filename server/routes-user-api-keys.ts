/**
 * Маршруты для управления личными API ключами пользователя
 */

import { Application, Request, Response } from 'express';
import { log } from './utils/logger';
import { directusApiManager } from './directus';

/**
 * Регистрирует маршруты для работы с личными API ключами пользователя
 * @param app Express приложение
 */
export function registerUserApiKeysRoutes(app: Application) {
  /**
   * Получение списка личных API ключей пользователя
   * GET /api/user-api-keys
   */
  app.get('/api/user-api-keys', async (req: Request, res: Response) => {
    try {
      // Проверяем, что пользователь авторизован
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Требуется авторизация'
        });
      }

      // Получаем список ключей из Directus
      const userId = req.user.id;
      const token = req.headers.authorization?.split(' ')[1];
      
      log(`Запрос личных API ключей для пользователя ${userId}`, 'api-keys-routes');
      
      try {
        // Делаем запрос к Directus API для получения ключей пользователя
        const response = await directusApiManager.instance.get('/items/user_api_keys', {
          params: {
            filter: {
              user_id: { _eq: userId }
            },
            fields: ['id', 'service_name', 'api_key']
          },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        log(`Получено ${response.data?.data?.length || 0} API ключей для пользователя ${userId}`, 'api-keys-routes');
        
        return res.json({
          success: true,
          data: response.data?.data || []
        });
      } catch (error: any) {
        console.error(`Ошибка при получении API ключей пользователя:`, error);
        return res.status(500).json({
          success: false,
          message: `Ошибка при получении API ключей: ${error.message || 'Неизвестная ошибка'}`
        });
      }
    } catch (err: any) {
      console.error('Ошибка в маршруте /api/user-api-keys:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Неизвестная ошибка'
      });
    }
  });

  log('Маршруты для работы с личными API ключами успешно зарегистрированы', 'api-keys-routes');
}
