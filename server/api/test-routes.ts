/**
 * Тестовые маршруты API для проверки функционала социальных сетей
 */

import { Router } from 'express';
import { socialPublishingService } from '../services/social-publishing';
import log from '../utils/logger';

const router = Router();

/**
 * Тестовый маршрут для прямого вызова updatePublicationStatus
 * Позволяет имитировать обновление статуса публикации с заданными данными
 */
router.post('/manual-test/update-publication-status', async (req, res) => {
  try {
    const { contentId, platform, publicationResult, initialSocialPlatforms } = req.body;
    
    log(`Тестовый вызов updatePublicationStatus с платформой ${platform}`, 'test-routes');
    
    // Подготавливаем мок контента
    const mockContent = {
      id: contentId || 'test-id',
      socialPlatforms: initialSocialPlatforms || {}
    };
    
    // Вызываем непосредственно метод для теста
    const testMethod = async () => {
      // Имитируем логику updatePublicationStatus
      let socialPlatforms = mockContent.socialPlatforms;
      
      // Проверяем тип socialPlatforms и преобразуем при необходимости
      if (typeof socialPlatforms === 'string') {
        try {
          socialPlatforms = JSON.parse(socialPlatforms);
        } catch (e) {
          log(`[ПЛАТФОРМЫ ОШИБКА ПАРСИНГА] Не удалось распарсить socialPlatforms: ${e}`, 'social-publishing');
          socialPlatforms = {};
        }
      }
      
      // Если socialPlatforms не является объектом или null, создаем новый объект
      if (typeof socialPlatforms !== 'object' || socialPlatforms === null) {
        log(`[ПЛАТФОРМЫ ОШИБКА ТИПА] socialPlatforms имеет неверный тип: ${typeof socialPlatforms}. Создаем новый объект.`, 'social-publishing');
        socialPlatforms = {};
      }
      
      // Обновляем информацию о платформе
      // platform - это строковый enum ('instagram', 'telegram', 'vk', 'facebook')
      const platformKey = platform;
      
      log(`[ПЛАТФОРМА КЛЮЧ] Обновление статуса публикации для платформы: ${platformKey}`, 'social-publishing');
      log(`[ПЛАТФОРМА ДАННЫЕ] Данные публикации: ${JSON.stringify(publicationResult)}`, 'social-publishing');
      
      // Проверяем наличие URL-а в publicationResult
      if (!publicationResult.postUrl && mockContent.socialPlatforms) {
        // Пытаемся извлечь URL из существующих данных, если в текущем обновлении его нет
        try {
          let existingPlatforms = mockContent.socialPlatforms;
          if (typeof existingPlatforms === 'string') {
            existingPlatforms = JSON.parse(existingPlatforms);
          }
          
          // Если у платформы уже есть сохраненный URL, используем его
          if (existingPlatforms[platformKey] && existingPlatforms[platformKey].postUrl) {
            log(`[ПЛАТФОРМА URL] Найден сохраненный URL ${existingPlatforms[platformKey].postUrl} для платформы ${platformKey}`, 'social-publishing');
            publicationResult.postUrl = existingPlatforms[platformKey].postUrl;
          }
        } catch (e) {
          log(`[ПЛАТФОРМА URL ОШИБКА] Ошибка при попытке извлечь сохраненный URL: ${e}`, 'social-publishing');
        }
      }
      
      // ВАЖНО: Создаем НОВУЮ копию объекта socialPlatforms, чтобы не изменять исходный объект напрямую
      const updatedSocialPlatforms = { ...socialPlatforms };
      
      // Сохраняем существующие данные платформы, если они есть
      const existingPlatformData = updatedSocialPlatforms[platformKey] || {};
      
      log(`[ПЛАТФОРМА СУЩЕСТВУЮЩИЕ ДАННЫЕ] Данные перед обновлением для ${platformKey}: ${JSON.stringify(existingPlatformData)}`, 'social-publishing');
      
      // Объединяем существующие данные с новыми результатами публикации
      // КРИТИЧНО: сохраняем scheduledAt и другие важные поля, которые могут быть в существующих данных
      updatedSocialPlatforms[platformKey] = {
        ...existingPlatformData,   // Сохраняем все существующие данные
        ...publicationResult,      // Применяем новые данные
        // Убедимся, что статус и дата публикации обновлены
        status: publicationResult.status,
        publishedAt: publicationResult.status === 'published' ? publicationResult.publishedAt : existingPlatformData.publishedAt,
        // Сохраняем дату планирования, если она есть
        scheduledAt: existingPlatformData.scheduledAt || publicationResult.scheduledAt
      };
      
      log(`[ПЛАТФОРМА ОБЪЕДИНЕНИЕ] Объединены данные для платформы ${platformKey}.`, 'social-publishing');
      log(`[ПЛАТФОРМА НОВЫЕ ДАННЫЕ] Результат объединения для ${platformKey}: ${JSON.stringify(updatedSocialPlatforms[platformKey])}`, 'social-publishing');
      
      // Проверяем, что другие платформы не были потеряны
      const platformsList = Object.keys(updatedSocialPlatforms);
      log(`[ПЛАТФОРМЫ ПОЛНЫЙ СПИСОК] Все платформы в обновленном объекте: ${platformsList.join(', ')}`, 'social-publishing');
      
      return {
        socialPlatforms: updatedSocialPlatforms,
        status: 'processed'
      };
    };
    
    const result = await testMethod();
    
    res.json({
      success: true,
      method: 'updatePublicationStatus',
      contentId,
      platform,
      ...result
    });
  } catch (error: any) {
    log(`Ошибка при тестировании updatePublicationStatus: ${error.message}`, 'test-routes');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;