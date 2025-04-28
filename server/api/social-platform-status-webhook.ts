/**
 * Универсальный вебхук для обновления статуса публикации в социальных сетях
 * Этот вебхук надежно обновляет только ту часть socialPlatforms, которая относится
 * к конкретной платформе, сохраняя информацию о других платформах
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import log from '../utils/logger';
import { DirectusAuthManager } from '../services/directus-auth-manager';

const router = Router();
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';

// Генерация уникального ID для каждого запроса для отслеживания в логах
const generateRequestId = (): string => {
  return `status_update_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
};

/**
 * Получает текущие данные контента из Directus
 * @param contentId ID контента
 * @param token Токен авторизации Directus
 * @returns Данные контента или null
 */
async function getContentData(contentId: string, token: string): Promise<any> {
  try {
    const response = await axios.get(
      `${DIRECTUS_URL}/items/campaign_content/${contentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data.data;
  } catch (error) {
    log.error(`Ошибка при получении данных контента ${contentId}: ${error.message}`);
    return null;
  }
}

/**
 * Обновляет статус публикации контента в Directus
 * @param contentId ID контента
 * @param updates Обновления для контента
 * @param token Токен авторизации Directus
 * @returns Успех операции
 */
async function updateContentStatus(contentId: string, updates: any, token: string): Promise<boolean> {
  try {
    await axios.patch(
      `${DIRECTUS_URL}/items/campaign_content/${contentId}`,
      updates,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return true;
  } catch (error) {
    log.error(`Ошибка при обновлении статуса контента ${contentId}: ${error.message}`);
    return false;
  }
}

/**
 * Проверяет наличие ключей платформ в social_platforms и возвращает массив их имен
 * @param socialPlatforms Объект с данными платформ
 * @returns Массив имен найденных платформ
 */
function getPlatformNames(socialPlatforms: any): string[] {
  if (!socialPlatforms || typeof socialPlatforms !== 'object') {
    return [];
  }
  return Object.keys(socialPlatforms);
}

// Универсальный вебхук для обновления статуса публикации в любой социальной сети
router.post('/update-status/:platform', async (req: Request, res: Response) => {
  const requestId = generateRequestId();
  const { platform } = req.params;
  const { contentId, status, postUrl, postId, publishedAt, error } = req.body;

  log.info(`[${requestId}] Получен запрос на обновление статуса ${platform} для контента ${contentId}`);
  log.info(`[${requestId}] Данные обновления: ${JSON.stringify({ status, postUrl, postId, publishedAt, error })}`);

  if (!contentId) {
    log.error(`[${requestId}] Не указан ID контента`);
    return res.status(400).json({ error: 'Не указан ID контента' });
  }

  if (!platform) {
    log.error(`[${requestId}] Не указана платформа`);
    return res.status(400).json({ error: 'Не указана платформа' });
  }

  try {
    // Получаем токен администратора из DirectusAuthManager
    const adminToken = DirectusAuthManager.getAdminToken();
    
    if (!adminToken) {
      log.error(`[${requestId}] Не найден токен администратора. Используем токен из запроса.`);
    }
    
    // Используем токен администратора или токен из запроса
    const token = adminToken || req.body.token;
    
    if (!token) {
      log.error(`[${requestId}] Нет доступного токена авторизации`);
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    // 1. Получаем текущие данные контента
    log.info(`[${requestId}] Получение текущих данных контента ${contentId}`);
    const contentData = await getContentData(contentId, token);
    
    if (!contentData) {
      log.error(`[${requestId}] Не удалось получить данные контента ${contentId}`);
      return res.status(404).json({ error: 'Контент не найден' });
    }

    // 2. Получаем текущие данные социальных платформ
    const currentSocialPlatforms = contentData.social_platforms || {};
    log.info(`[${requestId}] Текущие платформы: ${getPlatformNames(currentSocialPlatforms).join(', ')}`);

    // 3. Создаем глубокую копию текущих данных социальных платформ
    const updatedSocialPlatforms = JSON.parse(JSON.stringify(currentSocialPlatforms));
    
    // 4. Обновляем данные только для указанной платформы
    updatedSocialPlatforms[platform] = {
      ...updatedSocialPlatforms[platform], // сохраняем существующие данные платформы
      status: status || updatedSocialPlatforms[platform]?.status,
      postUrl: postUrl || updatedSocialPlatforms[platform]?.postUrl,
      postId: postId || updatedSocialPlatforms[platform]?.postId,
      publishedAt: publishedAt || updatedSocialPlatforms[platform]?.publishedAt,
      error: error || updatedSocialPlatforms[platform]?.error,
      platform // всегда добавляем имя платформы
    };
    
    // Особая обработка для статуса error
    if (status === 'error' && error) {
      updatedSocialPlatforms[platform].error = error;
    }
    
    // Особая обработка для статуса published
    if (status === 'published') {
      updatedSocialPlatforms[platform].error = null; // Сбрасываем ошибку при успешной публикации
    }

    // 5. Подготавливаем данные для обновления
    const updates = {
      social_platforms: updatedSocialPlatforms
    };
    
    // Если все платформы опубликованы, обновляем общий статус
    const allPublished = Object.values(updatedSocialPlatforms).every(
      (p: any) => p.status === 'published'
    );
    
    const hasFailures = Object.values(updatedSocialPlatforms).some(
      (p: any) => p.status === 'failed' || p.status === 'error'
    );
    
    const hasPending = Object.values(updatedSocialPlatforms).some(
      (p: any) => p.status === 'pending'
    );
    
    // Обновляем общий статус только если все платформы в одинаковом состоянии
    if (allPublished) {
      updates['status'] = 'published';
    } else if (hasFailures && !hasPending) {
      updates['status'] = 'failed';
    }

    log.info(`[${requestId}] Платформы после обновления: ${getPlatformNames(updatedSocialPlatforms).join(', ')}`);
    log.info(`[${requestId}] Итоговые данные platform -> status:`);
    for (const [plt, data] of Object.entries(updatedSocialPlatforms)) {
      const hasUrl = (data as any).postUrl ? '(имеет URL)' : '(без URL)';
      log.info(`[${requestId}]   - ${plt}: ${(data as any).status} ${hasUrl}`);
    }

    // 6. Отправляем обновление в Directus
    log.info(`[${requestId}] Отправка обновленных данных в Directus`);
    const updateSuccess = await updateContentStatus(contentId, updates, token);
    
    if (!updateSuccess) {
      log.error(`[${requestId}] Ошибка при обновлении статуса контента ${contentId}`);
      return res.status(500).json({ error: 'Ошибка при обновлении статуса' });
    }

    // 7. Проверяем, что обновление прошло успешно
    log.info(`[${requestId}] Верификация обновления в Directus`);
    const updatedContent = await getContentData(contentId, token);
    
    if (!updatedContent) {
      log.error(`[${requestId}] Не удалось получить обновленные данные контента ${contentId}`);
      return res.status(500).json({ 
        error: 'Не удалось верифицировать обновление',
        success: true // все равно возвращаем успех, т.к. обновление могло пройти успешно
      });
    }
    
    const updatedPlatforms = getPlatformNames(updatedContent.social_platforms);
    log.info(`[${requestId}] Верификация платформ: ${updatedPlatforms.length} платформ после обновления: ${updatedPlatforms.join(', ')}`);
    
    // Проверяем, что все платформы сохранились
    const originalPlatforms = getPlatformNames(currentSocialPlatforms);
    const allPlatformsPreserved = originalPlatforms.every(p => updatedPlatforms.includes(p));
    
    if (!allPlatformsPreserved) {
      log.warn(`[${requestId}] ВНИМАНИЕ: Не все платформы сохранены после обновления!`);
      log.warn(`[${requestId}] Было: ${originalPlatforms.join(', ')}, стало: ${updatedPlatforms.join(', ')}`);
    } else {
      log.info(`[${requestId}] ✅ Верификация успешна - все платформы сохранены`);
    }

    log.info(`[${requestId}] ✅ ЗАВЕРШЕНО обновление статуса публикации для ${contentId}, платформа: ${platform}`);
    
    return res.json({
      success: true,
      message: `Статус публикации в ${platform} успешно обновлен`,
      contentId,
      platform,
      status: updatedSocialPlatforms[platform].status,
      allPlatformsPreserved
    });
  } catch (error) {
    log.error(`[${requestId}] Критическая ошибка при обновлении статуса: ${error.message}`);
    log.error(error.stack);
    
    return res.status(500).json({
      error: `Ошибка при обновлении статуса: ${error.message}`,
      success: false
    });
  }
});

export default router;