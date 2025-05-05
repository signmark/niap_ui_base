/**
 * Маршруты для управления глобальными API ключами
 */

import { Application, Request, Response } from 'express';
import { globalApiKeysService } from './services/global-api-keys';
import { log } from './utils/logger';
import { directusCrud } from './services/directus-crud';
import { directusApiManager } from './directus';
import { ApiServiceName } from './services/api-keys';

/**
 * Проверяет, является ли пользователь администратором SMM
 * @param req Объект запроса Express
 * @param directusToken Токен авторизации Directus
 * @returns Признак администратора
 */
export async function isUserAdmin(req: Request, directusToken?: string): Promise<boolean> {
  try {
    // Если токен не передан, пытаемся извлечь из заголовка запроса
    const token = directusToken || (req.headers.authorization?.startsWith('Bearer ') 
      ? req.headers.authorization.substring(7) 
      : null);

    if (!token) {
      return false;
    }

    // Получаем данные пользователя из Directus
    const currentUser = await directusCrud.read('users/me', null, { authToken: token });

    if (!currentUser) {
      return false;
    }

    // Проверяем, является ли пользователь администратором
    return currentUser.is_smm_admin === true;
  } catch (error) {
    console.error('Ошибка при проверке прав администратора:', error);
    return false;
  }
}

/**
 * Мидлвар для проверки прав администратора
 */
function requireAdmin(req: Request, res: Response, next: Function) {
  isUserAdmin(req).then(isAdmin => {
    if (isAdmin) {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Недостаточно прав для доступа к этому ресурсу' });
    }
  }).catch(error => {
    console.error('Ошибка при проверке прав администратора:', error);
    res.status(500).json({ success: false, message: 'Ошибка при проверке прав доступа' });
  });
}

/**
 * Регистрирует маршруты для управления глобальными API ключами
 * @param app Сервер Express
 */
