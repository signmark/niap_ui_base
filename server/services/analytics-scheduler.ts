/**
 * Модуль планировщика автоматического сбора аналитики
 */

import { log } from '../utils/logger';
import { collectAnalytics, getAnalyticsStatus } from './analytics';
import { directusCrud } from './directus-crud';
import { directusAuthManager } from './directus-auth-manager';

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
    
    // Пытаемся получить административный доступ
    // Используем обычный метод directusCrud.login вместо getAdminSession
    try {
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      
      if (!email || !password) {
        log.error('[analytics-scheduler] Отсутствуют учетные данные DIRECTUS_ADMIN_EMAIL или DIRECTUS_ADMIN_PASSWORD');
        return;
      }
      
      log.info(`[analytics-scheduler] Попытка авторизации администратора (${email})`);
      
      const authResult = await directusCrud.login(email, password);
      
      if (!authResult || !authResult.access_token) {
        log.error('[analytics-scheduler] Не удалось получить токен авторизации администратора');
        return;
      }
      
      const adminToken = authResult.access_token;
    
    // Получаем список всех активных кампаний с использованием административного доступа
    const campaigns = await directusCrud.searchItems('campaigns', {
      filter: {
        status: { _eq: 'active' }
      },
      fields: ['id', 'name'],
      authToken: adminSession.token
    });
    
    log.info(`[analytics-scheduler] Найдено ${campaigns.length} активных кампаний для сбора аналитики`);
    
    if (campaigns.length === 0) {
      return;
    }
    
    // Для демонстрации выбираем первую кампанию
    // В реальном приложении можно организовать очередь или собирать параллельно
    const campaign = campaigns[0];
    
    log.info(`[analytics-scheduler] Запуск сбора аналитики для кампании ${campaign.name} (${campaign.id})`);
    
    // Запускаем сбор аналитики для выбранной кампании с передачей админского токена
    await collectAnalytics(campaign.id, adminSession.token);
    
  } catch (error: any) {
    log.error(`[analytics-scheduler] Ошибка планирования сбора аналитики: ${error.message}`);
  }
}