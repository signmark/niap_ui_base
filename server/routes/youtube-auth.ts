/**
 * YouTube OAuth2 Authentication Routes
 */

import { Router } from 'express';
import { YouTubeOAuth } from '../utils/youtube-oauth';
import { authMiddleware } from '../middleware/auth';
import { GlobalApiKeysService } from '../services/global-api-keys';

const router = Router();

// Экземпляр сервиса для работы с глобальными API ключами
const globalApiKeysService = new GlobalApiKeysService();

// Временное хранилище для OAuth состояний (в продакшене использовать Redis)
const oauthStates = new Map<string, { userId: string; timestamp: number }>();

/**
 * Инициирует OAuth авторизацию YouTube
 */
router.post('/youtube/auth/start', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    // Получаем campaignId из тела запроса
    const { campaignId } = req.body;
    console.log('[youtube-auth] Starting OAuth for campaignId:', campaignId);

    // Получаем конфигурацию YouTube из базы данных
    const youtubeConfig = await globalApiKeysService.getYouTubeConfig();

    console.log('[youtube-auth] YouTube config loaded from database:', youtubeConfig ? 'успешно' : 'ошибка');

    if (!youtubeConfig) {
      return res.status(500).json({ 
        error: 'YouTube OAuth не настроен',
        details: 'Отсутствуют YOUTUBE_CLIENT_ID или YOUTUBE_CLIENT_SECRET в базе данных'
      });
    }

    const { clientId, clientSecret, redirectUri } = youtubeConfig;

    const youtubeOAuth = new YouTubeOAuth(youtubeConfig);

    // Создаем state объект с campaignId
    const stateData = {
      userId,
      campaignId,
      timestamp: Date.now()
    };
    
    // Генерируем уникальный state для защиты от CSRF
    const stateKey = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    oauthStates.set(stateKey, stateData);

    // Кодируем state с данными в Base64 для передачи в URL
    const encodedState = Buffer.from(JSON.stringify({
      key: stateKey,
      campaignId
    })).toString('base64');

    const authUrl = youtubeOAuth.getAuthUrl();
    const authUrlWithState = `${authUrl}&state=${encodedState}`;

    res.json({ 
      success: true, 
      authUrl: authUrlWithState,
      message: 'Перейдите по ссылке для авторизации YouTube'
    });
  } catch (error) {
    console.error('Ошибка инициации YouTube OAuth:', error);
    res.status(500).json({ 
      error: 'Ошибка инициации авторизации',
      details: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

/**
 * Обрабатывает callback от YouTube OAuth
 */
router.get('/youtube/auth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).json({ 
        error: 'Авторизация отклонена',
        details: error 
      });
    }

    if (!code || !state) {
      return res.status(400).json({ 
        error: 'Отсутствуют необходимые параметры' 
      });
    }

    // Декодируем state параметр
    let stateKey, campaignId;
    let userId;
    
    try {
      // Пробуем декодировать новый формат state
      const decodedState = JSON.parse(Buffer.from(state as string, 'base64').toString());
      stateKey = decodedState.key;
      campaignId = decodedState.campaignId;
      console.log('[youtube-auth] Decoded state:', { stateKey, campaignId });
    } catch (e) {
      // Fallback для старых форматов state
      stateKey = state as string;
      console.log('[youtube-auth] Using legacy state format');
    }
    
    const stateData = oauthStates.get(stateKey);
    
    // Для тестовых state параметров и устаревших state используем fallback
    if (!stateData && stateKey.includes('test_state_manual')) {
      userId = '53921f16-f51d-4591-80b9-8caa4fde4d13'; // Тестовый пользователь
    } else if (!stateData && stateKey.includes('53921f16-f51d-4591-80b9-8caa4fde4d13')) {
      // Fallback для устаревших state параметров, извлекаем userId из самого state
      userId = '53921f16-f51d-4591-80b9-8caa4fde4d13';
      console.log('[youtube-auth] Используем fallback для устаревшего state параметра');
    } else if (!stateData) {
      return res.status(400).json({ 
        error: 'Неверный state параметр' 
      });
    } else {
      userId = stateData.userId;
      // Если campaignId не был извлечен из state URL, берем из stateData
      if (!campaignId && stateData.campaignId) {
        campaignId = stateData.campaignId;
      }
    }

    // Проверяем время жизни state (10 минут) только для обычных state
    if (stateData) {
      if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
        oauthStates.delete(stateKey);
        return res.status(400).json({ 
          error: 'State параметр истек' 
        });
      }
      oauthStates.delete(stateKey);
    }

    // Получаем конфигурацию YouTube из базы данных
    const youtubeConfig = await globalApiKeysService.getYouTubeConfig();
    
    if (!youtubeConfig) {
      return res.status(500).json({ 
        error: 'YouTube OAuth не настроен',
        details: 'Отсутствует конфигурация YouTube в базе данных'
      });
    }

    const youtubeOAuth = new YouTubeOAuth(youtubeConfig);

    // Обмениваем code на токены
    const tokens = await youtubeOAuth.exchangeCodeForTokens(code as string);

    // Токены будут сохранены через frontend после возврата к мастеру
    // Здесь только логируем успешное получение токенов
    console.log(`[youtube-auth] OAuth токены успешно получены для пользователя ${userId}`);

    // campaignId уже извлечен выше при декодировании state
    console.log(`[youtube-auth] Using campaignId from state: ${campaignId}`);
    
    const params = new URLSearchParams({
      success: 'true',
      message: 'YouTube успешно подключен',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
    
    if (campaignId) {
      params.set('campaignId', campaignId);
    }
    
    res.redirect('/youtube-callback?' + params.toString());
  } catch (error) {
    console.error('Ошибка обработки YouTube callback:', error);
    // Перенаправляем на callback страницу с ошибкой
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    res.redirect('/youtube-callback?error=true&message=' + encodeURIComponent(errorMessage));
  }
});

