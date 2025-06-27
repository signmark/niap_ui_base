import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { log } from '../utils/logger';
import axios from 'axios';

const router = express.Router();

// Получить статус OAuth авторизации для кампании
router.get('/status/:campaignId', authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    log(`[Instagram OAuth] Проверка статуса для кампании ${campaignId}`, 'instagram-oauth');

    // Получаем данные кампании из Directus
    const directusUrl = process.env.DIRECTUS_URL;
    const token = req.headers.authorization?.replace('Bearer ', '');

    const campaignResponse = await axios.get(`${directusUrl}/items/user_campaigns/${campaignId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const campaign = campaignResponse.data?.data;
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Кампания не найдена' });
    }

    // Проверяем настройки Instagram в social_media_settings
    const socialSettings = campaign.social_media_settings;
    const instagramSettings = socialSettings?.instagram;

    if (!instagramSettings?.accessToken && !instagramSettings?.oauthToken) {
      return res.json({
        success: true,
        status: {
          isConnected: false
        }
      });
    }

    // Проверяем валидность токена (если есть)
    let isValid = false;
    let username = '';
    let profilePicture = '';

    if (instagramSettings.accessToken || instagramSettings.oauthToken) {
      try {
        // Пытаемся проверить токен через Instagram API
        const tokenToCheck = instagramSettings.accessToken || instagramSettings.oauthToken;
        
        // Базовая проверка через Graph API
        const testResponse = await axios.get(`https://graph.instagram.com/me?fields=id,username&access_token=${tokenToCheck}`);
        
        if (testResponse.data?.id) {
          isValid = true;
          username = testResponse.data.username || 'Instagram аккаунт';
          
          // Пытаемся получить фото профиля
          try {
            const profileResponse = await axios.get(`https://graph.instagram.com/me?fields=profile_picture_url&access_token=${tokenToCheck}`);
            profilePicture = profileResponse.data?.profile_picture_url || '';
          } catch (profileError) {
            log(`[Instagram OAuth] Не удалось получить фото профиля: ${profileError}`, 'instagram-oauth');
          }
        }
      } catch (tokenError: any) {
        log(`[Instagram OAuth] Токен недействителен: ${tokenError.message}`, 'instagram-oauth');
        isValid = false;
      }
    }

    res.json({
      success: true,
      status: {
        isConnected: isValid,
        username: username,
        profilePicture: profilePicture,
        lastConnected: instagramSettings.lastConnected || new Date().toISOString()
      }
    });

  } catch (error: any) {
    log(`[Instagram OAuth] Ошибка проверки статуса: ${error.message}`, 'instagram-oauth');
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Обработчик callback от OAuth сервиса
router.post('/callback', authMiddleware, async (req, res) => {
  try {
    const { campaignId, accessToken, refreshToken, username, profilePicture, expiresIn } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    if (!campaignId || !accessToken) {
      return res.status(400).json({ success: false, error: 'Отсутствуют обязательные параметры' });
    }

    log(`[Instagram OAuth] Обработка callback для кампании ${campaignId}`, 'instagram-oauth');

    // Получаем текущие данные кампании
    const directusUrl = process.env.DIRECTUS_URL;
    const token = req.headers.authorization?.replace('Bearer ', '');

    const campaignResponse = await axios.get(`${directusUrl}/items/user_campaigns/${campaignId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const campaign = campaignResponse.data?.data;
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Кампания не найдена' });
    }

    // Проверяем, что кампания принадлежит пользователю
    if (campaign.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Нет доступа к кампании' });
    }

    // Обновляем настройки Instagram в social_media_settings
    const currentSettings = campaign.social_media_settings || {};
    const updatedSettings = {
      ...currentSettings,
      instagram: {
        ...currentSettings.instagram,
        oauthToken: accessToken,
        accessToken: accessToken, // Сохраняем также в accessToken для совместимости
        refreshToken: refreshToken || null,
        username: username || null,
        profilePicture: profilePicture || null,
        expiresIn: expiresIn || null,
        lastConnected: new Date().toISOString(),
        authMethod: 'oauth' // Отмечаем, что используется OAuth
      }
    };

    // Сохраняем обновленные настройки
    const updateResponse = await axios.patch(`${directusUrl}/items/user_campaigns/${campaignId}`, {
      social_media_settings: updatedSettings
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (updateResponse.status === 200) {
      log(`[Instagram OAuth] Настройки успешно сохранены для кампании ${campaignId}`, 'instagram-oauth');
      
      res.json({
        success: true,
        message: 'Instagram OAuth авторизация завершена успешно'
      });
    } else {
      throw new Error('Не удалось сохранить настройки');
    }

  } catch (error: any) {
    log(`[Instagram OAuth] Ошибка callback: ${error.message}`, 'instagram-oauth');
    res.status(500).json({ success: false, error: 'Ошибка сохранения настроек' });
  }
});

// Отключить Instagram OAuth
router.delete('/disconnect/:campaignId', authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    log(`[Instagram OAuth] Отключение для кампании ${campaignId}`, 'instagram-oauth');

    // Получаем текущие данные кампании
    const directusUrl = process.env.DIRECTUS_URL;
    const token = req.headers.authorization?.replace('Bearer ', '');

    const campaignResponse = await axios.get(`${directusUrl}/items/user_campaigns/${campaignId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const campaign = campaignResponse.data?.data;
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Кампания не найдена' });
    }

    // Проверяем, что кампания принадлежит пользователю
    if (campaign.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Нет доступа к кампании' });
    }

    // Очищаем настройки Instagram
    const currentSettings = campaign.social_media_settings || {};
    const updatedSettings = {
      ...currentSettings,
      instagram: {
        ...currentSettings.instagram,
        oauthToken: null,
        accessToken: currentSettings.instagram?.token || null, // Сохраняем старый API токен если был
        refreshToken: null,
        username: null,
        profilePicture: null,
        expiresIn: null,
        lastConnected: null,
        authMethod: null
      }
    };

    // Сохраняем обновленные настройки
    const updateResponse = await axios.patch(`${directusUrl}/items/user_campaigns/${campaignId}`, {
      social_media_settings: updatedSettings
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (updateResponse.status === 200) {
      log(`[Instagram OAuth] Instagram отключен для кампании ${campaignId}`, 'instagram-oauth');
      
      res.json({
        success: true,
        message: 'Instagram OAuth отключен'
      });
    } else {
      throw new Error('Не удалось обновить настройки');
    }

  } catch (error: any) {
    log(`[Instagram OAuth] Ошибка отключения: ${error.message}`, 'instagram-oauth');
    res.status(500).json({ success: false, error: 'Ошибка отключения' });
  }
});

export default router;