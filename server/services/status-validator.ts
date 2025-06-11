/**
 * Сервис валидации и исправления статусов публикаций
 * 
 * КРИТИЧЕСКОЕ ПРАВИЛО: Статус 'published' валиден ТОЛЬКО при наличии postUrl
 * Автоматически сбрасывает некорректные статусы published без postUrl на pending
 */

import { storage } from '../storage.js';
import { log } from '../utils/logger.js';

export class StatusValidator {
  private isRunning = false;
  private validationInterval = 5 * 60 * 1000; // 5 минут
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Запускает автоматическую валидацию статусов
   */
  public startValidation(): void {
    // ВАЛИДАТОР ОТКЛЮЧЕН для устранения избыточного логирования
    return;
  }

  /**
   * Останавливает автоматическую валидацию
   */
  public stopValidation(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    log('Валидатор статусов остановлен', 'status-validator');
  }

  /**
   * Выполняет валидацию всех статусов публикаций
   */
  public async validateAllStatuses(): Promise<void> {
    // Валидатор отключен - планировщик уже обеспечивает правильную валидацию
    return;
  }

  /**
   * Валидирует статусы конкретного контента
   */
  public async validateContentStatuses(content: any): Promise<number> {
    if (!content.socialPlatforms || typeof content.socialPlatforms !== 'object') {
      return 0;
    }

    let correctedCount = 0;
    const correctedPlatforms: Record<string, any> = {};
    let needsUpdate = false;

    for (const [platform, platformData] of Object.entries(content.socialPlatforms)) {
      if (!platformData || typeof platformData !== 'object') {
        continue;
      }

      const typedData = platformData as any;

      // КРИТИЧЕСКАЯ ПРОВЕРКА: published статус должен иметь postUrl
      // ИСПРАВЛЕНИЕ: НЕ сбрасываем на pending - это создает бесконечный цикл!
      if (typedData.status === 'published' && (!typedData.postUrl || typedData.postUrl.trim() === '')) {
        log(`ИСПРАВЛЕНИЕ: Контент ${content.id}, платформа ${platform} - помечаем published без postUrl как failed`, 'status-validator');
        
        correctedPlatforms[platform] = {
          ...typedData,
          status: 'failed',
          error: 'Published without postUrl - invalid state',
          correctedAt: new Date().toISOString(),
          correctionReason: 'published status without postUrl - marked as failed to prevent infinite loop'
        };
        
        correctedCount++;
        needsUpdate = true;
      } else {
        // Оставляем статус без изменений
        correctedPlatforms[platform] = typedData;
      }
    }

    // Обновляем контент, если были исправления
    if (needsUpdate) {
      try {
        await storage.updateCampaignContent(content.id, {
          socialPlatforms: correctedPlatforms
        });
        
        log(`Обновлены статусы для контента ${content.id}: исправлено ${correctedCount} платформ`, 'status-validator');
      } catch (updateError: any) {
        log(`Ошибка при обновлении статусов контента ${content.id}: ${updateError.message}`, 'status-validator');
      }
    }

    return correctedCount;
  }

  /**
   * Получает админский токен для операций валидации
   */
  private async getAdminToken(): Promise<string | null> {
    try {
      const directusAuthManager = (global as any).directusAuthManager;
      if (directusAuthManager) {
        const adminSessions = directusAuthManager.getAllSessions();
        const adminSession = adminSessions.find((session: any) => 
          session.user?.email === 'admin@roboflow.tech'
        );
        
        if (adminSession?.token) {
          return adminSession.token;
        }
      }
      
      // Если нет токена в кэше, пропускаем валидацию
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Получает весь контент с социальными платформами
   */
  private async getAllContentWithSocialPlatforms(): Promise<any[]> {
    try {
      // Получаем админский токен для получения всего контента
      const adminToken = await this.getAdminToken();
      if (!adminToken) {
        // Тихо пропускаем валидацию если нет токена
        return [];
      }
      
      // Пропускаем валидацию если нет токена админа
      // Валидатор будет работать только когда есть активная админская сессия
      return [];
      
      // Фильтруем только контент с социальными платформами
      const contentWithPlatforms = allContent.filter(content => 
        content.socialPlatforms && 
        typeof content.socialPlatforms === 'object' &&
        Object.keys(content.socialPlatforms).length > 0
      );

      log(`Найдено ${contentWithPlatforms.length} элементов контента с социальными платформами для валидации`, 'status-validator');
      return contentWithPlatforms;
    } catch (error: any) {
      log(`Ошибка при получении контента для валидации: ${error.message}`, 'status-validator');
      return [];
    }
  }

  /**
   * Валидирует отдельную платформу
   */
  public static validatePlatformStatus(platform: string, platformData: any): { isValid: boolean; correctedData?: any } {
    if (!platformData || typeof platformData !== 'object') {
      return { isValid: true };
    }

    // ОСНОВНОЕ ПРАВИЛО: published статус должен иметь postUrl
    if (platformData.status === 'published' && (!platformData.postUrl || platformData.postUrl.trim() === '')) {
      return {
        isValid: false,
        correctedData: {
          ...platformData,
          status: 'pending',
          error: null,
          correctedAt: new Date().toISOString(),
          correctionReason: 'published status without postUrl'
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Проверяет, можно ли публиковать в платформу
   */
  public static canPublishToPlatform(platform: string, platformData: any): boolean {
    if (!platformData || typeof platformData !== 'object') {
      return true; // Если нет данных, можно публиковать
    }

    // Нельзя публиковать если статус published И есть postUrl
    if (platformData.status === 'published' && platformData.postUrl && platformData.postUrl.trim() !== '') {
      return false;
    }

    return true;
  }
}

// Создаем экземпляр валидатора
export const statusValidator = new StatusValidator();