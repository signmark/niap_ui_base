import { Router, Request, Response } from 'express';
import { isAuthenticated, isSmmAdmin } from '../middleware/auth';
import { directusCrud } from '../services/directus-crud';

export const usersRouter = Router();

// Защищаем все маршруты аутентификацией
usersRouter.use(isAuthenticated);

// Получение активных пользователей (доступно только для SMM админов)
usersRouter.get('/active', isSmmAdmin, async (req: Request, res: Response) => {
  try {
    console.log('Получение списка активных пользователей');
    
    // Используем токен из запроса
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Необходима авторизация для получения информации о пользователях'
      });
    }
    
    // Получаем пользователей через Directus API
    const users = await directusCrud.getAllUsers(token);
    
    if (!users || !Array.isArray(users)) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось получить информацию о пользователях'
      });
    }
    
    // Отмечаем активных пользователей (тех, кто был активен за последние 24 часа)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const processedUsers = users.map(user => {
      // Проверяем дату последнего доступа
      const lastAccess = user.last_access ? new Date(user.last_access) : null;
      const isActive = lastAccess && lastAccess > oneDayAgo;
      
      return {
        id: user.id,
        name: user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}` 
          : user.first_name || user.email?.split('@')[0] || 'Пользователь',
        email: user.email,
        status: user.status,
        lastAccess: user.last_access,
        isActive,
        isSmmAdmin: user.is_smm_admin || false
      };
    });
    
    // Считаем общее количество и количество активных пользователей
    const totalUsers = processedUsers.length;
    const activeUsers = processedUsers.filter(user => user.isActive).length;
    
    return res.json({
      success: true,
      data: {
        total: totalUsers,
        active: activeUsers,
        users: processedUsers
      }
    });
    
  } catch (error: any) {
    console.error('Ошибка при получении списка пользователей:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка сервера: ${error.message}`
    });
  }
});

// Проверка, является ли текущий пользователь SMM-администратором
usersRouter.get('/is-smm-admin', isAuthenticated, async (req: Request, res: Response) => {
  try {
    // Используем middleware isSmmAdmin для проверки, но здесь мы хотим вернуть результат,
    // а не блокировать доступ, поэтому повторно запрашиваем пользователя
    
    const userId = (req as any).userId;
    const isSmmAdminUser = (req as any).isSmmAdmin === true;
    
    return res.json({
      success: true,
      isSmmAdmin: isSmmAdminUser
    });
  } catch (error: any) {
    console.error('Ошибка при проверке статуса SMM-администратора:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка сервера: ${error.message}`
    });
  }
});