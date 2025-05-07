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
    
    // Получаем логи активности пользователей
    const userActivities = await directusCrud.getUserActivity(token, undefined, 100);
    
    // Группируем активность по пользователям
    const userActivityMap = new Map();
    
    if (userActivities && Array.isArray(userActivities)) {
      userActivities.forEach(activity => {
        if (activity.user && activity.user.id) {
          const userId = activity.user.id;
          if (!userActivityMap.has(userId)) {
            userActivityMap.set(userId, []);
          }
          userActivityMap.get(userId).push({
            action: activity.action,
            collection: activity.collection,
            timestamp: activity.timestamp,
            ip: activity.ip,
            user_agent: activity.user_agent,
            item: activity.item
          });
        }
      });
    }
    
    // Отмечаем активных пользователей (тех, кто был активен за последние 24 часа)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const processedUsers = users.map(user => {
      // Проверяем дату последнего доступа
      const lastAccess = user.last_access ? new Date(user.last_access) : null;
      const isActive = lastAccess && lastAccess > oneDayAgo;
      
      // Получаем активность пользователя
      const userActivity = userActivityMap.get(user.id) || [];
      
      // Определяем последнее действие пользователя
      let lastActivity = null;
      let recentActions = [];
      
      if (userActivity.length > 0) {
        // Сортируем активность по времени (от новых к старым)
        userActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        // Получаем последнее действие
        lastActivity = userActivity[0];
        
        // Получаем последние 5 действий
        recentActions = userActivity.slice(0, 5).map(act => {
          // Формируем понятное описание действия
          let actionDescription = '';
          
          switch (act.action) {
            case 'create':
              actionDescription = `Создал(а) запись в "${act.collection}"`;
              break;
            case 'update':
              actionDescription = `Обновил(а) запись в "${act.collection}"`;
              break;
            case 'delete':
              actionDescription = `Удалил(а) запись из "${act.collection}"`;
              break;
            case 'login':
              actionDescription = 'Вход в систему';
              break;
            default:
              actionDescription = `${act.action} в "${act.collection}"`;
          }
          
          return {
            description: actionDescription,
            timestamp: act.timestamp,
            collection: act.collection,
            action: act.action
          };
        });
      }
      
      return {
        id: user.id,
        name: user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}` 
          : user.first_name || user.email?.split('@')[0] || 'Пользователь',
        email: user.email,
        status: user.status,
        lastAccess: user.last_access,
        isActive,
        isSmmAdmin: user.is_smm_admin || false,
        activityCount: userActivity.length,
        lastActivity: lastActivity ? {
          action: lastActivity.action,
          collection: lastActivity.collection,
          timestamp: lastActivity.timestamp
        } : null,
        recentActions
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