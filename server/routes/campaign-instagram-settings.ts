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

    // Используем системный токен как fallback для доступа к базе данных
    const tokenToUse = userToken || process.env.DIRECTUS_TOKEN;
    
    if (!tokenToUse) {
      return res.status(401).json({
        success: false,
        error: 'Токен авторизации не доступен'
      });
    }

    console.log('📋 Using token type:', userToken ? 'user' : 'system');

    // Получаем настройки кампании
    const getCampaignResponse = await axios.get(
      `${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`,
      {
        headers: {
          Authorization: `Bearer ${tokenToUse}`,
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

/**
 * Получение Instagram Business Account ID через Graph API
 */
router.post('/campaigns/:campaignId/fetch-instagram-business-id', async (req, res) => {
  const { campaignId } = req.params;
  const { accessToken } = req.body;
  const userToken = req.headers.authorization?.replace('Bearer ', '');

  try {
    console.log('🔍 Fetching Instagram Business Account ID for campaign:', campaignId);
    console.log('🔍 Access Token provided:', accessToken ? 'YES' : 'NO');
    console.log('🔍 User Token provided:', userToken ? 'YES' : 'NO');
    
    if (!accessToken) {
      console.log('❌ Missing access token');
      return res.status(400).json({
        success: false,
        error: 'Access Token обязателен для получения Business Account ID'
      });
    }

    if (!userToken) {
      console.log('❌ Missing user token');
      return res.status(401).json({
        success: false,
        error: 'Токен авторизации не предоставлен'
      });
    }

    // Получаем страницы Facebook пользователя
    console.log('📋 Getting Facebook pages...');
    const pagesResponse = await axios.get(
      `https://graph.facebook.com/v23.0/me/accounts?access_token=${accessToken}&fields=id,name,instagram_business_account`
    );

    console.log('📋 Facebook pages response:', JSON.stringify(pagesResponse.data, null, 2));

    const pages = pagesResponse.data.data || [];
    let instagramBusinessAccountId = null;
    let availablePages = [];

    // Ищем Instagram Business Account среди страниц и собираем информацию о доступных страницах
    for (const page of pages) {
      availablePages.push({
        id: page.id,
        name: page.name,
        hasInstagramBusiness: !!(page.instagram_business_account && page.instagram_business_account.id)
      });
      
      if (page.instagram_business_account && page.instagram_business_account.id) {
        instagramBusinessAccountId = page.instagram_business_account.id;
        console.log('✅ Found Instagram Business Account ID:', instagramBusinessAccountId);
        console.log('✅ From Facebook page:', page.name, '(ID:', page.id, ')');
        break;
      }
    }

    console.log('📋 Available Facebook pages:', availablePages);

    if (!instagramBusinessAccountId) {
      return res.status(404).json({
        success: false,
        error: 'Instagram Business Account не найден. Убедитесь, что ваша Facebook страница связана с Instagram Business аккаунтом.',
        details: {
          availablePages: availablePages,
          message: 'Ни одна из ваших Facebook страниц не связана с Instagram Business аккаунтом. Необходимо подключить Instagram Business аккаунт к одной из Facebook страниц.'
        }
      });
    }

    // Сохраняем Instagram Business Account ID в кампанию
    console.log('💾 Saving Instagram Business Account ID to campaign...');
    
    // Получаем текущие настройки кампании используя системный токен
    const getCampaignResponse = await axios.get(
      `${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const campaign = getCampaignResponse.data.data;
    const currentSocialMediaSettings = campaign.social_media_settings || {};
    const currentInstagramSettings = currentSocialMediaSettings.instagram || {};

    // Обновляем Instagram настройки с новым Business Account ID
    const updatedInstagramSettings = {
      ...currentInstagramSettings,
      businessAccountId: instagramBusinessAccountId,
      businessAccountIdFetchedAt: new Date().toISOString()
    };

    const updatedSocialMediaSettings = {
      ...currentSocialMediaSettings,
      instagram: updatedInstagramSettings
    };

    console.log('💾 Saving with Business Account ID:', instagramBusinessAccountId);
    console.log('💾 Full Instagram settings to save:', JSON.stringify(updatedInstagramSettings, null, 2));

    // Сохраняем обновленные настройки используя системный токен
    const updateResponse = await axios.patch(
      `${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`,
      {
        social_media_settings: updatedSocialMediaSettings
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Instagram Business Account ID saved successfully');

    res.json({
      success: true,
      businessAccountId: instagramBusinessAccountId,
      message: 'Instagram Business Account ID успешно получен и сохранен'
    });

  } catch (error: any) {
    console.error('❌ Error fetching Instagram Business Account ID:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении Instagram Business Account ID',
      details: error.response?.data || error.message
    });
  }
});

export default router;