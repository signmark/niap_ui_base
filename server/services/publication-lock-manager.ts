import { log } from '../utils/logger';

/**
 * Менеджер блокировок для предотвращения дублирования публикаций
 * Обеспечивает, что одна и та же платформа для одного контента
 * не может быть опубликована одновременно
 */
export class PublicationLockManager {
  private locks = new Map<string, Set<string>>(); // contentId -> Set<platform>
  private lockTimeout = 5 * 60 * 1000; // 5 минут на публикацию
  private lockTimestamps = new Map<string, number>(); // lock key -> timestamp
  private maxLocksSize = 500; // Максимальное количество блокировок
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  /**
   * Пытается получить блокировку для публикации
   * @param contentId ID контента
   * @param platform Платформа (instagram, facebook, vk, telegram)
   * @returns true если блокировка получена, false если уже заблокирован
   */
  async acquireLock(contentId: string, platform: string): Promise<boolean> {
    const lockKey = `${contentId}:${platform}`;
    
    // Проверяем существующую блокировку
    if (this.isLocked(contentId, platform)) {
      // Проверяем не истекла ли блокировка
      const timestamp = this.lockTimestamps.get(lockKey);
      if (timestamp && Date.now() - timestamp > this.lockTimeout) {
        // Блокировка истекла, освобождаем и создаем новую
        this.releaseLock(contentId, platform);
        log(`🔓 PublicationLock: Истекшая блокировка освобождена для ${lockKey}`, 'publication-lock');
      } else {
        log(`🔒 PublicationLock: Контент ${contentId} уже публикуется в ${platform}`, 'publication-lock');
        return false;
      }
    }

    // Получаем новую блокировку
    let platformSet = this.locks.get(contentId);
    if (!platformSet) {
      platformSet = new Set();
      this.locks.set(contentId, platformSet);
    }
    
    platformSet.add(platform);
    this.lockTimestamps.set(lockKey, Date.now());
    
    log(`🔒 PublicationLock: Блокировка получена для ${lockKey}`, 'publication-lock');
    return true;
  }

  /**
   * Освобождает блокировку публикации
   * @param contentId ID контента
   * @param platform Платформа
   */
  async releaseLock(contentId: string, platform: string): Promise<void> {
    const lockKey = `${contentId}:${platform}`;
    
    const platformSet = this.locks.get(contentId);
    if (platformSet) {
      platformSet.delete(platform);
      if (platformSet.size === 0) {
        this.locks.delete(contentId);
      }
    }
    
    this.lockTimestamps.delete(lockKey);
    log(`🔓 PublicationLock: Блокировка освобождена для ${lockKey}`, 'publication-lock');
  }

  /**
   * Проверяет заблокирован ли контент для публикации на платформе
   * @param contentId ID контента
   * @param platform Платформа
   * @returns true если заблокирован
   */
  isLocked(contentId: string, platform: string): boolean {
    const platformSet = this.locks.get(contentId);
    return platformSet ? platformSet.has(platform) : false;
  }

  /**
   * Освобождает все блокировки для контента
   * @param contentId ID контента
   */
  async releaseAllLocks(contentId: string): Promise<void> {
    const platformSet = this.locks.get(contentId);
    if (platformSet) {
      for (const platform of Array.from(platformSet)) {
        const lockKey = `${contentId}:${platform}`;
        this.lockTimestamps.delete(lockKey);
      }
      this.locks.delete(contentId);
      log(`🔓 PublicationLock: Все блокировки освобождены для контента ${contentId}`, 'publication-lock');
    }
  }

  /**
   * Инициализирует автоматическую очистку с контролем памяти
   */
  private initCleanupSchedule(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredLocks();
      this.enforceMemoryLimits();
    }, 5 * 60 * 1000); // каждые 5 минут
  }

  /**
   * Принудительно ограничивает размер кэша для предотвращения утечек памяти
   */
  private enforceMemoryLimits(): void {
    if (this.locks.size > this.maxLocksSize) {
      // Удаляем 25% самых старых блокировок
      const entries = Array.from(this.lockTimestamps.entries())
        .sort(([, a], [, b]) => a - b) // сортируем по времени
        .slice(0, Math.floor(this.lockTimestamps.size / 4));

      for (const [lockKey] of entries) {
        const [contentId, platform] = lockKey.split(':');
        this.releaseLock(contentId, platform);
      }
      
      log(`🚨 MEMORY: Принудительно очищено ${entries.length} блокировок (лимит: ${this.maxLocksSize})`, 'publication-lock');
    }
  }

  /**
   * Очищает истекшие блокировки
   */
  cleanupExpiredLocks(): void {
    const now = Date.now();
    const expiredLocks: string[] = [];

    for (const [lockKey, timestamp] of Array.from(this.lockTimestamps.entries())) {
      if (now - timestamp > this.lockTimeout) {
        expiredLocks.push(lockKey);
      }
    }

    for (const lockKey of expiredLocks) {
      const [contentId, platform] = lockKey.split(':');
      this.releaseLock(contentId, platform);
    }

    if (expiredLocks.length > 0) {
      log(`🧹 PublicationLock: Очищено ${expiredLocks.length} истекших блокировок`, 'publication-lock');
    }
  }

  /**
   * Получает статистику блокировок
   */
  getStats(): { totalLocks: number; contentCount: number } {
    let totalLocks = 0;
    for (const platformSet of Array.from(this.locks.values())) {
      totalLocks += platformSet.size;
    }
    
    return {
      totalLocks,
      contentCount: this.locks.size
    };
  }

  /**
   * Полная очистка всех блокировок и остановка фоновых процессов
   */
  shutdown(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    
    this.locks.clear();
    this.lockTimestamps.clear();
    log('🔴 PublicationLockManager: Полная очистка памяти выполнена', 'publication-lock');
  }
}

// Создаем единственный экземпляр менеджера блокировок
export const publicationLockManager = new PublicationLockManager();

// Инициализируем автоматическую очистку с контролем памяти
publicationLockManager['initCleanupSchedule']();

// Graceful shutdown при завершении процесса
process.on('SIGTERM', () => publicationLockManager.shutdown());
process.on('SIGINT', () => publicationLockManager.shutdown());