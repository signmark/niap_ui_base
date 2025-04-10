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
        if (!content.scheduledAt) return false;
        
        const scheduledTime = new Date(content.scheduledAt);
        const timeUntilPublish = scheduledTime.getTime() - now.getTime();
        
        // Логируем для каждого контента
        log(`Контент ID ${content.id} "${content.title}" запланирован на ${scheduledTime.toISOString()}, ` +
            `текущее время: ${now.toISOString()}, ` + 
            `разница: ${Math.floor(timeUntilPublish / 1000 / 60)} минут`, 'scheduler');
        
        return scheduledTime <= now;
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
            
            // Проверяем наличие publishedAt поля - если есть, значит контент уже опубликован
            if (freshData.published_at) {
              log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" уже имеет published_at = ${freshData.published_at}, пропускаем`, 'scheduler');
              continue;
            }
            
            // Проверяем статус в платформах
            if (freshData.social_platforms && typeof freshData.social_platforms === 'object') {
              const socialPlatforms = freshData.social_platforms;
              
              // Проверяем, есть ли хотя бы одна платформа со статусом published
              const anyPublished = Object.values(socialPlatforms).some(
                (platform: any) => platform && platform.status === 'published'
              );
              
              if (anyPublished) {
                log(`ПРОВЕРКА В БД: Контент ID ${content.id} "${content.title}" уже имеет опубликованный статус в соцсетях, пропускаем`, 'scheduler');
                // Обновляем общий статус на published
                log(`Обновление общего статуса на published для контента ${content.id}`, 'scheduler');
                
                await axios.patch(
                  `${directusUrl}/items/campaign_content/${content.id}`,
                  { 
                    status: 'published',
                    published_at: new Date().toISOString()
                  },
                  { headers: { 'Authorization': `Bearer ${authToken}` } }
                );
                continue;
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
      
      // ЖЕСТКАЯ проверка статуса ПЕРЕД публикацией
      // Проверяем, был ли контент уже опубликован (общий статус или любая платформа)
      if (content.status === 'published') {
        log(`БЛОКИРОВКА: Контент ${content.id} имеет глобальный статус "published", публикация остановлена`, 'scheduler');
        return;
      }
      
      // Проверяем статус в социальных платформах
      if (content.socialPlatforms && typeof content.socialPlatforms === 'object') {
        // Если хотя бы одна платформа имеет статус published, считаем контент опубликованным
        const anyPublished = Object.values(content.socialPlatforms).some(
          (platform: any) => platform && platform.status === 'published'
        );
        
        if (anyPublished) {
          log(`БЛОКИРОВКА: Контент ${content.id} уже имеет опубликованный статус в некоторых соцсетях, публикация остановлена`, 'scheduler');
          
          // Обновляем основной статус на published, если он ещё не установлен
          if (content.status !== 'published') {
            await storage.updateCampaignContent(content.id, {
              status: 'published'
            });
            log(`Обновлен глобальный статус контента ${content.id} на "published"`, 'scheduler');
          }
          
          return;
        }
      }

      log(`Публикация контента ${content.id}: "${content.title}"`, 'scheduler');

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
      const platformsToPublish = Object.keys(socialPlatforms) as SocialPlatform[];

      if (platformsToPublish.length === 0) {
        log(`Для контента ${content.id} не указаны платформы`, 'scheduler');
        
        // Обновляем статус - не передаем publishedAt напрямую, это внутреннее поле контента
        await storage.updateCampaignContent(content.id, {
          status: 'published'
        });
        
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
            
            const result = {
              platform,
              status: 'published',
              publishedAt: new Date(),
              // API может вернуть ссылку в postUrl или url, проверяем оба поля
              postUrl: resultFromApi.postUrl || resultFromApi.url || null,
              postId: resultFromApi.messageId || resultFromApi.postId || null,
              error: null
            };
            
            log(`Сформирован результат публикации с postUrl: ${result.postUrl}`, 'scheduler');
            
            // Обновляем статус публикации через модульный сервис с дополнительной проверкой
            // API должен обновить статус, но для надёжности делаем и здесь
            await socialPublishingService.updatePublicationStatus(content.id, platform, result);
            
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
      
      // Обновляем основной статус контента на "published", если:
      // 1. Есть хотя бы одна успешная публикация
      // 2. Все платформы уже были в статусе "published" (successfulPublications > 0 && totalAttempts === 0)
      if (successfulPublications > 0) {
        log(`Обновление основного статуса контента ${content.id} на "published" после успешной публикации в ${successfulPublications}/${platformsToPublish.length} платформах`, 'scheduler');
        
        try {
          // Сначала проверяем, что контент все еще существует в базе
          // Используем переданный токен авторизации
          const existingContent = await storage.getCampaignContentById(content.id, authToken);
          if (!existingContent) {
            log(`Контент с ID ${content.id} не найден в БД, обновление статуса невозможно`, 'scheduler');
            return;
          }
          
          // Обновляем статус с передачей токена авторизации
          await storage.updateCampaignContent(content.id, {
            status: 'published'
          }, authToken);
          
          log(`Статус контента ${content.id} успешно обновлен на published`, 'scheduler');
        } catch (updateError: any) {
          log(`Ошибка при обновлении статуса контента ${content.id}: ${updateError.message}`, 'scheduler');
        }
      }
    } catch (error: any) {
      log(`Ошибка при публикации контента ${content.id}: ${error.message}`, 'scheduler');
    }
  }
}

export const publishScheduler = new PublishScheduler();