import { Router, Request, Response } from 'express';
import { DirectusCrud } from '../services/directus-crud.js';

const router = Router();

// Получить список всех пользователей (только для админов)
router.get('/admin/users', async (req, res) => {
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
    const currentUser = await directusCrud.read('users', userId);
    
    if (!currentUser?.is_smm_admin) {
      console.log('[admin-users] Пользователь не является администратором SMM');
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    // Получаем список всех пользователей
    const users = await directusCrud.readMany('users', {
      fields: ['id', 'email', 'first_name', 'last_name', 'is_smm_admin', 'expire_date', 'last_access', 'status'],
      filter: {},
      sort: ['-last_access']
    });

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
router.patch('/admin/users/:userId', async (req, res) => {
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
    const currentUser = await directusCrud.read('users', currentUserId);
    
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

    // Получаем статистику пользователей
    const users = await directusCrud.readMany('users', {
      fields: ['id', 'email', 'first_name', 'last_name', 'last_access', 'status', 'is_smm_admin', 'expire_date'],
      filter: {},
      sort: ['-last_access']
    });

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