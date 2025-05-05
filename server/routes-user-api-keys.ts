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
      console.log('User API Keys request received, req.user:', req.user ? 'exists' : 'undefined');
      
      // Получаем токен авторизации из заголовка
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Требуется токен авторизации'
        });
      }
      
      const token = authHeader.split(' ')[1];
      
      // Декодируем JWT токен для получения ID пользователя
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
      
      const userId = payload.sub || payload.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Неверный формат токена авторизации'
        });
      }

      // Получаем список ключей из Directus
      
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
