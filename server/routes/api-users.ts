/**
 * API для работы с пользователями
 */
import express from 'express';
import { directusApiManager } from '../directus';
import { isAuthenticated } from '../middleware/auth';
import { directusCrud } from '../services/directus-crud';

const router = express.Router();

/**
 * Получение списка активных пользователей (только для администраторов)
 */
router.get('/active', isAuthenticated, async (req: express.Request, res: express.Response) => {
  try {
    console.log('Получение списка активных пользователей');
    
    // Используем токен из запроса
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Необходима авторизация для получения информации о пользователях'
      });
    }
    
    // Проверка прав администратора
    const isAdmin = (req as any).isSmmAdmin === true;
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Недостаточно прав для просмотра списка пользователей'
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
    
    // Определяем активных пользователей (с доступом за последние 24 часа)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const activeUsers = users.filter(user => 
      user.last_access && new Date(user.last_access) > oneDayAgo
    );

    return res.json({
      success: true,
      data: {
        total: users.length,
        active: activeUsers.length,
        users: users.map(user => ({
          id: user.id,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          email: user.email,
          status: user.status,
          lastAccess: user.last_access,
          isActive: user.last_access ? new Date(user.last_access) > oneDayAgo : false
        }))
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

/**
 * Получение информации о текущем пользователе
 */
router.get('/me', isAuthenticated, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Пользователь не аутентифицирован'
      });
    }
    
    return res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        status: 'active'
      }
    });
  } catch (error: any) {
    console.error('Ошибка при получении данных текущего пользователя:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка сервера: ${error.message}`
    });
  }
});

export default router;
