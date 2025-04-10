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
 * Проверяет и корректирует URL поста в Telegram
 * @param url Исходный URL
 * @param platform Платформа
 * @param messageId ID сообщения или поста
 * @returns Корректный URL
 */
function ensureValidTelegramUrl(url: string | undefined, platform: string, messageId: string | undefined): string {
  // Если URL не определен, возвращаем пустую строку
  if (!url) return '';
  
  // Логируем параметры для отладки
  log(`Проверка URL: ${url}, платформа: ${platform}, messageId: ${messageId}`, 'scheduler');
  
  // Обрабатываем URL для Telegram
  if (platform === 'telegram') {
    // Проверяем формат URL для приватных каналов Telegram
    // URL не содержит ID сообщения (проверяем, что после /c/NUMBER нет дальнейших слешей)
    if (url.includes('/c/') && !url.includes('/', url.indexOf('/c/') + 3)) {
      // URL не содержит ID сообщения - нужно добавить messageId
      // Пример URL: https://t.me/c/230236310 -> https://t.me/c/230236310/123
      const fixedUrl = `${url}/${messageId}`;
      log(`Исправление URL для Telegram: ${url} -> ${fixedUrl}`, 'scheduler');
      return fixedUrl;
    }
  }
  
  // Для других платформ или если URL уже корректный, возвращаем без изменений
  return url;
}

/**
 * Класс для планирования и выполнения автоматической публикации контента
 */
