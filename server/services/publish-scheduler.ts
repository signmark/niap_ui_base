import { log } from '../utils/logger';
import { storage } from '../storage';
import { socialPublishingService } from './social-publishing';
import { CampaignContent, SocialPlatform } from '@shared/schema';
import { directusStorageAdapter } from './directus';

/**
 * Класс для планирования и выполнения автоматической публикации контента
 */
export class PublishScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 60000; // проверяем каждую минуту

  /**
   * Запускает планировщик публикаций
   */
  start() {
    if (this.isRunning) {
      log('Планировщик публикаций уже запущен', 'scheduler');
      return;
    }

    log('Запуск планировщика публикаций', 'scheduler');
    this.isRunning = true;
    
    // Немедленно выполняем первую проверку
    this.checkScheduledContent();

    // Устанавливаем интервал для регулярных проверок
    this.intervalId = setInterval(() => {
      this.checkScheduledContent();
    }, this.checkIntervalMs);
  }

  /**
   * Останавливает планировщик публикаций
   */
  stop() {
    if (!this.isRunning || !this.intervalId) {
      log('Планировщик публикаций не запущен', 'scheduler');
      return;
    }

    log('Остановка планировщика публикаций', 'scheduler');
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Проверяет запланированные публикации и публикует контент, который пора опубликовать
   */
  async checkScheduledContent() {
    try {
      log('Проверка запланированных публикаций', 'scheduler');

      // Пытаемся получить запланированные публикации для всех известных пользователей
      // Так как у нас нет централизованного хранилища пользователей, попробуем 
      // использовать известных системных пользователей (администраторов)
      let scheduledContent: CampaignContent[] = [];
      
      // Пробуем получить запланированные публикации через новый адаптер
      try {
        // Идентификатор администратора из .env
        const adminUserId = process.env.DIRECTUS_ADMIN_USER_ID;
        if (adminUserId) {
          log(`Поиск запланированных публикаций через учетную запись администратора ID: ${adminUserId}`, 'scheduler');
          const adminContent = await directusStorageAdapter.getScheduledContent(adminUserId);
          scheduledContent = [...scheduledContent, ...adminContent];
        }
      } catch (error: any) {
        log(`Ошибка при получении публикаций через адаптер: ${error.message}`, 'scheduler');
      }
      
      // Если ничего не нашли через адаптер, попробуем стандартный метод
      if (scheduledContent.length === 0) {
        log('Попытка получения запланированных публикаций через стандартное хранилище', 'scheduler');
        const storageContent = await storage.getScheduledContent();
        scheduledContent = [...scheduledContent, ...storageContent];
      }
      
      if (scheduledContent.length === 0) {
        log('Запланированные публикации не найдены', 'scheduler');
        return;
      }

      log(`Найдено ${scheduledContent.length} запланированных публикаций`, 'scheduler');

      // Текущее время
      const now = new Date();

      // Фильтруем контент, который пора публиковать
      const contentToPublish = scheduledContent.filter(content => {
        if (!content.scheduledAt) return false;
        
        const scheduledTime = new Date(content.scheduledAt);
        return scheduledTime <= now;
      });

      log(`Готово к публикации ${contentToPublish.length} элементов контента`, 'scheduler');

      // Публикуем каждый элемент контента
      for (const content of contentToPublish) {
        await this.publishContent(content);
      }
    } catch (error: any) {
      log(`Ошибка при проверке запланированных публикаций: ${error.message}`, 'scheduler');
    }
  }

  /**
   * Публикует контент в выбранные социальные сети
   * @param content Контент для публикации
   */
  async publishContent(content: CampaignContent) {
    try {
      if (!content.id || !content.campaignId) {
        log(`Контент с ID ${content.id} не содержит необходимой информации`, 'scheduler');
        return;
      }

      log(`Публикация контента ${content.id}: "${content.title}"`, 'scheduler');

      // Получаем данные кампании для настроек социальных сетей
      const campaign = await storage.getCampaign(parseInt(content.campaignId));
      if (!campaign) {
        log(`Кампания с ID ${content.campaignId} не найдена`, 'scheduler');
        return;
      }

      // Настройки социальных сетей
      const socialSettings = campaign.socialMediaSettings || {};

      // Проверяем, в какие платформы нужно публиковать
      const socialPlatforms = content.socialPlatforms || {};
      const platformsToPublish = Object.keys(socialPlatforms) as SocialPlatform[];

      if (platformsToPublish.length === 0) {
        log(`Для контента ${content.id} не указаны платформы`, 'scheduler');
        
        // Обновляем статус - не передаем publishedAt напрямую, это внутреннее поле контента
        await storage.updateCampaignContent(content.id, {
          status: 'published'
        });
        
        return;
      }

      // Публикуем в каждую платформу
      for (const platform of platformsToPublish) {
        // Проверяем, существует ли объект социальных платформ и платформа в нём
        const platformStatus = socialPlatforms && typeof socialPlatforms === 'object' 
          ? (socialPlatforms as Record<string, any>)[platform]?.status
          : undefined;
          
        // Пропускаем уже опубликованные
        if (platformStatus === 'published') {
          log(`Контент ${content.id} уже опубликован в ${platform}`, 'scheduler');
          continue;
        }

        // Публикуем контент в платформу
        const result = await socialPublishingService.publishToPlatform(
          content,
          platform,
          socialSettings
        );

        // Обновляем статус публикации
        await socialPublishingService.updatePublicationStatus(
          content.id,
          platform,
          result
        );

        // Логируем результат
        if (result.status === 'published') {
          log(`Контент ${content.id} успешно опубликован в ${platform}`, 'scheduler');
        } else {
          log(`Ошибка при публикации контента ${content.id} в ${platform}: ${result.error}`, 'scheduler');
        }
      }
    } catch (error: any) {
      log(`Ошибка при публикации контента ${content.id}: ${error.message}`, 'scheduler');
    }
  }
}

export const publishScheduler = new PublishScheduler();