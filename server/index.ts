import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

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

    // Try ports 5000, 5001, 5002, etc. until we find an available one
    let currentPort = 5000;
    const startServer = () => {
      return new Promise<void>((resolve, reject) => {
        log(`Attempting to start server on port ${currentPort}...`);
        const serverInstance = server.listen({
          port: currentPort,
          host: "0.0.0.0",
        }, () => {
          log(`Server successfully started on port ${currentPort}`);
          resolve();
        });

        serverInstance.once('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            log(`Port ${currentPort} is in use, trying next port...`);
            currentPort++;
            startServer().then(resolve).catch(reject);
          } else {
            log(`Error starting server: ${err.message}`);
            reject(err);
          }
        });
      });
    };

    log("Initiating port binding sequence...");
    await startServer();
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