import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { telegramVideoRouter } from './test-routes-telegram-video';
import { log } from '../utils/logger';

// Создаем базовый роутер для всех API
const apiRouter = express.Router();

// Здесь можно добавить промежуточное ПО для логирования запросов к API
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  log(`${req.method} ${req.originalUrl}`, 'api');
  next();
});

// Регистрируем тестовый маршрут для проверки отправки видео в Telegram
apiRouter.use('/telegram-video', telegramVideoRouter);

// Корневой маршрут для проверки доступности API
apiRouter.get('/', (req: Request, res: Response) => {
  res.json({ message: 'API сервера активно и доступно' });
});

// Экспортируем маршруты API
export default apiRouter;