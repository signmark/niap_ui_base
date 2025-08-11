/**
 * Сервис для периодической проверки и обновления статусов публикаций
 * Это поможет решить проблему с контентом, который остается в статусе 'scheduled',
 * несмотря на то, что все платформы уже имеют статус 'published'
 */

import axios from 'axios';
import { log, DEBUG_LEVELS } from '../utils/logger';
import { storage } from '../storage';
// Убираем неиспользуемый импорт
import { directusAuthManager } from '../services/directus-auth-manager';

class PublicationStatusChecker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 1 * 60 * 1000; // проверка каждую 1 минуту вместо 5
  
  // Кэш токенов администратора для использования в API запросах
  private adminTokenCache: string | null = null;
  private adminTokenTimestamp: number = 0;
  private tokenExpirationMs = 30 * 60 * 1000; // 30 минут
  
  /**
   * Запускает сервис проверки статусов публикаций
   */
  start() {
    if (this.isRunning) {
      log('Сервис проверки статусов публикаций уже запущен', 'status-checker');
      return;
    }
    
    const minutesInterval = this.checkIntervalMs / (60 * 1000);
    log(`Запуск сервиса проверки статусов публикаций (интервал: ${minutesInterval} минут)`, 'status-checker');
    
    // Запускаем немедленную первую проверку (тихо)
    this.checkPublicationStatuses();
    
    // Запускаем регулярные проверки по интервалу (тихо)
    this.intervalId = setInterval(() => {
      this.checkPublicationStatuses();
    }, this.checkIntervalMs);
    
    this.isRunning = true;
    
    // Выводим лог с информацией о следующей проверке
    log(`Следующая проверка статусов через ${minutesInterval} минуту`, 'status-checker');
  }
  
  /**
   * Останавливает сервис проверки статусов
   */
  stop() {
    if (!this.isRunning || !this.intervalId) {
      return;
    }
    
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    
    log('Сервис проверки статусов публикаций остановлен', 'status-checker');
  }

  /**
   * Полная очистка всех данных и остановка фоновых процессов
   */
  shutdown() {
    this.stop();
    
    // Очищаем кэши
    this.adminTokenCache = null;
    
    log('🔴 PublicationStatusChecker: Полная очистка памяти выполнена', 'status-checker');
  }

  /**
   * Очищает кэшированный токен администратора
   */
  clearTokenCache() {
    this.adminTokenCache = null;
    this.adminTokenTimestamp = 0;
    log('Кэш токенов очищен в status-checker', 'status-checker');
  }
  
  /**
   * Получает токен администратора для API запросов
   * с кэшированием для минимизации авторизаций
   */
  private async getAdminToken(forceRefresh: boolean = false): Promise<string | null> {
    // Проверяем режим вывода логов
    const isVerboseMode = DEBUG_LEVELS.STATUS_CHECKER || DEBUG_LEVELS.GLOBAL;
    
    // Проверяем кэш (если не принудительное обновление) - тихо
    if (!forceRefresh && this.adminTokenCache && (Date.now() - this.adminTokenTimestamp) < this.tokenExpirationMs) {
      return this.adminTokenCache;
    }
    
    // Если принудительное обновление, очищаем кэш
    if (forceRefresh) {
      this.adminTokenCache = null;
      this.adminTokenTimestamp = 0;
      if (isVerboseMode) {
        log('Принудительное обновление токена администратора', 'status-checker');
      }
    }
    
    // Сначала пробуем получить токен из переменной окружения
    const envToken = process.env.DIRECTUS_ADMIN_TOKEN;
    if (envToken) {
      this.adminTokenCache = envToken;
      this.adminTokenTimestamp = Date.now();
      return envToken;
    }
    
    // Пробуем получить токен из активных сессий DirectusAuthManager
    try {
      const activeSessions = directusAuthManager.getAllActiveSessions();
      if (activeSessions && activeSessions.length > 0) {
        const firstSession = activeSessions[0];
        this.adminTokenCache = firstSession.token;
        this.adminTokenTimestamp = Date.now();
        return firstSession.token;
      }
    } catch (error) {
      // Игнорируем ошибки получения активных сессий
    }
    
    // Если нет активных сессий, запрашиваем сессию администратора
    try {
      const adminSession = await directusAuthManager.getAdminSession();
      if (adminSession && adminSession.token) {
        this.adminTokenCache = adminSession.token;
        this.adminTokenTimestamp = Date.now();
        return adminSession.token;
      }
    } catch (error: any) {
      log(`Ошибка при получении сессии администратора: ${error.message}`, 'status-checker');
    }
    
    // Если не удалось получить токен через DirectusAuthManager, 
    // пытаемся выполнить авторизацию напрямую
    try {
      const directusUrl = process.env.DIRECTUS_URL;
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      
      if (!email || !password) {
        if (isVerboseMode) {
          log('Отсутствуют учетные данные администратора для авторизации', 'status-checker');
        }
        return null;
      }
      
      if (isVerboseMode) {
        log('Попытка авторизации администратора с учетными данными из env', 'status-checker');
      }
      
      const authResponse = await axios.post(`${directusUrl}/auth/login`, {
        email,
        password
      });
      
      if (authResponse?.data?.data?.access_token) {
        const token = authResponse.data.data.access_token;
        if (isVerboseMode) {
          log('Получен новый токен администратора', 'status-checker');
        }
        
        // Сохраняем сессию в DirectusAuthManager
        directusAuthManager.addAdminSession({
          id: authResponse.data.data.user.id,
          token: token,
          email: authResponse.data.data.user.email
        });
        
        if (isVerboseMode) {
          log(`Сессия администратора добавлена в DirectusAuthManager (${authResponse.data.data.user.id})`, 'status-checker');
        }
        
        // Кэшируем токен
        this.adminTokenCache = token;
        this.adminTokenTimestamp = Date.now();
        
        return token;
      }
      
      if (isVerboseMode) {
        log('Не удалось получить токен из ответа авторизации', 'status-checker');
      }
      return null;
    } catch (error: any) {
      if (isVerboseMode) {
        log(`Ошибка при авторизации администратора: ${error.message}`, 'status-checker');
      }
      return null;
    }
  }
  
  /**
   * Проверяет статусы публикаций и обновляет общие статусы контента
   * Имеет встроенные меры безопасности:
   * 1. Проверка статусов конкретной платформы (должны быть либо published, либо failed)
   * 2. Проверка, что все выбранные платформы достигли финального статуса
   * 3. Проверка, что хотя бы одна платформа успешно опубликована
   */
  private async checkPublicationStatuses() {
    try {
      // Проверяем режим вывода логов
      const isVerboseMode = DEBUG_LEVELS.STATUS_CHECKER || DEBUG_LEVELS.GLOBAL;
      
      // Убираем избыточные логи - проверка выполняется тихо
      
      // Получаем токен администратора для запросов
      const adminToken = await this.getAdminToken();
      if (!adminToken) {
        // Тихо возвращаемся, если нет токена
        return;
      }
      
      // Получаем контент со статусом 'scheduled' через API
      const directusUrl = process.env.DIRECTUS_URL;
      
      // Для отладки включаем все статусы кроме 'published'
      const includeStatuses = ['scheduled', 'draft'];
      const filters = includeStatuses.map(status => `filter[status][_eq]=${status}`).join('&');
      
      // Бóльшие лимиты для проверки большего количества контента за раз
      let response;
      try {
        response = await axios.get(
          `${directusUrl}/items/campaign_content?${filters}&limit=100`, 
          {
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (error: any) {
        // Если получили 401 ошибку, пробуем обновить токен
        if (error.response?.status === 401) {
          if (isVerboseMode) {
            log('Получена 401 ошибка, обновляем токен администратора', 'status-checker');
          }
          
          const refreshedToken = await this.getAdminToken(true); // Принудительное обновление
          if (refreshedToken) {
            // Повторяем запрос с новым токеном
            try {
              response = await axios.get(
                `${directusUrl}/items/campaign_content?${filters}&limit=100`, 
                {
                  headers: {
                    'Authorization': `Bearer ${refreshedToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              if (isVerboseMode) {
                log('Запрос выполнен успешно с обновленным токеном', 'status-checker');
              }
            } catch (retryError: any) {
              log(`Ошибка после обновления токена: ${retryError.message}`, 'status-checker');
              return;
            }
          } else {
            log('Не удалось обновить токен администратора', 'status-checker');
            return;
          }
        } else {
          log(`Ошибка при получении контента: ${error.message}`, 'status-checker');
          return;
        }
      }
      
      if (!response?.data?.data || !Array.isArray(response.data.data)) {
        if (isVerboseMode) {
          log('API вернул некорректный формат данных', 'status-checker');
        }
        return;
      }
      
      const contentItems = response.data.data;
      
      // Счетчики для логирования
      let processedItems = 0;
      let updatedItems = 0;
      let skippedItems = 0;
      
      // Перебор всех элементов контента для проверки статусов
      for (const item of contentItems) {
        // Критически важная проверка на наличие поля social_platforms
        if (!item.social_platforms) {
          skippedItems++;
          continue;
        }
        
        // Преобразование данных социальных платформ, если они хранятся в виде строки
        let platformsData = item.social_platforms;
        if (typeof platformsData === 'string') {
          try {
            platformsData = JSON.parse(platformsData);
          } catch (error) {
            skippedItems++;
            continue;
          }
        }
        
        // Если данные платформ не являются объектом, пропускаем
        if (!platformsData || typeof platformsData !== 'object') {
          skippedItems++;
          continue;
        }
        
        // Получаем списки платформ по статусам
        const selectedPlatforms = Object.entries(platformsData)
          .filter(([_, platformData]: [string, any]) => platformData?.selected)
          .map(([platform]) => platform);
          
        const publishedPlatforms = Object.entries(platformsData)
          .filter(([_, platformData]: [string, any]) => platformData?.selected && platformData?.status === 'published')
          .map(([platform]) => platform);
          
        const failedPlatforms = Object.entries(platformsData)
          .filter(([_, platformData]: [string, any]) => platformData?.selected && (platformData?.status === 'failed' || platformData?.error))
          .map(([platform]) => platform);
          
        const pendingPlatforms = Object.entries(platformsData)
          .filter(([_, platformData]: [string, any]) => {
            return platformData?.selected && 
                   platformData?.status !== 'published' && 
                   platformData?.status !== 'failed' && 
                   !platformData?.error;
          })
          .map(([platform]) => platform);
        
        // Всегда логируем состояние платформ, особенно для проблемных контентов
        log(`Контент ${item.id}: "${item.title}" - статусы платформ:`, 'status-checker');
        log(`  - Выбрано: ${selectedPlatforms.length} платформ: ${selectedPlatforms.join(', ')}`, 'status-checker');
        log(`  - Опубликовано: ${publishedPlatforms.length} платформ: ${publishedPlatforms.join(', ')}`, 'status-checker');
        log(`  - В ожидании: ${pendingPlatforms.length} платформ: ${pendingPlatforms.join(', ')}`, 'status-checker');
        log(`  - С ошибками: ${failedPlatforms.length} платформ: ${failedPlatforms.join(', ')}`, 'status-checker');
        
        // Убираем хардкод проверки конкретного контента
        
        // Проверка условий для обновления статуса
        const allPublished = selectedPlatforms.length > 0 && 
                            selectedPlatforms.length === publishedPlatforms.length;
                            
        const allFinalized = pendingPlatforms.length === 0 && 
                            selectedPlatforms.length > 0;
        
        // Определяем необходимость обновления статуса
        let shouldUpdateStatus = false;
        let newStatus = item.status;
        
        // Убираем хардкод отладки конкретного контента
        
        if (allPublished) {
          // Если все платформы опубликованы, ставим статус 'published'
          shouldUpdateStatus = true;
          newStatus = 'published';
        } else if (allFinalized && publishedPlatforms.length > 0) {
          // Если все платформы завершили публикацию (успешно или с ошибкой) и есть хотя бы одна успешная,
          // также ставим статус 'published'
          shouldUpdateStatus = true;
          newStatus = 'published';
        }
        
        // Обновляем статус, если необходимо
        if (shouldUpdateStatus && newStatus !== item.status) {
          try {
            // Обновляем статус через storage для более высокой надежности
            const updated = await storage.updateCampaignContent(
              item.id,
              { status: newStatus },
              adminToken
            );
            
            if (updated) {
              log(`Обновлен статус контента ID ${item.id} на ${newStatus}`, 'status-checker');
              updatedItems++;
            }
          } catch (updateError: any) {
            log(`Ошибка при обновлении контента ${item.id}`, 'status-checker');
          }
        }
        
        processedItems++;
      }
      
      // После обновления статусов "draft" и "scheduled", проверяем опубликованный контент,
      // чтобы выявить случаи, когда контент помечен как опубликованный, но не все платформы опубликованы
      await this.checkPublishedContentWithPendingPlatforms(adminToken);
      
      // Только если были обновления, выводим статистику
      if (updatedItems > 0) {
        log(`Обновлено ${updatedItems} контент(ов)`, 'status-checker');
      }
    } catch (error: any) {
      log(`Ошибка при проверке статусов публикаций: ${error.message}`, 'status-checker');
    }
  }
  
  /**
   * Проверяет контент в статусе 'published' на наличие платформ в ожидании публикации
   * Если такие есть, возвращает статус контента в 'scheduled'
   */
  private async checkPublishedContentWithPendingPlatforms(adminToken: string) {
    try {
      // Проверяем режим вывода логов
      const isVerboseMode = DEBUG_LEVELS.STATUS_CHECKER || DEBUG_LEVELS.GLOBAL;
      
      if (isVerboseMode) {
        log('Поиск контента со статусом \'published\', у которого есть платформы в статусе \'pending\'', 'status-checker');
      }
      
      // Получаем контент со статусом 'published'
      const directusUrl = process.env.DIRECTUS_URL;
      
      const response = await axios.get(
        `${directusUrl}/items/campaign_content?filter[status][_eq]=published&limit=100`, 
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response?.data?.data || !Array.isArray(response.data.data)) {
        if (isVerboseMode) {
          log('API вернул некорректный формат данных для published контента', 'status-checker');
        }
        return;
      }
      
      const publishedContent = response.data.data;
      
      let revertedItems = 0;
      
      // Проверяем каждый опубликованный контент
      for (const item of publishedContent) {
        // Проверяем наличие поля social_platforms
        if (!item.social_platforms) {
          continue;
        }
        
        // Преобразование данных социальных платформ, если они хранятся в виде строки
        let platformsData = item.social_platforms;
        if (typeof platformsData === 'string') {
          try {
            platformsData = JSON.parse(platformsData);
          } catch (error) {
            continue;
          }
        }
        
        // Если данные платформ не являются объектом, пропускаем
        if (!platformsData || typeof platformsData !== 'object') {
          continue;
        }
        
        // Проверяем, есть ли платформы в статусе pending или scheduled
        const pendingPlatforms = Object.entries(platformsData)
          .filter(([_, platformData]: [string, any]) => {
            return platformData?.selected && 
                  ['pending', 'scheduled'].includes(platformData?.status);
          })
          .map(([platform]) => platform);
          
        // Если есть ожидающие платформы, а контент в статусе published, исправляем статус
        if (pendingPlatforms.length > 0) {
          // Логируем детальную информацию
          if (isVerboseMode) {
            log(`Найден контент ${item.id}: "${item.title}" в статусе 'published', но с платформами в ожидании: ${pendingPlatforms.join(', ')}`, 'status-checker');
          }
          
          try {
            // Возвращаем статус в scheduled
            const updated = await storage.updateCampaignContent(
              item.id,
              { status: 'scheduled' },
              adminToken
            );
            
            if (updated) {
              log(`Возвращен статус контента ID ${item.id} из published в scheduled - найдены платформы в ожидании`, 'status-checker');
              revertedItems++;
            }
          } catch (updateError: any) {
            log(`Ошибка при обновлении статуса контента ${item.id}: ${updateError}`, 'status-checker');
          }
        }
      }
      
      if (revertedItems > 0) {
        log(`Возвращено в статус 'scheduled': ${revertedItems} контент(ов)`, 'status-checker');
      } else if (isVerboseMode) {
        log('Не найдено контента, требующего обновления статуса', 'status-checker');
      }
    } catch (error: any) {
      log(`Ошибка при проверке опубликованного контента: ${error.message}`, 'status-checker');
    }
  }
  
  // Удалены функции с хардкодом конкретного контента
  
  // Функция runContentCheck удалена - больше не используется
}

// Экспортируем экземпляр класса для использования в других модулях
export const publicationStatusChecker = new PublicationStatusChecker();
