import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import axios from 'axios';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { registerRoutes } from "./routes";
import { registerFalAiImageRoutes } from "./routes-fal-ai-images";
import { registerClaudeRoutes } from "./routes-claude";
import { registerDeepSeekRoutes } from "./routes-deepseek";
import { registerDeepSeekModelsRoute } from "./routes-deepseek-models";
import { registerQwenRoutes } from "./routes-qwen";
import { registerGeminiRoutes } from "./routes-gemini";
import { registerImgurRoutes } from "./routes-imgur";
import { registerBegetS3Routes } from "./routes-beget-s3";
import { registerUserApiKeysRoutes } from "./routes-user-api-keys";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { setupVite, serveStatic } from "./vite";
import { log, logEnvironmentInfo } from "./utils/logger";
import { directusApiManager } from './directus';
import { registerXmlRiverRoutes } from './api/xmlriver-routes';
import { falAiUniversalService } from './services/fal-ai-universal';
import { initializeHeavyServices } from './optimize-startup';
// Импортируем тестовые маршруты для Telegram
import testRouter from './api/test-routes';
// Импортируем маршруты для диагностики и исправления URL в Telegram
import telegramDiagnosticsRouter from './api/test-routes-last-telegram';
// Импортируем API аналитики
import analyticsRouter from './analytics-api';
// Импортируем валидатор статусов публикаций
import { statusValidator } from './services/status-validator';
// Импортируем исправленный планировщик публикаций
import { getPublishScheduler } from './services/publish-scheduler';

// Установка переменных окружения для отладки
process.env.DEBUG = 'express:*,vite:*';
process.env.NODE_ENV = 'development';

// Глобальная переменная для доступа к directusApiManager без импорта (избегаем циклические зависимости)
// @ts-ignore - игнорируем проверку типов
global['directusApiManager'] = directusApiManager;

const app = express();
const server = createServer(app);

// TEMPORARILY DISABLED: WebSocket server для real-time уведомлений
// This was causing conflicts with Vite HMR WebSocket
// const wss = new WebSocketServer({ server });

// // Обработка WebSocket подключений
// wss.on('connection', (ws) => {
//   log('WebSocket клиент подключен', 'websocket');
  
//   ws.on('message', (message) => {
//     try {
//       const data = JSON.parse(message.toString());
//       log(`WebSocket сообщение получено: ${data.type}`, 'websocket');
//     } catch (error) {
//       log(`Ошибка парсинга WebSocket сообщения: ${error}`, 'websocket');
//     }
//   });
  
//   ws.on('close', () => {
//     log('WebSocket клиент отключен', 'websocket');
//   });
// });

// Функция для отправки уведомлений всем подключенным клиентам
export function broadcastNotification(type: string, data: any) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  
  // TEMPORARILY DISABLED: wss.clients.forEach((client) => {
  //   if (client.readyState === client.OPEN) {
  //     client.send(message);
  //   }
  // });
}

// Экспортируем WebSocket server для использования в других модулях
// export { wss };

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Health check endpoint for deployment monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// 🔥 УНИВЕРСАЛЬНОЕ ОТСЛЕЖИВАНИЕ ВСЕХ POST И GET ЗАПРОСОВ 🔥
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log('🔥🔥🔥 POST ЗАПРОС ПОЛУЧЕН 🔥🔥🔥');
    console.log('🔥 URL:', req.url);
    console.log('🔥 PATH:', req.path);
    console.log('🔥 BODY:', JSON.stringify(req.body, null, 2));
  }
  
  if (req.method === 'GET' && req.path.includes('youtube/channel-info')) {
    console.log('🎯🎯🎯 YOUTUBE CHANNEL INFO GET ЗАПРОС 🎯🎯🎯');
    console.log('🎯 URL:', req.url);
    console.log('🎯 PATH:', req.path);
    console.log('🎯 QUERY:', JSON.stringify(req.query, null, 2));
  }
  
  next();
});

