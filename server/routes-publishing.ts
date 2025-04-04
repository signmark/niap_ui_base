import express, { Request, Response } from 'express';
import { authenticateToken } from './middleware/auth';
import { publishToSocialNetwork } from './services/social-publishing-service';
import { logger } from './utils/logger';

const log = (message: string) => logger.info(`[PublishingRoutes] ${message}`);
const errorLog = (message: string) => logger.error(`[PublishingRoutes] ${message}`);

/**
 * Регистрирует маршруты API для публикации контента в социальные сети
 * @param app Экземпляр Express приложения
 */
export const registerPublishingRoutes = (app: express.Application) => {
  log('Initializing publishing routes');

  /**
   * Маршрут для публикации контента в социальную сеть
   * POST /api/publish
   * 
   * Body:
   * - contentId: ID контента для публикации
   * - platform: Платформа для публикации ('telegram', 'vk', 'instagram', 'facebook')
   * - content: Объект с контентом (опционально, если contentId не указан)
   */
  app.post('/api/publish', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { contentId, platform, content } = req.body;

      if (!platform) {
        return res.status(400).json({
          success: false,
          message: 'Не указана платформа для публикации'
        });
      }

      if (!contentId && !content) {
        return res.status(400).json({
          success: false,
          message: 'Необходимо указать ID контента или передать контент'
        });
      }

      log(`Запрос на публикацию контента ${contentId} на платформе ${platform}`);

      // Делегируем публикацию сервису
      const result = await publishToSocialNetwork(platform, contentId, content);

      log(`Контент успешно опубликован на ${platform}`);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      errorLog(`Ошибка публикации: ${errorMessage}`);
      
      return res.status(500).json({
        success: false,
        message: `Ошибка публикации: ${errorMessage}`
      });
    }
  });

  /**
   * Маршрут для обновления контента
   * PATCH /api/publish/update-content/:id
   */
  app.patch('/api/publish/update-content/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const contentId = req.params.id;
      const updateData = req.body;

      if (!contentId) {
        return res.status(400).json({
          success: false,
          message: 'Не указан ID контента для обновления'
        });
      }

      log(`Запрос на обновление контента с ID ${contentId}`);

      // Здесь должна быть логика обновления контента через Directus API
      // Пример реализации:
      
      try {
        // Поскольку сейчас мы не разрабатываем полную интеграцию с Directus,
        // просто возвращаем успешный ответ с обновленными данными
        return res.status(200).json({
          success: true,
          data: {
            id: contentId,
            ...updateData,
            updatedAt: new Date().toISOString()
          }
        });
      } catch (directusError) {
        errorLog(`Ошибка при обновлении контента в Directus: ${directusError instanceof Error ? directusError.message : 'Неизвестная ошибка'}`);
        return res.status(500).json({
          success: false,
          message: 'Ошибка при обновлении контента'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      errorLog(`Ошибка обновления контента: ${errorMessage}`);
      
      return res.status(500).json({
        success: false,
        message: `Ошибка обновления контента: ${errorMessage}`
      });
    }
  });

  log('Publishing routes registered successfully');
};