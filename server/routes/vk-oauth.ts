import express from 'express';
import axios from 'axios';
import { log } from '../utils/logger';

const router = express.Router();

/**
 * Получение списка VK групп пользователя
 */
router.get('/vk/groups', async (req, res) => {
  const { access_token } = req.query;

  if (!access_token) {
    return res.status(400).json({
      success: false,
      error: 'Access token не предоставлен'
    });
  }

  try {
    // Получаем список групп пользователя где он администратор
    const groupsResponse = await axios.get('https://api.vk.com/method/groups.get', {
      params: {
        access_token: access_token,
        extended: 1,
        filter: 'admin,editor,moder',
        fields: 'name,screen_name,members_count,description,photo_200',
        v: '5.131'
      }
    });

    if (groupsResponse.data.error) {
      throw new Error(groupsResponse.data.error.error_msg || 'VK API Error');
    }

    const groups = groupsResponse.data.response?.items || [];
    
    // Форматируем данные для фронтенда
    const formattedGroups = groups.map((group: any) => ({
      id: `-${group.id}`, // Отрицательный ID для групп в VK API
      name: group.name,
      screen_name: group.screen_name,
      members_count: group.members_count || 0,
      description: group.description || '',
      photo: group.photo_200 || ''
    }));

    log('VK groups fetched successfully', { 
      groupsCount: formattedGroups.length,
      firstGroup: formattedGroups[0]?.name 
    });

    res.json({
      success: true,
      groups: formattedGroups
    });

  } catch (error: any) {
    console.error('❌ Error fetching VK groups:', error.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения списка VK групп',
      details: error.message
    });
  }
});

/**
 * Проверка валидности VK токена
 */
router.get('/vk/validate', async (req, res) => {
  const { access_token } = req.query;

  if (!access_token) {
    return res.status(400).json({
      success: false,
      error: 'Access token не предоставлен'
    });
  }

  try {
    // Проверяем токен через метод users.get
    const userResponse = await axios.get('https://api.vk.com/method/users.get', {
      params: {
        access_token: access_token,
        v: '5.131'
      }
    });

    if (userResponse.data.error) {
      throw new Error(userResponse.data.error.error_msg || 'Invalid token');
    }

    const user = userResponse.data.response?.[0];
    
    res.json({
      success: true,
      valid: true,
      user: {
        id: user?.id,
        first_name: user?.first_name,
        last_name: user?.last_name
      }
    });

  } catch (error: any) {
    res.json({
      success: false,
      valid: false,
      error: error.message
    });
  }
});

export default router;