/**
 * Простой отладочный маршрут для тестирования
 */
import { Express, Request, Response } from 'express';

/**
 * Регистрирует простой отладочный маршрут для проверки работоспособности API
 */
export function registerSimpleDebugRoute(app: Express): void {
  console.log('[test-debug] Регистрация простого отладочного маршрута...');

  // Простой тестовый маршрут
  app.get('/api/test/debug-hello', (req: Request, res: Response) => {
    console.log('[test-debug] Запрос к отладочному маршруту /api/test/debug-hello');
    res.json({
      success: true,
      message: 'Отладочный маршрут работает'
    });
  });
}