import { Router, Request, Response } from 'express';
import { DirectusCrud } from '../services/directus-crud.js';

const router = Router();

// Получить список всех пользователей (только для админов)
router.get('/admin/users', async (req: any, res: Response) => {
  try {
    console.log('[admin-users] Запрос списка пользователей от администратора');
    
    // Проверяем права администратора
    const userId = req.session?.userId;
    if (!userId) {
      console.log('[admin-users] Пользователь не авторизован');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    // Получаем информацию о текущем пользователе
    const directusCrud = new DirectusCrud();
    const currentUser = await directusCrud.getById('users', userId);
    
    if (!currentUser?.is_smm_admin) {
      console.log('[admin-users] Пользователь не является администратором SMM');
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    // Используем токен текущего авторизованного администратора
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[admin-users] Отсутствует токен авторизации');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const adminToken = authHeader.substring(7);
    console.log('[admin-users] Используем токен текущего администратора для получения пользователей');
    console.log('[admin-users] Токен начинается с:', adminToken.substring(0, 10) + '...');

    // Получаем список всех пользователей напрямую через Directus API
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    const requestUrl = `${directusUrl}/users?fields=id,email,first_name,last_name,is_smm_admin,expire_date,last_access,status&sort=-last_access&limit=100`;
    console.log('[admin-users] Запрос к URL:', requestUrl);
    
    const usersResponse = await fetch(requestUrl, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[admin-users] Статус ответа:', usersResponse.status);
    console.log('[admin-users] Статус текст:', usersResponse.statusText);

    if (!usersResponse.ok) {
      const errorText = await usersResponse.text();
      console.log('[admin-users] Текст ошибки:', errorText);
      console.log(`[admin-users] Ошибка получения пользователей: ${usersResponse.status}`);
      return res.status(500).json({ 
        error: 'Ошибка получения списка пользователей',
        status: usersResponse.status,
        details: errorText
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
      error: 'Ошибка сервера при получении списка пользователей',
      details: error.message 
    });
  }
});

// Обновить права пользователя (только для админов)
router.patch('/admin/users/:userId', async (req: any, res: Response) => {
  try {
    const { userId: targetUserId } = req.params;
    const { is_smm_admin, expire_date, status } = req.body;
    
    console.log(`[admin-users] Обновление пользователя ${targetUserId}:`, { is_smm_admin, expire_date, status });
    
    // Проверяем права администратора
    const currentUserId = req.session?.userId;
    if (!currentUserId) {
      console.log('[admin-users] Пользователь не авторизован');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const directusCrud = new DirectusCrud();
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
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
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