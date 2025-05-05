/**
 * Маршруты для управления глобальными API ключами
 */

import { Application, Request, Response } from 'express';
import { globalApiKeysService } from './services/global-api-keys';
import { log } from './utils/logger';
import { directusCrud } from './services/directus-crud';
import { directusApiManager } from './directus';
import { ApiServiceName } from './services/api-keys';

// Массив email адресов пользователей, которые должны иметь административные привилегии
// Это может служить альтернативой для поля is_smm_admin в Directus
const ADMIN_EMAILS = ['lbrspb@gmail.com', 'lbr.spb@gmail.com']; 

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
      const response = await directusApiManager.get('/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
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

    // 1. Проверяем поле is_smm_admin
    const isSmmAdmin = currentUser.is_smm_admin === true || 
                       currentUser.is_smm_admin === 1 || 
                       currentUser.is_smm_admin === '1' || 
                       currentUser.is_smm_admin === 'true';
    
    // 2. Проверяем роль администратора в Directus
    const isDirectusAdmin = currentUser.role && (
      currentUser.role.name === 'Admin' || 
      currentUser.role.name === 'Administrator' || 
      currentUser.role.admin_access === true || 
      currentUser.role.admin_access === 1 ||
      currentUser.role.admin_access === '1' ||
      currentUser.role.admin_access === 'true'
    );

    // 3. Проверяем через массив электронных адресов администраторов
    const isAdminByEmail = ADMIN_EMAILS.includes(currentUser.email);

    // Итоговый результат - пользователь является администратором по любому из признаков
    const isAdmin = isSmmAdmin || isDirectusAdmin || isAdminByEmail;

    // Выводим логи для каждого метода проверки
    console.log('Admin check results:', { 
      isSmmAdmin, 
      isDirectusAdmin, 
      isAdminByEmail,
      finalResult: isAdmin 
    });

    log(`Пользователь ${currentUser.email}: итоговый статус админа = ${isAdmin}. Значение is_smm_admin = ${currentUser.is_smm_admin}, тип: ${typeof currentUser.is_smm_admin}. Роль = ${currentUser.role?.name}`, 'admin');
    
    return isAdmin;
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
        return res.status(401).json({ success: false, message: 'Требуется токен авторизации' });
      }

      // Получаем список глобальных API ключей
      const keys = await globalApiKeysService.getGlobalApiKeys();
      log('Успешно получен список глобальных API ключей', 'api');
      res.status(200).json({ success: true, data: keys });
    } catch (error) {
      console.error('Ошибка при получении глобальных API ключей:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при получении глобальных API ключей',
        error: error instanceof Error ? error.message : 'Unknown error'
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
