import express from 'express';
import path from 'path';
import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';
import uploadsRouter from './routes-uploads';
import cdnRouter from './routes-cdn';
import http from 'http';

// Создаем экземпляр Express приложения
const app = express();

// Настройка глобальных middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка статических файлов
const uploadsDir = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Применяем middleware авторизации
app.use(authMiddleware);

// Регистрируем маршруты
app.use('/api', uploadsRouter);
app.use('/api', cdnRouter);

// Обработка ошибок
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`[Server] Error: ${err.message}`);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Создаем HTTP сервер
const server = http.createServer(app);

// Инициализация сервера
export function initServer(port: number = 3000) {
  // Запускаем сервер на указанном порту
  server.listen(port, '0.0.0.0', () => {
    logger.info(`[Server] Server is running on http://0.0.0.0:${port}`);
  });
  
  return server;
}

// Запускаем сервер если этот файл запущен напрямую (не импортирован)
// В ESM используем другой способ определения точки входа
if (import.meta.url.endsWith('server/index.ts')) {
  initServer(5000);
}

// Экспортируем приложение для использования в других файлах
export default app;