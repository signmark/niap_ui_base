import express from 'express';
import { log } from '../utils/logger';
import axios from 'axios';

const router = express.Router();

/**
 * Получение Instagram настроек из JSON кампании
 */
router.get('/campaigns/:campaignId/instagram-settings', async (req, res) => {
  const { campaignId } = req.params;
  const userToken = req.headers.authorization?.replace('Bearer ', '');

  try {
    console.log('📋 GET Instagram settings for campaign:', campaignId);

    if (!userToken) {
      return res.status(401).json({
        success: false,
        error: 'Токен авторизации не предоставлен'
      });
    }

    // Получаем настройки кампании
    const getCampaignResponse = await axios.get(
      `${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`,
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const campaign = getCampaignResponse.data.data;
    const socialMediaSettings = campaign.social_media_settings || {};
    const instagramSettings = socialMediaSettings.instagram || null;

    console.log('📋 Instagram settings found:', {
      hasSettings: !!instagramSettings,
      appId: instagramSettings?.appId,
      configured: instagramSettings?.configured
    });

    res.json({
      success: true,
      settings: instagramSettings
    });

  } catch (error: any) {
    console.error('❌ Error retrieving Instagram settings:', error.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении Instagram настроек',
      details: error.message
    });
  }
});

/**
 * Сохранение Instagram настроек в JSON кампании
 */
router.patch('/campaigns/:campaignId/instagram-settings', async (req, res) => {
  const { campaignId } = req.params;
  const { appId, appSecret, instagramId, accessToken, setupCompletedAt } = req.body;
  const userToken = req.headers.authorization?.replace('Bearer ', '');

  try {
    console.log('🔥 INSTAGRAM SETTINGS ENDPOINT');
    console.log('🔥 Campaign ID:', campaignId);
    console.log('🔥 Full request body:', JSON.stringify(req.body, null, 2));
    console.log('🔥 Instagram settings:', { 
      appId: appId ? 'present' : 'missing', 
      appSecret: appSecret ? 'present' : 'missing', 
      instagramId,
      accessToken: accessToken ? 'present' : 'missing'
    });

    if (!appId || !appSecret) {
      return res.status(400).json({
        success: false,
        error: 'App ID и App Secret обязательны'
      });
    }

    // Получим существующие настройки кампании
    const getCampaignResponse = await axios.get(
      `${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`,
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const campaign = getCampaignResponse.data.data;
    const existingSettings = campaign.social_media_settings || {};

    // Обновляем Instagram настройки (сохраняем и объединяем с существующими)
    const existingInstagram = existingSettings.instagram || {};
    const updatedSettings = {
      ...existingSettings,
      instagram: {
        ...existingInstagram, // Сохраняем существующие данные (токены, аккаунты)
        appId,
        appSecret, // App Secret тоже сохраняется в БД
        instagramId: instagramId || existingInstagram.instagramId || '',
        accessToken: accessToken || existingInstagram.accessToken, // Сохраняем accessToken
        setupCompletedAt: setupCompletedAt || new Date().toISOString(),
        configured: true
      }
    };

    // Сохраняем обновленные настройки
    const updateResponse = await axios.patch(
      `${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`,
      {
        social_media_settings: updatedSettings
      },
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('🔥 Instagram settings saved successfully');
    console.log('🔥 Final Instagram settings:', JSON.stringify(updatedSettings.instagram, null, 2));

    res.json({
      success: true,
      data: updatedSettings.instagram
    });

  } catch (error: any) {
    console.error('❌ Error saving Instagram settings:', error?.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      error: error?.response?.data?.errors?.[0]?.message || 'Ошибка сохранения настроек Instagram'
    });
  }
});

export default router;