/**
 * YouTube OAuth2 Authentication Routes
 */

import { Router } from 'express';
import { YouTubeService } from '../services/social-platforms/youtube-service';
import { authMiddleware } from '../middleware/auth';

const router = Router();

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

    // Получаем конфигурацию YouTube из переменных окружения
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${process.env.FRONTEND_URL}/youtube/callback`;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ 
        error: 'YouTube OAuth не настроен',
        details: 'Отсутствуют YOUTUBE_CLIENT_ID или YOUTUBE_CLIENT_SECRET'
      });
    }

    const youtubeService = new YouTubeService({
      clientId,
      clientSecret,
      redirectUri,
      channelId: '' // Будет получен после авторизации
    });

    // Генерируем уникальный state для защиты от CSRF
    const state = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    oauthStates.set(state, { userId, timestamp: Date.now() });

    const authUrl = youtubeService.getAuthUrl();
    const authUrlWithState = `${authUrl}&state=${state}`;

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

    // Проверяем state
    const stateData = oauthStates.get(state as string);
    if (!stateData) {
      return res.status(400).json({ 
        error: 'Неверный state параметр' 
      });
    }

    // Проверяем время жизни state (10 минут)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      oauthStates.delete(state as string);
      return res.status(400).json({ 
        error: 'State параметр истек' 
      });
    }

    oauthStates.delete(state as string);

    const clientId = process.env.YOUTUBE_CLIENT_ID!;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET!;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${process.env.FRONTEND_URL}/youtube/callback`;

    const youtubeService = new YouTubeService({
      clientId,
      clientSecret,
      redirectUri,
      channelId: ''
    });

    // Обмениваем code на токены
    const tokens = await youtubeService.exchangeCodeForTokens(code as string);

    // TODO: Сохранить токены в базу данных для пользователя stateData.userId
    // Пока что возвращаем их в ответе (не безопасно для продакшена)

    res.json({
      success: true,
      message: 'YouTube успешно подключен',
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    console.error('Ошибка обработки YouTube callback:', error);
    res.status(500).json({ 
      error: 'Ошибка обработки авторизации',
      details: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
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

    const clientId = process.env.YOUTUBE_CLIENT_ID!;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET!;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${process.env.FRONTEND_URL}/youtube/callback`;

    const youtubeService = new YouTubeService({
      clientId,
      clientSecret,
      redirectUri,
      accessToken,
      refreshToken,
      channelId
    });

    const channelInfo = await youtubeService.getChannelInfo();

    res.json({
      success: true,
      message: 'YouTube соединение работает',
      channelInfo: {
        title: channelInfo?.snippet?.title,
        subscriberCount: channelInfo?.statistics?.subscriberCount,
        videoCount: channelInfo?.statistics?.videoCount
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

export default router;