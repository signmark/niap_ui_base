import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();



// Проверка прав администратора
async function checkAdminRights(token: string): Promise<{ isAdmin: boolean; userData: any }> {
  try {
    const directusUrl = process.env.DIRECTUS_URL;
    // Декодируем токен напрямую
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const response = { 
      data: { 
        data: { 
          id: payload.id, 
          email: payload.email || 'unknown@email.com' 
        } 
      } 
    };

    const userData = response.data.data;
    const isAdmin = userData.is_smm_admin === true;
    
    return { isAdmin, userData };
  } catch (error) {
    console.error('[admin-users] Ошибка проверки прав:', error);
    return { isAdmin: false, userData: null };
  }
}

// Получить список всех пользователей (только для админов)
router.get('/admin/users', async (req: Request, res: Response) => {
  try {
    console.log('[admin-users] Запрос списка пользователей от администратора');
    
    // Получаем токен из заголовка
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[admin-users] Отсутствует токен авторизации');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const userToken = authHeader.substring(7);
    
    // Проверяем права администратора
    const { isAdmin, userData } = await checkAdminRights(userToken);
    if (!isAdmin) {
      console.log('[admin-users] Пользователь не является администратором');
      return res.status(403).json({ error: 'Доступ запрещен: требуются права администратора' });
    }
    
    console.log('[admin-users] Администратор подтвержден:', userData.email);

    // Получаем список всех пользователей через админский токен, поскольку пользовательские токены не имеют доступа к /users
    console.log('[admin-users] Получаем список пользователей через Directus API с админским токеном');
    
    const directusUrl = process.env.DIRECTUS_URL;
    
    // Используем готовый админский токен из env
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
      console.log(`[admin-users] URL запроса: ${directusUrl}/users`);
      console.log(`[admin-users] Токен: ${adminToken ? adminToken.substring(0, 10) + '...' : 'отсутствует'}`);
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
    const { isAdmin } = await checkAdminRights(userToken);
    if (!isAdmin) {
      console.log('[admin-users] Пользователь не является администратором');
      return res.status(403).json({ error: 'Доступ запрещен: требуются права администратора' });
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
    const directusUrl = process.env.DIRECTUS_URL;
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
    
    if (!adminToken) {
      console.log('[admin-users] Нет админского токена');
      return res.status(500).json({ 
        success: false,
        error: 'Ошибка конфигурации сервера'
      });
    }

    // Обновляем пользователя через админский токен
    const updateResponse = await axios.patch(`${directusUrl}/users/${targetUserId}`, updateData, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`[admin-users] Пользователь ${targetUserId} успешно обновлен`);

    res.json({
      success: true,
      data: updateResponse.data.data
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
    
    // Получаем токен из заголовка авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[admin-users] Отсутствует токен авторизации');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const userToken = authHeader.substring(7);
    
    // Проверяем права администратора
    const { isAdmin } = await checkAdminRights(userToken);
    if (!isAdmin) {
      console.log('[admin-users] Пользователь не является администратором');
      return res.status(403).json({ error: 'Доступ запрещен: требуются права администратора' });
    }

    console.log('[admin-users] Используем админский токен для получения статистики');

    // Получаем статистику пользователей напрямую через Directus API
    const directusUrl = process.env.DIRECTUS_URL;
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
    
    if (!adminToken) {
      console.log('[admin-users] Нет админского токена для статистики');
      return res.status(500).json({ 
        success: false,
        error: 'Ошибка конфигурации сервера'
      });
    }
    
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
      active_today: users.filter((u: any) => u.last_access && new Date(u.last_access) > oneDayAgo).length,
      active_week: users.filter((u: any) => u.last_access && new Date(u.last_access) > oneWeekAgo).length,
      active_month: users.filter((u: any) => u.last_access && new Date(u.last_access) > oneMonthAgo).length,
      admins: users.filter((u: any) => u.is_smm_admin).length,
      expired: users.filter((u: any) => u.expire_date && new Date(u.expire_date) < now).length,
      suspended: users.filter((u: any) => u.status === 'suspended').length
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