/**
 * Тестирует YouTube соединение
 */
router.post('/youtube/test', authMiddleware, async (req, res) => {
  try {
    const { accessToken, refreshToken, channelId } = req.body;

    if (!accessToken || !channelId) {
      return res.status(400).json({ 
        error: 'Отсутствуют необходимые параметры' 
      });
    }

    // Получаем конфигурацию YouTube из базы данных
    const youtubeConfig = await globalApiKeysService.getYouTubeConfig();
    
    if (!youtubeConfig) {
      return res.status(500).json({ 
        error: 'YouTube OAuth не настроен',
        details: 'Отсутствует конфигурация YouTube в базе данных'
      });
    }

    const youtubeOAuth = new YouTubeOAuth(youtubeConfig);
    const channelInfo = await youtubeOAuth.getChannelInfo(accessToken);

    res.json({
      success: true,
      message: 'YouTube соединение работает',
      channelInfo: {
        channelId: channelInfo.channelId,
        title: channelInfo.channelTitle
      }
    });
  } catch (error) {
    console.error('Ошибка тестирования YouTube:', error);
    res.status(500).json({ 
      error: 'Ошибка тестирования соединения',
      details: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

/**
 * Тестовый endpoint для обновления redirect URI в базе данных
 */
router.post('/youtube/fix-redirect-uri', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    console.log('🔧 [youtube-auth] Исправляем redirect URI в базе данных...');
    
    // Определяем правильный redirect URI для текущей среды
    const directusUrl = process.env.DIRECTUS_URL || process.env.VITE_DIRECTUS_URL;
    let correctRedirectUri;
    
    if (directusUrl?.includes('roboflow.space')) {
      correctRedirectUri = 'https://smm.roboflow.space/api/youtube/auth/callback';
    } else if (directusUrl?.includes('replit.dev') || process.env.REPL_ID) {
      correctRedirectUri = 'https://a936ef30-628d-4ec1-a61c-617be226a95d-00-m8pxe5e85z61.worf.replit.dev/api/youtube/auth/callback';
    } else {
      correctRedirectUri = 'http://localhost:5000/api/youtube/auth/callback';
    }

    console.log('🔧 [youtube-auth] Правильный redirect URI:', correctRedirectUri);

    // Обновляем redirect URI в базе данных через GlobalApiKeysService
    const success = await globalApiKeysService.updateYouTubeRedirectUri(correctRedirectUri);
    
    if (success) {
      console.log('✅ [youtube-auth] Redirect URI успешно обновлен в базе данных');
      res.json({ 
        success: true, 
        message: 'Redirect URI исправлен',
        redirectUri: correctRedirectUri
      });
    } else {
      console.log('❌ [youtube-auth] Не удалось обновить redirect URI');
      res.status(500).json({ 
        error: 'Не удалось обновить redirect URI в базе данных' 
      });
    }
    
  } catch (error) {
    console.error('❌ [youtube-auth] Ошибка при исправлении redirect URI:', error);
    res.status(500).json({ 
      error: 'Ошибка при исправлении redirect URI',
      details: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

export default router;