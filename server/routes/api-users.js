import express from 'express';
import { isAuthenticated, isSmmAdmin } from '../middleware/auth.js';
import { directusApi } from '../directus.js';
import { log } from '../utils/logger.js';

const router = express.Router();

/**
 * Получить список активных пользователей
 * @route GET /api/users/active
 * @access Private (только для админов SMM)
 */
router.get('/active', isAuthenticated, isSmmAdmin, async (req, res) => {
  try {
    // Получаем список пользователей из Directus
    const response = await directusApi.get('/users', {
      headers: { 
        Authorization: `Bearer ${req.user.token}`
      },
      params: {
        // Фильтрация и сортировка
        sort: ['-last_access'],
        filter: { 
          status: { _eq: 'active' }
        }
      }
    });

    // Форматируем ответ
    const users = response.data.data.map(user => ({
      id: user.id,
      name: user.first_name && user.last_name 
        ? `${user.first_name} ${user.last_name}`
        : user.email,
      email: user.email,
      status: user.status,
      lastAccess: user.last_access,
      isActive: user.status === 'active'
    }));

    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive).length;

    return res.json({
      success: true,
      data: {
        total: totalUsers,
        active: activeUsers,
        users: users
      }
    });
  } catch (error) {
    log(`Ошибка при получении списка пользователей: ${error.message}`, 'api-users');
    return res.status(500).json({
      success: false,
      error: 'Ошибка при получении списка пользователей'
    });
  }
});

export default router;