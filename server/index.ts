import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerFalAiImageRoutes } from "./routes-fal-ai-images";
import { registerClaudeRoutes } from "./routes-claude";
import { registerDeepSeekRoutes } from "./routes-deepseek";
import { registerDeepSeekModelsRoute } from "./routes-deepseek-models";
import { registerQwenRoutes } from "./routes-qwen";
import { registerImgurRoutes } from "./routes-imgur";
import { setupVite, serveStatic } from "./vite";
import { log } from "./utils/logger";
import { directusApiManager } from './directus';
import { registerXmlRiverRoutes } from './api/xmlriver-routes';
import { falAiUniversalService } from './services/fal-ai-universal';
// Импортируем тестовые маршруты для Telegram
import testRouter from './api/test-routes';

// Установка переменных окружения для отладки
process.env.DEBUG = 'express:*,vite:*';
process.env.NODE_ENV = 'development';

// Глобальная переменная для доступа к directusApiManager без импорта (избегаем циклические зависимости)
// @ts-ignore - игнорируем проверку типов
global['directusApiManager'] = directusApiManager;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Добавляем механизм приоритетной обработки API запросов, чтобы они не перехватывались Vite
app.use((req, res, next) => {
  // Если это запрос к API, помечаем его специальным флагом
  if (req.path.startsWith('/api/')) {
    (req as any).isApiRequest = true;
  }
  next();
});

// Добавляем API маршрут для проверки статуса явно, чтобы он работал до инициализации Vite
app.get('/api/status-check', (req, res) => {
  return res.json({ status: 'ok', server: 'running', time: new Date().toISOString() });
});

// Добавляем маршрут для проверки здоровья
app.get('/health', (req, res) => {
  return res.status(200).send('OK');
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
- PORT: ${process.env.PORT || '5000 (по умолчанию)'}
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
    app.use('/api/test', testRouter);
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

    log("Registering routes...");
    console.log("Starting route registration...");
    const server = await registerRoutes(app);
    
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
    
    // Закомментировано, т.к. мы уже зарегистрировали тестовые маршруты в начале
    // log("Registering Telegram test routes...");
    // app.use('/api/test', testRouter);
    // log("Telegram test routes registered successfully");
    
    console.log("Route registration completed");
    log("Routes registered successfully");

    // Глобальный обработчик ошибок
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`Error encountered: ${status} - ${message}`);
      res.status(status).json({ message });
    });

    // УДАЛЕНО: специальное middleware для API-запросов, так как оно блокирует все
    // незарегистрированные маршруты, а нам нужно, чтобы они проходили дальше
    
    // Всегда настраиваем Vite в среде Replit
    try {
      log("Setting up Vite in development mode...");
      await setupVite(app, server);
      log("Vite setup completed");
    } catch (viteError) {
      log(`Warning: Error setting up Vite: ${viteError instanceof Error ? viteError.message : 'Unknown error'}`);
      log("Continuing server startup despite Vite initialization error");
    }

    // Используем стандартный порт 5000 или порт из переменной окружения
    const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;
    console.log(`=== STARTING SERVER ON PORT ${PORT} ===`);
    log(`Attempting to start server on port ${PORT}...`);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`=== SERVER SUCCESSFULLY STARTED ON PORT ${PORT} ===`);
      log(`Server successfully started on port ${PORT}`);
      
      // Печатаем URL-адрес приложения
      console.log(`=== SERVER URL: http://0.0.0.0:${PORT} ===`);
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