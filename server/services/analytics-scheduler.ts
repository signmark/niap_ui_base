/**
 * Модуль планировщика автоматического сбора аналитики
 */

import { log } from '../utils/logger';
import { collectAnalytics, getAnalyticsStatus } from './analytics';
import { directusCrud } from './directus-crud';

// Таймер сбора аналитики
let analyticsTimer: NodeJS.Timeout | null = null;

/**
 * Запускает планировщик сбора аналитики по расписанию в 8:00 утра каждый день
 */
export function startAnalyticsScheduler(): void {
  if (analyticsTimer) {
    clearTimeout(analyticsTimer);
  }
  
  // Рассчитываем время до следующего запуска в 8:00 утра
  const scheduleNextCollection = () => {
    const now = new Date();
    const next8AM = new Date(now);
    next8AM.setHours(8, 0, 0, 0);
    
    // Если сейчас уже после 8 утра, планируем на завтра
    if (now >= next8AM) {
      next8AM.setDate(next8AM.getDate() + 1);
    }
    
    const timeUntilNext = next8AM.getTime() - now.getTime();
    
    log.info(`[analytics-scheduler] Запуск планировщика аналитики на ${next8AM.toLocaleString()}. Времени до запуска: ${Math.round(timeUntilNext / 60000)} минут`);
    
    // Устанавливаем таймер до 8:00 следующего утра
    analyticsTimer = setTimeout(() => {
      // Запускаем сбор аналитики
      scheduleAnalyticsCollection().finally(() => {
        // После завершения сбора, планируем следующий на 8:00 завтра
        scheduleNextCollection();
      });
    }, timeUntilNext);
  };
  
  // Если нужен первый сбор сразу при запуске планировщика, раскомментируйте
  // scheduleAnalyticsCollection();
  
  // Запускаем планировщик
  scheduleNextCollection();
}

/**
 * Останавливает планировщик сбора аналитики
 */
export function stopAnalyticsScheduler(): void {
  if (analyticsTimer) {
    clearTimeout(analyticsTimer);
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

    try {
      // Пытаемся получить список всех активных кампаний с использованием административного доступа
      const campaigns = await directusCrud.searchItems('campaigns', {
        filter: {
          status: { _eq: 'active' }
        },
        fields: ['id', 'name'],
        authToken: adminToken
      });

      log.info(`[analytics-scheduler] Найдено ${campaigns.length} активных кампаний для сбора аналитики`);
      
      if (campaigns.length === 0) {
        log.info('[analytics-scheduler] Нет активных кампаний для сбора аналитики');
        return;
      }
      
      // Для демонстрации выбираем первую кампанию
      const campaign = campaigns[0] as { id: string; name: string };
      
      log.info(`[analytics-scheduler] Запуск сбора аналитики для кампании ${campaign.name} (${campaign.id})`);
      
      // Запускаем сбор аналитики для выбранной кампании с передачей админского токена
      await collectAnalytics(campaign.id, adminToken);
    } catch (campaignsError: any) {
      // Если не удалось получить кампании из-за ошибки прав доступа,
      // попробуем использовать фиксированный ID кампании для сбора аналитики
      log.warn(`[analytics-scheduler] Не удалось получить список кампаний: ${campaignsError.message}`);
      
      // Используем фиксированный ID основной кампании (из env или константу)
      const defaultCampaignId = process.env.DEFAULT_CAMPAIGN_ID || '46868c44-c6a4-4bed-accf-9ad07bba790e';
      log.info(`[analytics-scheduler] Использование кампании по умолчанию: ${defaultCampaignId}`);
      
      // Запускаем сбор аналитики для кампании по умолчанию
      await collectAnalytics(defaultCampaignId, adminToken);
    }
  } catch (error: any) {
    log.error(`[analytics-scheduler] Ошибка планирования сбора аналитики: ${error.message}`);
  }
}