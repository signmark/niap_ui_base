import express from 'express';
import path from 'path';
import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';
import uploadsRouter from './routes-uploads';
import cdnRouter from './routes-cdn';
import authRouter from './routes-auth';
import http from 'http';

// Создаем экземпляр Express приложения
const app = express();

// Настройка глобальных middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка статических файлов
const uploadsDir = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Регистрируем маршруты для API
app.use('/api/upload-image', uploadsRouter);
app.use('/api/cdn', cdnRouter);
app.use('/api', authRouter);

// Настраиваем обработку запросов к API
app.use('/api', (req, res, next) => {
  // Пропускаем определенные пути без аутентификации
  if (req.path.startsWith('/login') || 
      req.path.startsWith('/register') || 
      req.path.startsWith('/auth/check') || 
      req.path.startsWith('/auth/refresh') || 
      req.path.startsWith('/upload-image') || 
      req.path.startsWith('/cdn')) {
    return next();
  }
  
  // Для всех остальных API-запросов применяем проверку аутентификации
  authMiddleware(req, res, next);
});

// Настраиваем Express для поддержки клиентского маршрутизатора
// Используем статические файлы из собранного frontend приложения
app.use(express.static(path.join(process.cwd(), 'public')));

// Для всех остальных маршрутов отдаем статический HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

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