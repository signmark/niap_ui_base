import { Router, Request, Response } from 'express';

const router = Router();

// Получить список всех пользователей (только для админов)
router.get('/admin/users', async (req: Request, res: Response) => {
  try {
    console.log('[admin-users] Запрос списка пользователей от администратора');
    
    // Получаем токен из заголовка авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[admin-users] Отсутствует токен авторизации');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const userToken = authHeader.substring(7);
    const directusUrl = process.env.DIRECTUS_URL;
    
    // Проверяем права администратора через прямой запрос к Directus
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

    // Получаем список всех пользователей через админский токен
    console.log('[admin-users] Получаем список пользователей через Directus API с админским токеном');
    
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
    if (!adminToken) {
      console.log('[admin-users] Нет админского токена в env');
      return res.status(500).json({ 
        success: false,
        error: 'Ошибка конфигурации сервера'
      });
    }
    
    const usersResponse = await fetch(`${directusUrl}/users?fields=id,email,first_name,last_name,is_smm_admin,expire_date,last_access,status&sort=-last_access&limit=100`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!usersResponse.ok) {
      const errorText = await usersResponse.text();
      console.log(`[admin-users] Ошибка получения пользователей: ${usersResponse.status}`);
      console.log(`[admin-users] Детали ошибки: ${errorText}`);
      return res.status(500).json({ 
        success: false,
        error: 'Ошибка получения пользователей',
        details: `HTTP ${usersResponse.status}: ${errorText}`
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
router.patch('/admin/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId: targetUserId } = req.params;
    const { is_smm_admin, expire_date, status } = req.body;
    
    console.log(`[admin-users] Запрос на обновление пользователя ${targetUserId}`);
    
    // Получаем токен из заголовка авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[admin-users] Отсутствует токен авторизации');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const userToken = authHeader.substring(7);
    const directusUrl = process.env.DIRECTUS_URL;
    
    // Проверяем права администратора
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

    // Используем админский токен для обновления
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
    if (!adminToken) {
      return res.status(500).json({ 
        success: false,
        error: 'Ошибка конфигурации сервера'
      });
    }

    const updateResponse = await fetch(`${directusUrl}/users/${targetUserId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.log(`[admin-users] Ошибка обновления пользователя: ${updateResponse.status}`);
      return res.status(500).json({ 
        error: 'Ошибка обновления пользователя',
        details: `HTTP ${updateResponse.status}: ${errorText}`
      });
    }

    const updatedUser = await updateResponse.json();

    console.log(`[admin-users] Пользователь ${targetUserId} успешно обновлен`);

    res.json({
      success: true,
      data: updatedUser.data
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
router.get('/admin/users/activity', async (req: Request, res: Response) => {
  try {
    console.log('[admin-users] Запрос статистики активности пользователей');
    
    // Получаем токен из заголовка авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[admin-users] Отсутствует токен авторизации');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const userToken = authHeader.substring(7);
    const directusUrl = process.env.DIRECTUS_URL;
    
    // Проверяем права администратора
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
    
    if (!currentUser?.is_smm_admin) {
      console.log('[admin-users] Пользователь не является администратором SMM');
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    // Используем админский токен для получения статистики
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
    if (!adminToken) {
      return res.status(500).json({ 
        success: false,
        error: 'Ошибка конфигурации сервера'
      });
    }

    // Получаем активных пользователей за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activityResponse = await fetch(`${directusUrl}/users?fields=id,email,last_access&filter[last_access][_gte]=${thirtyDaysAgo.toISOString()}&sort=-last_access`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!activityResponse.ok) {
      const errorText = await activityResponse.text();
      return res.status(500).json({ 
        success: false,
        error: 'Ошибка получения статистики активности',
        details: `HTTP ${activityResponse.status}: ${errorText}`
      });
    }

    const activityData = await activityResponse.json();
    const activeUsers = activityData.data || [];

    // Получаем общее количество пользователей
    const totalUsersResponse = await fetch(`${directusUrl}/users?aggregate[count]=*`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    let totalUsers = 0;
    if (totalUsersResponse.ok) {
      const totalData = await totalUsersResponse.json();
      totalUsers = totalData.data?.[0]?.count || 0;
    }

    const activityStats = {
      totalUsers,
      activeUsers: activeUsers.length,
      activityRate: totalUsers > 0 ? Math.round((activeUsers.length / totalUsers) * 100) : 0,
      recentActivity: activeUsers.slice(0, 10) // Последние 10 активных пользователей
    };

    console.log(`[admin-users] Статистика активности: ${activeUsers.length}/${totalUsers} активных пользователей`);

    res.json({
      success: true,
      data: activityStats
    });

  } catch (error: any) {
    console.error('[admin-users] Ошибка при получении статистики активности:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка получения статистики активности',
      details: error?.message || 'Unknown error'
    });
  }
});

export { router as adminUsersRouter };