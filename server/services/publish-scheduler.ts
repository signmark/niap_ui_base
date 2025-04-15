import axios from 'axios';
import { log } from '../utils/logger';
import { storage } from '../storage';
// Не используем старый сервис, заменив его на новый модульный
import { socialPublishingService } from './social/index';
import { CampaignContent, SocialPlatform, Campaign } from '@shared/schema';
import { directusStorageAdapter } from './directus';
import { directusApiManager } from '../directus';
import { directusCrud } from './directus-crud';
import { checkTokenExtractionRequest } from './token-extractor';

/**
 * Класс для планирования и выполнения автоматической публикации контента
 */
export class PublishScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 60000; // проверяем каждую минуту
  // Для обратной совместимости со старым кодом (временное решение)
  private processedContentIds = new Set<string>();
  // Глобальный флаг для полного отключения публикаций (критическая мера безопасности)
  // Публикации активированы
  public disablePublishing = false;

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
   * @returns Токен для авторизации запросов к API
   */
  public async getSystemToken(): Promise<string | null> {
    try {
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
          const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
          const response = await axios.post(`${directusUrl}/auth/login`, {
            email,
            password
          });
          
          if (response?.data?.data?.access_token) {
            const token = response.data.data.access_token;
            log('Авторизация администратора успешна через прямой API запрос', 'scheduler');
            
            // Сохраняем токен в кэше
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
            return authInfo.token;
          }
          
          // Если не получилось через directusAuthManager, пробуем через directusCrud
          const authResult = await directusCrud.login(email, password);
          
          if (authResult?.access_token) {
            log('Авторизация администратора успешна через directusCrud', 'scheduler');
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
            return adminToken;
          }
        } catch (error: any) {
          log(`Статический токен недействителен: ${error.message}`, 'scheduler');
        }
      }
      
      // 4. Пробуем получить токен из кэша
      const cachedToken = directusApiManager.getCachedToken(adminUserId);
      if (cachedToken) {
        log(`Найден кэшированный токен для администратора ${adminUserId}`, 'scheduler');
        
        // Проверяем валидность токена
        try {
          const testResponse = await directusApiManager.request({
            url: '/users/me',
            method: 'get'
          }, cachedToken.token);
          
          if (testResponse?.data?.data) {
            log('Кэшированный токен администратора валиден', 'scheduler');
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
              return tokenInfo.token;
            }
          } catch (error: any) {
            log(`Токен из хранилища недействителен: ${error.message}`, 'scheduler');
          }
        }
      } catch (error: any) {
        log(`Ошибка при получении токена из хранилища: ${error.message}`, 'scheduler');
      }
      
      log('Не удалось получить действительный токен для планировщика', 'scheduler');
      return null;
    } catch (error: any) {
      log(`Ошибка при получении системного токена: ${error.message}`, 'scheduler');
      return null;
    }
  }

  /**
   * Проверяет и публикует запланированный контент 
   * Ищет ТОЛЬКО контент со статусом 'scheduled' и публикует его
   */
  async checkScheduledContent() {
    try {
      log('Проверка запланированных публикаций', 'scheduler');
      
      // Проверяем, не отключены ли публикации глобально
      if (this.disablePublishing) {
        log('ПРЕДУПРЕЖДЕНИЕ: Публикации отключены глобальным флагом disablePublishing=true', 'scheduler');
        log('Контент будет обнаружен, но не будет опубликован', 'scheduler');
      }
      
      // Проверяем запросы на извлечение токена
      checkTokenExtractionRequest();
      
      // Получаем системный токен для доступа ко всем публикациям
      const authToken = await this.getSystemToken();
      
      if (!authToken) {
        log('Ошибка: системный токен не получен, запланированные публикации не могут быть обработаны', 'scheduler');
        return;
      }
      
      // Пытаемся получить запланированные публикации
      let scheduledContent: CampaignContent[] = [];
      
      try {
        // Прямой запрос с параметрами фильтрации
        const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
        log(`Прямой запрос axios к ${directusUrl}/items/campaign_content с фильтром по статусу scheduled`, 'scheduler');
        
        const headers = {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        };
        
        // Запрос с фильтром ТОЛЬКО по статусу "scheduled"
        const response = await axios.get(`${directusUrl}/items/campaign_content`, {
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
        
        if (response?.data?.data) {
          const items = response.data.data;
          log(`Получено ${items.length} запланированных публикаций через API`, 'scheduler');
          
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
        log(`Ошибка при запросе запланированных публикаций: ${error.message}`, 'scheduler');
        
        if (error.response?.data) {
          log(`Ошибка API: ${JSON.stringify(error.response.data)}`, 'scheduler');
        }
        return; // Прерываем выполнение, так как эти данные критичны
      }
      
      if (scheduledContent.length === 0) {
        log('Запланированные публикации не найдены', 'scheduler');
        return;
      }
      
      log(`Найдено ${scheduledContent.length} запланированных публикаций`, 'scheduler');
      
      // Текущее время
      const now = new Date();
      
      // Фильтруем контент, время публикации которого уже наступило
      const contentToPublish = scheduledContent.filter(content => {
        // Если нет платформ для публикации, то пропускаем
        if (!content.socialPlatforms || Object.keys(content.socialPlatforms).length === 0) {
          log(`Контент ID ${content.id} "${content.title}" не имеет настроек социальных платформ, пропускаем`, 'scheduler');
          return false;
        }
        
        const now = new Date();
        let anyPlatformReady = false;
        let logMessages = [];
        
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
              logMessages.push(`${platform}: ГОТОВ К ПУБЛИКАЦИИ`);
              anyPlatformReady = true;
              
              // Устанавливаем статус 'pending' для этой платформы, если он еще не установлен
              // Это важно для корректной публикации
              if (content.socialPlatforms[platform] && content.socialPlatforms[platform].status !== 'pending') {
                log(`Устанавливаем статус 'pending' для платформы ${platform}`, 'scheduler');
                content.socialPlatforms[platform].status = 'pending';
              }
            }
          } else {
            logMessages.push(`${platform}: нет данных о времени публикации`);
          }
        }
        
        // Логируем результаты проверки времени для всего контента
        log(`Проверка времени публикации для контента ID ${content.id} "${content.title}":`, 'scheduler');
        logMessages.forEach(msg => log(`  - ${msg}`, 'scheduler'));
        
        // Если общее поле scheduledAt указано, логируем его значение, но НЕ используем для принятия решения
        if (content.scheduledAt) {
          const scheduledTime = new Date(content.scheduledAt);
          const timeUntilPublish = scheduledTime.getTime() - now.getTime();
          
          log(`  - Общее время: ${scheduledTime.toISOString()} (через ${Math.floor(timeUntilPublish / 1000 / 60)} мин.) - ИГНОРИРУЕТСЯ`, 'scheduler');
        }
        
        // Возвращаем true, если хотя бы одна платформа готова к публикации
        return anyPlatformReady;
      });
      
      if (contentToPublish.length === 0) {
        log('Нет контента, готового к публикации по времени', 'scheduler');
        return;
      }
      
      log(`Найдено ${contentToPublish.length} публикаций, готовых к публикации`, 'scheduler');
      
      // Проверяем каждый контент перед публикацией
      // Делаем последнюю проверку для каждого контента - получаем свежие данные
      const publishReadyContent = [];
      
      for (const content of contentToPublish) {
        try {
          // Делаем прямой запрос к Directus API для получения свежих данных
          const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
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
            
            // Проверяем основной статус контента - должен быть СТРОГО "scheduled"
            if (freshData.status !== 'scheduled') {
              log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" имеет статус ${freshData.status} вместо scheduled, пропускаем`, 'scheduler');
              continue;
            }
            
            // Удалена проверка на publishedAt - она не должна влиять на публикацию
            // т.к. может быть заполнена раньше, чем завершится публикация на всех платформах
            
            // Проверяем статус в платформах
            if (freshData.social_platforms && typeof freshData.social_platforms === 'object') {
              const socialPlatforms = freshData.social_platforms;
              
              // Сначала обновляем статусы на 'pending' для платформ, которые прошли время публикации
              const now = new Date();
              let platformsUpdated = false;
              
              for (const [platform, platformData] of Object.entries(socialPlatforms)) {
                // Пропускаем уже опубликованные платформы
                if (platformData?.status === 'published') {
                  continue;
                }
                
                // Если время публикации наступило, но статус не pending, устанавливаем его
                if (platformData?.scheduledAt) {
                  const platformScheduledTime = new Date(platformData.scheduledAt);
                  
                  if (platformScheduledTime <= now && platformData.status !== 'pending') {
                    log(`Обновляем статус для платформы ${platform} на 'pending', так как время публикации наступило`, 'scheduler');
                    socialPlatforms[platform].status = 'pending';
                    platformsUpdated = true;
                  }
                }
              }
              
              // Если были обновления, сохраняем их в БД
              if (platformsUpdated) {
                try {
                  log(`Сохраняем обновленные статусы платформ в БД для контента ${content.id}`, 'scheduler');
                  
                  const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
                  await axios.patch(
                    `${directusUrl}/items/campaign_content/${content.id}`,
                    {
                      social_platforms: socialPlatforms
                    },
                    {
                      headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                      }
                    }
                  );
                  
                  log(`Статусы платформ успешно обновлены для контента ${content.id}`, 'scheduler');
                } catch (error: any) {
                  log(`Ошибка при обновлении статусов платформ: ${error.message}`, 'scheduler');
                }
              }
              
              // Проверяем, сколько платформ имеют статус pending (ожидают публикации)
              const pendingPlatforms = Object.entries(socialPlatforms)
                .filter(([_, data]: [string, any]) => data && data.status === 'pending')
                .map(([platform, _]) => platform);
              
              // Проверяем, сколько платформ имеют статус опубликовано
              const publishedPlatforms = Object.entries(socialPlatforms)
                .filter(([_, data]: [string, any]) => data && data.status === 'published')
                .map(([platform, _]) => platform);
              
              log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" имеет опубликованный статус в соцсетях: ${publishedPlatforms.join(', ')}`, 'scheduler');
              log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" ожидает публикации в соцсетях: ${pendingPlatforms.join(', ')}`, 'scheduler');
              
              // Главное изменение логики: ПРОДОЛЖАЕМ публикацию если есть хотя бы одна платформа в статусе pending
              if (pendingPlatforms.length === 0) {
                log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" не имеет платформ, ожидающих публикации, пропускаем`, 'scheduler');
                continue;
              }
              
              // НЕ обновляем общий статус на published, даже если есть опубликованные платформы
              // Статус published будет установлен только когда ВСЕ платформы будут опубликованы
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
            const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
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
    try {
      if (!content.id || !content.campaignId) {
        log(`Контент с ID ${content.id} не содержит необходимой информации`, 'scheduler');
        return;
      }
      
      // Проверяем, был ли контент опубликован (только общий статус)
      if (content.status === 'published') {
        log(`ВНИМАНИЕ: Контент ${content.id} имеет глобальный статус "published", но проверим платформы`, 'scheduler');
        // Не останавливаем публикацию полностью - проверим каждую платформу отдельно
      }
      
      // Проверяем статус в социальных платформах, но ТОЛЬКО для логирования
      // Не блокируем публикацию, если какие-то платформы уже опубликованы
      if (content.socialPlatforms && typeof content.socialPlatforms === 'object') {
        // Находим опубликованные платформы (только для логирования)
        const publishedPlatforms = Object.entries(content.socialPlatforms)
          .filter(([_, data]: [string, any]) => data && data.status === 'published')
          .map(([platform, _]) => platform);
        
        if (publishedPlatforms.length > 0) {
          log(`ИНФОРМАЦИЯ: Контент ${content.id} уже имеет опубликованный статус на платформах: ${publishedPlatforms.join(', ')}`, 'scheduler');
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
      
      // Пробуем с системным токеном через прямой запрос
      if (systemToken) {
        try {
          const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
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
      const now = new Date();
      
      // Подробное логирование для диагностики
      log(`Проверка платформ для публикации контента ${content.id} "${content.title || ''}":`, 'scheduler');
      
      // Отфильтруем только те платформы, время публикации которых уже наступило
      const platformsToPublish = Object.entries(socialPlatforms)
        .filter(([platform, platformData]) => {
          // Если платформа уже опубликована, пропускаем
          if (platformData.status === 'published') {
            log(`  - ${platform}: статус "published", пропускаем`, 'scheduler');
            return false;
          }
          
          // Если у платформы есть своё scheduledAt, используем его для проверки
          if (platformData.scheduledAt) {
            const platformScheduledTime = new Date(platformData.scheduledAt);
            const diffMs = platformScheduledTime.getTime() - now.getTime();
            const diffMinutes = Math.floor(diffMs / 1000 / 60);
            
            if (platformScheduledTime > now) {
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
              return content.scheduledAt <= now;
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
            const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
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
        const publishUrl = `${appUrl}/api/publish/content`;
        
        // Используем тот же метод, что и при нажатии "Опубликовать сейчас" через API
        log(`Вызов API публикации для запланированного контента ${content.id} на платформе ${platform}`, 'scheduler');
        
        try {
          const apiResponse = await axios.post(publishUrl, {
            content,
            platforms: [platform],
            userId: content.userId,
            force: false // не используем принудительную публикацию для запланированного контента
          }, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          // Проверяем успешность публикации
          const resultFromApi = apiResponse.data?.results?.[platform];
          
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
        
        // Резервный вариант: публикуем через модульный сервис, если API метод не сработал
        log(`Использование резервного метода публикации для контента ${content.id} на платформе ${platform}`, 'scheduler');
        
        const result = await socialPublishingService.publishToPlatform(
          content,
          platform,
          socialSettings
        );

        // Обновляем статус публикации через модульный сервис socialPublishingService
        await socialPublishingService.updatePublicationStatus(
          content.id,
          platform,
          result
        );

        // Логируем результат
        if (result.status === 'published') {
          log(`Контент ${content.id} успешно опубликован в ${platform}`, 'scheduler');
          successfulPublications++;
        } else {
          log(`Ошибка при публикации контента ${content.id} в ${platform}: ${result.error}`, 'scheduler');
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
            
            // Если платформа находится в статусе pending, считаем её ожидающей публикации
            if (platformData.status === 'pending') {
              // Если есть scheduledAt, проверяем время
              if (platformData.scheduledAt) {
                const platformTime = new Date(platformData.scheduledAt);
                const now = new Date();
                log(`Проверка времени для непубликованной платформы ${platform}: ${platformTime.toISOString()} vs ${now.toISOString()}`, 'scheduler');
                
                // Проверяем, наступило ли время публикации или еще нет
                if (platformTime > now) {
                  // Время публикации ещё не наступило, считаем платформу ожидающей
                  log(`Платформа ${platform} запланирована на будущее время: ${platformTime.toISOString()}`, 'scheduler');
                  return true;
                } else {
                  // Время публикации наступило, но платформа не опубликована - возможно, была ошибка или задержка
                  log(`Платформа ${platform} должна была быть опубликована в ${platformTime.toISOString()}, но всё ещё в статусе pending`, 'scheduler');
                  return true; // Всё равно считаем ожидающей, так как статус pending
                }
              } else {
                // У платформы нет scheduledAt, но она в статусе pending - считаем ожидающей
                log(`Платформа ${platform} в статусе pending без установленного времени публикации`, 'scheduler');
                return true;
              }
            }
            
            return false; // Если платформа не в статусе pending, не считаем её ожидающей
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

export const publishScheduler = new PublishScheduler();