// Добавляем API маршруты для проверки статуса и проверки админа явно, чтобы они работали до инициализации Vite
app.get('/api/status-check', (req, res) => {
  return res.json({ status: 'ok', server: 'running', time: new Date().toISOString() });
});

// Регистрируем прямые маршруты аутентификации до инициализации Vite
import { isUserAdmin } from './routes-global-api-keys';
import { registerAuthRoutes } from './api/auth-routes';
import { registerSimpleAnalyticsAPI } from './simple-analytics-api';

// Регистрируем простой API аналитики ПЕРЕД всеми остальными маршрутами
registerSimpleAnalyticsAPI(app);

// КРИТИЧНЫЙ ENDPOINT: Анализ источника (регистрируем ДО Vite middleware)
app.post("/api/analyze-source/:sourceId", async (req: any, res) => {
  const sourceId = req.params.sourceId;
  const campaignId = req.body?.campaignId;
  console.log(`[ANALYZE SOURCE] API called with sourceId: ${sourceId}, campaignId: ${campaignId}`);
  
  try {
    // Получаем токен из заголовка Authorization
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      console.log(`[ANALYZE SOURCE] No authorization header provided`);
      return res.status(401).json({
        success: false,
        message: "Требуется авторизация"
      });
    }
    
    const userToken = authHeader.replace('Bearer ', '');
    console.log(`[ANALYZE SOURCE] Используем пользовательский токен: ${userToken.substring(0, 10)}...`);
    
    if (!sourceId || !campaignId) {
      console.log(`[ANALYZE SOURCE] Missing required params: sourceId=${sourceId}, campaignId=${campaignId}`);
      return res.status(400).json({
        success: false,
        message: "Требуется sourceId и campaignId"
      });
    }

    console.log(`[ANALYZE SOURCE] ===== НОВЫЙ ENDPOINT 2025-08-01 ===== Начинаем анализ источника ${sourceId} для кампании ${campaignId}`); 
    console.log(`[ANALYZE SOURCE] ===== ИСПОЛЬЗУЕМ СИСТЕМНЫЙ ТОКЕН ===== : ${process.env.DIRECTUS_TOKEN?.substring(0, 10)}...`);

    // Используем системный токен для доступа к campaign_trend_topics
    const systemDirectusApi = axios.create({
      baseURL: process.env.DIRECTUS_URL || 'https://directus.roboflow.space',
      headers: {
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log(`[ANALYZE SOURCE] Запрашиваем тренды для источника ${sourceId} в кампании ${campaignId}`);
    
    // Запрос к коллекции campaign_trend_topics с системным токеном
    const trendsResponse = await systemDirectusApi.get('/items/campaign_trend_topics', {
      params: {
        'filter[source_id][_eq]': sourceId,
        'filter[campaign_id][_eq]': campaignId,
        'fields': 'id,title,source_id,campaign_id,sentiment_analysis'
      }
    });

    const sourceTrends = trendsResponse.data?.data || [];
    console.log(`[ANALYZE SOURCE] Найдено ${sourceTrends.length} трендов для источника ${sourceId}`);

    if (sourceTrends.length === 0) {
      // Если нет трендов, вернем нулевую статистику, но не ошибку
      console.log(`[ANALYZE SOURCE] Нет трендов для источника ${sourceId}, возвращаем пустую статистику`);
      return res.json({
        success: true,
        data: {
          sourceId,
          campaignId,
          analyzed_trends: 0,
          source_rating: {
            total_trends: 0,
            analyzed_trends: 0,
            positive_percentage: 0,
            negative_percentage: 0,
            neutral_percentage: 0,
            overall_sentiment: 'neutral',
            analyzed_at: new Date().toISOString()
          },
          sentiment_breakdown: {
            positive: 0,
            negative: 0,
            neutral: 0
          }
        },
        message: `Анализ источника завершен. Трендов не найдено.`
      });
    }

    // 2. Анализируем настроения всех трендов
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    let totalScore = 0;
    let scoredTrends = 0;

    console.log(`[ANALYZE SOURCE] Начинаем анализ настроения для ${sourceTrends.length} трендов`);
    
    // Анализируем каждый тренд через Gemini API
    for (const trend of sourceTrends) {
      try {
        // Проверяем, есть ли уже анализ настроения
        if (trend.sentiment_analysis?.sentiment) {
          const sentiment = trend.sentiment_analysis.sentiment;
          if (sentiment === 'positive') positiveCount++;
          else if (sentiment === 'negative') negativeCount++;
          else neutralCount++;
          console.log(`[ANALYZE SOURCE] Тренд ${trend.id} уже проанализирован: ${sentiment}`);
          continue;
        }

        // Если анализа нет, проводим его
        console.log(`[ANALYZE SOURCE] Анализируем тренд: ${trend.title.substring(0, 50)}...`);
        
        // Используем Gemini для анализа настроения с балльной оценкой
        const sentimentResponse = await axios.post(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
          {
            contents: [{
              parts: [{
                text: `Проанализируй настроение этого поста и дай оценку:

Заголовок: ${trend.title}

Ответь в формате JSON:
{
  "sentiment": "positive/negative/neutral",
  "score": число_от_1_до_100,
  "reasoning": "краткое_объяснение"
}

Где score:
- 80-100: очень позитивный контент
- 60-79: умеренно позитивный  
- 40-59: нейтральный контент
- 20-39: умеренно негативный
- 1-19: очень негативный контент`
              }]
            }]
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            params: {
              key: process.env.GEMINI_API_KEY
            },
            timeout: 10000
          }
        );

        const responseText = sentimentResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        let sentiment = 'neutral';
        let score = 50;
        let reasoning = 'Автоматический анализ';

        try {
          // Парсим JSON ответ от Gemini
          const jsonMatch = responseText.match(/\{[^}]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            sentiment = ['positive', 'negative', 'neutral'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral';
            score = Math.max(1, Math.min(100, parseInt(parsed.score) || 50));
            reasoning = parsed.reasoning || reasoning;
          }
        } catch (error) {
          console.log(`[ANALYZE SOURCE] Ошибка парсинга JSON, используем fallback для тренда ${trend.id}`);
          // Fallback к простому анализу
          const sentimentText = responseText.toLowerCase();
          if (sentimentText.includes('positive')) {
            sentiment = 'positive';
            score = 70;
          } else if (sentimentText.includes('negative')) {
            sentiment = 'negative';
            score = 30;
          } else {
            sentiment = 'neutral';
            score = 50;
          }
        }
        
        console.log(`[ANALYZE SOURCE] Результат анализа тренда ${trend.id}: ${sentiment} (${score} баллов)`);

        // Подсчитываем статистику
        if (sentiment === 'positive') positiveCount++;
        else if (sentiment === 'negative') negativeCount++;
        else neutralCount++;
        
        // Добавляем балл к общему счету
        totalScore += score;
        scoredTrends++;

        // Сохраняем результат анализа в базу данных
        const sentimentAnalysis = {
          sentiment: sentiment,
          score: score,
          reasoning: reasoning,
          analyzed_at: new Date().toISOString(),
          analyzed_by: 'source_analysis'
        };

        await systemDirectusApi.patch(`/items/campaign_trend_topics/${trend.id}`, {
          sentiment_analysis: sentimentAnalysis
        });

        console.log(`[ANALYZE SOURCE] Анализ настроения сохранен для тренда ${trend.id}`);

        // Небольшая задержка между запросами к Gemini
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[ANALYZE SOURCE] Ошибка анализа тренда ${trend.id}:`, error);
        // Если ошибка - считаем как нейтральный
        neutralCount++;
        totalScore += 50; // Нейтральный балл по умолчанию
        scoredTrends++;
      }
    }

    // Вычисляем средний балл на основе всех проанализированных трендов
    const averageScore = scoredTrends > 0 ? Math.round(totalScore / scoredTrends) : 50;
    const total = sourceTrends.length;
    
    // Определяем общее настроение на основе среднего балла
    let overallSentiment = 'neutral';
    if (averageScore >= 70) overallSentiment = 'positive';
    else if (averageScore <= 40) overallSentiment = 'negative';
    
    // Определяем эмодзи на основе среднего балла
    let emoji = '😐'; // нейтральный по умолчанию
    if (averageScore >= 90) emoji = '🔥'; // отлично
    else if (averageScore >= 80) emoji = '😍'; // очень хорошо  
    else if (averageScore >= 70) emoji = '😊'; // хорошо
    else if (averageScore >= 60) emoji = '😌'; // неплохо
    else if (averageScore >= 40) emoji = '😐'; // нейтрально
    else if (averageScore >= 25) emoji = '😕'; // плохо
    else emoji = '😞'; // очень плохо

    const sourceRating = {
      total_trends: total,
      analyzed_trends: total,
      positive_percentage: Math.round((positiveCount / total) * 100),
      negative_percentage: Math.round((negativeCount / total) * 100),
      neutral_percentage: Math.round((neutralCount / total) * 100),
      overall_sentiment: overallSentiment,
      average_score: averageScore,
      emoji: emoji,
      analyzed_at: new Date().toISOString()
    };

    console.log(`[ANALYZE SOURCE] Анализ завершен: ${positiveCount} позитивных, ${negativeCount} негативных, ${neutralCount} нейтральных`);
    console.log(`[ANALYZE SOURCE] Средний балл: ${averageScore}, Эмодзи: ${emoji}, Общее настроение: ${overallSentiment}`);

    return res.json({
      success: true,
      data: {
        sourceId,
        campaignId,
        analyzed_trends: total,
        source_rating: sourceRating,
        sentiment_breakdown: {
          positive: positiveCount,
          negative: negativeCount,
          neutral: neutralCount
        }
      },
      message: `Анализ источника завершен. Проанализировано ${total} трендов.`
    });

  } catch (error) {
    console.error('[ANALYZE SOURCE] Ошибка:', error);
    return res.status(500).json({
      success: false,
      message: "Ошибка при анализе источника",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Source analysis endpoint is now integrated in main routes

// Старый код API аналитики удален - теперь используется simple-analytics-api.ts

// Регистрируем все маршруты аутентификации и API ключей раньше Vite
registerAuthRoutes(app);

// Импортируем и регистрируем маршруты для глобальных API ключей
import { registerGlobalApiKeysRoutes } from './routes-global-api-keys';
// Импортируем Instagram Setup Wizard
import instagramSetupRoutes from './routes/instagram-setup-wizard';
// Импортируем Facebook Pages router
import facebookPagesRouter from './routes/facebook-pages';
// Импортируем Facebook Debug router
import facebookDebugRouter from './routes/facebook-debug';
// Импортируем Facebook Page URL router
import facebookPageUrlRouter from './routes/facebook-page-url';
// Импортируем Facebook Groups Discovery router
import facebookGroupsRouter from './routes/facebook-groups-discovery';
registerGlobalApiKeysRoutes(app);
log('Global API keys routes registered early to avoid Vite middleware interception');

// Регистрируем маршруты для пользовательских API ключей раньше Vite
registerUserApiKeysRoutes(app);
log('User API keys routes registered early to avoid Vite middleware interception');

// Регистрируем Instagram Setup Wizard маршруты
app.use('/api/instagram-setup', instagramSetupRoutes);
log('Instagram Setup Wizard routes registered');

// Регистрируем Facebook Pages маршруты
app.use('/api/facebook', facebookPagesRouter);
log('Facebook Pages routes registered');

// Регистрируем Facebook Debug маршруты
app.use('/api/facebook', facebookDebugRouter);
log('Facebook Debug routes registered');

// Регистрируем Facebook Page URL маршруты
app.use('/api/facebook', facebookPageUrlRouter);
log('Facebook Page URL routes registered');

// Регистрируем Facebook Groups Discovery маршруты
app.use('/api', facebookGroupsRouter);
log('Facebook Groups Discovery routes registered');

// Регистрируем YouTube Auth маршруты раньше всех
import youtubeAuthRouter from './routes/youtube-auth';
import youtubeSettingsRouter from './routes/campaign-youtube-settings';
app.use('/api', youtubeAuthRouter);
app.use('/api', youtubeSettingsRouter);
log('YouTube Auth and Settings routes registered early to avoid 404 errors');

// Instagram Campaign Settings маршруты будут зарегистрированы ПОСЛЕ registerRoutes
// чтобы иметь приоритет над конфликтующими маршрутами в routes.ts
log('Instagram Campaign Settings routes will be registered after main routes');

// Дополнительно дублируем маршрут is-admin с явными заголовками Content-Type
app.get('/api/auth/is-admin', async (req, res) => {
  try {
    console.log('EARLY IS-ADMIN ROUTE CALLED');
    // Указываем явно content-type как JSON
    res.setHeader('Content-Type', 'application/json');
    // Добавляем заголовки для предотвращения кэширования
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log('Запрос на проверку админа без токена', 'auth');
      return res.status(401).json({ 
        success: false, 
        isAdmin: false,
        message: 'Требуется токен авторизации'
      });
    }
    
    const token = authHeader.substring(7);
    log(`Проверка статуса админа с токеном: ${token.substring(0, 10)}...`, 'auth');
    
    const isAdmin = await isUserAdmin(req, token);
    log(`Результат проверки администратора: ${isAdmin}`, 'auth');
    
    // Добавляем случайный параметр в ответ, чтобы предотвратить кэширование
    return res.status(200).json({ 
      success: true, 
      isAdmin, 
      timestamp: Date.now(),
      source: 'early-route'
    });
  } catch (error) {
    log(`Ошибка при проверке статуса администратора: ${error instanceof Error ? error.message : 'Unknown error'}`, 'auth');
    return res.status(500).json({ 
      success: false, 
      error: 'Произошла ошибка при проверке статуса администратора', 
      timestamp: Date.now(),
      source: 'early-route' 
    });
  }
});

// Добавляем маршрут для проверки здоровья
app.get('/health', (req, res) => {
  return res.status(200).send('OK');
});

// Статические файлы для лендинга (должно быть ДО маршрута)
app.use('/landing', express.static('smmniap_static'));

// Маршрут для лендинга
app.get('/landing', (req, res) => {
  res.sendFile(process.cwd() + '/smmniap_static/index.html');
});

// Специальный маршрут для проверки доступности сервера с интерфейсом
app.get('/server-health', (req, res) => {
  const content = `
  <!DOCTYPE html>
  <html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Сервер работает</title>
    <style>
      body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
      .status { color: #4caf50; font-weight: bold; }
      .time { color: #2196f3; margin-top: 20px; }
      pre { text-align: left; max-width: 800px; margin: 20px auto; background: #f5f5f5; padding: 15px; border-radius: 5px; }
    </style>
  </head>
  <body>
    <h1>Статус сервера: <span class="status">Работает</span></h1>
    <div class="time">Текущее время: ${new Date().toLocaleString('ru-RU')}</div>
    <pre>
API маршруты:
- GET /api/status-check - Проверка статуса API
- GET /api/claude/test-api-key - Проверка API ключа Claude
- POST /api/claude/improve-text - Улучшение текста с Claude AI

Конфигурация сервера:
- NODE_ENV: ${process.env.NODE_ENV || 'не задано'}
- PORT: ${process.env.PORT || '5001 (по умолчанию)'}
    </pre>
  </body>
  </html>
  `;
  return res.status(200).type('html').send(content);
});

// Middleware для логирования запросов
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Middleware для извлечения userId из заголовка и сохранения в req.userId
app.use((req, res, next) => {
  const userId = req.headers['x-user-id'] as string;
  if (userId) {
    (req as any).userId = userId;
  }
  next();
});

(async () => {
  try {
    console.log("=== SERVER INITIALIZATION START ===");
    log("Starting server initialization...");

    // Регистрируем тестовые маршруты для проверки Telegram и других API
    console.log("Registering test API routes...");
    log("Registering test API routes first...");
    // Регистрируем основные тестовые маршруты
    app.use('/api/test', testRouter);
    // Регистрируем маршруты для диагностики и исправления проблем с URL Telegram
    app.use('/api/telegram-diagnostics', telegramDiagnosticsRouter);
    console.log("Test API routes registered");
    log("Test API routes registered successfully");
    
    // Регистрируем маршруты для Claude AI
    console.log("Registering Claude AI routes...");
    log("Registering Claude AI routes...");
    registerClaudeRoutes(app);
    console.log("Claude AI routes registered");
    log("Claude AI routes registered successfully");
    
    // Регистрируем маршруты для DeepSeek
    console.log("Registering DeepSeek routes...");
    log("Registering DeepSeek routes...");
    registerDeepSeekRoutes(app);
    console.log("DeepSeek routes registered");
    log("DeepSeek routes registered successfully");
    
    // Регистрируем маршруты для Qwen
    console.log("Registering Qwen routes...");
    log("Registering Qwen routes...");
    registerQwenRoutes(app);
    console.log("Qwen routes registered");
    log("Qwen routes registered successfully");
    
    // Регистрируем маршруты для Gemini
    console.log("Registering Gemini routes...");
    log("Registering Gemini routes...");
    registerGeminiRoutes(app);
    console.log("Gemini routes registered");
    log("Gemini routes registered successfully");

    // Регистрируем маршруты Claude
    log("Registering Claude routes...");
    registerClaudeRoutes(app);
    console.log("Claude routes registered");
    log("Claude routes registered successfully");

    // Регистрируем YouTube Channel Info маршруты ПЕРЕД основными маршрутами
    console.log("Registering YouTube Channel routes EARLY...");
    log("Registering YouTube Channel routes EARLY...");
    const youtubeChannelRouter = (await import('./routes/youtube-channel')).default;
    
    // Добавляем отладочное логирование для проверки регистрации маршрута
    console.log('📍 [YOUTUBE-ROUTER] Router imported successfully:', !!youtubeChannelRouter);
    console.log('📍 [YOUTUBE-ROUTER] Registering at /api prefix EARLY');
    
    app.use('/api', youtubeChannelRouter);
    console.log("YouTube Channel routes registered EARLY");
    log("YouTube Channel routes registered successfully EARLY");
    
    // Регистрируем YouTube OAuth маршруты ПЕРЕД основными маршрутами
    console.log("Registering YouTube OAuth routes EARLY...");
    log("Registering YouTube OAuth routes EARLY...");
    const youtubeAuthRouter = (await import('./routes/youtube-auth')).default;
    app.use('/api', youtubeAuthRouter);
    console.log("YouTube OAuth routes registered EARLY");
    log("YouTube OAuth routes registered successfully EARLY");

    log("Registering main routes after YouTube routes...");
    console.log("Starting route registration...");
    await registerRoutes(app);
    
    // Регистрируем Instagram Campaign Settings маршруты ПОСЛЕ registerRoutes
    // чтобы они имели приоритет над конфликтующими маршрутами в routes.ts
    console.log("Registering Instagram Campaign Settings routes...");
    log("Registering Instagram Campaign Settings routes...");
    const campaignInstagramRoutes = (await import('./routes/campaign-instagram-settings')).default;
    app.use('/api', campaignInstagramRoutes);
    console.log("Instagram Campaign Settings routes registered");
    log('Instagram Campaign Settings routes registered with priority');
    
    // Регистрируем Instagram OAuth маршруты
    console.log("Registering Instagram OAuth routes...");
    log("Registering Instagram OAuth routes...");
    const instagramOAuthRouter = (await import('./routes/instagram-oauth')).default;
    app.use('/api', instagramOAuthRouter);
    console.log("Instagram OAuth routes registered");
    log("Instagram OAuth routes registered successfully");

    // Регистрируем VK OAuth маршруты
    console.log("Registering VK OAuth routes...");
    log("Registering VK OAuth routes...");
    const vkOAuthRouter = (await import('./routes/vk-oauth')).default;
    app.use('/api', vkOAuthRouter);
    console.log("VK OAuth routes registered");
    log("VK OAuth routes registered successfully");

    // Регистрируем VK настройки кампании
    console.log("Registering VK Campaign Settings routes...");
    log("Registering VK Campaign Settings routes...");
    const vkSettingsRouter = (await import('./routes/campaign-vk-settings')).default;
    app.use('/api', vkSettingsRouter);
    console.log("VK Campaign Settings routes registered");
    log("VK Campaign Settings routes registered successfully");

    // Регистрируем Facebook настройки кампании
    console.log("Registering Facebook Campaign Settings routes...");
    log("Registering Facebook Campaign Settings routes...");
    const facebookSettingsRouter = (await import('./routes/campaign-facebook-settings')).default;
    app.use('/api', facebookSettingsRouter);
    console.log("Facebook Campaign Settings routes registered");
    log("Facebook Campaign Settings routes registered successfully");

    // Регистрируем Facebook Debug маршруты
    console.log("Registering Facebook Debug routes...");
    log("Registering Facebook Debug routes...");
    const facebookDebugRouter = (await import('./routes/facebook-debug')).default;
    app.use('/api', facebookDebugRouter);
    console.log("Facebook Debug routes registered");
    log("Facebook Debug routes registered successfully");

    // Регистрируем Facebook Groups Discovery маршруты
    console.log("Registering Facebook Groups Discovery routes...");
    log("Registering Facebook Groups Discovery routes...");
    const facebookGroupsRouter = (await import('./routes/facebook-groups-discovery')).default;
    app.use('/api', facebookGroupsRouter);
    console.log("Facebook Groups Discovery routes registered");
    log("Facebook Groups Discovery routes registered successfully");

    // Регистрируем YouTube настройки кампании
    console.log("Registering YouTube Campaign Settings routes...");
    log("Registering YouTube Campaign Settings routes...");
    const youtubeSettingsRouter = (await import('./routes/campaign-youtube-settings')).default;
    app.use('/api', youtubeSettingsRouter);
    console.log("YouTube Campaign Settings routes registered");
    log("YouTube Campaign Settings routes registered successfully");
    
    // Register stories routes with proper API fixes
    console.log("Registering Stories routes...");
    log("Registering Stories routes...");
    const storiesRoutes = (await import('./routes/stories')).default;
    app.use('/api/stories', storiesRoutes);
    console.log("Stories routes registered");
    log("Stories routes registered successfully");
    
    // Регистрируем маршруты аналитики
    log("Registering Analytics routes...");
    registerAnalyticsRoutes(app);
    log("Analytics routes registered successfully");
    
    // Регистрируем специальные маршруты для XMLRiver API
    log("Registering XMLRiver API routes...");
    registerXmlRiverRoutes(app);
    log("XMLRiver API routes registered successfully");
    
    // Регистрируем универсальный интерфейс для моделей FAL.AI
    log("Registering FAL.AI Universal Image Generation routes...");
    registerFalAiImageRoutes(app);
    log("FAL.AI Universal Image Generation routes registered successfully");
    
    // Регистрируем маршруты для Imgur Uploader
    log("Registering Imgur Uploader routes...");
    registerImgurRoutes(app);
    log("Imgur Uploader routes registered successfully");
    
    // Регистрируем маршруты для получения моделей DeepSeek
    log("Registering DeepSeek Models route...");
    registerDeepSeekModelsRoute(app);
    log("DeepSeek Models route registered successfully");
    
    // Регистрируем маршруты для работы с Beget S3
    log("Registering Beget S3 routes...");
    registerBegetS3Routes(app);
    log("Beget S3 routes registered successfully");
    
    // Регистрируем маршрут для очистки кэша
    log("Registering clear cache routes...");
    const clearCacheRouter = (await import('./routes/clear-cache')).default;
    app.use('/api', clearCacheRouter);
    log("Clear cache routes registered successfully");
    
    // Маршруты для работы с личными API ключами пользователя уже зарегистрированы в начале файла
    log("User API keys routes already registered early");
    
    // Закомментировано, т.к. мы уже зарегистрировали тестовые маршруты в начале
    // log("Registering Telegram test routes...");
    // app.use('/api/test', testRouter);
    // log("Telegram test routes registered successfully");
    
    // Убираем старый неработающий endpoint

    console.log("Route registration completed");
    log("Routes registered successfully");

    // Глобальный обработчик ошибок
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`Error encountered: ${status} - ${message}`);
      res.status(status).json({ message });
    });

    // Всегда настраиваем Vite в среде Replit
    try {
      log("Setting up Vite in development mode...");
      await setupVite(app, server);
      log("Vite setup completed");
    } catch (viteError) {
      log(`Warning: Error setting up Vite: ${viteError instanceof Error ? viteError.message : 'Unknown error'}`);
      log("Continuing server startup despite Vite initialization error");
    }

    // Всегда используем порт 5000 для соответствия настройкам .replit
    const PORT = 5000;
    console.log(`=== STARTING SERVER ON PORT ${PORT} ===`);
    log(`Attempting to start server on port ${PORT}...`);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`=== SERVER SUCCESSFULLY STARTED ON PORT ${PORT} ===`);
      log(`Server successfully started on port ${PORT}`);
      
      // Печатаем URL-адрес приложения
      console.log(`=== SERVER URL: http://0.0.0.0:${PORT} ===`);
      
      // Логируем информацию об окружении
      logEnvironmentInfo();
      
      // Инициализируем тяжелые сервисы после успешного запуска сервера
      initializeHeavyServices();
      
      // Запускаем валидатор статусов публикаций для автоматического исправления некорректных статусов
      setTimeout(() => {
        log('Запуск валидатора статусов публикаций', 'status-validator');
        statusValidator.startValidation();
      }, 30000); // Задержка 30 секунд для завершения инициализации всех сервисов
      
      // Запускаем планировщик публикаций с поддержкой индивидуального времени платформ
      setTimeout(() => {
        log('Запуск планировщика публикаций с поддержкой N8N', 'scheduler');
        const scheduler = getPublishScheduler();
        scheduler.start();
        log('✅ Планировщик публикаций успешно запущен', 'scheduler');
      }, 35000); // Задержка 35 секунд для завершения инициализации всех сервисов
    }).on('error', (err: NodeJS.ErrnoException) => {
      console.log(`=== SERVER START ERROR: ${err.message} ===`);
      if (err.code === 'EADDRINUSE') {
        log(`Fatal error: Port ${PORT} is already in use. Please ensure no other process is using this port.`);
      } else {
        log(`Fatal error starting server: ${err.message}`);
      }
      process.exit(1);
    });

  } catch (error) {
    log(`Fatal error during server startup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
})();

// Глобальный обработчик необработанных исключений
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Глобальный обработчик необработанных отклонений промисов
process.on('unhandledRejection', (reason) => {
  log(`Unhandled Promise Rejection: ${reason instanceof Error ? reason.message : 'Unknown reason'}`);
  process.exit(1);
});