export class PublishScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 60000; // проверяем каждую минуту
  // Для обратной совместимости со старым кодом (временное решение)
  // При перезапуске сервера список очищается
  
  /**
   * Проверяет и корректирует URL поста в зависимости от платформы
   * @param url Исходный URL
   * @param platform Платформа
   * @param messageId ID сообщения или поста
   * @returns Корректный URL
   */
  private ensureValidPostUrl(url: string | undefined, platform: string, messageId: string | undefined): string {
    // Если URL не определен, возвращаем пустую строку
    if (!url) return '';
    
    // Логируем параметры для отладки
    log(`Проверка URL: ${url}, платформа: ${platform}, messageId: ${messageId}`, 'scheduler');
    
    // Обрабатываем URL для Telegram
    if (platform === 'telegram') {
      // Проверяем формат URL для приватных каналов Telegram
      if (url.includes('/c/') && !url.includes('/', url.indexOf('/c/') + 3)) {
        // URL не содержит ID сообщения - нужно добавить messageId
        // Пример URL: https://t.me/c/230236310 -> https://t.me/c/230236310/123
        const fixedUrl = `${url}/${messageId}`;
        log(`Исправление URL для Telegram: ${url} -> ${fixedUrl}`, 'scheduler');
        return fixedUrl;
      }
    }
    
    // Для других платформ или если URL уже корректный, возвращаем без изменений
    return url;
  }
  private processedContentIds = new Set<string>();
  
  // Инициализируем пустой список при создании экземпляра класса
  constructor() {
    this.processedContentIds.clear();
    log('Планировщик публикаций инициализирован с пустым списком обработанных контентов', 'scheduler');
  }

  /**
   * Запускает планировщик публикаций
   */
  public start(): void {
    if (this.isRunning) {
      log('Планировщик публикаций уже запущен', 'scheduler');
      return;
    }

    log('Запуск планировщика публикаций', 'scheduler');
    this.isRunning = true;

    // Сразу делаем первую проверку
    this.checkScheduledContent().catch(error => {
      log(`Ошибка при первой проверке запланированного контента: ${error}`, 'scheduler');
    });

    // Настраиваем интервальную проверку
    this.intervalId = setInterval(() => {
      this.checkScheduledContent().catch(error => {
        log(`Ошибка при проверке запланированного контента: ${error}`, 'scheduler');
      });
    }, this.checkIntervalMs);
  }

  /**
   * Останавливает планировщик публикаций
   */
  public stop(): void {
    if (!this.isRunning) {
      log('Планировщик публикаций не запущен', 'scheduler');
      return;
    }

    log('Остановка планировщика публикаций', 'scheduler');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * Публичный метод для добавления ID контента в список обработанных
   * @param contentId ID контента
   */
  public addProcessedContentId(contentId: string): void {
    this.processedContentIds.add(contentId);
    log(`ID ${contentId} добавлен в список обработанных через публичный метод`, 'scheduler');
  }

  /**
   * Получает токен администратора для авторизации запросов к API
   * @returns Токен администратора
   */
  public async getSystemToken(): Promise<string | null> {
    log('Получение системного токена для авторизации запросов', 'scheduler');
    try {
      // Используем переменные окружения
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;

      if (!email || !password) {
        log('Не найдены учетные данные администратора в переменных окружения', 'scheduler');
        return null;
      }

      log('Попытка авторизации администратора с учетными данными из env', 'scheduler');
      
      // Пробуем получить токен напрямую через API
      try {
        const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
        const response = await axios.post(`${directusUrl}/auth/login`, {
          email,
          password
        });

        if (response.data && response.data.data && response.data.data.access_token) {
          log('Авторизация администратора успешна через прямой API запрос', 'scheduler');
          return response.data.data.access_token;
        }
      } catch (error: any) {
        log(`Ошибка API при получении токена: ${error.message}`, 'scheduler');
      }

      // Пробуем получить токен через directusApiManager
      try {
        const authData = await directusApiManager.auth.login({
          email,
          password
        });

        if (authData && authData.access_token) {
          return authData.access_token;
        }
      } catch (error: any) {
        log(`Ошибка directusApiManager при получении токена: ${error.message}`, 'scheduler');
      }

      // Пробуем через DirectusCrud
      try {
        const adminSession = await directusCrud.authenticateUser(email, password);
        if (adminSession && adminSession.token) {
          log('Сессия администратора добавлена в DirectusAuthManager', 'scheduler');
          return adminSession.token;
        }
      } catch (error: any) {
        log(`Ошибка directusCrud при получении токена: ${error.message}`, 'scheduler');
      }

      log('Не удалось получить токен администратора', 'scheduler');
      return null;
    } catch (error: any) {
      log(`Ошибка при получении токена администратора: ${error.message}`, 'scheduler');
      return null;
    }
  }

  /**
   * Проверяет запланированный контент и публикует его при необходимости
   */
  private async checkScheduledContent(): Promise<void> {
    log('Проверка запланированных публикаций', 'scheduler');

    try {
      // Получаем токен для авторизации запросов
      const authToken = await this.getSystemToken();
      if (!authToken) {
        log('Не удалось получить токен для проверки запланированных публикаций', 'scheduler');
        return;
      }
      
      // Подробно логируем полученный токен для отладки (только первые 15 символов)
      if (authToken) {
        log(`Получен токен авторизации для работы с API (первые 15 символов): ${authToken.substring(0, 15)}...`, 'scheduler');
      }

      // Получаем список запланированных публикаций
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      const currentDate = new Date().toISOString();

      // Фильтр для запроса: контент со статусом "scheduled" и scheduled_at <= текущее время
      // Directus API использует snake_case для имен полей
      const filter = {
        status: { _eq: 'scheduled' },
        scheduled_at: { 
          _lte: currentDate,
          _nnull: true // Поле должно быть не null
        }
      };
      
      // Дополнительно логируем SQL-запрос, который будет сгенерирован
      log(`SQL-подобный запрос: SELECT * FROM campaign_content WHERE status = 'scheduled' AND scheduled_at <= '${currentDate}' AND scheduled_at IS NOT NULL`, 'scheduler');
      
      log(`Дата проверки шедулера: ${currentDate}`, 'scheduler');

      log(`Прямой запрос axios к ${directusUrl}/items/campaign_content с фильтром по статусу scheduled`, 'scheduler');
      
      const response = await axios.get(`${directusUrl}/items/campaign_content`, {
        params: {
          filter: JSON.stringify(filter),
          sort: 'scheduled_at'
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      // Проверяем наличие запланированных публикаций
      const scheduledContent = response.data.data || [];
      log(`Получено ${scheduledContent.length} запланированных публикаций через API`, 'scheduler');

      if (scheduledContent.length === 0) {
        log('Запланированные публикации не найдены', 'scheduler');
        return;
      }

      // Обрабатываем каждую запланированную публикацию
      for (const content of scheduledContent) {
        await this.processScheduledContent(content, authToken);
      }
    } catch (error: any) {
      log(`Ошибка при проверке запланированных публикаций: ${error.message}`, 'scheduler');
    }
  }

  /**
   * Обрабатывает запланированный контент
   * @param content Запланированный контент
   * @param authToken Токен для авторизации запросов
   */
  private async processScheduledContent(content: CampaignContent, authToken: string): Promise<void> {
    try {
      log(`Обработка запланированного контента ${content.id}`, 'scheduler');

      // УДАЛЕНО: Проверка на уже обработанный контент теперь полностью отключена
      // Вместо этого мы будем полагаться на статусы публикаций в БД

      // Добавляем ID в список обработанных ПОСЛЕ проверки наличия платформ
      // (перенесено ниже)

      // Проверяем наличие платформ для публикации
      // Дополнительное логирование для отладки
      log(`Тип socialPlatforms: ${typeof content.socialPlatforms}`, 'scheduler');
      log(`Значение socialPlatforms: ${JSON.stringify(content.socialPlatforms)}`, 'scheduler');
      log(`Тип social_platforms: ${typeof content.social_platforms}`, 'scheduler');
      log(`Значение social_platforms: ${JSON.stringify(content.social_platforms)}`, 'scheduler');
      
      // Используем правильное имя поля в зависимости от типа API
      // Directus API возвращает CamelCase, но в Directus UI используется snake_case
      // Чтобы исключить неоднозначность и ошибки, проверяем оба варианта
      
      let socialPlatforms = null;
      
      // Проверяем наличие поля social_platforms (snake_case вариант - обычно из Directus API)
      if (content.social_platforms !== undefined && content.social_platforms !== null) {
        log(`Найдено поле social_platforms в snake_case формате`, 'scheduler');
        socialPlatforms = content.social_platforms;
      } 
      // Проверяем наличие поля socialPlatforms (camelCase вариант - обычно из кода)
      else if (content.socialPlatforms !== undefined && content.socialPlatforms !== null) {
        log(`Найдено поле socialPlatforms в camelCase формате`, 'scheduler');
        socialPlatforms = content.socialPlatforms;
      }
      
      // Если поле получено как строка (часто из Directus), преобразуем его в объект
      if (typeof socialPlatforms === 'string') {
        try {
          log(`Попытка разбора socialPlatforms из строки: ${socialPlatforms}`, 'scheduler');
          socialPlatforms = JSON.parse(socialPlatforms);
          log(`После разбора тип: ${typeof socialPlatforms}`, 'scheduler');
        } catch (e) {
          log(`Ошибка при разборе socialPlatforms для ${content.id}: ${e}`, 'scheduler');
          socialPlatforms = {};
        }
      }
      
      // Если socialPlatforms все еще null или undefined, создаем пустой объект для безопасности
      if (socialPlatforms === null || socialPlatforms === undefined) {
        log(`social_platforms и socialPlatforms не найдены, создаем пустой объект`, 'scheduler');
        socialPlatforms = {};
      }
      
      // Проверяем наличие платформ с улучшенной обработкой
      const hasSocialPlatforms = socialPlatforms && 
                              typeof socialPlatforms === 'object' &&
                              Object.keys(socialPlatforms).length > 0;
                              
      // Подробный лог после проверки
      log(`hasSocialPlatforms: ${hasSocialPlatforms}, тип после обработки: ${typeof socialPlatforms}`, 'scheduler');
      if (socialPlatforms) {
        log(`Количество платформ: ${Object.keys(socialPlatforms).length}`, 'scheduler');
      }
      
      if (!hasSocialPlatforms) {
        log(`Контент ${content.id} не имеет привязанных социальных платформ. Вот его данные:`, 'scheduler');
        log(JSON.stringify(content), 'scheduler');
        return;
      }
      
      log(`Контент ${content.id} имеет привязанные социальные платформы:`, 'scheduler');
      log(JSON.stringify(socialPlatforms), 'scheduler');
      
      // Логируем платформы для диагностики
      log(`Найдены следующие платформы для контента ${content.id}: ${Object.keys(socialPlatforms).join(', ')}`, 'scheduler');
      
      // Добавляем ID в список обработанных только если контент имеет платформы
      this.processedContentIds.add(content.id);

      // Получаем список платформ для публикации
      const platformsToPublish: SocialPlatform[] = [];
      
      // Логируем все платформы для отладки
      log(`Все платформы в контенте: ${JSON.stringify(socialPlatforms)}`, 'scheduler');
      
      for (const [platform, settings] of Object.entries(socialPlatforms)) {
        // Подробный лог о типах данных
        log(`Платформа ${platform} (тип: ${typeof platform}) с настройками ${JSON.stringify(settings)} (тип: ${typeof settings})`, 'scheduler');
        
        // ИСПРАВЛЕНО: Улучшена логика обработки платформ
        // 1. Проверяем наличие настроек
        // 2. Любая платформа со статусом null или undefined устанавливается в 'pending'
        // 3. Обработка разных статусов
        
        if (settings) {
          // Получаем текущий статус (если его нет, считаем равным 'pending')
          const statusValue = settings.status || 'pending';
          log(`Статус для платформы ${platform}: "${statusValue}" (тип: ${typeof statusValue})`, 'scheduler');
          
          // ИЗМЕНЕНО: Обрабатываем любой статус, кроме 'published'
          if (statusValue !== 'published') {
            // Если статус не 'pending', обновляем его в БД
            if (statusValue !== 'pending') {
              log(`Платформа ${platform} имеет статус ${statusValue}, меняем на pending для публикации`, 'scheduler');
              
              try {
                // Создаем полный объект socialPlatforms с обновленным статусом
                const updatedSocialPlatforms = { ...socialPlatforms };
                updatedSocialPlatforms[platform] = { 
                  ...settings, 
                  status: 'pending',
                  error: null // сбрасываем ошибку
                };
                
                // Обновляем контент в базе данных
                await storage.updateCampaignContent(content.id, {
                  socialPlatforms: updatedSocialPlatforms
                }, authToken);
                
                log(`Статус платформы ${platform} для контента ${content.id} обновлен в БД: status=pending, error=null`, 'scheduler');
              } catch (updateError) {
                log(`Ошибка при обновлении статуса платформы в БД: ${updateError}`, 'scheduler');
              }
            } else {
              log(`Платформа ${platform} уже имеет статус pending`, 'scheduler');
            }
            
            // Добавляем платформу для публикации в любом случае (кроме 'published')
            platformsToPublish.push(platform as SocialPlatform);
            log(`Платформа ${platform} добавлена в список для публикации`, 'scheduler');
          } else {
            log(`Платформа ${platform} имеет статус published и не будет обработана повторно`, 'scheduler');
          }
        } else {
          log(`Настройки для платформы ${platform} отсутствуют, пропускаем`, 'scheduler');
        }
      }

      if (platformsToPublish.length === 0) {
        log(`Контент ${content.id} не имеет платформ со статусом pending`, 'scheduler');
        return;
      }

      log(`Платформы для публикации контента ${content.id}: ${platformsToPublish.join(', ')}`, 'scheduler');

      // Получаем настройки социальных сетей для контента
      log(`Запрос настроек кампании ${content.campaignId} для получения настроек соцсетей`, 'scheduler');
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      const campaignUrl = `${directusUrl}/items/campaigns/${content.campaignId}`;
      log(`URL для получения настроек кампании: ${campaignUrl}`, 'scheduler');
      
      // Создаем константы для тестирования (временное решение)
      // Внимание: В реальном коде получать настройки из API
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
      const VK_ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN;
      const VK_GROUP_ID = process.env.VK_GROUP_ID;
      
      if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        log(`Отсутствуют переменные окружения для настроек Telegram. Пожалуйста, проверьте наличие TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID`, 'scheduler');
      }
      
      if (!VK_ACCESS_TOKEN || !VK_GROUP_ID) {
        log(`Отсутствуют переменные окружения для настроек VK. Пожалуйста, проверьте наличие VK_ACCESS_TOKEN и VK_GROUP_ID`, 'scheduler');
      }
      
      // Подробно логируем все переменные окружения (без их значений)
      Object.keys(process.env).forEach(key => {
        if (key.includes('TELEGRAM') || key.includes('VK') || key.includes('INSTAGRAM')) {
          log(`Найдена переменная окружения: ${key} = ${key.includes('TOKEN') || key.includes('KEY') ? '[скрыто]' : process.env[key]}`, 'scheduler');
        }
      });
      
      // Пытаемся выполнить запрос к API для получения настроек кампании
      let campaignResponse;
      try {
        campaignResponse = await axios.get(campaignUrl, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
      } catch (error: any) {
        // Если возникла ошибка доступа, используем временное решение с переменными окружения
        log(`Ошибка при запросе настроек кампании: ${error.message}. Используем настройки из переменных окружения`, 'scheduler');
        
        // Создаем имитацию ответа API со значениями из переменных окружения
        campaignResponse = {
          data: {
            data: {
              id: content.campaignId,
              socialMediaSettings: {
                telegram: {
                  token: TELEGRAM_BOT_TOKEN,
                  chatId: TELEGRAM_CHAT_ID
                },
                vk: {
                  token: VK_ACCESS_TOKEN,
                  groupId: VK_GROUP_ID
                }
              }
            }
          },
          status: 200
        };
      }
      
      // Выводим ответ для отладки
      log(`Получен ответ API для кампании: статус ${campaignResponse.status}`, 'scheduler');
      if (campaignResponse.data) {
        log(`Данные в ответе: ${JSON.stringify(campaignResponse.data).substring(0, 200)}...`, 'scheduler');
      }

      if (!campaignResponse.data || !campaignResponse.data.data) {
        log(`Не удалось получить настройки кампании ${content.campaignId}`, 'scheduler');
        return;
      }

      const campaign = campaignResponse.data.data;
      const socialSettings = campaign.socialMediaSettings || {};

      // Счетчики для отслеживания успешных публикаций и всех попыток
      let successfulPublications = 0;
      let totalAttempts = 0;

      // Публикуем контент в каждую платформу
      for (const platform of platformsToPublish) {
        // Проверяем, не был ли контент уже опубликован в эту платформу
        const platformSettings = socialPlatforms[platform];
        
        if (platformSettings && platformSettings.status === 'published') {
          log(`Контент ${content.id} уже опубликован в ${platform}`, 'scheduler');
          successfulPublications++;
          continue;
        }

        totalAttempts++;

        // Убедимся, что метаданные проинициализированы
        if (!content.metadata) {
          content.metadata = {};
        }
        
        log(`Публикация запланированного контента ${content.id} на платформу ${platform}`, 'scheduler');
        
        // ПРЯМОЙ ВЫЗОВ СЕРВИСА ПУБЛИКАЦИИ - используем тот же код, что и для моментальной публикации
        log(`Прямой вызов socialPublishingService.publishToPlatform для контента ${content.id}`, 'scheduler');
        
        // Получаем объект кампании для использования в сервисе публикации
        // ИСПРАВЛЕНО: Передаем полные настройки кампании, полученные ранее
        const campaignObject = {
          id: content.campaignId,
          socialMediaSettings: socialSettings
        };
        
        // Вызываем общий сервис публикации - ТОТ ЖЕ КОД, что и для моментальной публикации через API
        // ИСПРАВЛЕНО: Преобразуем platform в строку, если она не является строкой
        // Этот код предотвращает передачу объекта вместо строки
        const platformName = typeof platform === 'string' ? platform : (platform as any).toString();
        
        log(`Передаем platformName=${platformName} (тип: ${typeof platformName}) в socialPublishingService.publishToPlatform`, 'scheduler');
        log(`Настройки социальных сетей: ${JSON.stringify(socialSettings)}`, 'scheduler');
        
        const result = await socialPublishingService.publishToPlatform(
          platformName as SocialPlatform, 
          content, 
          campaignObject,
          authToken
        );
        
        // Логируем результат публикации
        log(`Результат публикации для ${platform}: ${JSON.stringify(result)}`, 'scheduler');
        
        // Обновляем статус публикации
        try {
          log(`Обновление статуса публикации для platform=${platform}`, 'scheduler');
          
          // Формируем структуру результата (для socialPublishingService.updatePublicationStatus)
          // ИСПРАВЛЕНО: Преобразуем platform в строку для корректного формирования объекта
          const platformNameForResult = typeof platform === 'string' ? platform : (platform as any).toString();
          // Формируем объект результата публикации с улучшенной обработкой URL
          const publicationResult = {
            status: 'published' as const,
            platform: platformNameForResult as SocialPlatform, // используем строку вместо объекта
            publishedAt: new Date(),
            // Дополнительная проверка URL для Telegram - убедиться, что ссылка содержит message_id
            postUrl: ensureValidTelegramUrl(result.postUrl || result.url, platformNameForResult, result.messageId || result.postId),
            postId: result.messageId || result.postId,
            error: null
          };
          
          // Логируем результирующий URL для отладки
          log(`Финальный URL для платформы ${platform}: ${publicationResult.postUrl}`, 'scheduler');
          
          // ИСПРАВЛЕНО: Преобразуем platform в строку, если она не является строкой
          // для корректной передачи в метод updatePublicationStatus
          const platformNameForUpdate = typeof platform === 'string' ? platform : (platform as any).toString();
          log(`Передаем platformNameForUpdate=${platformNameForUpdate} (тип: ${typeof platformNameForUpdate}) в updatePublicationStatus`, 'scheduler');
          await socialPublishingService.updatePublicationStatus(content.id, platformNameForUpdate as SocialPlatform, publicationResult);
          log(`Статус публикации успешно обновлен для ${platform}`, 'scheduler');
          
          // Отмечаем успешную публикацию
          successfulPublications++;
          log(`Контент ${content.id} успешно опубликован в ${platform}`, 'scheduler');
        } catch (updateError) {
          log(`Ошибка при обновлении статуса публикации: ${updateError}`, 'scheduler');
          log(`Ошибка при публикации контента ${content.id} в ${platform}: ${updateError}`, 'scheduler');
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