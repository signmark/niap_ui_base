/**
 * Маршруты для авторизации и проверки прав пользователей
 */

import { Request, Response, Express } from 'express';
import { directusApiManager } from '../directus';
import { directusAuthManager } from '../services/directus-auth-manager';
import { log } from '../utils/logger';
import { isUserAdmin } from '../routes-global-api-keys';

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
      const { email, password, first_name, last_name } = req.body;

      if (!email || !password || !first_name || !last_name) {
        return res.status(400).json({ 
          error: 'Неверные данные',
          message: 'Требуется указать email, пароль, имя и фамилию'
        });
      }

      // Получаем ID роли "SMM Manager User"
      const adminToken = await directusAuthManager.getAdminToken();
      if (!adminToken) {
        throw new Error('Не удалось получить токен администратора для создания пользователя');
      }

      // Ищем роль "SMM Manager User"
      const rolesResponse = await directusApiManager.get('/roles', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        },
        params: {
          'filter[name][_eq]': 'SMM Manager User'
        }
      });

      const smmUserRole = rolesResponse.data.data[0];
      if (!smmUserRole) {
        throw new Error('Роль "SMM Manager User" не найдена в системе');
      }

      // Создаем пользователя
      const userResponse = await directusApiManager.post('/users', {
        email,
        password,
        first_name,
        last_name,
        role: smmUserRole.id,
        status: 'active'
      }, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      const newUser = userResponse.data.data;
      log(`Создан новый пользователь: ${newUser.email} (${newUser.id}) с ролью SMM Manager User`, 'auth');

      res.status(201).json({ 
        success: true,
        message: 'Пользователь успешно создан',
        user: {
          id: newUser.id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          role: smmUserRole.name
        }
      });
    } catch (error) {
      console.error('Error during registration:', error);
      
      // Обрабатываем ошибку регистрации
      if (error.response && error.response.status === 400) {
        const errorMessage = error.response.data?.errors?.[0]?.message || 'Ошибка валидации данных';
        return res.status(400).json({ 
          error: 'Ошибка регистрации',
          message: errorMessage
        });
      }

      res.status(500).json({ 
        error: 'Ошибка сервера',
        message: 'Произошла ошибка при регистрации пользователя'
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
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({ 
          error: 'Неверные данные',
          message: 'Требуется указать refresh_token'
        });
      }

      // Обновляем токен
      const response = await directusApiManager.post('/auth/refresh', {
        refresh_token,
        mode: 'json'
      });

      // Возвращаем новый токен
      res.status(200).json({ 
        token: response.data.data.access_token,
        refresh_token: response.data.data.refresh_token
      });
    } catch (error) {
      console.error('Error refreshing token:', error);
      
      // Обрабатываем ошибку обновления токена
      if (error.response && (error.response.status === 401 || error.response.status === 400)) {
        return res.status(401).json({ 
          error: 'Недействительный токен',
          message: 'Требуется повторная авторизация'
        });
      }

      res.status(500).json({ 
        error: 'Ошибка сервера',
        message: 'Произошла ошибка при обновлении токена'
      });
    }
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
      // Только администраторы могут получать токен системы
      const isAdmin = await isUserAdmin(req);
      if (!isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: 'Недостаточно прав для получения системного токена' 
        });
      }

      // Получаем токен системы
      const loginResult = await directusAuthManager.loginAdmin();
      
      if (!loginResult.success || !loginResult.token) {
        return res.status(500).json({ 
          success: false, 
          message: 'Не удалось получить системный токен' 
        });
      }
      
      const token = loginResult.token;

      res.status(200).json({ success: true, token });
    } catch (error) {
      console.error('Error getting system token:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении системного токена',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}