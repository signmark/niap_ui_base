/**
 * Модуль планировщика автоматического сбора аналитики
 */

import { log } from '../utils/logger';
import { collectAnalytics, getAnalyticsStatus } from './analytics';
import { directusCrud } from './directus-crud';

// Интервал сбора аналитики по умолчанию (5 минут)
const DEFAULT_COLLECTION_INTERVAL = 5 * 60 * 1000;

// Таймер сбора аналитики
let analyticsTimer: NodeJS.Timeout | null = null;

/**
 * Запускает планировщик сбора аналитики
 * @param interval Интервал сбора в миллисекундах (по умолчанию 5 минут)
 */
export function startAnalyticsScheduler(interval: number = DEFAULT_COLLECTION_INTERVAL): void {
  if (analyticsTimer) {
    clearInterval(analyticsTimer);
  }
  
  log.info(`[analytics-scheduler] Запуск планировщика аналитики с интервалом ${interval / 60000} минут`);
  
  // Инициируем первый сбор сразу при запуске планировщика
  scheduleAnalyticsCollection();
  
  // Устанавливаем таймер для регулярного сбора
  analyticsTimer = setInterval(scheduleAnalyticsCollection, interval);
}

/**
 * Останавливает планировщик сбора аналитики
 */
export function stopAnalyticsScheduler(): void {
  if (analyticsTimer) {
    clearInterval(analyticsTimer);
    analyticsTimer = null;
    log.info('[analytics-scheduler] Планировщик аналитики остановлен');
  }
}

/**
 * Планирует сбор аналитики для всех кампаний
 */
async function scheduleAnalyticsCollection(): Promise<void> {
  try {
    // Проверяем, что процесс сбора не запущен
    const status = getAnalyticsStatus();
    if (status.isCollecting) {
      log.info('[analytics-scheduler] Предыдущий процесс сбора ещё не завершён, пропускаем запуск');
      return;
    }
    
    // Получаем список всех активных кампаний
    const campaigns = await directusCrud.searchItems('campaigns', {
      filter: {
        status: { _eq: 'active' }
      },
      fields: ['id', 'name']
    });
    
    log.info(`[analytics-scheduler] Найдено ${campaigns.length} активных кампаний для сбора аналитики`);
    
    if (campaigns.length === 0) {
      return;
    }
    
    // Для демонстрации выбираем первую кампанию
    // В реальном приложении можно организовать очередь или собирать параллельно
    const campaign = campaigns[0];
    
    log.info(`[analytics-scheduler] Запуск сбора аналитики для кампании ${campaign.name} (${campaign.id})`);
    
    // Запускаем сбор аналитики для выбранной кампании
    await collectAnalytics(campaign.id);
    
  } catch (error: any) {
    log.error(`[analytics-scheduler] Ошибка планирования сбора аналитики: ${error.message}`);
  }
}