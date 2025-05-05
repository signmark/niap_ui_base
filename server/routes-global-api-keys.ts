/**
 * Маршруты для управления глобальными API ключами
 * Эти маршруты доступны только администраторам
 */

import { Express, Request, Response } from 'express';
import { ApiServiceName } from './services/api-keys';
import { globalApiKeysService } from './services/global-api-keys';
import { log } from './utils/logger';
import { directusCrud } from './services/directus-crud';

/**
 * Проверяет, является ли пользователь администратором
 * @param req Express запрос
 * @returns Промис булевого значения, тру если пользователь админ
 */
async function isAdmin(req: Request): Promise<boolean> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    
    const token = authHeader.split(' ')[1];
    
    // Получаем информацию о пользователе напрямую через API Directus
    try {
      const response = await directusApiManager.instance.get('/users/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const userInfo = response.data?.data;
      
      if (!userInfo) {
        console.log('Не удалось получить информацию о пользователе');
        return false;
      }
      
      // Проверяем, включено ли поле is_smm_admin 
      const isSmmAdmin = userInfo.is_smm_admin === true;
      
      // Список ID администраторов SMM Manager из переменной окружения
      const adminIds = process.env.SMM_ADMIN_USER_IDS?.split(',') || [];
      if (process.env.DIRECTUS_ADMIN_USER_ID) {
        adminIds.push(process.env.DIRECTUS_ADMIN_USER_ID);
      }
      
      // Критерии проверки администратора:
      // 1. Флаг is_smm_admin включен
      // 2. Пользователь имеет ID из списка администраторов
      // 3. Пользователь имеет права администратора в Directus
      // 4. Email пользователя совпадает с DIRECTUS_ADMIN_EMAIL
      const isAdminResult = 
        isSmmAdmin || 
        (userInfo.id && adminIds.includes(userInfo.id)) ||
        (userInfo.role?.admin_access === true) || 
        (userInfo.email === process.env.DIRECTUS_ADMIN_EMAIL);
      
      console.log(`Проверка прав администратора для ${userInfo.email}: ${isAdminResult ? 'ЕСТЬ ПРАВА' : 'НЕТ ПРАВ'}`);
      return isAdminResult;
    } catch (apiError) {
      console.error('Error fetching user info from Directus:', apiError);
      return false;
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Регистрирует маршруты для управления глобальными API ключами
 * @param app Express приложение
 */
export function registerGlobalApiKeysRoutes(app: Express) {
  /**
   * Получение списка глобальных API ключей
   * Доступно только администраторам
   */
  app.get('/api/admin/global-api-keys', async (req: Request, res: Response) => {
    try {
      // Проверяем, что пользователь администратор
      const adminStatus = await isAdmin(req);
      if (!adminStatus) {
        return res.status(403).json({ 
          success: false, 
          error: 'Доступ запрещен. Требуются права администратора.' 
        });
      }
      
      // Получаем авторизационный токен для Directus
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          error: 'Не предоставлен токен авторизации.' 
        });
      }
      
      // Запрашиваем список глобальных API ключей через DirectusCrud
      const apiKeys = await directusCrud.list('global_api_keys', {
        authToken: token,
        fields: ['id', 'service_name', 'is_active', 'description', 'updated_at'],
        sort: ['-updated_at']
      });
      
      // Для безопасности не возвращаем сами ключи
      return res.json({ success: true, data: apiKeys });
    } catch (error: any) {
      log(`Error fetching global API keys: ${error.message}`, 'api-keys');
      return res.status(500).json({ 
        success: false, 
        error: 'Ошибка при запросе глобальных API ключей.' 
      });
    }
  });
  
  /**
   * Сохранение глобального API ключа
   * Доступно только администраторам
   */
  app.post('/api/admin/global-api-keys', async (req: Request, res: Response) => {
    try {
      // Проверяем, что пользователь администратор
      const adminStatus = await isAdmin(req);
      if (!adminStatus) {
        return res.status(403).json({ 
          success: false, 
          error: 'Доступ запрещен. Требуются права администратора.' 
        });
      }
      
      const { serviceName, apiKey, description } = req.body;
      
      if (!serviceName || !apiKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'Необходимо указать serviceName и apiKey.' 
        });
      }
      
      // Получаем авторизационный токен для Directus
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          error: 'Не предоставлен токен авторизации.' 
        });
      }
      
      // Сохраняем глобальный API ключ
      const keyId = await globalApiKeysService.setGlobalApiKey(
        serviceName as ApiServiceName,
        apiKey,
        token
      );
      
      if (keyId) {
        await globalApiKeysService.refreshCache();
        return res.json({ 
          success: true, 
          data: { id: keyId } 
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          error: 'Ошибка при сохранении глобального API ключа.' 
        });
      }
    } catch (error: any) {
      log(`Error saving global API key: ${error.message}`, 'api-keys');
      return res.status(500).json({ 
        success: false, 
        error: 'Ошибка при сохранении глобального API ключа.' 
      });
    }
  });
  
  /**
   * Деактивация глобального API ключа
   * Доступно только администраторам
   */
  app.post('/api/admin/global-api-keys/deactivate', async (req: Request, res: Response) => {
    try {
      // Проверяем, что пользователь администратор
      const adminStatus = await isAdmin(req);
      if (!adminStatus) {
        return res.status(403).json({ 
          success: false, 
          error: 'Доступ запрещен. Требуются права администратора.' 
        });
      }
      
      const { serviceName } = req.body;
      
      if (!serviceName) {
        return res.status(400).json({ 
          success: false, 
          error: 'Необходимо указать serviceName.' 
        });
      }
      
      // Получаем авторизационный токен для Directus
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          error: 'Не предоставлен токен авторизации.' 
        });
      }
      
      // Деактивируем глобальный API ключ
      const success = await globalApiKeysService.deactivateGlobalApiKey(
        serviceName as ApiServiceName,
        token
      );
      
      if (success) {
        await globalApiKeysService.refreshCache();
        return res.json({ success: true });
      } else {
        return res.status(404).json({ 
          success: false, 
          error: 'Глобальный API ключ не найден или уже деактивирован.' 
        });
      }
    } catch (error: any) {
      log(`Error deactivating global API key: ${error.message}`, 'api-keys');
      return res.status(500).json({ 
        success: false, 
        error: 'Ошибка при деактивации глобального API ключа.' 
      });
    }
  });
  
  /**
   * Проверка доступности глобальных API ключей
   * Этот маршрут доступен всем пользователям, но не раскрывает значения ключей
   */
  app.get('/api/global-api-keys/availability', async (req: Request, res: Response) => {
    try {
      // Обновляем кэш глобальных API ключей
      await globalApiKeysService.refreshCache();
      
      // Создаем список доступных сервисов
      const availability: Record<string, boolean> = {};
      
      // Проверяем каждый сервис
      const services: ApiServiceName[] = [
        'perplexity', 'social_searcher', 'apify', 'deepseek', 
        'fal_ai', 'xmlriver', 'qwen', 'claude', 'gemini'
      ];
      
      for (const service of services) {
        const key = await globalApiKeysService.getGlobalApiKey(service);
        availability[service] = !!key;
      }
      
      return res.json({ 
        success: true, 
        data: { availability } 
      });
    } catch (error: any) {
      log(`Error checking global API keys availability: ${error.message}`, 'api-keys');
      return res.status(500).json({ 
        success: false, 
        error: 'Ошибка при проверке доступности глобальных API ключей.' 
      });
    }
  });
  
  console.log('Global API key management routes registered');
}
