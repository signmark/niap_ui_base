import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { directusApiManager } from './directus';
import { registerXmlRiverRoutes } from './api/xmlriver-routes';

// Глобальная переменная для доступа к directusApiManager без импорта (избегаем циклические зависимости)
// @ts-ignore - игнорируем проверку типов
global['directusApiManager'] = directusApiManager;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

(async () => {
  try {
    log("Starting server initialization...");

    log("Registering routes...");
    console.log("Starting route registration...");
    const server = await registerRoutes(app);
    
    // Регистрируем специальные маршруты для XMLRiver API
    log("Registering XMLRiver API routes...");
    registerXmlRiverRoutes(app);
    log("XMLRiver API routes registered successfully");
    
    console.log("Route registration completed");
    log("Routes registered successfully");

    // Глобальный обработчик ошибок
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`Error encountered: ${status} - ${message}`);
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      log("Setting up Vite in development mode...");
      await setupVite(app, server);
      log("Vite setup completed");
    } else {
      log("Setting up static file serving...");
      serveStatic(app);
      log("Static file serving setup completed");
    }

    // Используем стандартный порт 5000
    const PORT = 5000;
    log(`Attempting to start server on port ${PORT}...`);

    server.listen({
      port: PORT,
      host: "0.0.0.0",
    }, () => {
      log(`Server successfully started on port ${PORT}`);
    }).on('error', (err: NodeJS.ErrnoException) => {
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