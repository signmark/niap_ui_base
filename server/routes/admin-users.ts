import { Router, Request, Response } from 'express';
import { DirectusCrud } from '../services/directus-crud.js';

const router = Router();

interface AuthenticatedRequest extends Request {
  session?: {
    userId?: string;
    [key: string]: any;
  };
}

// Получить список всех пользователей (только для админов)
router.get('/admin/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[admin-users] Запрос списка пользователей от администратора');
    
    // Получаем токен из заголовка авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[admin-users] Отсутствует токен авторизации');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const userToken = authHeader.substring(7);
    
    // Проверяем права администратора через прямой запрос к Directus
    const directusUrl = process.env.DIRECTUS_URL;
    
    // Получаем информацию о текущем пользователе
    const userResponse = await fetch(`${directusUrl}/users/me`, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      console.log('[admin-users] Неверный токен авторизации');
      return res.status(401).json({ error: 'Неверный токен авторизации' });
    }

    const userData = await userResponse.json();
    const currentUser = userData.data;
    
    console.log('[admin-users] Данные текущего пользователя:', {
      id: currentUser?.id,
      email: currentUser?.email,
      is_smm_admin: currentUser?.is_smm_admin,
      first_name: currentUser?.first_name,
      last_name: currentUser?.last_name
    });
    
    if (!currentUser?.is_smm_admin) {
      console.log(`[admin-users] Пользователь ${currentUser?.email} не является администратором SMM`);
      return res.status(403).json({ 
        error: 'Недостаточно прав доступа', 
        details: `Пользователь ${currentUser?.email} не имеет прав администратора`
      });
    }

    // Получаем список всех пользователей через прямой запрос к Directus
    console.log('[admin-users] Получаем список пользователей через Directus API');
    
    const usersResponse = await fetch(`${directusUrl}/users?fields=id,email,first_name,last_name,is_smm_admin,expire_date,last_access,status&sort=-last_access&limit=100`, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!usersResponse.ok) {
      console.log(`[admin-users] Ошибка получения пользователей: ${usersResponse.status}`);
      return res.status(500).json({ 
        success: false,
        error: 'Ошибка получения пользователей',
        details: `HTTP ${usersResponse.status}`
      });
    }

    const usersData = await usersResponse.json();
    const users = usersData.data || [];

    console.log(`[admin-users] Получено ${users.length} пользователей`);

    res.json({
      success: true,
      data: users
    });

  } catch (error: any) {
    console.error('[admin-users] Ошибка при получении списка пользователей:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка получения пользователей',
      details: error?.message || 'Unknown error'
    });
  }
});

// Обновить права пользователя (только для админов)
router.patch('/admin/users/:userId', async (req: any, res: Response) => {
  try {
    const { userId: targetUserId } = req.params;
    const { is_smm_admin, expire_date, status } = req.body;
    
    console.log(`[admin-users] Обновление пользователя ${targetUserId}:`, { is_smm_admin, expire_date, status });
    
    // Получаем токен из заголовка авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[admin-users] Отсутствует токен авторизации');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const userToken = authHeader.substring(7);
    
    // Проверяем права администратора
    const currentUserId = req.session?.userId;
    if (!currentUserId) {
      console.log('[admin-users] Пользователь не авторизован');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const directusCrud = new DirectusCrud(userToken);
    const currentUser = await directusCrud.getById('users', currentUserId);
    
    if (!currentUser?.is_smm_admin) {
      console.log('[admin-users] Пользователь не является администратором SMM');
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    // Подготавливаем данные для обновления
    const updateData: any = {};
    if (typeof is_smm_admin === 'boolean') {
      updateData.is_smm_admin = is_smm_admin;
    }
    if (expire_date) {
      updateData.expire_date = expire_date;
    }
    if (status) {
      updateData.status = status;
    }

    // Обновляем пользователя
    const updatedUser = await directusCrud.update('users', targetUserId, updateData);

    console.log(`[admin-users] Пользователь ${targetUserId} успешно обновлен`);

    res.json({
      success: true,
      data: updatedUser
    });

  } catch (error: any) {
    console.error('[admin-users] Ошибка при обновлении пользователя:', error);
    res.status(500).json({ 
      error: 'Ошибка сервера при обновлении пользователя',
      details: error.message 
    });
  }
});

// Получить статистику активности пользователей
router.get('/admin/users/activity', async (req, res) => {
  try {
    console.log('[admin-users] Запрос статистики активности пользователей');
    
    // Проверяем права администратора
    const userId = req.session?.userId;
    if (!userId) {
      console.log('[admin-users] Пользователь не авторизован');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const directusCrud = new DirectusCrud();
    const currentUser = await directusCrud.read('users', userId);
    
    if (!currentUser?.is_smm_admin) {
      console.log('[admin-users] Пользователь не является администратором SMM');
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    // Используем токен текущего авторизованного администратора
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[admin-users] Отсутствует токен авторизации для статистики');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const adminToken = authHeader.substring(7);
    console.log('[admin-users] Используем токен текущего администратора для получения статистики');

    // Получаем статистику пользователей напрямую через Directus API
    const directusUrl = process.env.DIRECTUS_URL;
    const statsResponse = await fetch(`${directusUrl}/users?fields=id,email,first_name,last_name,last_access,status,is_smm_admin,expire_date&sort=-last_access`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!statsResponse.ok) {
      console.log(`[admin-users] Ошибка получения статистики: ${statsResponse.status}`);
      return res.status(500).json({ error: 'Ошибка получения статистики пользователей' });
    }

    const statsData = await statsResponse.json();
    const users = statsData.data || [];

    // Подсчитываем статистику
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      total: users.length,
      active_today: users.filter(u => u.last_access && new Date(u.last_access) > oneDayAgo).length,
      active_week: users.filter(u => u.last_access && new Date(u.last_access) > oneWeekAgo).length,
      active_month: users.filter(u => u.last_access && new Date(u.last_access) > oneMonthAgo).length,
      admins: users.filter(u => u.is_smm_admin).length,
      expired: users.filter(u => u.expire_date && new Date(u.expire_date) < now).length,
      suspended: users.filter(u => u.status === 'suspended').length
    };

    console.log('[admin-users] Статистика активности:', stats);

    res.json({
      success: true,
      data: {
        stats,
        users: users.slice(0, 50) // Ограничиваем до 50 последних пользователей
      }
    });

  } catch (error: any) {
    console.error('[admin-users] Ошибка при получении статистики активности:', error);
    res.status(500).json({ 
      error: 'Ошибка сервера при получении статистики активности',
      details: error.message 
    });
  }
});

export default router;