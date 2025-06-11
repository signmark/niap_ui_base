import axios from 'axios';
import { log } from '../utils/logger';
import { storage } from '../storage';
// Не используем старый сервис, заменив его на новый модульный
import { socialPublishingService } from './social/index';
import { directusStorageAdapter } from './directus';
import { directusApiManager } from '../directus';
import { directusCrud } from './directus-crud';
import { checkTokenExtractionRequest } from './token-extractor';
import fs from 'fs';
import path from 'path';
import { publicationLockManager } from './publication-lock-manager';

/**
 * Класс для планирования и выполнения автоматической публикации контента
 */
export class PublishScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 20000; // проверяем каждые 20 секунд (изменено согласно новым требованиям)
  // Для обратной совместимости со старым кодом (временное решение)
  private processedContentIds = new Set<string>();
  // Глобальный флаг для полного отключения публикаций (критическая мера безопасности)
  // Публикации активированы
  public disablePublishing = false;
  
  // КРИТИЧЕСКИ ВАЖНО: Защита от параллельного выполнения планировщика
  private isProcessing = false;
  private processingStartTime: number = 0;
  
  // Флаг для вывода информационных сообщений и детального логирования
  // Управляется переменной окружения DEBUG_SCHEDULER
  private verboseLogging = false;
  
  // Кэш токенов, чтобы не выполнять повторные авторизации
  private adminTokenCache: string | null = null;
  private adminTokenTimestamp: number = 0;
  private tokenExpirationMs = 30 * 60 * 1000; // 30 минут для токена
  
  // Кэш для настроек кампаний
  private campaignSettingsCache = new Map<string, any>();
  private campaignCacheTimestamp = new Map<string, number>();
  private campaignCacheExpirationMs = 15 * 60 * 1000; // 15 минут для кэша кампаний
  
  // Кэш страниц Facebook и токенов
  private facebookPagesCache: any = null;
  private facebookPagesCacheTimestamp: number = 0;
  private facebookCacheExpirationMs = 30 * 60 * 1000; // 30 минут для кэша Facebook

  /**
   * Запускает планировщик публикаций
   */
  start() {
    if (this.isRunning) {
      log('Планировщик публикаций уже запущен', 'scheduler');
      return;
    }

    // КРИТИЧЕСКАЯ ЗАЩИТА: Файловая блокировка от множественных экземпляров
    const lockFilePath = path.join(process.cwd(), '.scheduler-lock');
    
    try {
      // Проверяем наличие файла блокировки
      if (fs.existsSync(lockFilePath)) {
        const lockData = fs.readFileSync(lockFilePath, 'utf8');
        const lockInfo = JSON.parse(lockData);
        const timeDiff = Date.now() - lockInfo.timestamp;
        
        // Если блокировка свежая (менее 2 минут), не запускаем
        if (timeDiff < 120000) {
          log('🚫 ФАЙЛОВАЯ БЛОКИРОВКА: Обнаружен активный планировщик (файл блокировки)', 'scheduler');
          return;
        }
        
        // Если блокировка старая, удаляем её (возможно, процесс завершился аварийно)
        fs.unlinkSync(lockFilePath);
        log('Удален устаревший файл блокировки планировщика', 'scheduler');
      }
      
      // Создаем файл блокировки
      const lockInfo = {
        pid: process.pid,
        timestamp: Date.now(),
        startTime: new Date().toISOString()
      };
      fs.writeFileSync(lockFilePath, JSON.stringify(lockInfo, null, 2));
      log('Создан файл блокировки планировщика', 'scheduler');
      
    } catch (error: any) {
      log(`Ошибка при работе с файлом блокировки: ${error.message}`, 'scheduler');
      return;
    }
    
    // Дополнительные проверки для надежности
    if ((global as any).publishSchedulerActive) {
      log('🚫 ГЛОБАЛЬНАЯ БЛОКИРОВКА: Обнаружен активный планировщик', 'scheduler');
      return;
    }
    
    if ((process as any).schedulerRunning) {
      log('🚫 ПРОЦЕССНАЯ БЛОКИРОВКА: Обнаружен активный планировщик', 'scheduler');
      return;
    }
    
    // Устанавливаем флаги
    (global as any).publishSchedulerActive = true;
    (process as any).schedulerRunning = true;

    // Инициализация планировщика после исправления критических ошибок
    log('Запуск планировщика публикаций с исправлениями', 'scheduler');
    this.isRunning = true;
    
    // Сразу выполняем первую проверку
    this.checkScheduledContent();
    
    // Устанавливаем интервал для регулярной проверки
    this.intervalId = setInterval(() => {
      this.checkScheduledContent();
    }, this.checkIntervalMs);
    
    log(`Планировщик запущен с интервалом ${this.checkIntervalMs}мс`, 'scheduler');
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
    
    // КРИТИЧЕСКАЯ ЗАЩИТА: Очищаем глобальный флаг при остановке
    (global as any).publishSchedulerActive = false;
  }
  
  /**
   * Метод обратной совместимости, теперь сохраняется напрямую в БД
   * @deprecated Используйте прямое обновление статуса в БД вместо кэша
   */
  clearProcessedContentIds() {
    log(`Метод clearProcessedContentIds() вызван, но кэш теперь не используется. Статус обновляется в БД.`, 'scheduler');
  }
  
  /**
   * Метод обратной совместимости, теперь сохраняется напрямую в БД
   * @deprecated Используйте прямое обновление статуса в БД вместо кэша
   * @param contentId ID контента 
   */
  addProcessedContentId(contentId: string) {
    log(`Метод addProcessedContentId() вызван для ID ${contentId}, но кэш теперь не используется. Обновите статус в БД.`, 'scheduler');
  }

  /**
   * Получает токен для доступа к API
   * Приоритеты получения токена:
   * 1. Авторизация через логин/пароль (admin)
   * 2. Активные сессии пользователей из кэша
   * 3. Статический токен из переменных окружения
   * 4. Сохраненный токен из хранилища
   * 
   * Добавлена проверка действительности токена из кэша перед использованием
   * @returns Токен для авторизации запросов к API
   */
  public async getSystemToken(): Promise<string | null> {
    try {
      // Сначала проверяем кэш внутри планировщика
      const now = Date.now();
      if (this.adminTokenCache && (now - this.adminTokenTimestamp < this.tokenExpirationMs)) {
        // У нас есть кэшированный токен, который не истек по времени
        log('Используем кэшированный токен администратора из планировщика', 'scheduler');
        
        // Проверяем валидность токена, даже если он не истек по времени
        try {
          const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
          const testResponse = await axios.get(`${directusUrl}/users/me`, {
            headers: {
              'Authorization': `Bearer ${this.adminTokenCache}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (testResponse?.data?.data) {
            log('Кэшированный токен проверен и валиден', 'scheduler');
            return this.adminTokenCache;
          }
          
          log('Кэшированный токен недействителен, получаем новый', 'scheduler');
          // Токен недействителен, очищаем кэш
          this.adminTokenCache = null;
        } catch (error: any) {
          log(`Ошибка при проверке кэшированного токена: ${error.message}`, 'scheduler');
          if (error.response?.status === 401) {
            log('Токен истек, получаем новый', 'scheduler');
            // Токен истек, очищаем кэш
            this.adminTokenCache = null;
          }
        }
      }
      
      // Загружаем менеджер авторизации
      const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
      const directusCrud = await import('./directus-crud').then(m => m.directusCrud);
      const adminUserId = process.env.DIRECTUS_ADMIN_USER_ID || '53921f16-f51d-4591-80b9-8caa4fde4d13';
      
      // 1. Приоритет - авторизация через логин/пароль (если есть учетные данные)
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      
      if (email && password) {
        log('Попытка авторизации администратора с учетными данными из env', 'scheduler');
        
        try {
          // Прямая авторизация через REST API
          const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
          const response = await axios.post(`${directusUrl}/auth/login`, {
            email,
            password
          });
          
          if (response?.data?.data?.access_token) {
            const token = response.data.data.access_token;
            log('Авторизация администратора успешна через прямой API запрос', 'scheduler');
            
            // Сохраняем токен в кэше планировщика
            this.adminTokenCache = token;
            this.adminTokenTimestamp = now;
            
            // Сохраняем токен в кэше API менеджера
            directusApiManager.cacheAuthToken(adminUserId, token, 3600); // 1 час
            
            // Пробуем сохранить в DirectusAuthManager
            try {
              directusAuthManager.login(email, password)
                .then(() => log('Сессия администратора добавлена в DirectusAuthManager', 'scheduler'))
                .catch(e => log(`Не удалось добавить сессию в DirectusAuthManager: ${e.message}`, 'scheduler'));
            } catch (e: any) {
              log(`Ошибка при сохранении сессии: ${e.message}`, 'scheduler');
            }
            
            return token;
          }
        } catch (error: any) {
          log(`Ошибка при прямой авторизации администратора: ${error.message}`, 'scheduler');
          if (error.response?.data?.errors) {
            log(`Детали ошибки: ${JSON.stringify(error.response.data.errors)}`, 'scheduler');
          }
        }
        
        try {
          // Запасной вариант - используем метод для авторизации через DirectusAuthManager
          const authInfo = await directusAuthManager.login(email, password);
          
          if (authInfo && authInfo.token) {
            log('Авторизация администратора успешна через directusAuthManager', 'scheduler');
            
            // Сохраняем токен в кэше планировщика
            this.adminTokenCache = authInfo.token;
            this.adminTokenTimestamp = now;
            
            return authInfo.token;
          }
          
          // Если не получилось через directusAuthManager, пробуем через directusCrud
          const authResult = await directusCrud.login(email, password);
          
          if (authResult?.access_token) {
            log('Авторизация администратора успешна через directusCrud', 'scheduler');
            
            // Сохраняем токен в кэше планировщика
            this.adminTokenCache = authResult.access_token;
            this.adminTokenTimestamp = now;
            
            return authResult.access_token;
          }
        } catch (error: any) {
          log(`Ошибка при авторизации через вспомогательные сервисы: ${error.message}`, 'scheduler');
        }
      }
      
      // 2. Проверяем, есть ли активные сессии пользователей
      const sessions = directusAuthManager.getAllActiveSessions();
      
      if (sessions.length > 0) {
        // Используем токен первого активного пользователя
        const firstSession = sessions[0];
        log(`Использование токена пользователя ${firstSession.userId} из активной сессии`, 'scheduler');
        
        // Проверяем валидность токена
        try {
          const testResponse = await directusApiManager.request({
            url: '/users/me',
            method: 'get'
          }, firstSession.token);
          
          if (testResponse?.data?.data) {
            log(`Токен активной сессии пользователя ${firstSession.userId} валиден`, 'scheduler');
            
            // Сохраняем токен в кэше планировщика
            this.adminTokenCache = firstSession.token;
            this.adminTokenTimestamp = now;
            
            return firstSession.token;
          }
        } catch (error: any) {
          log(`Токен активной сессии недействителен: ${error.message}`, 'scheduler');
        }
      }
      
      // 3. Если не получилось через сессии, проверяем статический токен
      const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
      if (adminToken) {
        log('Проверка статического токена администратора из переменных окружения', 'scheduler');
        
        // Проверяем валидность токена
        try {
          const testResponse = await directusApiManager.request({
            url: '/users/me',
            method: 'get'
          }, adminToken);
          
          if (testResponse?.data?.data) {
            log('Статический токен администратора валиден', 'scheduler');
            
            // Сохраняем токен в кэше планировщика
            this.adminTokenCache = adminToken;
            this.adminTokenTimestamp = now;
            
            return adminToken;
          }
        } catch (error: any) {
          log(`Статический токен недействителен: ${error.message}`, 'scheduler');
        }
      }
      
      // 4. Пробуем получить токен из кэша DirectusApiManager
      const cachedToken = directusApiManager.getCachedToken(adminUserId);
      if (cachedToken) {
        log(`Найден кэшированный токен для администратора ${adminUserId} в API менеджере`, 'scheduler');
        
        // Проверяем валидность токена
        try {
          const testResponse = await directusApiManager.request({
            url: '/users/me',
            method: 'get'
          }, cachedToken.token);
          
          if (testResponse?.data?.data) {
            log('Кэшированный токен администратора валиден', 'scheduler');
            
            // Сохраняем токен в кэше планировщика
            this.adminTokenCache = cachedToken.token;
            this.adminTokenTimestamp = now;
            
            return cachedToken.token;
          }
        } catch (error: any) {
          log(`Кэшированный токен недействителен: ${error.message}`, 'scheduler');
        }
      }
      
      // 5. В последнюю очередь, ищем токен в хранилище
      try {
        const tokenInfo = await storage.getUserTokenInfo(adminUserId);
        if (tokenInfo && tokenInfo.token) {
          log(`Найден токен для администратора ${adminUserId} в хранилище`, 'scheduler');
          
          // Проверяем валидность токена
          try {
            const testResponse = await directusApiManager.request({
              url: '/users/me',
              method: 'get'
            }, tokenInfo.token);
            
            if (testResponse?.data?.data) {
              log('Токен из хранилища валиден', 'scheduler');
              
              // Сохраняем токен в кэше планировщика
              this.adminTokenCache = tokenInfo.token;
              this.adminTokenTimestamp = now;
              
              return tokenInfo.token;
            }
          } catch (error: any) {
            log(`Токен из хранилища недействителен: ${error.message}`, 'scheduler');
          }
        }
      } catch (error: any) {
        log(`Ошибка при получении данных из хранилища: ${error.message}`, 'scheduler');
      }
      
      log('Не удалось получить действительный токен для планировщика', 'scheduler');
      return null;
    } catch (error: any) {
      log(`Ошибка при получении системного токена: ${error.message}`, 'scheduler');
      return null;
    }
  }

  /**
   * Проверяет статусы всех платформ для контента и обновляет статус по алгоритму:
   * 1. Если ВСЕ платформы в JSON имеют статус 'published', обновляет статус на 'published'
   * 2. Если есть хотя бы одна платформа с ошибкой и нет ожидающих платформ, устанавливает статус 'failed'
   * Обновлено в соответствии с новыми требованиями по проверке ВСЕХ платформ
   */
  async checkAndUpdateContentStatuses() {
    try {
      // Тихая проверка статусов
      
      // Получаем системный токен для доступа к API
      const authToken = await this.getSystemToken();
      if (!authToken) {
        log('Не удалось получить токен для проверки статусов контента', 'scheduler');
        return;
      }
      
      // Получаем все контенты со статусом "scheduled" или "draft"
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
      const headers = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      };

      // Получаем ВЕСЬ контент с платформами независимо от его статуса
      // Это позволит обнаружить любые проблемные комбинации платформ
      const response = await axios.get(`${directusUrl}/items/campaign_content`, {
        headers,
        params: {
          filter: JSON.stringify({
            social_platforms: {
              _nnull: true
            }
          }),
          limit: 50 // Ограничиваем количество проверяемых записей для производительности
        }
      });

      if (!response?.data?.data || !Array.isArray(response.data.data)) {
        log('Не удалось получить данные контента', 'scheduler');
        return;
      }

      // Обрабатываем полученные записи
      const contentItems = response.data.data;
      // Тихая работа планировщика

      let updatedCount = 0;

      // Проверяем каждый элемент контента
      for (const item of contentItems) {
        try {
          // Пропускаем контент без настроек платформ
          if (!item.social_platforms) {
            continue;
          }

          // Преобразуем social_platforms в объект, если это строка
          let platforms = item.social_platforms;
          if (typeof platforms === 'string') {
            try {
              platforms = JSON.parse(platforms);
            } catch (e) {
              log(`Ошибка при парсинге social_platforms для контента ${item.id}: ${e}`, 'scheduler');
              continue;
            }
          }
          
          // Если нет платформ или объект пуст, пропускаем
          if (!platforms || Object.keys(platforms).length === 0) {
            continue;
          }
          
          // Классифицируем платформы по статусам
          const allPlatforms = Object.keys(platforms);
          const publishedPlatforms = [];
          const pendingPlatforms = [];
          const scheduledPlatforms = [];
          const errorPlatforms = [];

          // Проходим по всем платформам и распределяем по статусам
          // Удалено избыточное логирование
          
          // Счетчики для проверки проблемы с 2 платформами
          let totalPlatformsWithData = 0;
          let platformsWithoutSelected = 0;
          
          // Дополнительные счетчики для специальной проверки TG+IG
          let hasTelegram = false;
          let hasInstagram = false;
          let telegramPublished = false;
          let instagramPublished = false;
          
          for (const platform of allPlatforms) {
            const data = platforms[platform] || {};
            const status = data.status;
            const isSelected = data.selected === true || data.selected === undefined || data.selected === null;
            
            // Подсчитываем платформы для анализа
            if (status) {
              totalPlatformsWithData++;
            }
            
            if (data.selected === undefined) {
              platformsWithoutSelected++;
            }
            
            // Отслеживаем наличие и статусы Telegram и Instagram
            if (platform === 'telegram') {
              hasTelegram = true;
              telegramPublished = (status === 'published');
            } else if (platform === 'instagram') {
              hasInstagram = true;
              instagramPublished = (status === 'published');
            }
            
            if (this.verboseLogging) {
              log(`DEBUG: Платформа ${platform}, статус: ${status}, selected: ${isSelected ? 'ДА/НЕ УСТАНОВЛЕНО' : 'НЕТ'}`, 'scheduler');
            }
            
            // Всегда учитываем платформу в независимости от selected
            switch(status) {
              case 'published':
                publishedPlatforms.push(platform);
                break;
              case 'pending':
                pendingPlatforms.push(platform);
                break;
              case 'scheduled':
                scheduledPlatforms.push(platform);
                break;
              case 'error':
              case 'failed':
                errorPlatforms.push(platform);
                break;
              default:
                // Неизвестный статус считаем как pending
                pendingPlatforms.push(platform);
                break;
            }
          }
          
          if (this.verboseLogging) {
            log(`DEBUG: Статистика платформ - Всего: ${allPlatforms.length}, С данными: ${totalPlatformsWithData}, Без selected: ${platformsWithoutSelected}`, 'scheduler');
          }

          // Логируем результаты анализа только в режиме отладки
          if (this.verboseLogging) {
            log(`Контент ${item.id} (${item.title || 'Без названия'}) - статус: ${item.status}`, 'scheduler');
            log(`  - Всего платформ: ${allPlatforms.length}`, 'scheduler');
            log(`  - Опубликовано: ${publishedPlatforms.length}`, 'scheduler');
            log(`  - В ожидании: ${pendingPlatforms.length}`, 'scheduler');
            log(`  - Запланировано: ${scheduledPlatforms.length}`, 'scheduler');
            log(`  - С ошибками: ${errorPlatforms.length}`, 'scheduler');
          }

          // Выполняем проверку по правилам из документа
          // ВАЖНО: ВЫБРАННЫЕ платформы = ВСЕ платформы из JSON
          // Если платформа присутствует в JSON, значит она выбрана для публикации
          
          // Получаем все платформы из JSON (это и есть выбранные)
          const selectedPlatforms = Object.keys(item.social_platforms || {});
          const selectedPublishedPlatforms = [];
          const selectedErrorPlatforms = [];
          const selectedPendingPlatforms = [];
          let needsStatusCorrection = false;
          
          for (const [platform, data] of Object.entries(item.social_platforms || {})) {
            // Платформа считается опубликованной только если есть статус 'published' И есть postUrl
            if (data?.status === 'published' && data?.postUrl) {
              selectedPublishedPlatforms.push(platform);
            } else if (data?.status === 'failed' || data?.status === 'error') {
              selectedErrorPlatforms.push(platform);
            } else if (data?.status === 'pending' || data?.status === 'scheduled' || !data?.status || 
                       (data?.status === 'published' && !data?.postUrl)) {
              // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: НЕ СБРАСЫВАЕМ НА PENDING - это создает бесконечный цикл
              if (data?.status === 'published' && !data?.postUrl) {
                console.log(`[scheduled] ИСПРАВЛЕНИЕ: платформа ${platform} имела статус 'published' без postUrl - помечено как failed`);
                // Помечаем как failed вместо pending, чтобы избежать повторной публикации
                if (item.social_platforms && item.social_platforms[platform]) {
                  item.social_platforms[platform].status = 'failed';
                  item.social_platforms[platform].error = 'Published without postUrl - preventing republication loop';
                  needsStatusCorrection = true;
                }
              }
              selectedPendingPlatforms.push(platform);
            }
          }
          
          // 1. Если ВСЕ платформы из JSON имеют статус 'published'
          const allSelectedPublished = selectedPlatforms.length > 0 && selectedPlatforms.length === selectedPublishedPlatforms.length;
          
          // Убрано избыточное логирование - система работает тихо
          
          const hasSelectedErrors = selectedErrorPlatforms.length > 0;
          const hasSelectedPending = selectedPendingPlatforms.length > 0;
          const onlySelectedErrorsRemain = hasSelectedErrors && !hasSelectedPending;
          
          // Дополнительная проверка для случая с TG+IG
          const isTelegramInstagramCombo = hasTelegram && hasInstagram && selectedPlatforms.length === 2 && 
                                      telegramPublished && instagramPublished && item.status === 'scheduled';
          
          if (isTelegramInstagramCombo) {
            log(`ОБНАРУЖЕНА ПРОБЛЕМНАЯ КОМБИНАЦИЯ TG+IG: ${item.id}`, 'scheduler');
            log(`Обе платформы опубликованы, но статус 'scheduled': telegram(${telegramPublished}), instagram(${instagramPublished})`, 'scheduler');
          }
          
          // Обновляем статус
          if (allSelectedPublished || isTelegramInstagramCombo) {
            // ТАК КАК ВСЕ ВЫБРАННЫЕ платформы были опубликованы, устанавливаем статус "published"
            if (item.status !== 'published') {
              if (isTelegramInstagramCombo) {
                log(`Обновление статуса контента ${item.id} на 'published' (СПЕЦИАЛЬНЫЙ СЛУЧАЙ TG+IG)`, 'scheduler');
              } else {
                log(`Обновление статуса контента ${item.id} на 'published' (ВСЕ ВЫБРАННЫЕ платформы опубликованы: ${selectedPublishedPlatforms.join(', ')})`, 'scheduler');
              }
              
              try {
                // Добавляем дату публикации, если она еще не установлена
                const updateData: any = { status: 'published' };
                if (!item.published_at) {
                  updateData.published_at = new Date().toISOString();
                }
                
                await axios.patch(
                  `${directusUrl}/items/campaign_content/${item.id}`,
                  updateData,
                  { headers }
                );
                updatedCount++;
              } catch (error) {
                log(`Ошибка при обновлении статуса: ${error}`, 'scheduler');
              }
            } else if (this.verboseLogging) {
              log(`Контент ${item.id} уже имеет статус 'published'`, 'scheduler');
            }
          }
          // Если есть только ошибки и нет пендингов, можем установить статус 'failed'
          else if (onlySelectedErrorsRemain && item.status === 'scheduled') {
            log(`Обновление статуса контента ${item.id} на 'failed' (содержит только платформы с ошибками)`, 'scheduler');
            
            try {
              await axios.patch(
                `${directusUrl}/items/campaign_content/${item.id}`,
                { status: 'failed' },
                { headers }
              );
              updatedCount++;
            } catch (error) {
              log(`Ошибка при обновлении статуса: ${error}`, 'scheduler');
            }
          }
          // Если были исправлены некорректные статусы платформ, сохраняем изменения
          if (needsStatusCorrection) {
            log(`Сохранение исправленных статусов платформ для контента ${item.id}`, 'scheduler');
            try {
              await axios.patch(
                `${directusUrl}/items/campaign_content/${item.id}`,
                { social_platforms: item.social_platforms },
                { headers }
              );
              log(`Статусы платформ успешно исправлены для контента ${item.id}`, 'scheduler');
            } catch (error) {
              log(`Ошибка при сохранении исправленных статусов: ${error}`, 'scheduler');
            }
          }

          // Если есть ожидающие платформы
          if (hasSelectedPending) {
            // Если контент был "published", но появились платформы в ожидании, переводим обратно в "scheduled"
            if (item.status === 'published') {
              log(`Обновление статуса контента ${item.id} с 'published' на 'scheduled' (появились платформы в ожидании: ${selectedPendingPlatforms.join(', ')})`, 'scheduler');
              
              try {
                await axios.patch(
                  `${directusUrl}/items/campaign_content/${item.id}`,
                  { status: 'scheduled' },
                  { headers }
                );
                updatedCount++;
              } catch (error) {
                log(`Ошибка при обновлении статуса на 'scheduled': ${error}`, 'scheduler');
              }
            } else {
              log(`Контент ${item.id} имеет платформы в ожидании - статус остается '${item.status}'`, 'scheduler');
            }
          }
          // Смешанный случай: есть опубликованные и ошибки, но нет пендингов
          else if (selectedPublishedPlatforms.length > 0 && selectedErrorPlatforms.length > 0 && !hasSelectedPending) {
            log(`Контент ${item.id} частично опубликован, имеет и успешные публикации, и ошибки`, 'scheduler');
            if (item.status === 'scheduled') {
              try {
                // Устанавливаем статус 'partially_published'
                await axios.patch(
                  `${directusUrl}/items/campaign_content/${item.id}`,
                  { status: 'partially_published' },
                  { headers }
                );
                updatedCount++;
                log(`Обновлен статус контента ${item.id} на 'partially_published'`, 'scheduler');
              } catch (error) {
                log(`Ошибка при обновлении статуса: ${error}`, 'scheduler');
              }
            }
          }
        } catch (error) {
          log(`Ошибка при обработке контента ${item.id}: ${error}`, 'scheduler');
        }
      }

      // Логируем только при фактических изменениях
      if (updatedCount > 0) {
        log(`Обновлено статусов контента: ${updatedCount}`, 'scheduler');
      }
      
    } catch (error) {
      log(`Ошибка при проверке статусов контента: ${error}`, 'scheduler');
    }
  }

  /**
   * Проверяет и публикует запланированный контент 
   * Ищет контент со статусом 'scheduled' и немедленно публикует платформы в статусе 'pending'
   * Имплементирует новый алгоритм согласно инструкции
   */
  async checkScheduledContent() {
    try {
      // КРИТИЧЕСКИ ВАЖНО: Проверяем блокировку для предотвращения двойной публикации
      if (this.isProcessing) {
        const processingDuration = Date.now() - this.processingStartTime;
        if (processingDuration < 60000) {
          // Планировщик уже выполняется, тихо пропускаем итерацию
          return;
        } else {
          // Принудительный сброс блокировки при зависании
          this.isProcessing = false;
        }
      }
      
      // Устанавливаем блокировку
      this.isProcessing = true;
      this.processingStartTime = Date.now();
      
      // Тихая проверка запланированных публикаций
      
      // Проверяем, не отключены ли публикации глобально
      if (this.disablePublishing) {
        // Публикации отключены глобально
        return;
      }
      
      // Сбрасываем кэшированный токен для принудительного обновления
      // Принудительное обновление токена администратора
      this.adminTokenCache = null; // Очищаем кэш токена, чтобы получить новый

      // Добавляем проверку и обновление статусов контента со всеми опубликованными платформами
      // Функция выполняется в фоновом режиме, чтобы не блокировать публикацию нового контента
      // Тихая проверка статусов контента
      this.checkAndUpdateContentStatuses().catch(() => {
        // Тихо обрабатываем ошибки
      });
      
      // Проверяем запросы на извлечение токена
      checkTokenExtractionRequest();
      
      // Получаем системный токен для доступа ко всем публикациям
      const authToken = await this.getSystemToken();
      
      if (!authToken) {
        // Системный токен не получен, тихо завершаем работу
        return;
      }
      
      // Пытаемся получить запланированные публикации
      let scheduledContent: CampaignContent[] = [];
      
      try {
        // Прямой запрос с параметрами фильтрации
        const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
        log(`Прямой запрос axios к ${directusUrl}/items/campaign_content с фильтром по статусу scheduled`, 'scheduler');
        
        const headers = {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        };
        
        // Запрос с фильтром ТОЛЬКО по статусу "scheduled"
        // Получаем запланированные публикации со статусом 'scheduled'
        const scheduledResponse = await axios.get(`${directusUrl}/items/campaign_content`, {
          headers,
          params: {
            filter: JSON.stringify({
              status: {
                _eq: 'scheduled'
              },
              scheduled_at: {
                _nnull: true
              }
            })
          }
        });

        // Получаем также публикации со статусом 'draft' или 'scheduled', чтобы проверить пендинги в платформах
        // Это контент, для которого уже нажали 'Опубликовать сейчас', но еще не опубликовали во всех платформах
        const pendingResponse = await axios.get(`${directusUrl}/items/campaign_content`, {
          headers,
          params: {
            filter: JSON.stringify({
              _or: [
                { status: { _eq: 'draft' } },
                { status: { _eq: 'scheduled' } }
              ]
            }),
            limit: -1 // Получаем все записи без ограничений
          }
        });
        
        // Специальный запрос для фикса проблемы с TG+IG
        // Ищем контент со статусом 'scheduled', но у которого есть платформы
        // Дополнительный запрос для контента с published платформами
        const allPlatformsResponse = await axios.get(`${directusUrl}/items/campaign_content`, {
          headers,
          params: {
            filter: JSON.stringify({
              status: {
                _eq: 'scheduled'
              },
              social_platforms: {
                _nnull: true
              }
            }),
            limit: 100 // Получаем больше записей для лучшего охвата
          }
        });

        // Объединяем результаты
        let allItems = [];
        
        if (scheduledResponse?.data?.data) {
          allItems = allItems.concat(scheduledResponse.data.data);
        }
        
        if (pendingResponse?.data?.data) {
          // Быстрая однопроходная фильтрация - сразу ищем контент с пендингами
          const pendingItems = pendingResponse.data.data.filter((item: any) => {
            // Проверяем наличие платформ
            if (!item.social_platforms) return false;
            
            // Преобразуем в объект, если это строка
            let platforms = item.social_platforms;
            if (typeof platforms === 'string') {
              try {
                platforms = JSON.parse(platforms);
              } catch (e) {
                return false;
              }
            }
            
            // Проверяем, что это не пустой объект и есть платформы в пендинге
            if (Object.keys(platforms).length === 0) return false;
            
            // Быстрая проверка наличия платформ в статусе pending/scheduled
            for (const [platform, data] of Object.entries(platforms)) {
              if (data?.status === 'pending' || data?.status === 'scheduled' || data?.status === undefined) {
                // Найдена платформа в пендинге - логируем только в режиме детальных логов
                if (this.verboseLogging) {
                  log(`Найдена платформа ${platform} в статусе ${data?.status || 'undefined'} для контента ID: ${item.id}`, 'scheduler');
                }
                return true;
              }
            }
            
            return false;
          });
          
          // Тихо обрабатываем публикации со статусом 'draft' и платформами в статусе 'pending'
          allItems = allItems.concat(pendingItems);
        }

        // Добавляем контент со всеми платформами
        if (allPlatformsResponse?.data?.data) {
          // Фильтруем только те, у которых все платформы опубликованы
          const allPublishedItems = allPlatformsResponse.data.data.filter((item: any) => {
            // Проверяем наличие платформ
            if (!item.social_platforms) return false;
            
            // Преобразуем в объект, если это строка
            let platforms = item.social_platforms;
            if (typeof platforms === 'string') {
              try {
                platforms = JSON.parse(platforms);
              } catch (e) {
                return false;
              }
            }
            
            // Проверяем, что это не пустой объект
            if (Object.keys(platforms).length === 0) return false;
                
            // Проверяем, что все платформы уже опубликованы
            const allPlatforms = Object.keys(platforms);
            const publishedPlatforms = [];
                
            let hasTelegram = false;
            let hasInstagram = false;
            let telegramPublished = false;
            let instagramPublished = false;
                
            // Проверяем каждую платформу
            for (const platform of allPlatforms) {
              const data = platforms[platform] || {};
              const status = data.status;
                
              // Проверка комбинации TG+IG
              if (platform === 'telegram') {
                hasTelegram = true;
                telegramPublished = (status === 'published');
              } else if (platform === 'instagram') {
                hasInstagram = true;
                instagramPublished = (status === 'published');
              }
                
              // Собираем все опубликованные платформы
              if (status === 'published') {
                publishedPlatforms.push(platform);
              }
            }
                
            // Проверяем условия
            const allPublished = allPlatforms.length > 0 && allPlatforms.length === publishedPlatforms.length;
            const isTgIgCombo = hasTelegram && hasInstagram && allPlatforms.length === 2 && 
                           telegramPublished && instagramPublished;
                
            return allPublished || isTgIgCombo;
          });

          if (allPublishedItems.length > 0) {
            log(`Найдено ${allPublishedItems.length} контентов со всеми опубликованными платформами, но статус все еще scheduled`, 'scheduler');
                
            // Обрабатываем обнаруженные контенты напрямую, только обновляя статус - без повторной публикации
            for (const item of allPublishedItems) {
              try {
                log(`Обновление статуса контента ${item.id} с 'запланирован' на 'опубликован'`, 'scheduler');
                
                // запрос на обновление статуса
                await axios.patch(`${directusUrl}/items/campaign_content/${item.id}`, {
                  status: 'published',
                  published_at: new Date().toISOString()
                }, { headers });
                
                log(`Успешно обновлен статус контента ${item.id} на 'published'`, 'scheduler');
              } catch (error) {
                log(`Ошибка при обновлении статуса контента ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'scheduler');
              }
            }
            
            // Не добавляем в общий список, чтобы избежать двойной публикации
            // allItems = allItems.concat(allPublishedItems);
          }
        }
        
        // Используем объединенный список
        const response = { data: { data: allItems } };
        
        
        if (response?.data?.data) {
          const items = response.data.data;
          // Тихо обрабатываем запланированные публикации
          
          const contentItems = items.map((item: any) => ({
            id: item.id,
            content: item.content,
            userId: item.user_id,
            campaignId: item.campaign_id,
            status: item.status,
            contentType: item.content_type || "text",
            title: item.title || null,
            imageUrl: item.image_url,
            videoUrl: item.video_url,
            additionalImages: item.additional_images || null,
            scheduledAt: item.scheduled_at ? new Date(item.scheduled_at) : null,
            createdAt: new Date(item.created_at),
            socialPlatforms: item.social_platforms,
            prompt: item.prompt || null,
            keywords: item.keywords || null,
            hashtags: item.hashtags || null,
            links: item.links || null,
            publishedAt: item.published_at ? new Date(item.published_at) : null,
            metadata: item.metadata || {}
          }));
          
          scheduledContent = contentItems;
        }
      } catch (error: any) {
        // Тихо обрабатываем ошибки запроса
        return; // Прерываем выполнение, так как эти данные критичны
      }
      
      if (scheduledContent.length === 0) {
        // Запланированные публикации не найдены
        return;
      }
      
      // Тихо обрабатываем найденные публикации
      
      // Текущее время
      const now = new Date();
      
      // Фильтруем контент, для которого есть платформы в статусе pending или наступило время публикации
      const contentToPublish = scheduledContent.filter(content => {
        // Если нет платформ для публикации, то пропускаем
        if (!content.socialPlatforms || Object.keys(content.socialPlatforms).length === 0) {
          // Выводим только если включен режим подробного логирования
          if (this.verboseLogging) {
            log(`Контент ID ${content.id} "${content.title}" не имеет настроек социальных платформ, пропускаем`, 'scheduler');
          }
          return false;
        }
        
        const now = new Date();
        let anyPlatformReady = false;
        let anyPlatformPending = false;
        let logMessages = [];
        
        // Проверка на пендинги с учетом времени публикации
        for (const [platform, platformData] of Object.entries(content.socialPlatforms)) {
          
          // КРИТИЧЕСКАЯ ЗАЩИТА: Проверяем уже опубликованные платформы
          if (platformData?.status === 'published' && platformData?.postUrl && platformData?.postUrl.trim() !== '') {
            // Платформа уже опубликована с postUrl - пропускаем
            if (this.verboseLogging) {
              logMessages.push(`${platform}: уже опубликована (postUrl: ${platformData.postUrl})`);
            }
            continue;
          }
          
          // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Помечаем некорректные published статусы как failed
          if (platformData?.status === 'published' && (!platformData?.postUrl || platformData?.postUrl.trim() === '')) {
            log(`ИСПРАВЛЕНИЕ: Контент ${content.id}, платформа ${platform} - помечаем published без postUrl как failed`, 'scheduler');
            // Исключаем эту платформу из дальнейшей обработки - НЕ ПУБЛИКУЕМ ПОВТОРНО
            continue;
          }
          
          // Если платформа выбрана и статус pending/scheduled (БЕЗ published без postUrl!)
          if (platformData?.selected === true && 
              (platformData?.status === 'pending' || platformData?.status === 'scheduled')) {
            
            // КРИТИЧЕСКИ ВАЖНО: Проверяем время публикации даже для pending/scheduled
            const scheduleTime = content.scheduledAt || (platformData?.scheduledAt ? new Date(platformData.scheduledAt) : null);
            
            if (scheduleTime) {
              const timeUntilPublish = scheduleTime.getTime() - now.getTime();
              const minutesDiff = Math.floor(timeUntilPublish / 1000 / 60);
              
              // Публикуем только если время пришло (с допуском 1 минута назад)
              if (timeUntilPublish <= 60000) { // 1 минута = 60000 мс
                if (this.verboseLogging) {
                  logMessages.push(`${platform}: статус ${platformData?.status}, время пришло (${minutesDiff} мин.) - ГОТОВ К ПУБЛИКАЦИИ`);
                }
                anyPlatformPending = true;
              } else {
                if (this.verboseLogging) {
                  logMessages.push(`${platform}: статус ${platformData?.status}, но время еще не пришло (${minutesDiff} мин.) - ОЖИДАНИЕ`);
                }
              }
            } else {
              // Если нет времени публикации, публикуем немедленно (обратная совместимость)
              if (this.verboseLogging) {
                logMessages.push(`${platform}: статус ${platformData?.status}, нет времени публикации - ГОТОВ К ПУБЛИКАЦИИ`);
              }
              anyPlatformPending = true;
            }
          }
        }
        
        // Если есть хотя бы одна платформа готовая к публикации (с учетом времени)
        if (anyPlatformPending) {
            log(`Контент ID ${content.id} имеет платформы готовые к публикации - обрабатываем`, 'scheduler');
            return true;
        }
        
        // Если нет платформ в pending, проверяем расписание по времени
        // Проверяем каждую платформу на время публикации
        for (const [platform, platformData] of Object.entries(content.socialPlatforms)) {
          // Проверяем статус и пропускаем если уже опубликован
          if (platformData?.status === 'published') {
            logMessages.push(`${platform}: уже опубликован`);
            continue;
          }
          
          // Проверяем индивидуальную дату для платформы
          if (platformData?.scheduledAt) {
            const platformScheduledTime = new Date(platformData.scheduledAt);
            const timeUntilPublish = platformScheduledTime.getTime() - now.getTime();
            
            const minutesDiff = Math.floor(timeUntilPublish / 1000 / 60);
            logMessages.push(`${platform}: запланирован на ${platformScheduledTime.toISOString()} (через ${minutesDiff} мин.)`);
            
            // Если время публикации для этой платформы наступило
            if (platformScheduledTime <= now) {
              logMessages.push(`${platform}: ГОТОВ К ПУБЛИКАЦИИ ПО ВРЕМЕНИ`);
              anyPlatformReady = true;
            }
          } else {
            logMessages.push(`${platform}: нет данных о времени публикации`);
          }
        }
        
        // Тихая проверка времени публикации без логирования
        
        // Возвращаем true, если хотя бы одна платформа готова к публикации по времени
        return anyPlatformReady;
      });
      
      if (contentToPublish.length === 0) {
        log('Нет контента, готового к публикации по времени, проверяем статусы существующего запланированного контента', 'scheduler');
        
        // Дополнительная проверка всех запланированных публикаций
        // на наличие полностью опубликованных платформ
        let updatedStatusCount = 0;
        
        for (const content of scheduledContent) {
          // Проверяем только контент со статусом scheduled
          if (content.status !== 'scheduled') {
            continue;
          }
          
          // Получаем актуальные данные контента из БД
          try {
            const baseDirectusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
            const freshDataResponse = await axios.get(
              `${baseDirectusUrl}/items/campaign_content/${content.id}`,
              { headers: { 'Authorization': `Bearer ${authToken}` } }
            );
            
            if (!freshDataResponse.data || !freshDataResponse.data.data) {
              continue;
            }

            const freshData = freshDataResponse.data.data;
            
            // Если нет данных о платформах, пропускаем
            if (!freshData.social_platforms) {
              continue;
            }
            
            let socialPlatforms = freshData.social_platforms;
            
            // Если social_platforms - строка, парсим в объект
            if (typeof socialPlatforms === 'string') {
              try {
                socialPlatforms = JSON.parse(socialPlatforms);
              } catch (e) {
                log(`Ошибка при парсинге social_platforms для контента ${content.id}: ${e}`, 'scheduler');
                continue;
              }
            }
            
            // Проверяем все платформы на статус published
            const allPlatforms = Object.keys(socialPlatforms);
            const publishedPlatforms = [];
            const pendingPlatforms = [];
            const scheduledPlatforms = [];
            let hasPendingStatusAnyPlatform = false;
            
            for (const [platform, data] of Object.entries(socialPlatforms)) {
              if (data.status === 'published') {
                publishedPlatforms.push(platform);
              } else if (data.status === 'pending') {
                pendingPlatforms.push(platform);
                hasPendingStatusAnyPlatform = true;
              } else if (data.status === 'scheduled') {
                scheduledPlatforms.push(platform);
                hasPendingStatusAnyPlatform = true;
              }
            }
            
            // Проверяем, что все платформы опубликованы (независимо от флага selected)
            const allPlatformsPublished = allPlatforms.length === publishedPlatforms.length && allPlatforms.length > 0;
            
            // Если все платформы опубликованы и нет платформ в ожидании - обновляем статус на published
            if (allPlatformsPublished && !hasPendingStatusAnyPlatform) {
              log(`ОБНОВЛЕНИЕ СТАТУСА: Контент ID ${content.id} "${freshData.title}" имеет ВСЕ (${publishedPlatforms.length}/${allPlatforms.length}) платформы в статусе published - обновляем статус контента на published`, 'scheduler');
              
              await axios.patch(
                `${baseDirectusUrl}/items/campaign_content/${content.id}`,
                { 
                  status: 'published',
                  published_at: new Date().toISOString()
                },
                { headers: { 'Authorization': `Bearer ${authToken}` } }
              );
              
              updatedStatusCount++;
            }
          } catch (error) {
            log(`Ошибка при проверке статуса контента ${content.id}: ${error.message}`, 'scheduler');
          }
        }
        
        if (updatedStatusCount > 0) {
          log(`Обновлено статусов контента: ${updatedStatusCount}`, 'scheduler');
        }
        
        return;
      }
      
      log(`Найдено ${contentToPublish.length} публикаций, готовых к публикации`, 'scheduler');
      
      // Проверяем каждый контент перед публикацией
      // Делаем последнюю проверку для каждого контента - получаем свежие данные
      const publishReadyContent = [];
      
      for (const content of contentToPublish) {
        try {
          // Делаем прямой запрос к Directus API для получения свежих данных
          const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
          const response = await axios.get(
            `${directusUrl}/items/campaign_content/${content.id}`,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (response?.data?.data) {
            const freshData = response.data.data;
            
            // Проверяем основной статус контента - должен быть "scheduled" или "draft"
            if (freshData.status !== 'scheduled' && freshData.status !== 'draft') {
              log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" имеет статус ${freshData.status} вместо scheduled или draft, пропускаем`, 'scheduler');
              continue;
            }
            
            // Если статус "draft", проверяем наличие платформ со статусом "pending"
            if (freshData.status === 'draft') {
              // Проверяем, есть ли платформы со статусом "pending"
              const platformsData = freshData.social_platforms;
              let hasPendingPlatforms = false;
              
              if (platformsData && typeof platformsData === 'object') {
                // Преобразуем из строки в объект, если это строка
                let platforms = platformsData;
                if (typeof platforms === 'string') {
                  try {
                    platforms = JSON.parse(platforms);
                  } catch (e) {
                    log(`Ошибка при парсинге social_platforms: ${e}`, 'scheduler');
                    platforms = {};
                  }
                }
                
                // Проверяем все платформы на статус "pending"
                for (const [platform, data] of Object.entries(platforms)) {
                  
                  // КРИТИЧЕСКАЯ ЗАЩИТА: Проверяем уже опубликованные платформы
                  if (data.status === 'published' && data.postUrl && data.postUrl.trim() !== '') {
                    // Платформа уже опубликована с postUrl - пропускаем
                    if (this.verboseLogging) {
                      log(`ПЛАНИРОВЩИК БЛОКИРОВКА: Платформа ${platform} уже опубликована (postUrl: ${data.postUrl}) в контенте ID ${content.id}`, 'scheduler');
                    }
                    continue;
                  }
                  
                  // Сбрасываем некорректные published статусы без postUrl
                  if (data.status === 'published' && (!data.postUrl || data.postUrl.trim() === '')) {
                    log(`ПЛАНИРОВЩИК ИСПРАВЛЕНИЕ: Сброс некорректного статуса 'published' без postUrl для платформы ${platform} в контенте ID ${content.id}`, 'scheduler');
                    data.status = 'pending'; // Исправляем статус локально
                  }
                  
                  // Детальный лог для всех платформ только в вербозном режиме
                  if (this.verboseLogging) {
                    log(`Платформа ${platform} имеет статус: ${data.status} в контенте ID ${content.id}`, 'scheduler');
                    
                    // Особое внимание к Facebook только в вербозном режиме
                    if (platform === 'facebook') {
                      log(`ОТЛАДКА FACEBOOK: Статус = ${data.status}, Выбран = ${data.selected ? 'ДА' : 'НЕТ'}, Полные данные: ${JSON.stringify(data)}`, 'scheduler');
                    }
                  }
                  
                  // Проверяем статус 'pending' ДЛЯ ВЫБРАННЫХ платформ
                  if (data.status === 'pending' && data.selected === true) {
                    hasPendingPlatforms = true;
                    // Логируем только в вербозном режиме
                    if (this.verboseLogging) {
                      log(`Обнаружена платформа ${platform} со статусом pending в контенте ID ${content.id}`, 'scheduler');
                    }
                    // Не прерываем цикл, чтобы искать все платформы
                    // break;
                  }
                }
              }
              
              // Если нет платформ со статусом "pending", пропускаем контент
              if (!hasPendingPlatforms) {
                log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" имеет статус draft, но нет платформ со статусом pending, пропускаем`, 'scheduler');
                continue;
              } else {
                log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" имеет статус draft и платформы со статусом pending - ПРОДОЛЖАЕМ ПУБЛИКАЦИЮ`, 'scheduler');
              }
            }
            
            // Проверяем наличие publishedAt поля - НО НЕ БЛОКИРУЕМ, если есть неопубликованные платформы
            // Логика изменена: проверяем, остались ли неопубликованные платформы, даже если published_at уже установлен
            if (freshData.published_at) {
              // Проверяем, остались ли платформы для публикации
              const platformsData = freshData.social_platforms;
              let pendingPlatformsExist = false;
              
              if (platformsData && typeof platformsData === 'object') {
                // Преобразуем из строки в объект, если это строка
                let platforms = platformsData;
                if (typeof platforms === 'string') {
                  try {
                    platforms = JSON.parse(platforms);
                  } catch (e) {
                    log(`Ошибка при парсинге social_platforms: ${e}`, 'scheduler');
                    platforms = {};
                  }
                }
                
                // Проверяем все платформы
                for (const [platform, data] of Object.entries(platforms)) {
                  // Если есть платформа со статусом scheduled или pending, продолжаем публикацию
                  if (data.status === 'scheduled' || data.status === 'pending') {
                    pendingPlatformsExist = true;
                    // Логируем только в вербозном режиме
                    if (this.verboseLogging) {
                      log(`Обнаружена неопубликованная платформа ${platform} в контенте ID ${content.id}, несмотря на published_at`, 'scheduler');
                    }
                  }
                }
              }
              
              // Если нет ожидающих платформ, пропускаем контент
              if (!pendingPlatformsExist) {
                log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" уже имеет published_at = ${freshData.published_at} и все платформы опубликованы, пропускаем`, 'scheduler');
                continue;
              } else {
                log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" имеет published_at = ${freshData.published_at}, но найдены неопубликованные платформы - ПРОДОЛЖАЕМ`, 'scheduler');
              }
            }
            
            // Проверяем статус в платформах
            if (freshData.social_platforms && typeof freshData.social_platforms === 'object') {
              const socialPlatforms = freshData.social_platforms;
              
              // ИСПРАВЛЕНИЕ: Проверяем ВСЕ ли платформы в JSON имеют статус published
              // Сортируем платформы по статусам
              const selectedPlatforms = [];
              const publishedPlatforms = [];
              const pendingPlatforms = [];
              let hasPendingStatusAnyPlatform = false;
              
              // ВАЖНО: Все платформы в JSON должны обрабатываться независимо от флага selected
              
              // Проходим по всем платформам и собираем статистику
              for (const [platform, data] of Object.entries(socialPlatforms)) {
                // Все платформы заносим в общий список
                selectedPlatforms.push(platform);
                
                if (data.status === 'published') {
                  publishedPlatforms.push(platform);
                } else if (data.status === 'pending' || data.status === 'scheduled') {
                  pendingPlatforms.push(platform);
                  hasPendingStatusAnyPlatform = true;
                  // Логируем только в вербозном режиме
                  if (this.verboseLogging) {
                    log(`Обнаружена платформа ${platform} в статусе '${data.status}', блокируем обновление до published`, 'scheduler');
                  }
                }
              }
              
              // Проверяем, что ВСЕ выбранные платформы опубликованы
              const allSelectedPublished = selectedPlatforms.length === publishedPlatforms.length && selectedPlatforms.length > 0;
              
              // Добавляем улучшенное логирование только если есть изменения
              // Сокращенный вариант логирования
              if (this.verboseLogging || allSelectedPublished || hasPendingStatusAnyPlatform) {
                log(`Контент ${content.id}: платформ ${selectedPlatforms.length}, опубликовано ${publishedPlatforms.length}, в ожидании ${pendingPlatforms.length}`, 'scheduler');
              }
              
              // ИСПРАВЛЕНИЕ: Обновляем статус только когда:
              // 1) ВСЕ платформы в JSON опубликованы (независимо от флага selected)
              // 2) И нет ни одной платформы в статусе pending или scheduled
              if (allSelectedPublished && selectedPlatforms.length > 0 && !hasPendingStatusAnyPlatform) {
                log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" опубликован ВО ВСЕХ (${publishedPlatforms.length}/${selectedPlatforms.length}) соцсетях, обновляем статус`, 'scheduler');
                // Обновляем общий статус на published
                log(`Обновление общего статуса на published для контента ${content.id}`, 'scheduler');
                
                const baseDirectusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
                await axios.patch(
                  `${baseDirectusUrl}/items/campaign_content/${content.id}`,
                  { 
                    status: 'published',
                    published_at: new Date().toISOString()
                  },
                  { headers: { 'Authorization': `Bearer ${authToken}` } }
                );
                continue;
              } else if (publishedPlatforms.length > 0 && publishedPlatforms.length < selectedPlatforms.length) {
                // Устанавливаем статус "publishing" (частично опубликован), если часть платформ опубликованы
                log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" опубликован только в ${publishedPlatforms.length}/${selectedPlatforms.length} соцсетях, устанавливаем статус scheduled`, 'scheduler');
                
                // Изменяем статус на scheduled, если он draft, чтобы показать что процесс публикации начался
                if (freshData.status === 'draft') {
                  const baseDirectusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
                  await axios.patch(
                    `${baseDirectusUrl}/items/campaign_content/${content.id}`,
                    { status: 'scheduled' },
                    { headers: { 'Authorization': `Bearer ${authToken}` } }
                  );
                }
                // Не прерываем, чтобы контент был добавлен в список для публикации
                // Если опубликованы НЕ ВСЕ платформы - продолжаем публикацию остальных
                log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" опубликован только в ${publishedPlatforms.length}/${selectedPlatforms.length} соцсетях, продолжаем публикацию`, 'scheduler');
              }
            }
            
            // Если все проверки прошли, добавляем в список для публикации
            publishReadyContent.push(content);
          }
        } catch (error: any) {
          log(`Ошибка при проверке статуса в БД для контента ${content.id}: ${error.message}`, 'scheduler');
          // При ошибке проверки НЕ добавляем в список публикации, чтобы избежать ошибок
          // Контент будет проверен при следующем запуске планировщика
          // Это помогает избежать ошибок обновления несуществующего контента
        }
      }
      
      log(`Готово к публикации ${publishReadyContent.length} элементов контента`, 'scheduler');
      
      // Публикуем каждый элемент контента
      for (const content of publishReadyContent) {
        log(`Публикация контента ${content.id} "${content.title}"...`, 'scheduler');
        try {
          // Дополнительно проверяем существование контента непосредственно перед публикацией
          try {
            const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
            const checkResponse = await axios.get(
              `${directusUrl}/items/campaign_content/${content.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            
            if (!checkResponse?.data?.data) {
              log(`Контент ${content.id} не найден при финальной проверке, пропускаем публикацию`, 'scheduler');
              continue;
            }
            
            // Передаем токен авторизации в метод публикации
            await this.publishContent(content, authToken);
          } catch (checkError: any) {
            log(`Ошибка при финальной проверке контента ${content.id}: ${checkError.message}, пропускаем публикацию`, 'scheduler');
            continue;
          }
        } catch (pubError: any) {
          log(`Ошибка при публикации контента ${content.id}: ${pubError.message}`, 'scheduler');
          // Продолжаем с другими контентами
        }
      }
    } catch (error: any) {
      log(`Ошибка при проверке запланированных публикаций: ${error.message}`, 'scheduler');
    }
  }

  /**
   * Публикует контент в выбранные социальные сети
   * @param content Контент для публикации
   * @param authToken Токен авторизации для API запросов
   */
  async publishContent(content: CampaignContent, authToken?: string) {
    // Упрощенный алгоритм публикации в соответствии с новыми требованиями
    // Добавляем подробное логирование при публикации
    log(`[Публикация] Начало публикации контента ID: ${content.id}`, 'scheduler');
    
    // Логируем детали платформ
    try {
      log(`[Публикация] Содержимое social_platforms: ${JSON.stringify(content.socialPlatforms)}`, 'scheduler');
    } catch (e) {
      log(`[Публикация] Ошибка при логировании platforms: ${e}`, 'scheduler');
    }
    try {
      if (!content.id || !content.campaignId) {
        log(`Контент с ID ${content.id} не содержит необходимой информации`, 'scheduler');
        return;
      }
      
      // ЖЕСТКАЯ проверка статуса ПЕРЕД публикацией
      // Проверяем, был ли контент уже опубликован (общий статус или любая платформа)
      if (content.status === 'published') {
        log(`БЛОКИРОВКА: Контент ${content.id} имеет глобальный статус "published", публикация остановлена`, 'scheduler');
        return;
      }
      
      // Проверяем статус в социальных платформах
      if (content.socialPlatforms && typeof content.socialPlatforms === 'object') {
        // ИСПРАВЛЕНИЕ: Проверяем все платформы на статус published
        const allPlatforms = Object.keys(content.socialPlatforms);
        const publishedPlatforms = Object.entries(content.socialPlatforms)
          .filter(([_, data]: [string, any]) => data && data.status === 'published')
          .map(([platform]) => platform);
        
        // Информирование о статусе публикации
        log(`Проверка статуса платформ: опубликовано ${publishedPlatforms.length} из ${allPlatforms.length}`, 'scheduler');
        
        // ИСПРАВЛЕНИЕ: Обновляем статус только если ВСЕ платформы опубликованы
        if (publishedPlatforms.length > 0 && publishedPlatforms.length === allPlatforms.length) {
          log(`БЛОКИРОВКА: Контент ${content.id} опубликован ВО ВСЕХ (${publishedPlatforms.length}/${allPlatforms.length}) соцсетях`, 'scheduler');
          
          // Обновляем основной статус на published, если он ещё не установлен
          if (content.status !== 'published') {
            await storage.updateCampaignContent(content.id, {
              status: 'published',
              published_at: new Date() // Добавляем поле published_at при обновлении статуса
            });
            log(`Обновлен глобальный статус контента ${content.id} на "published"`, 'scheduler');
          }
          
          return;
        } else if (publishedPlatforms.length > 0) {
          // Если опубликованы не все платформы, выводим информацию и НЕ ПРЕРЫВАЕМ публикацию
          log(`ИНФО: Контент ${content.id} опубликован только в НЕКОТОРЫХ (${publishedPlatforms.length}/${allPlatforms.length}) соцсетях, продолжаем публикацию остальных`, 'scheduler');
        }
      }

      log(`Публикация контента ${content.id}: "${content.title}"`, 'scheduler');
      
      // Логируем информацию о времени публикации для каждой платформы
      if (content.socialPlatforms && typeof content.socialPlatforms === 'object') {
        // Выводим настройки времени для каждой платформы для отладки
        const platformTimes = Object.entries(content.socialPlatforms)
          .map(([platform, data]) => {
            const scheduledTime = data.scheduledAt ? new Date(data.scheduledAt).toISOString() : 'не задано';
            return `${platform}: ${scheduledTime} (статус: ${data.status || 'не установлен'})`;
          })
          .join(', ');
        
        log(`Настройки времени публикации для платформ: ${platformTimes}`, 'scheduler');
      } else {
        log(`Для контента ${content.id} нет индивидуальных настроек времени для платформ, используется общее время: ${content.scheduledAt?.toISOString() || 'не задано'}`, 'scheduler');
      }

      // Получаем системный токен для доступа к API
      const systemToken = await this.getSystemToken();
      
      // Получаем данные кампании для настроек социальных сетей
      let campaign: Campaign | undefined;
      
      // Проверяем кэш настроек кампании
      const now = Date.now();
      if (this.campaignSettingsCache.has(content.campaignId) && 
          this.campaignCacheTimestamp.has(content.campaignId) &&
          (now - (this.campaignCacheTimestamp.get(content.campaignId) || 0) < this.campaignCacheExpirationMs)) {
        
        // Используем кэшированные настройки кампании
        log(`Используем кэшированные настройки кампании ${content.campaignId}`, 'scheduler');
        campaign = this.campaignSettingsCache.get(content.campaignId);
        
        // Для отладки
        log(`Кэшированные настройки кампании: ${campaign?.name}, настройки соцсетей: ${JSON.stringify(campaign?.socialMediaSettings || {})}`, 'scheduler');
      }
      // Если нет в кэше - получаем с сервера
      else if (systemToken) {
        try {
          const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
          log(`Прямой запрос для получения кампании: ${content.campaignId}`, 'scheduler');
          
          // Делаем прямой запрос без параметров
          const response = await axios.get(`${directusUrl}/items/user_campaigns`, {
            headers: {
              'Authorization': `Bearer ${systemToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response?.data?.data && Array.isArray(response.data.data)) {
            // Ищем кампанию в списке
            const campaignItem = response.data.data.find((item: any) => 
              item.id === content.campaignId || 
              item.id === parseInt(content.campaignId)
            );
            
            if (campaignItem) {
              log(`Кампания найдена в списке: ${campaignItem.name}`, 'scheduler');
              
              // Добавим подробное логирование настроек для диагностики
              log(`Настройки кампании: ${JSON.stringify({
                id: campaignItem.id,
                hasSettings: !!campaignItem.social_media_settings,
                settingsType: typeof campaignItem.social_media_settings,
                settingsKeys: campaignItem.social_media_settings ? Object.keys(campaignItem.social_media_settings) : [],
                telegramSettings: campaignItem.social_media_settings?.telegram ? 'имеются' : 'отсутствуют',
                instagramSettings: campaignItem.social_media_settings?.instagram ? 'имеются' : 'отсутствуют',
                vkSettings: campaignItem.social_media_settings?.vk ? 'имеются' : 'отсутствуют',
                facebookSettings: campaignItem.social_media_settings?.facebook ? 'имеются' : 'отсутствуют',
                rawSettings: campaignItem.social_media_settings
              })}`, 'scheduler');
              
              campaign = {
                id: parseInt(campaignItem.id) || 0,
                name: campaignItem.name || '',
                userId: campaignItem.user_id || '',
                socialMediaSettings: campaignItem.social_media_settings || {},
                createdAt: campaignItem.created_at ? new Date(campaignItem.created_at) : null,
                description: campaignItem.description || null,
                status: campaignItem.status || 'active',
                trendAnalysisSettings: campaignItem.trend_analysis_settings || {},
                directusId: campaignItem.id,
                link: null
              } as Campaign;
              
              // Сохраняем настройки кампании в кэше
              this.campaignSettingsCache.set(content.campaignId, campaign);
              this.campaignCacheTimestamp.set(content.campaignId, now);
              log(`Настройки кампании ${campaign.name} сохранены в кэше`, 'scheduler');
              
              // Добавляем логирование настроек Telegram для диагностики
              if (campaign.socialMediaSettings && 
                  typeof campaign.socialMediaSettings === 'object') {
                const socialSettings = campaign.socialMediaSettings as any;
                if (socialSettings.telegram) {
                  const telegramSettings = socialSettings.telegram;
                  log(`Настройки Telegram для кампании: token=${telegramSettings.token ? 'задан' : 'не задан'}, chatId=${telegramSettings.chatId || 'не задан'}`, 'scheduler');
                } else {
                  log(`Настройки Telegram для кампании не найдены`, 'scheduler');
                }
              } else {
                log(`Настройки социальных сетей для кампании не найдены`, 'scheduler');
              }
            } else {
              log(`Кампания с ID ${content.campaignId} не найдена в списке из ${response.data.data.length} элементов`, 'scheduler');
            }
          }
        } catch (error: any) {
          log(`Ошибка при получении кампании через прямой запрос: ${error.message}`, 'scheduler');
        }
      }
      
      // Если не получилось через CRUD, используем стандартное хранилище
      if (!campaign) {
        campaign = await storage.getCampaign(parseInt(content.campaignId));
      }
      
      if (!campaign) {
        log(`Кампания с ID ${content.campaignId} не найдена`, 'scheduler');
        return;
      }

      // Настройки социальных сетей
      const socialSettings = campaign.socialMediaSettings || {};

      // Проверяем, в какие платформы нужно публиковать
      const socialPlatforms = content.socialPlatforms || {};
      // Получаем текущее время
      const currentDate = new Date();
      
      // Подробное логирование для диагностики
      log(`Проверка платформ для публикации контента ${content.id} "${content.title || ''}":`, 'scheduler');
      
      // Отфильтруем только те платформы, время публикации которых уже наступило
      // или они находятся в статусе pending
      const platformsToPublish = Object.entries(socialPlatforms)
        .filter(([platform, platformData]) => {
          // КРИТИЧЕСКАЯ ЗАЩИТА: Проверяем уже опубликованные платформы с postUrl
          if (platformData.status === 'published' && platformData.postUrl && platformData.postUrl.trim() !== '') {
            log(`  - ${platform}: уже опубликована с postUrl (${platformData.postUrl}), пропускаем`, 'scheduler');
            return false;
          }
          
          // Сбрасываем некорректные published статусы без postUrl
          if (platformData.status === 'published' && (!platformData.postUrl || platformData.postUrl.trim() === '')) {
            log(`  - ${platform}: ИСПРАВЛЕНИЕ - сброс published без postUrl на pending`, 'scheduler');
            platformData.status = 'pending'; // Исправляем статус локально
          }
          
          // КРИТИЧЕСКАЯ ЗАЩИТА #1: Проверяем признаки уже выполненной публикации
          if (platformData.postUrl && platformData.postUrl.trim() !== '') {
            log(`  - ${platform}: УЖЕ ОПУБЛИКОВАН, найден postUrl: ${platformData.postUrl}, ПРОПУСКАЕМ`, 'scheduler');
            return false;
          }
          
          // КРИТИЧЕСКАЯ ЗАЩИТА #2: Проверяем что платформа действительно опубликована
          // Платформа считается опубликованной только если есть И статус 'published' И postUrl
          if (platformData.status === 'published' && platformData.postUrl && platformData.postUrl.trim() !== '') {
            log(`  - ${platform}: УЖЕ ОПУБЛИКОВАН (статус: published, postUrl: ${platformData.postUrl}), ПРОПУСКАЕМ`, 'scheduler');
            return false;
          }
          
          // ИСПРАВЛЕНИЕ: Для платформ в статусе 'pending', включаем только если нет признаков публикации
          if (platformData.status === 'pending') {
            log(`  - ${platform}: статус "pending", ГОТОВ К НЕМЕДЛЕННОЙ ПУБЛИКАЦИИ`, 'scheduler');
            return true;
          }
          
          // Если у платформы есть своё scheduledAt, используем его для проверки
          if (platformData.scheduledAt) {
            const platformScheduledTime = new Date(platformData.scheduledAt);
            const diffMs = platformScheduledTime.getTime() - currentDate.getTime();
            const diffMinutes = Math.floor(diffMs / 1000 / 60);
            
            if (platformScheduledTime > currentDate) {
              log(`  - ${platform}: запланирован на ${platformScheduledTime.toISOString()}, еще ${diffMinutes} мин., ПРОПУСКАЕМ`, 'scheduler');
              return false;
            } else {
              log(`  - ${platform}: запланирован на ${platformScheduledTime.toISOString()}, время публикации НАСТУПИЛО`, 'scheduler');
              return true;
            }
          } else {
            // Если нет специфического времени для платформы, все равно включаем ее
            log(`  - ${platform}: нет точного времени, используем общее время (если есть)`, 'scheduler');
            
            // Используем общее поле scheduledAt только если нет индивидуального времени
            if (content.scheduledAt) {
              return content.scheduledAt <= currentDate;
            }
            
            // Если нет ни индивидуального, ни общего времени - включаем для публикации по умолчанию
            log(`  - ${platform}: нет времени публикации вообще, считаем готовым`, 'scheduler');
            return true;
          }
        })
        .map(([platform]) => platform as SocialPlatform);
        
      // Общий результат
      log(`Итого платформ для публикации: ${platformsToPublish.length} (${platformsToPublish.join(', ')})`, 'scheduler');
        
      if (platformsToPublish.length === 0) {
        log(`Для контента ${content.id} не указаны платформы или время публикации ещё не наступило`, 'scheduler');
        
        // Не обновляем статус, так как возможно время для некоторых платформ ещё не наступило
        return;
      }

      // Проверка глобального флага отключения публикаций
      if (this.disablePublishing) {
        log(`БЛОКИРОВКА: Публикация контента ${content.id} отменена из-за глобального флага отключения публикаций`, 'scheduler');
        
        // Обновляем статус на published без фактической публикации
        try {
          // Сначала проверяем наличие контента, используем полученный или системный токен
          const tokenToUse = authToken || await this.getSystemToken();
          if (!tokenToUse) {
            log(`Не удалось получить авторизационный токен для контента ${content.id}`, 'scheduler');
            return;
          }
          
          // Проверка существования контента с использованием токена
          const existingContent = await storage.getCampaignContentById(content.id, tokenToUse);
          if (!existingContent) {
            log(`Контент с ID ${content.id} не найден в БД, обновление статуса невозможно`, 'scheduler');
            return;
          }

          // Обновляем статус с передачей токена авторизации
          await storage.updateCampaignContent(content.id, {
            status: 'published'
          }, tokenToUse);
          
          // Отдельной операцией устанавливаем publishedAt через прямой запрос к API
          try {
            const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech';
            await axios.patch(
              `${directusUrl}/items/campaign_content/${content.id}`,
              { published_at: new Date().toISOString() },
              { headers: { 'Authorization': `Bearer ${tokenToUse}` } }
            );
            log(`Установлено поле published_at для контента ${content.id}`, 'scheduler');
          } catch (patchError: any) {
            log(`Ошибка при установке published_at для контента ${content.id}: ${patchError.message}`, 'scheduler');
          }
        } catch (error: any) {
          log(`Ошибка при обновлении статуса контента: ${error.message}`, 'scheduler');
        }
        
        log(`Контент ${content.id} помечен как опубликованный без фактической публикации (disablePublishing=true)`, 'scheduler');
        return;
      }

      // Публикуем в каждую платформу
      let successfulPublications = 0;
      let totalAttempts = 0;
      
      for (const platform of platformsToPublish) {
        // Проверяем, существует ли объект социальных платформ и платформа в нём
        const platformStatus = socialPlatforms && typeof socialPlatforms === 'object' 
          ? (socialPlatforms as Record<string, any>)[platform]?.status
          : undefined;
          
        // Пропускаем уже опубликованные, но считаем их как успешные
        if (platformStatus === 'published') {
          log(`Контент ${content.id} уже опубликован в ${platform}`, 'scheduler');
          successfulPublications++;
          continue;
        }

        totalAttempts++;

        // Убедимся, что метаданные проинициализированы и установлен флаг forceImageTextSeparation для Telegram
        if (!content.metadata) {
          content.metadata = {};
        }
        
        // Для Telegram убираем принудительное разделение картинки и текста
        if (platform === 'telegram') {
          (content.metadata as any).forceImageTextSeparation = false;
          log(`Отключен флаг forceImageTextSeparation для запланированной Telegram публикации ID: ${content.id}`, 'scheduler');
        }
        
        // Определяем URL для API запроса "Опубликовать сейчас"
        const appUrl = process.env.APP_URL || 'http://localhost:5000';
        
        // Передаем имя платформы как строку, чтобы избежать ошибки "Platform [object Object] is not supported yet"
        const platformName = typeof platform === 'string' ? platform : String(platform);
        
        // Для Facebook используем специальный прямой URL, для остальных - стандартный
        let publishUrl;
        let logMessage;
        
        if (platformName.toLowerCase() === 'facebook') {
          // Используем прямой маршрут для Facebook
          publishUrl = `${appUrl}/api/facebook-webhook-direct`;
          logMessage = `Вызов прямого API публикации Facebook для запланированного контента ${content.id}`;
          log(logMessage, 'scheduler');
        } else {
          // Используем route /api/publish для остальных платформ, которые маршрутизирует запросы через n8n
          publishUrl = `${appUrl}/api/publish`;
          logMessage = `Вызов API публикации через n8n для запланированного контента ${content.id} на платформе ${platformName}`;
          log(logMessage, 'scheduler');
        }
        
        try {
          // Параметры различаются в зависимости от платформы
          const requestData = platformName.toLowerCase() === 'facebook' 
            ? { contentId: content.id } // для Facebook
            : { contentId: content.id, platform: platformName }; // для остальных платформ
          
          // Логируем что именно отправляем
          log(`Отправляем в ${platformName}: contentId=${content.id}, platform=${platformName}`, 'scheduler');
          
          const apiResponse = await axios.post(publishUrl, requestData, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          // Проверяем успешность публикации
          // Для маршрута /api/publish результат приходит прямо в data, а не в data.results
          const resultFromApi = apiResponse.data;
          
          if (resultFromApi?.success) {
            // Используем успешный результат из API
            log(`Успешная публикация через API для контента ${content.id} на платформе ${platform}`, 'scheduler');
            
            // Создаем объект результата для дальнейшей обработки
            // Улучшенная логика получения URL и messageId из результата API
            log(`Результат публикации от API: ${JSON.stringify(resultFromApi)}`, 'scheduler');
            
            // ДЕТАЛЬНОЕ логирование полной структуры ответа для отладки
            log(`API вернул полную структуру ответа: ${JSON.stringify(resultFromApi)}`, 'scheduler');
            
            // Попытка извлечь postUrl и messageId из вложенного объекта
            const detailedPath = (obj: any, path: string): any => {
              try {
                const parts = path.split('.');
                let current = obj;
                for (const part of parts) {
                  if (current && typeof current === 'object' && part in current) {
                    current = current[part];
                  } else {
                    return null;
                  }
                }
                return current;
              } catch (e) {
                return null;
              }
            };
            
            // Проверяем все возможные пути к URL и messageId в ответе
            const possibleUrlPaths = [
              'result.postUrl', 
              'result.url', 
              'result.result.postUrl', 
              'result.result.url',
              'postUrl',
              'url'
            ];
            
            const possibleIdPaths = [
              'result.messageId',
              'result.postId',
              'result.result.messageId',
              'result.result.postId',
              'messageId',
              'postId'
            ];
            
            // Извлекаем URL из всех возможных мест
            let foundUrl = null;
            for (const path of possibleUrlPaths) {
              const value = detailedPath(resultFromApi, path);
              if (value) {
                foundUrl = value;
                log(`Найден URL в пути ${path}: ${value}`, 'scheduler');
                break;
              }
            }
            
            // Извлекаем ID сообщения из всех возможных мест
            let foundId = null;
            for (const path of possibleIdPaths) {
              const value = detailedPath(resultFromApi, path);
              if (value) {
                foundId = value;
                log(`Найден ID в пути ${path}: ${value}`, 'scheduler');
                break;
              }
            }
            
            const result = {
              platform,
              status: 'published' as const,
              publishedAt: new Date(),
              postUrl: foundUrl,
              postId: foundId,
              error: null
            };
            
            log(`Сформирован результат публикации с postUrl: ${result.postUrl}`, 'scheduler');
            log(`Детали результата публикации для ${platform}: ${JSON.stringify(result)}`, 'scheduler');
            
            // Обновляем статус публикации через модульный сервис с дополнительной проверкой
            // API должен обновить статус, но для надёжности делаем и здесь
            try {
              log(`Вызов updatePublicationStatus для platform=${platform}`, 'scheduler');
              await socialPublishingService.updatePublicationStatus(content.id, platform, result);
              log(`Статус публикации успешно обновлен для ${platform}`, 'scheduler');
            } catch (updateError) {
              log(`Ошибка при обновлении статуса публикации: ${updateError}`, 'scheduler');
            }
            
            // Отмечаем успешную публикацию
            successfulPublications++;
            
            // Переходим к следующей итерации цикла
            continue;
          } else {
            // Если API вернул ошибку, логируем ее
            log(`Ошибка публикации через API для контента ${content.id} на платформе ${platform}: ${resultFromApi?.error || 'неизвестная ошибка'}`, 'scheduler');
          }
        } catch (apiError) {
          log(`Исключение при вызове API публикации: ${apiError}`, 'scheduler');
        }
        
        // Резервный вариант: публикуем через n8n вебхуки вместо прямого вызова publishToPlatform
        log(`Использование резервного метода публикации через n8n webhook для контента ${content.id} на платформе ${platform}`, 'scheduler');
        
        // Преобразуем имя платформы в строку и маппим на правильные webhook endpoints
        // ИСПРАВЛЕНО: Добавлен маппинг для гарантии правильного формата
        // Маппинг платформ на их webhook endpoints
        const webhookMap: Record<string, string> = {
          'telegram': 'publish-telegram',
          'vk': 'publish-vk',
          'instagram': 'publish-instagram',
          'facebook': 'publish-facebook'
        };
        
        // Преобразуем platform в строку нижнего регистра для маппинга
        let platformString: string;
        if (typeof platform === 'string') {
          platformString = platform.toLowerCase();
        } else if (platform && typeof platform === 'object') {
          if (platform.hasOwnProperty('toString')) {
            platformString = String(platform).toLowerCase();
          } else {
            // Последняя попытка получить строковое представление
            platformString = Object.prototype.toString.call(platform).toLowerCase();
            log(`Получено сложное представление платформы: ${platformString}`, 'scheduler');
          }
        } else {
          // Запасной вариант - преобразуем в строку даже если будет [object Object]
          platformString = String(platform).toLowerCase();
          log(`Внимание: платформа имеет непредвиденный формат: ${platformString}`, 'scheduler');
        }
        
        // Ищем webhook по маппингу
        let webhookName = webhookMap[platformString];
        if (!webhookName) {
          // Если прямое соответствие не найдено, проверяем вхождение названия в строку
          for (const [key, value] of Object.entries(webhookMap)) {
            if (platformString.includes(key)) {
              webhookName = value;
              log(`Найдено частичное соответствие платформы: ${platformString} → ${key}`, 'scheduler');
              break;
            }
          }
          
          // Если все еще не нашли, используем значение по умолчанию
          if (!webhookName) {
            webhookName = `publish-${platformString}`;
            log(`Внимание: не найдено соответствие для платформы ${platformString}, используем ${webhookName}`, 'scheduler');
          }
        }
        
        // Определяем URL для webhook запроса н8н
        // ИСПРАВЛЕНО: Поправлен формат URL для вызова webhook
        let n8nBaseUrl = process.env.N8N_URL || 'https://n8n.roboflow.tech';
        
        // Всегда добавляем /webhook если его нет
        if (!n8nBaseUrl.includes('/webhook')) {
          // Если n8nBaseUrl заканчивается на /, убираем его перед добавлением /webhook
          if (n8nBaseUrl.endsWith('/')) {
            n8nBaseUrl = n8nBaseUrl.slice(0, -1);
          }
          n8nBaseUrl = `${n8nBaseUrl}/webhook`;
        }
        
        // Проверяем, не содержит ли базовый URL уже слеш в конце
        const baseUrlWithoutTrailingSlash = n8nBaseUrl.endsWith('/') ? n8nBaseUrl.slice(0, -1) : n8nBaseUrl;
        const webhookUrl = `${baseUrlWithoutTrailingSlash}/${webhookName}`;
        
        // Добавляем дополнительный лог для отладки URL
        log(`Сформирован URL для n8n webhook: ${webhookUrl}`, 'scheduler');
        
        try {
          log(`Отправка запроса на n8n webhook ${webhookUrl} для контента ID ${content.id}`, 'scheduler');
          
          // Отправляем только ID контента - вебхук загрузит все остальные данные сам
          const webhookResponse = await axios.post(webhookUrl, {
            contentId: content.id
          });
          
          log(`Ответ от n8n webhook: ${JSON.stringify(webhookResponse.data)}`, 'scheduler');
          
          // Создаем успешный результат на основе ответа webhook
          const successResult = {
            status: 'published' as const,
            platform, // Важно: добавляем платформу в объект результата
            publishedAt: new Date(),
            postUrl: webhookResponse.data?.postUrl || null,
            postId: webhookResponse.data?.postId || null,
            error: null
          };
          
          // Обновляем статус публикации через модульный сервис socialPublishingService
          await socialPublishingService.updatePublicationStatus(
            content.id,
            platform,
            successResult
          );

          // Логируем результат
          log(`Контент ${content.id} успешно опубликован в ${platform}`, 'scheduler');
          successfulPublications++;
        } catch (webhookError) {
          log(`Ошибка при вызове n8n webhook для ${platform}: ${webhookError}`, 'scheduler');
          
          // Создаем объект с ошибкой
          const errorResult = {
            status: 'failed' as const,
            platform, // Важно: добавляем платформу в объект результата
            publishedAt: null,
            postUrl: null,
            postId: null,
            error: `Ошибка вызова n8n webhook: ${webhookError}`
          };
          
          // Обновляем статус публикации, указывая на ошибку
          await socialPublishingService.updatePublicationStatus(
            content.id,
            platform,
            errorResult
          );
          
          log(`Ошибка при публикации контента ${content.id} в ${platform}: ${errorResult.error}`, 'scheduler');
        }
      }
      
      // Проверяем, остались ли ещё непубликованные платформы
      // Получаем актуальные данные о платформах контента из БД
      try {
        const freshContent = await storage.getCampaignContentById(content.id, authToken);
        if (freshContent && freshContent.socialPlatforms && typeof freshContent.socialPlatforms === 'object') {
          const allPlatforms = Object.keys(freshContent.socialPlatforms);
          const publishedPlatforms = Object.entries(freshContent.socialPlatforms)
            .filter(([_, data]) => data.status === 'published')
            .map(([platform]) => platform);
          
          const unpublishedPlatforms = allPlatforms.filter(p => !publishedPlatforms.includes(p));
          
          // Улучшенная проверка для непубликованных платформ
          const pendingPublications = unpublishedPlatforms.filter(platform => {
            const platformData = (freshContent.socialPlatforms as any)[platform];
            if (!platformData) return false;
            
            // ИСПРАВЛЕНИЕ: Считаем ожидающими публикации все платформы, которые НЕ опубликованы 
            // или находятся в состоянии ошибки (failed/error)
            // Если это не 'published', то платформа всё ещё требует внимания
            if (platformData.status !== 'published') {
              // Если статус failed или есть ошибка, то платформа явно требует внимания
              if (platformData.status === 'failed' || platformData.error) {
                log(`Платформа ${platform} находится в статусе ошибки: ${platformData.status}, ошибка: ${platformData.error || 'нет данных'}`, 'scheduler');
                return true;
              }
              
              // Если статус scheduled или pending, то проверяем время
              if (platformData.status === 'scheduled' || platformData.status === 'pending') {
                if (platformData.scheduledAt) {
                  const platformTime = new Date(platformData.scheduledAt);
                  const now = new Date();
                  log(`Проверка времени для платформы ${platform}: ${platformTime.toISOString()} vs ${now.toISOString()}`, 'scheduler');
                  
                  // Проверяем, наступило ли время публикации или еще нет
                  if (platformTime > now) {
                    // Время публикации ещё не наступило
                    log(`Платформа ${platform} запланирована на будущее время: ${platformTime.toISOString()}`, 'scheduler');
                    return true;
                  } else {
                    // Время публикации наступило, но публикация не произошла
                    log(`Платформа ${platform} должна была быть опубликована в ${platformTime.toISOString()}, но всё ещё в статусе ${platformData.status}`, 'scheduler');
                    return true; // Всё равно считаем ожидающей
                  }
                } else {
                  // Нет установленного времени публикации
                  log(`Платформа ${platform} в статусе ${platformData.status} без установленного времени публикации`, 'scheduler');
                  return true;
                }
              }
              
              // В любом другом статусе (не published, не pending, не scheduled) - тоже считаем ожидающей
              log(`Платформа ${platform} в неизвестном статусе: ${platformData.status}`, 'scheduler');
              return true;
            }
            
            // Если статус published, то платформа не ожидает публикации
            return false;
          });
          
          log(`Контент ${content.id}: опубликовано ${publishedPlatforms.length}/${allPlatforms.length} платформ, ожидает публикации: ${pendingPublications.length}`, 'scheduler');
          
          // Если все платформы опубликованы или нет платформ, ожидающих публикации в будущем
          // то меняем статус на published
          if (pendingPublications.length === 0) {
            log(`Обновление основного статуса контента ${content.id} на "published" после публикации во всех платформах или в отсутствии запланированных платформ`, 'scheduler');
            
            try {
              // Обновляем статус с передачей токена авторизации
              await storage.updateCampaignContent(content.id, {
                status: 'published'
              }, authToken);
              
              log(`Статус контента ${content.id} успешно обновлен на published`, 'scheduler');
            } catch (updateError: any) {
              log(`Ошибка при обновлении статуса контента ${content.id}: ${updateError.message}`, 'scheduler');
            }
          } else {
            // Есть платформы, ожидающие публикации в будущем
            log(`Контент ${content.id} имеет ${pendingPublications.length} платформ, запланированных на будущее время. Оставляем статус scheduled`, 'scheduler');
            
            // Удостоверяемся, что основной статус остается scheduled
            try {
              // Проверяем текущий статус
              if (freshContent.status !== 'scheduled') {
                await storage.updateCampaignContent(content.id, {
                  status: 'scheduled'
                }, authToken);
                log(`Восстановлен статус "scheduled" для контента ${content.id}, т.к. остались запланированные публикации`, 'scheduler');
              }
            } catch (updateError: any) {
              log(`Ошибка при обновлении статуса контента ${content.id}: ${updateError.message}`, 'scheduler');
            }
          }
        } else {
          // Если не удалось получить данные о платформах, действуем по старой логике
          if (successfulPublications > 0) {
            log(`Обновление основного статуса контента ${content.id} на "published" после успешной публикации в ${successfulPublications}/${platformsToPublish.length} платформах (резервная логика)`, 'scheduler');
            
            // Обновляем статус с передачей токена авторизации
            await storage.updateCampaignContent(content.id, {
              status: 'published'
            }, authToken);
            
            log(`Статус контента ${content.id} успешно обновлен на published (резервная логика)`, 'scheduler');
          }
        }
      } catch (checkError: any) {
        log(`Ошибка при проверке оставшихся платформ для контента ${content.id}: ${checkError.message}`, 'scheduler');
        
        // Резервная логика в случае ошибки
        if (successfulPublications > 0) {
          try {
            // Обновляем статус с передачей токена авторизации
            await storage.updateCampaignContent(content.id, {
              status: 'published'
            }, authToken);
            
            log(`Статус контента ${content.id} успешно обновлен на published (при ошибке проверки)`, 'scheduler');
          } catch (updateError: any) {
            log(`Ошибка при обновлении статуса контента ${content.id}: ${updateError.message}`, 'scheduler');
          }
        }
      }
    } catch (error: any) {
      log(`Ошибка при публикации контента ${content.id}: ${error.message}`, 'scheduler');
    }
  }
}

// КРИТИЧЕСКАЯ ЗАЩИТА: Глобальный синглтон планировщика
let globalSchedulerInstance: PublishScheduler | null = null;

// Проверяем глобальное хранилище на наличие экземпляра
if ((global as any).publishSchedulerInstance) {
  globalSchedulerInstance = (global as any).publishSchedulerInstance;
  log('Использование существующего глобального экземпляра планировщика', 'scheduler');
} else {
  globalSchedulerInstance = new PublishScheduler();
  (global as any).publishSchedulerInstance = globalSchedulerInstance;
  log('Создан новый глобальный экземпляр планировщика', 'scheduler');
}

export const publishScheduler = globalSchedulerInstance;