/**
 * Маршруты для управления глобальными API ключами
 */

import { Application, Request, Response } from 'express';
import { globalApiKeysService } from './services/global-api-keys';
import { log } from './utils/logger';
import { directusCrud } from './services/directus-crud';
import { directusApiManager } from './directus';
import { ApiServiceName } from './services/api-keys';
import axios from 'axios';

// Проверка будет производиться только по полю is_smm_admin в Directus

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
      log('Нет токена для проверки прав администратора', 'admin');
      return false;
    }

    log(`Проверка прав администратора с токеном: ${token.substring(0, 10)}...`, 'admin');
    
    // Получаем данные пользователя из Directus
    try {
      // Используем axios напрямую вместо directusApiManager
      const response = await axios.get(`${process.env.DIRECTUS_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const currentUser = response.data.data;

      if (!currentUser) {
        log('Не удалось получить данные пользователя', 'admin');
        return false;
      }

      // Выводим все данные пользователя для отладки
      console.log('User data for admin check:', {
        email: currentUser.email,
        is_smm_admin: currentUser.is_smm_admin,
        role: currentUser.role?.name,
        roleName: currentUser.role?.name,
        roleAdmin: currentUser.role?.admin_access,
      });

      // Проверяем только поле is_smm_admin
      const isAdmin = currentUser.is_smm_admin === true || 
                     currentUser.is_smm_admin === 1 || 
                     currentUser.is_smm_admin === '1' || 
                     currentUser.is_smm_admin === 'true';
      
      // Выводим логи для проверки
      console.log('Admin check results:', { 
        isSmmAdmin: isAdmin,
        finalResult: isAdmin 
      });

      log(`Пользователь ${currentUser.email}: итоговый статус админа = ${isAdmin}. Значение is_smm_admin = ${currentUser.is_smm_admin}, тип: ${typeof currentUser.is_smm_admin}. Роль = ${currentUser.role?.name}`, 'admin');
      
      return isAdmin;
    } catch (innerError) {
      console.error('Error getting user data from Directus:', innerError);
      log(`Ошибка при получении данных пользователя: ${innerError instanceof Error ? innerError.message : 'Unknown error'}`, 'admin');
      return false;
    }
  } catch (error) {
    log(`Ошибка при проверке прав администратора: ${error instanceof Error ? error.message : 'Unknown error'}`, 'admin');
    console.error('Ошибка при проверке прав администратора:', error);
    return false;
  }
}

/**
 * Мидлвар для проверки прав администратора
 */
function requireAdmin(req: Request, res: Response, next: Function) {
  // Устанавливаем явно заголовки для предотвращения перехвата Vite
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  console.log('CHECKING ADMIN RIGHTS IN MIDDLEWARE');
  
  // Печатаем токен для отладки
  const token = req.headers.authorization?.startsWith('Bearer ') 
    ? req.headers.authorization.substring(7) 
    : null;
  
  if (!token) {
    console.log('NO TOKEN PROVIDED FOR ADMIN CHECK');
    return res.status(401).json({ success: false, message: 'Требуется токен авторизации' });
  }
  
  console.log(`TOKEN FOR ADMIN CHECK: ${token.substring(0, 10)}...`);
  
  // Для тестирования пропускаем всех авторизованных пользователей
  // Временно для тестирования - предполагаем, что все авторизованные пользователи - админы
  if (process.env.NODE_ENV === 'development') {
    console.log('DEVELOPMENT MODE - ALL USERS WITH TOKEN ARE ADMINS');
    return next();
  }
  
  isUserAdmin(req).then(isAdmin => {
    console.log(`ADMIN CHECK RESULT IN MIDDLEWARE: ${isAdmin}`);
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
      console.log('IS-ADMIN ROUTE CALLED');
      // Устанавливаем явно заголовки для предотвращения перехвата Vite
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');

      // Получаем токен из заголовка запроса
      const token = req.headers.authorization?.startsWith('Bearer ') 
        ? req.headers.authorization.substring(7) 
        : null;

      if (!token) {
        return res.status(401).json({ success: false, message: 'Требуется токен авторизации' });
      }

      // Получаем список глобальных API ключей
      const keys = await globalApiKeysService.getGlobalApiKeys();
      log('Успешно получен список глобальных API ключей', 'api');
      return res.status(200).json({ success: true, data: keys, timestamp: Date.now() });
    } catch (error) {
      console.error('Ошибка при получении глобальных API ключей:', error);
      return res.status(500).json({
        success: false,
        message: 'Ошибка при получении глобальных API ключей',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  // Добавление глобального API ключа (только для администраторов)
  app.post('/api/global-api-keys', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { service, apiKey, priority } = req.body;

      if (!service || !apiKey) {
        return res.status(400).json({ success: false, message: 'Требуется указать сервис и API ключ' });
      }

      // Проверяем, что сервис указан корректно
      if (!Object.values(ApiServiceName).includes(service as ApiServiceName)) {
        return res.status(400).json({ success: false, message: 'Неверное название сервиса' });
      }

      // Добавляем глобальный API ключ
      const result = await globalApiKeysService.addGlobalApiKey({
        service: service as ApiServiceName,
        api_key: apiKey,
        priority: priority || 0,
        active: true
      });

      log(`Успешно добавлен глобальный API ключ для сервиса ${service}`, 'api');
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error('Ошибка при добавлении глобального API ключа:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при добавлении глобального API ключа',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Обновление глобального API ключа (только для администраторов)
  app.put('/api/global-api-keys/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { service, apiKey, priority, active } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, message: 'Требуется указать ID ключа' });
      }

      // Обновляем глобальный API ключ
      const updateData: any = {};
      if (service) updateData.service = service;
      if (apiKey) updateData.api_key = apiKey;
      if (priority !== undefined) updateData.priority = priority;
      if (active !== undefined) updateData.active = active;

      const result = await globalApiKeysService.updateGlobalApiKey(id, updateData);

      if (!result) {
        return res.status(404).json({ success: false, message: 'Ключ не найден' });
      }

      log(`Успешно обновлен глобальный API ключ ${id}`, 'api');
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error('Ошибка при обновлении глобального API ключа:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при обновлении глобального API ключа',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Удаление глобального API ключа (только для администраторов)
  app.delete('/api/global-api-keys/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ success: false, message: 'Требуется указать ID ключа' });
      }

      // Удаляем глобальный API ключ
      const result = await globalApiKeysService.deleteGlobalApiKey(id);

      if (!result) {
        return res.status(404).json({ success: false, message: 'Ключ не найден' });
      }

      log(`Успешно удален глобальный API ключ ${id}`, 'api');
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Ошибка при удалении глобального API ключа:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при удалении глобального API ключа',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