export function registerGlobalApiKeysRoutes(app: Application): void {
  // Получение списка всех глобальных ключей (только для администраторов)
  app.get('/api/global-api-keys', requireAdmin, async (req: Request, res: Response) => {
    try {
      // Получаем токен из заголовка запроса
      const token = req.headers.authorization?.startsWith('Bearer ') 
        ? req.headers.authorization.substring(7) 
        : null;

      if (!token) {
        return res.status(401).json({ success: false, message: 'Не указан токен авторизации' });
      }

      // Получаем список глобальных API ключей
      const globalApiKeys = await directusCrud.list('global_api_keys', {
        authToken: token,
        fields: ['id', 'service_name', 'api_key', 'is_active', 'description', 'created_at', 'updated_at']
      });

      // Маскируем значения ключей для отображения в интерфейсе
      const maskedKeys = globalApiKeys.map((key: any) => {
        if (key.api_key) {
          // Маскируем ключ для отображения
          const keyLength = key.api_key.length;
          if (keyLength > 10) {
            // Оставляем первые 4 и последние 4 символа
            key.displayed_key = `${key.api_key.substring(0, 4)}...${key.api_key.substring(keyLength - 4)}`;
          } else {
            // Если ключ короткий, маскируем полностью
            key.displayed_key = '*'.repeat(keyLength);
          }
        } else {
          key.displayed_key = '';
        }

        // Удаляем реальный ключ из ответа
        const { api_key, ...safeKey } = key;
        return safeKey;
      });

      return res.json({ success: true, data: maskedKeys });
    } catch (error) {  
      console.error('Ошибка при получении глобальных API ключей:', error);
      return res.status(500).json({ success: false, message: 'Ошибка при получении глобальных API ключей' });
    }
  });

  // Создание или обновление глобального API ключа (только для администраторов)
  app.post('/api/global-api-keys', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { service_name, api_key, description } = req.body;

      if (!service_name || !api_key) {
        return res.status(400).json({ success: false, message: 'Укажите название сервиса и API ключ' });
      }

      // Проверяем, что service_name является допустимым значением
      if (!Object.values(ApiServiceName).includes(service_name as ApiServiceName)) {
        return res.status(400).json({ 
          success: false, 
          message: `Недопустимое название сервиса. Допустимые значения: ${Object.values(ApiServiceName).join(', ')}` 
        });
      }

      // Получаем токен из заголовка запроса
      const token = req.headers.authorization?.startsWith('Bearer ') 
        ? req.headers.authorization.substring(7) 
        : null;

      if (!token) {
        return res.status(401).json({ success: false, message: 'Не указан токен авторизации' });
      }

      // Сохраняем глобальный API ключ
      const keyId = await globalApiKeysService.setGlobalApiKey(
        service_name as unknown as ApiServiceName, 
        api_key, 
        token
      );

      if (!keyId) {
        return res.status(500).json({ success: false, message: 'Ошибка при сохранении глобального API ключа' });
      }

      // Если есть описание, сохраняем его отдельным запросом
      if (description) {
        await directusCrud.update('global_api_keys', keyId, {
          description
        }, {
          authToken: token
        });
      }

      // Обновляем кэш глобальных API ключей
      await globalApiKeysService.refreshCache();

      return res.json({ success: true, id: keyId, message: 'Глобальный API ключ успешно сохранен' });
    } catch (error) {
      console.error('Ошибка при сохранении глобального API ключа:', error);
      return res.status(500).json({ success: false, message: 'Ошибка при сохранении глобального API ключа' });
    }
  });

  // Деактивация глобального API ключа (только для администраторов)
  app.delete('/api/global-api-keys/:service_name', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { service_name } = req.params;

      if (!service_name) {
        return res.status(400).json({ success: false, message: 'Укажите название сервиса' });
      }

      // Проверяем, что service_name является допустимым значением
      if (!Object.values(ApiServiceName).includes(service_name as ApiServiceName)) {
        return res.status(400).json({ 
          success: false, 
          message: `Недопустимое название сервиса. Допустимые значения: ${Object.values(ApiServiceName).join(', ')}` 
        });
      }

      // Получаем токен из заголовка запроса
      const token = req.headers.authorization?.startsWith('Bearer ') 
        ? req.headers.authorization.substring(7) 
        : null;

      if (!token) {
        return res.status(401).json({ success: false, message: 'Не указан токен авторизации' });
      }

      // Деактивируем глобальный API ключ
      const success = await globalApiKeysService.deactivateGlobalApiKey(
        service_name as unknown as ApiServiceName, 
        token
      );

      if (!success) {
        return res.status(404).json({ success: false, message: 'Глобальный API ключ не найден или уже деактивирован' });
      }

      // Обновляем кэш глобальных API ключей
      await globalApiKeysService.refreshCache();

      return res.json({ success: true, message: 'Глобальный API ключ успешно деактивирован' });
    } catch (error) {
      console.error('Ошибка при деактивации глобального API ключа:', error);
      return res.status(500).json({ success: false, message: 'Ошибка при деактивации глобального API ключа' });
    }
  });

  // Публичный маршрут для проверки наличия глобального API ключа для указанного сервиса
  app.get('/api/global-api-keys/check/:service_name', async (req: Request, res: Response) => {
    try {
      const { service_name } = req.params;

      if (!service_name) {
        return res.status(400).json({ success: false, message: 'Укажите название сервиса' });
      }

      // Проверяем, что service_name является допустимым значением
      if (!Object.values(ApiServiceName).includes(service_name as ApiServiceName)) {
        return res.status(400).json({ 
          success: false, 
          message: `Недопустимое название сервиса. Допустимые значения: ${Object.values(ApiServiceName).join(', ')}` 
        });
      }

      // Проверяем наличие глобального API ключа
      const apiKey = await globalApiKeysService.getGlobalApiKey(service_name as unknown as ApiServiceName);
      const hasApiKey = apiKey !== null;

      return res.json({ success: true, has_api_key: hasApiKey });
    } catch (error) {
      console.error('Ошибка при проверке наличия глобального API ключа:', error);
      return res.status(500).json({ success: false, message: 'Ошибка при проверке наличия глобального API ключа' });
    }
  });

  log('Global API Keys routes registered successfully');
}
