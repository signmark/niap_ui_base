import express from 'express';
import axios from 'axios';
import { log } from '../utils/logger';

const router = express.Router();

// Временное хранение для OAuth flow (в продакшене можно использовать Redis)
const oauthSessions = new Map();

// Эндпоинт для начала OAuth flow
router.post('/instagram/auth/start', async (req, res) => {
  try {
    const { appId, appSecret, redirectUri, webhookUrl, instagramId } = req.body;

    if (!appId || !appSecret || !redirectUri) {
      return res.status(400).json({
        error: 'Требуются: appId, appSecret, redirectUri'
      });
    }

    // Используем зашитый webhook URL если не передан
    const finalWebhookUrl = webhookUrl || 'https://n8n.roboflow.space/webhook/instagram-auth';

    // Генерируем уникальный state для безопасности
    const state = Math.random().toString(36).substring(2, 15);

    // Сохраняем данные сессии
    oauthSessions.set(state, {
      appId,
      appSecret,
      redirectUri,
      webhookUrl: finalWebhookUrl,
      instagramId,
      timestamp: Date.now()
    });

    // Формируем URL для авторизации Facebook
    const scopes = [
      'pages_manage_posts',
      'pages_read_engagement', 
      'pages_show_list',
      'instagram_basic',
      'instagram_content_publish'
    ].join(',');

    const authUrl = `https://www.facebook.com/v23.0/dialog/oauth?` +
      `client_id=${appId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `response_type=code&` +
      `state=${state}`;

    log('instagram-oauth', `OAuth поток запущен для App ID: ${appId}`);
    
    res.json({ authUrl, state });
  } catch (error) {
    log('instagram-oauth', `Ошибка запуска OAuth: ${error}`);
    res.status(500).json({ error: 'Ошибка сервера при запуске OAuth' });
  }
});

// Callback эндпоинт для обработки ответа от Facebook
router.get('/instagram/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    log('instagram-oauth', `Facebook error: ${error}`);
    return res.status(400).json({ error: `Facebook error: ${error}` });
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'Отсутствует код авторизации или state' });
  }

  // Получаем данные сессии
  const session = oauthSessions.get(state);
  if (!session) {
    return res.status(400).json({ error: 'Недействительная сессия' });
  }

  try {
    // Настройки для axios с увеличенным timeout
    const axiosConfig = {
      timeout: 30000, // 30 секунд
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    log('instagram-oauth', 'Шаг 1: Получаем краткосрочный токен...');
    // Шаг 1: Обмениваем код на краткосрочный токен
    const tokenResponse = await axios.get('https://graph.facebook.com/v23.0/oauth/access_token', {
      params: {
        client_id: session.appId,
        client_secret: session.appSecret,  
        redirect_uri: session.redirectUri,
        code: code
      },
      ...axiosConfig
    });

    const shortLivedToken = tokenResponse.data.access_token;

    log('instagram-oauth', 'Шаг 2: Получаем долгосрочный токен...');
    // Шаг 2: Обмениваем краткосрочный токен на долгосрочный
    const longLivedResponse = await axios.get('https://graph.facebook.com/v23.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: session.appId,
        client_secret: session.appSecret,
        fb_exchange_token: shortLivedToken
      },
      ...axiosConfig
    });

    const longLivedToken = longLivedResponse.data.access_token;
    const expiresIn = longLivedResponse.data.expires_in;

    log('instagram-oauth', 'Шаг 3: Получаем информацию о пользователе...');
    // Шаг 3: Получаем информацию о пользователе
    const userResponse = await axios.get('https://graph.facebook.com/v23.0/me', {
      params: {
        access_token: longLivedToken,
        fields: 'id,name,email'
      },
      ...axiosConfig
    });

    log('instagram-oauth', 'Шаг 4: Получаем страницы пользователя...');
    // Шаг 4: Получаем страницы с Instagram аккаунтами
    const pagesResponse = await axios.get('https://graph.facebook.com/v23.0/me/accounts', {
      params: {
        access_token: longLivedToken,
        fields: 'id,name,access_token,instagram_business_account{id,name,username,profile_picture_url}',
        limit: 100
      },
      ...axiosConfig
    });

    // Фильтруем только страницы с подключенным Instagram
    const pagesWithInstagram = pagesResponse.data.data?.filter(page =>
      page.instagram_business_account
    ) || [];

    log('instagram-oauth', `Найдено страниц с Instagram: ${pagesWithInstagram.length}`);

    // Подготавливаем данные для отправки в N8N webhook
    const webhookData = {
      success: true,
      appId: session.appId,
      longLivedToken,
      expiresIn,
      user: userResponse.data,
      pages: pagesWithInstagram,
      instagramAccounts: pagesWithInstagram.map(page => ({
        instagramId: page.instagram_business_account.id,
        username: page.instagram_business_account.username,
        name: page.instagram_business_account.name,
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token
      })),
      timestamp: new Date().toISOString()
    };

    // Отправляем данные в N8N webhook
    try {
      await axios.post(session.webhookUrl, webhookData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      log('instagram-oauth', `Данные успешно отправлены в N8N webhook: ${session.webhookUrl}`);
    } catch (webhookError) {
      log('instagram-oauth', `Ошибка отправки в N8N webhook: ${webhookError}`);
    }

    // Очищаем сессию
    oauthSessions.delete(state);

    // Возвращаем успешный ответ с данными
    res.json({
      success: true,
      message: 'Instagram авторизация завершена успешно',
      data: {
        instagramAccounts: webhookData.instagramAccounts,
        user: userResponse.data
      }
    });

  } catch (error) {
    log('instagram-oauth', `Ошибка OAuth callback: ${error}`);
    
    // Очищаем сессию при ошибке
    oauthSessions.delete(state);
    
    res.status(500).json({
      error: 'Ошибка при обработке OAuth callback',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Эндпоинт для проверки статуса OAuth сессии
router.get('/instagram/auth/status/:state', (req, res) => {
  const { state } = req.params;
  const session = oauthSessions.get(state);
  
  if (!session) {
    return res.json({ exists: false });
  }
  
  res.json({
    exists: true,
    timestamp: session.timestamp,
    appId: session.appId
  });
});

export default router;