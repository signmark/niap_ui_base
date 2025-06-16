/**
 * Маршруты для авторизации и проверки прав пользователей
 */

import { Request, Response, Express } from 'express';
import { directusApiManager } from '../directus';
import { directusAuthManager } from '../services/directus-auth-manager';
import { log } from '../utils/logger';
import { isUserAdmin } from '../routes-global-api-keys';
import { detectEnvironment } from '../utils/environment-detector';

/**
 * Регистрирует маршруты для авторизации
 * @param app Express приложение
 */
export function registerAuthRoutes(app: Express): void {
  // Маршрут для проверки валидности токена
  app.get('/api/auth/check', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Не авторизован',
        message: 'Требуется токен авторизации'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      // Проверяем валидность токена
      const response = await directusApiManager.get('/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      res.status(200).json({
        valid: true,
        user: response.data.data
      });
    } catch (error) {
      console.error('Error checking token:', error);
      res.status(401).json({ 
        valid: false,
        error: 'Недействительный токен'
      });
    }
  });

  // Маршрут для регистрации
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      console.log('Registration request body:', req.body);
      const { email, password, firstName, lastName } = req.body;
      console.log('Extracted fields:', { email, password: '***', firstName, lastName });

      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ 
          error: 'Неверные данные',
          message: 'Требуется указать email, пароль, имя и фамилию'
        });
      }

      // Используем ID роли SMM Manager User напрямую
      const smmUserRoleId = 'c971fd93-1abc-4a40-9ab7-6cddb78e491c';

      // Получаем токен администратора для создания пользователя
      let adminToken: string;
      
      try {
        // Пробуем использовать токен из активной сессии admin@roboflow.tech
        const { directusApiManager } = await import('../directus.js');
        const adminUserId = '61941d89-55c2-4def-83a3-bc8bfbd21d6f'; // ID admin@roboflow.tech
        
        const cachedToken = directusApiManager.getCachedToken(adminUserId);
        
        if (cachedToken && cachedToken.token) {
          adminToken = cachedToken.token;
          console.log('Using cached admin@roboflow.tech token for user creation');
        } else {
          // Пробуем получить токен через планировщик
          const { publishScheduler } = await import('../services/publish-scheduler.js');
          const systemToken = await publishScheduler.getSystemToken();
          
          if (!systemToken) {
            throw new Error('Не удалось получить токен администратора');
          }
          adminToken = systemToken;
          console.log('Using system token from scheduler for user creation');
        }
        
        // Создаем пользователя через directusApiManager с админским токеном
        const response = await directusApiManager.post('/users', {
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          role: smmUserRoleId,
          status: 'active'
        }, {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });

        console.log('User created successfully via directusApiManager:', response.data.data.id);
        
        return res.status(201).json({
          success: true,
          message: 'Пользователь успешно зарегистрирован',
          userId: response.data.data.id
        });
        
      } catch (createError: any) {
        console.error('User creation error:', createError.response?.data || createError.message);
        console.error('Full error object:', JSON.stringify(createError, null, 2));
        
        // Обрабатываем специфичные ошибки Directus - проверяем разные структуры
        let errorMessage = 'Не удалось создать пользователя';
        
        // Первый уровень: createError.response.data.errors
        if (createError.response?.data?.errors && Array.isArray(createError.response.data.errors)) {
          const directusError = createError.response.data.errors[0];
          if (directusError.message && directusError.message.includes('has to be unique')) {
            errorMessage = 'Пользователь с таким email уже существует';
          } else {
            errorMessage = directusError.message || 'Ошибка создания пользователя';
          }
        }
        // Второй уровень: createError.data.errors
        else if (createError.data?.errors && Array.isArray(createError.data.errors)) {
          const directusError = createError.data.errors[0];
          if (directusError.message && directusError.message.includes('has to be unique')) {
            errorMessage = 'Пользователь с таким email уже существует';
          } else {
            errorMessage = directusError.message || 'Ошибка создания пользователя';
          }
        }
        // Третий уровень: непосредственно в createError
        else if (createError.errors && Array.isArray(createError.errors)) {
          const directusError = createError.errors[0];
          if (directusError.message && directusError.message.includes('has to be unique')) {
            errorMessage = 'Пользователь с таким email уже существует';
          } else {
            errorMessage = directusError.message || 'Ошибка создания пользователя';
          }
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error during registration:', error.message);
      
      // Возвращаем конкретное сообщение об ошибке
      return res.status(400).json({ 
        success: false,
        message: error.message || 'Произошла ошибка при регистрации пользователя'
      });
    }
  });

  // Маршрут для авторизации
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ 
          error: 'Неверные данные',
          message: 'Требуется указать email и пароль'
        });
      }

      // Получаем токен
      const response = await directusApiManager.post('/auth/login', {
        email,
        password
      });

      // Дополнительно получаем данные пользователя
      const userResponse = await directusApiManager.get('/users/me', {
        headers: {
          'Authorization': `Bearer ${response.data.data.access_token}`
        }
      });

      const userData = userResponse.data.data;
      const token = response.data.data.access_token;
      log(`Успешная авторизация пользователя: ${userData.email} (${userData.id})`, 'auth');

      // Проверяем, является ли пользователь администратором
      const isAdmin = await isUserAdmin(req, token);
      log(`Пользователь ${userData.email}: статус администратора = ${isAdmin}`, 'auth');

      // Возвращаем токен и данные пользователя
      res.status(200).json({ 
        token,
        refresh_token: response.data.data.refresh_token,
        user: {
          id: userData.id,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role,
          isAdmin
        }
      });
    } catch (error) {
      console.error('Error during login:', error);
      
      // Обрабатываем ошибку авторизации
      if (error.response && error.response.status === 401) {
        return res.status(401).json({ 
          error: 'Неверные учетные данные',
          message: 'Неверный email или пароль'
        });
      }

      res.status(500).json({ 
        error: 'Ошибка сервера',
        message: 'Произошла ошибка при авторизации'
      });
    }
  });

  // Маршрут для обновления токена
  app.post('/api/auth/refresh', async (req: Request, res: Response) => {
    try {
      const { refresh_token, user_id } = req.body;

      if (!refresh_token) {
        console.log('Refresh token request without refresh_token');
        return res.status(400).json({ 
          error: 'Неверные данные',
          message: 'Требуется указать refresh_token'
        });
      }

      console.log(`Attempting to refresh token for user: ${user_id || 'unknown'}`);

      // Пытаемся обновить токен через Directus API
      try {
        const response = await directusApiManager.post('/auth/refresh', {
          refresh_token,
          mode: 'json'
        });
        
        console.log('Token refresh successful');
        
        if (response.data?.data?.access_token) {
          return res.status(200).json({
            success: true,
            token: response.data.data.access_token,
            refresh_token: response.data.data.refresh_token,
            expires_at: response.data.data.expires_at
          });
        } else {
          console.error('Token refresh response missing access_token:', response.data);
          throw new Error('Invalid refresh response');
        }
      } catch (refreshError: any) {
        console.error('Token refresh failed:', refreshError.response?.data || refreshError.message);
        
        // Возвращаем ошибку для повторной авторизации пользователя
        return res.status(401).json({
          error: 'Token refresh failed',
          code: 'TOKEN_EXPIRED',
          message: 'Please log in again'
        });
      }
    } catch (error: any) {
      console.error('Error in refresh endpoint:', error);
      
      // Обрабатываем ошибку обновления токена
      if (error.response && (error.response.status === 401 || error.response.status === 400)) {
        return res.status(401).json({ 
          error: 'Недействительный токен',
          message: 'Требуется повторная авторизация'
        });
      }

      return res.status(500).json({ 
        error: 'Ошибка сервера',
        message: 'Произошла ошибка при обновлении токена'
      });
    }
  });

  // Маршрут для получения конфигурации окружения
  app.get('/api/config', (req: Request, res: Response) => {
    const envConfig = detectEnvironment();
    
    res.json({
      directusUrl: envConfig.directusUrl,
      environment: envConfig.environment,
      logLevel: envConfig.logLevel,
      debugScheduler: envConfig.debugScheduler,
      verboseLogs: envConfig.verboseLogs
    });
  });

  // Маршрут для принудительного обновления переменных окружения
  app.post('/api/config/update', (req: Request, res: Response) => {
    process.env.DIRECTUS_URL = 'https://directus.nplanner.ru';
    process.env.N8N_URL = 'https://n8n.nplanner.ru';
    
    res.json({
      success: true,
      message: 'Environment variables updated',
      directusUrl: process.env.DIRECTUS_URL,
      n8nUrl: process.env.N8N_URL
    });
  });

  // Маршрут для проверки статуса администратора
  app.get('/api/auth/is-admin', async (req: Request, res: Response) => {
    try {
      console.log('IS-ADMIN ROUTE CALLED');
      // Указываем явно content-type как JSON
      res.setHeader('Content-Type', 'application/json');
      // Добавляем заголовки для предотвращения кэширования
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        log('Запрос на проверку админа без токена', 'auth');
        return res.status(401).json({ 
          success: false, 
          isAdmin: false,
          message: 'Требуется токен авторизации'
        });
      }
      
      const token = authHeader.substring(7);
      log(`Проверка статуса админа с токеном: ${token.substring(0, 10)}...`, 'auth');
      
      const isAdmin = await isUserAdmin(req, token);
      log(`Результат проверки администратора: ${isAdmin}`, 'auth');
      
      // Добавляем случайный параметр в ответ, чтобы предотвратить кэширование
      return res.status(200).json({ 
        success: true, 
        isAdmin, 
        timestamp: Date.now() 
      });
    } catch (error) {
      log(`Ошибка при проверке статуса администратора: ${error instanceof Error ? error.message : 'Unknown error'}`, 'auth');
      return res.status(500).json({ 
        success: false, 
        error: 'Произошла ошибка при проверке статуса администратора', 
        timestamp: Date.now() 
      });
    }
  });

  // Маршрут для получения информации о текущем пользователе
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Не авторизован',
        message: 'Требуется токен авторизации'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      // Получаем данные пользователя
      const response = await directusApiManager.get('/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const userData = response.data.data;
      
      // Проверяем, является ли пользователь администратором
      const isAdmin = await isUserAdmin(req, token);
      log(`Пользователь ${userData.email}: статус администратора = ${isAdmin}`, 'auth');

      // Возвращаем данные пользователя
      res.status(200).json({
        user: {
          id: userData.id,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role?.name || 'User',
          is_smm_admin: userData.is_smm_admin,
          expire_date: userData.expire_date,
          isAdmin
        }
      });
    } catch (error) {
      console.error('Error getting user data:', error);
      res.status(401).json({ 
        error: 'Недействительный токен',
        message: 'Требуется повторная авторизация'
      });
    }
  });
  
  // Маршрут для выхода
  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({ success: true });
    }
    
    const token = authHeader.substring(7);
    
    try {
      // Отправляем запрос на выход в Directus
      await directusApiManager.post('/auth/logout', null, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      log('Успешный выход пользователя', 'auth');
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error during logout:', error);
      // Даже если есть ошибка, все равно считаем выход успешным
      res.status(200).json({ success: true });
    }
  });

  // Маршрут для получения токена системы
  app.get('/api/auth/system-token', async (req: Request, res: Response) => {
    try {
      // Получаем токен администратора из кэша для внутренних операций
      const { directusApiManager } = await import('../directus.js');
      const adminUserId = '61941d89-55c2-4def-83a3-bc8bfbd21d6f'; // admin@roboflow.tech
      
      const cachedToken = directusApiManager.getCachedToken(adminUserId);
      
      if (cachedToken && cachedToken.token) {
        return res.status(200).json({
          success: true,
          token: cachedToken.token
        });
      }
      
      // Fallback: получаем токен через планировщик
      const { publishScheduler } = await import('../services/publish-scheduler.js');
      const systemToken = await publishScheduler.getSystemToken();
      
      if (systemToken) {
        return res.status(200).json({
          success: true,
          token: systemToken
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: 'Не удалось получить системный токен' 
      });
      
    } catch (error: any) {
      console.error('Error getting system token:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Ошибка получения системного токена'
      });
    }
  });
}