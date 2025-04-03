/**
 * Специальные маршруты для тестирования функций социальных сетей
 */
import { Express, Request, Response } from 'express';
import { socialPublishingService } from './services/updated-social-publishing';
import fs from 'fs';
import path from 'path';

/**
 * Регистрирует тестовые маршруты для проверки публикации в социальные сети
 * @param app Express приложение
 */
export function registerSocialTestRoutes(app: Express) {
  console.log('Регистрация тестовых маршрутов для социальных сетей');
  
  // Маршрут для отправки изображения в Telegram через API
  app.post('/api/social-test/telegram', async (req: Request, res: Response) => {
    try {
      console.log('Запрос на тестовую отправку изображения в Telegram');
      
      // Получаем параметры запроса
      const { imageUrl, chatId, caption, token } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({
          ok: false,
          description: 'Отсутствует URL изображения (imageUrl)'
        });
      }
      
      if (!chatId) {
        return res.status(400).json({
          ok: false,
          description: 'Отсутствует ID чата Telegram (chatId)'
        });
      }
      
      if (!token) {
        return res.status(400).json({
          ok: false,
          description: 'Отсутствует токен бота Telegram (token)'
        });
      }
      
      console.log(`Тестовая отправка изображения: ${imageUrl} -> чат ${chatId}`);
      
      // Отправляем изображение через сервис публикации
      const result = await socialPublishingService.uploadTelegramImageFromUrl(
        imageUrl,
        chatId,
        caption || '',
        token
      );
      
      return res.json(result);
    } catch (error: any) {
      console.error('Ошибка в тестовом маршруте Telegram:', error);
      return res.status(500).json({
        ok: false,
        description: `Внутренняя ошибка сервера: ${error.message || 'Неизвестная ошибка'}`
      });
    }
  });
  
  // Маршрут для получения HTML-страницы с тестовой формой
  app.get('/test-telegram', (req: Request, res: Response) => {
    try {
      // Путь к HTML-файлу с тестовой формой
      const htmlPath = path.join(process.cwd(), 'test-telegram-upload.html');
      
      // Проверяем существование файла
      if (!fs.existsSync(htmlPath)) {
        return res.status(404).send('Тестовая страница не найдена');
      }
      
      // Отправляем HTML-файл
      res.sendFile(htmlPath);
    } catch (error: any) {
      console.error('Ошибка при отправке тестовой страницы:', error);
      res.status(500).send(`Ошибка при отправке тестовой страницы: ${error.message}`);
    }
  });
  
  console.log('Тестовые маршруты для социальных сетей зарегистрированы');
}