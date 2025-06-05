import { DirectusCrud } from './directus-crud';
import { log } from '../utils/logger';

export interface PublicationLock {
  id: string;
  content_id: string;
  server_id: string;
  platform: string;
  created_at: string;
  expires_at: string;
  status: 'active' | 'completed' | 'failed';
}

/**
 * Менеджер блокировок для предотвращения дублирования публикаций
 * при работе нескольких серверов с одной базой Directus
 */
export class PublicationLockManager {
  private directusCrud: DirectusCrud;
  private serverId: string;
  private lockDurationMs: number = 5 * 60 * 1000; // 5 минут

  constructor() {
    this.directusCrud = new DirectusCrud();
    // Генерируем уникальный ID сервера на основе окружения и времени запуска
    this.serverId = `server_${process.env.REPL_ID || 'local'}_${Date.now()}`;
    log(`Инициализирован PublicationLockManager с serverId: ${this.serverId}`, 'lock-manager');
  }

  /**
   * Попытка получить блокировку на публикацию контента в указанной платформе
   * @param contentId ID контента
   * @param platform Платформа для публикации
   * @returns true если блокировка получена, false если контент уже заблокирован
   */
  async acquireLock(contentId: string, platform: string): Promise<boolean> {
    try {
      // Проверяем существующие активные блокировки
      const existingLocks = await this.getActiveLocks(contentId, platform);
      
      if (existingLocks.length > 0) {
        log(`Контент ${contentId} уже заблокирован для платформы ${platform} сервером ${existingLocks[0].server_id}`, 'lock-manager');
        return false;
      }

      // Создаем новую блокировку
      const lockId = `lock_${contentId}_${platform}_${Date.now()}`;
      const expiresAt = new Date(Date.now() + this.lockDurationMs);

      const lockData = {
        id: lockId,
        content_id: contentId,
        server_id: this.serverId,
        platform: platform,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'active'
      };

      // Используем административный токен для создания блокировки
      const adminToken = await this.getAdminToken();
      if (!adminToken) {
        log('Не удалось получить административный токен для создания блокировки', 'lock-manager');
        return false;
      }

      await this.directusCrud.create('publication_locks', lockData, { authToken: adminToken });
      
      log(`Создана блокировка ${lockId} для контента ${contentId} на платформе ${platform}`, 'lock-manager');
      return true;
    } catch (error: any) {
      log(`Ошибка при создании блокировки для контента ${contentId}: ${error.message}`, 'lock-manager');
      return false;
    }
  }

  /**
   * Освобождение блокировки после завершения публикации
   * @param contentId ID контента
   * @param platform Платформа
   * @param status Статус завершения ('completed' или 'failed')
   */
  async releaseLock(contentId: string, platform: string, status: 'completed' | 'failed' = 'completed'): Promise<void> {
    try {
      const adminToken = await this.getAdminToken();
      if (!adminToken) {
        log('Не удалось получить административный токен для освобождения блокировки', 'lock-manager');
        return;
      }

      // Находим активную блокировку этого сервера
      const locks = await this.getActiveLocks(contentId, platform);
      const ourLock = locks.find(lock => lock.server_id === this.serverId);

      if (!ourLock) {
        log(`Блокировка для контента ${contentId} на платформе ${platform} не найдена`, 'lock-manager');
        return;
      }

      // Обновляем статус блокировки
      await this.directusCrud.update('publication_locks', ourLock.id, {
        status: status,
        completed_at: new Date().toISOString()
      }, { authToken: adminToken });

      log(`Освобождена блокировка ${ourLock.id} со статусом ${status}`, 'lock-manager');
    } catch (error: any) {
      log(`Ошибка при освобождении блокировки для контента ${contentId}: ${error.message}`, 'lock-manager');
    }
  }

  /**
   * Получение активных блокировок для контента и платформы
   */
  private async getActiveLocks(contentId: string, platform: string): Promise<PublicationLock[]> {
    try {
      const adminToken = await this.getAdminToken();
      if (!adminToken) return [];

      const locks = await this.directusCrud.readMany('publication_locks', {
        filter: {
          content_id: { _eq: contentId },
          platform: { _eq: platform },
          status: { _eq: 'active' },
          expires_at: { _gt: new Date().toISOString() }
        },
        authToken: adminToken
      });

      return locks || [];
    } catch (error: any) {
      log(`Ошибка при получении блокировок для контента ${contentId}: ${error.message}`, 'lock-manager');
      return [];
    }
  }

  /**
   * Очистка просроченных блокировок
   */
  async cleanupExpiredLocks(): Promise<void> {
    try {
      const adminToken = await this.getAdminToken();
      if (!adminToken) return;

      const expiredLocks = await this.directusCrud.readMany('publication_locks', {
        filter: {
          status: { _eq: 'active' },
          expires_at: { _lt: new Date().toISOString() }
        },
        authToken: adminToken
      });

      for (const lock of expiredLocks || []) {
        await this.directusCrud.update('publication_locks', lock.id, {
          status: 'failed',
          completed_at: new Date().toISOString()
        }, { authToken: adminToken });
      }

      if (expiredLocks && expiredLocks.length > 0) {
        log(`Очищено ${expiredLocks.length} просроченных блокировок`, 'lock-manager');
      }
    } catch (error: any) {
      log(`Ошибка при очистке просроченных блокировок: ${error.message}`, 'lock-manager');
    }
  }

  /**
   * Получение административного токена
   */
  private async getAdminToken(): Promise<string | null> {
    try {
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;

      if (!email || !password) {
        log('Отсутствуют учетные данные администратора в переменных окружения', 'lock-manager');
        return null;
      }

      const authResult = await this.directusCrud.login(email, password);
      return authResult.token;
    } catch (error: any) {
      log(`Ошибка при получении административного токена: ${error.message}`, 'lock-manager');
      return null;
    }
  }

  /**
   * Проверка, заблокирован ли контент для публикации
   */
  async isContentLocked(contentId: string, platform: string): Promise<boolean> {
    const locks = await this.getActiveLocks(contentId, platform);
    return locks.length > 0;
  }

  /**
   * Получение информации о сервере, который заблокировал контент
   */
  async getLockInfo(contentId: string, platform: string): Promise<PublicationLock | null> {
    const locks = await this.getActiveLocks(contentId, platform);
    return locks.length > 0 ? locks[0] : null;
  }
}

// Экспортируем единственный экземпляр
export const publicationLockManager = new PublicationLockManager();