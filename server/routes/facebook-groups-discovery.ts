import express from 'express';
import axios from 'axios';
import { log } from '../utils/logger';

const router = express.Router();

// Автоматическое обнаружение групп, связанных с Facebook страницами
router.get('/campaigns/:campaignId/discover-facebook-groups', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { accessToken } = req.query;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Требуется accessToken для обнаружения групп'
      });
    }

    console.log('🔍 [FB-GROUPS] Начинаем обнаружение Facebook групп...');

    // 1. Получаем страницы пользователя
    const pagesResponse = await axios.get(`https://graph.facebook.com/me/accounts`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,access_token,category'
      }
    });

    console.log('📄 [FB-GROUPS] Найдено страниц:', pagesResponse.data.data.length);

    const discoveredGroups = [];

    // 2. Для каждой страницы ищем связанные группы
    for (const page of pagesResponse.data.data) {
      console.log(`🔍 [FB-GROUPS] Проверяем страницу: ${page.name} (${page.id})`);

      try {
        // Проверяем группы, где страница является администратором
        const groupsResponse = await axios.get(`https://graph.facebook.com/${page.id}/groups`, {
          params: {
            access_token: page.access_token,
            fields: 'id,name,description,privacy,member_count,cover'
          }
        });

        if (groupsResponse.data.data && groupsResponse.data.data.length > 0) {
          console.log(`📊 [FB-GROUPS] Найдено групп для страницы ${page.name}:`, groupsResponse.data.data.length);

          for (const group of groupsResponse.data.data) {
            discoveredGroups.push({
              groupId: group.id,
              groupName: group.name,
              groupDescription: group.description || '',
              privacy: group.privacy,
              memberCount: group.member_count || 0,
              cover: group.cover?.source || '',
              linkedPageId: page.id,
              linkedPageName: page.name,
              pageAccessToken: page.access_token
            });
          }
        }
      } catch (groupError) {
        console.log(`⚠️ [FB-GROUPS] Ошибка получения групп для страницы ${page.name}:`, groupError.response?.data || groupError.message);
        // Продолжаем с другими страницами
      }
    }

    // 3. Также проверяем группы пользователя напрямую
    try {
      const userGroupsResponse = await axios.get(`https://graph.facebook.com/me/groups`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,description,privacy,member_count,cover,administrator'
        }
      });

      if (userGroupsResponse.data.data) {
        for (const group of userGroupsResponse.data.data) {
          // Добавляем только если пользователь администратор
          if (group.administrator) {
            // Проверяем, не добавлена ли группа уже через страницы
            const alreadyAdded = discoveredGroups.find(g => g.groupId === group.id);
            if (!alreadyAdded) {
              discoveredGroups.push({
                groupId: group.id,
                groupName: group.name,
                groupDescription: group.description || '',
                privacy: group.privacy,
                memberCount: group.member_count || 0,
                cover: group.cover?.source || '',
                linkedPageId: null,
                linkedPageName: 'Прямой доступ',
                pageAccessToken: null,
                userAccessToken: accessToken
              });
            }
          }
        }
      }
    } catch (userGroupError) {
      console.log(`⚠️ [FB-GROUPS] Ошибка получения групп пользователя:`, userGroupError.response?.data || userGroupError.message);
    }

    console.log(`✅ [FB-GROUPS] Всего обнаружено групп: ${discoveredGroups.length}`);

    res.json({
      success: true,
      groups: discoveredGroups,
      totalGroups: discoveredGroups.length,
      groupsByPage: discoveredGroups.reduce((acc, group) => {
        const pageKey = group.linkedPageName || 'Прямой доступ';
        if (!acc[pageKey]) acc[pageKey] = [];
        acc[pageKey].push(group);
        return acc;
      }, {} as Record<string, any[]>)
    });

  } catch (error) {
    console.log('❌ [FB-GROUPS] Ошибка обнаружения групп:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка обнаружения Facebook групп',
      details: error.response?.data || error.message
    });
  }
});

// Сохранение выбранных групп в настройки кампании
router.post('/campaigns/:campaignId/save-facebook-groups', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { selectedGroups } = req.body;

    if (!selectedGroups || !Array.isArray(selectedGroups)) {
      return res.status(400).json({
        success: false,
        error: 'Требуется массив selectedGroups'
      });
    }

    console.log(`💾 [FB-GROUPS] Сохраняем ${selectedGroups.length} групп для кампании ${campaignId}`);

    // Получаем текущие настройки кампании
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Токен авторизации не найден' });
    }

    // Получаем текущие настройки
    const getCurrentSettings = await fetch(`${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!getCurrentSettings.ok) {
      return res.status(500).json({
        success: false,
        error: 'Ошибка получения текущих настроек кампании'
      });
    }

    const currentData = await getCurrentSettings.json();
    const currentSettings = currentData.data?.social_media_settings || {};

    // Обновляем Facebook настройки с группами
    const updatedFacebookSettings = {
      ...currentSettings.facebook,
      groups: selectedGroups.map(group => ({
        groupId: group.groupId,
        groupName: group.groupName,
        privacy: group.privacy,
        memberCount: group.memberCount,
        linkedPageId: group.linkedPageId,
        linkedPageName: group.linkedPageName,
        enabled: true
      }))
    };

    const updatedSettings = {
      ...currentSettings,
      facebook: updatedFacebookSettings
    };

    // Сохраняем обновленные настройки
    const updateResponse = await fetch(`${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        social_media_settings: updatedSettings
      })
    });

    if (!updateResponse.ok) {
      return res.status(500).json({
        success: false,
        error: 'Ошибка сохранения настроек кампании'
      });
    }

    console.log(`✅ [FB-GROUPS] Группы успешно сохранены для кампании ${campaignId}`);

    res.json({
      success: true,
      message: `Сохранено ${selectedGroups.length} Facebook групп`,
      groups: selectedGroups
    });

  } catch (error) {
    console.log('❌ [FB-GROUPS] Ошибка сохранения групп:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сохранения Facebook групп',
      details: error.message
    });
  }
});

export default router;