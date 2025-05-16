import axios from 'axios';
import { log } from '../utils/logger';
import { directusApiManager } from '../directus';

/**
 * Сервис для работы с аналитикой
 */
export class AnalyticsService {
  private readonly logPrefix: string = 'analytics-service';
  private readonly n8nWebhookUrl: string;

  constructor() {
    // Получаем URL вебхука из переменных окружения или используем значение по умолчанию
    this.n8nWebhookUrl = process.env.N8N_ANALYTICS_WEBHOOK_URL || 'https://n8n.nplanner.ru/webhook/posts-to-analytics';
    log(`AnalyticsService initialized with webhook URL: ${this.n8nWebhookUrl}`, this.logPrefix);
  }

  /**
   * Запрашивает обновление аналитических данных для указанной кампании
   * @param campaignId ID кампании
   * @param days Количество дней для обновления (по умолчанию 7)
   * @param userId ID пользователя для авторизации запроса (опционально)
   * @returns Результат операции
   */
  async requestAnalyticsUpdate(
    campaignId: string,
    days: number = 7,
    userId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      log(`Запрос обновления аналитики для кампании ${campaignId} за ${days} дней`, this.logPrefix);

      // Формируем данные для отправки в n8n вебхук
      const payload = {
        campaignId,
        days,
        timestamp: Date.now(),
        source: 'smm-manager-api'
      };

      // Подготовка конфигурации запроса с токеном авторизации, если предоставлен userId
      const config = userId 
        ? { headers: {} } 
        : {};

      if (userId) {
        const cachedToken = directusApiManager.getCachedToken(userId);
        if (cachedToken) {
          config.headers = {
            'Authorization': `Bearer ${cachedToken.token}`
          };
        }
      }

      // Отправляем запрос на вебхук n8n
      const response = await axios.post(this.n8nWebhookUrl, payload, config);

      // Вебхук может не возвращать данные, проверяем статус
      if (response.status >= 200 && response.status < 300) {
        log(`Успешно отправлен запрос на обновление аналитики для кампании ${campaignId}`, this.logPrefix);
        return {
          success: true,
          message: `Запрос на обновление аналитики успешно отправлен`
        };
      } else {
        log(`Ошибка при запросе обновления аналитики: Статус ${response.status}`, this.logPrefix);
        return {
          success: false,
          message: `Ошибка при запросе обновления аналитики: Статус ${response.status}`
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Ошибка при запросе обновления аналитики: ${errorMessage}`, this.logPrefix);
      return {
        success: false,
        message: `Ошибка при запросе обновления аналитики: ${errorMessage}`
      };
    }
  }
}

// Создаем и экспортируем экземпляр сервиса
export const analyticsService = new AnalyticsService();