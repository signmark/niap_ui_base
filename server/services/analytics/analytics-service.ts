/**
 * Сервис аналитики для работы с данными публикаций
 * Обеспечивает сбор и агрегацию статистики из социальных сетей
 */

import { directusCrud } from '../directus-crud';
import { log } from '../../utils/logger';
import { getTelegramAnalytics } from './telegram-analytics';
import { getVkAnalytics } from './vk-analytics';
import { getInstagramAnalytics } from './instagram-analytics';
import { getFacebookAnalytics } from './facebook-analytics';
import { extractTelegramIds, extractVkIds, extractInstagramId, extractFacebookId } from './url-extractor';
import axios from 'axios';
import { directusAuthManager } from '../directus-auth-manager';

// Статус обработки аналитики 
interface AnalyticsCollectionStatus {
  isCollecting: boolean;
  lastCollectionTime: string | null;
  progress: number; // 0-100%
  error: string | null;
}

// Глобальное состояние процесса сбора аналитики
const analyticsStatus: AnalyticsCollectionStatus = {
  isCollecting: false,
  lastCollectionTime: null,
  progress: 0,
  error: null
};

/**
 * Метрики аналитики для каждой платформы
 */
export interface PlatformMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement?: number;
  engagementRate?: number;
  [key: string]: any;
}

/**
 * Агрегированные метрики по всем платформам
 */
export interface AggregatedMetrics {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalEngagement: number;
  averageEngagementRate: number;
  platformDistribution: {
    [platform: string]: {
      posts: number;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      engagement: number;
      engagementRate: number;
    }
  };
}

/**
 * Получает статус текущего процесса сбора аналитики
 */
export function getAnalyticsStatus(): AnalyticsCollectionStatus {
  return { ...analyticsStatus };
}

/**
 * Обрабатывает ошибку сбора аналитики
 * @param error Объект ошибки
 */
function handleAnalyticsError(error: any): void {
  log.error(`[analytics-service] Ошибка сбора аналитики: ${error.message}`);
  analyticsStatus.isCollecting = false;
  analyticsStatus.error = error.message;
}

/**
 * Инициализирует структуру аналитики для поста, если она отсутствует
 * @param post Пост с социальными платформами
 * @returns Обновленный пост с инициализированной аналитикой
 */
function initializeAnalyticsStructure(post: any): any {
  const updatedPost = { ...post };
  
  if (!updatedPost.social_platforms) {
    return updatedPost;
  }

  Object.keys(updatedPost.social_platforms).forEach(platform => {
    const platformData = updatedPost.social_platforms[platform];
    
    // Пропускаем, если платформа не опубликована или нет URL
    if (platformData.status !== 'published' || !platformData.postUrl) {
      return;
    }
    
    // Создаем структуру аналитики, если она отсутствует
    if (!platformData.analytics) {
      updatedPost.social_platforms[platform].analytics = {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  });
  
  return updatedPost;
}

/**
 * Получает настройки социальных сетей для кампании
 * @param campaignId ID кампании
 * @returns Объект с настройками социальных сетей или fallback настройки в случае ошибки
 */
async function getCampaignSocialSettings(campaignId: string): Promise<any> {
  try {
    // Используем прямой axios запрос вместо directusCrud
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    
    // Пытаемся получить токен администратора
    const adminSession = await directusAuthManager.getAdminSession();
    
    if (!adminSession || !adminSession.token) {
      log.warn('[analytics-service] Не удалось получить токен администратора');
      return getDefaultSocialSettings();
    }
    
    // Запрашиваем информацию о кампании напрямую через axios
    const response = await axios.get(`${directusUrl}/items/campaigns`, {
      params: {
        filter: { id: { _eq: campaignId } },
        fields: ['id', 'social_media_settings']
      },
      headers: {
        'Authorization': `Bearer ${adminSession.token}`
      }
    });
    
    const campaigns = response.data?.data || [];
    
    if (!campaigns || campaigns.length === 0) {
      log.warn(`[analytics-service] Не найдена кампания с ID ${campaignId}`);
      // Если кампания не найдена, возвращаем настройки по умолчанию
      return getDefaultSocialSettings();
    }
    
    return campaigns[0].social_media_settings || getDefaultSocialSettings();
  } catch (error: any) {
    log.error(`[analytics-service] Ошибка получения настроек кампании: ${error.message}`);
    // В случае ошибки возвращаем настройки по умолчанию
    return getDefaultSocialSettings();
  }
}

/**
 * Возвращает настройки социальных сетей по умолчанию
 * @returns Объект с настройками социальных сетей по умолчанию
 */
function getDefaultSocialSettings(): any {
  // Загружаем настройки из переменных окружения или используем дефолтные
  return {
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU',
      chatId: process.env.TELEGRAM_CHAT_ID
    },
    vk: {
      access_token: process.env.VK_ACCESS_TOKEN,
      owner_id: process.env.VK_OWNER_ID
    },
    instagram: {
      access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
      business_account_id: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
    },
    facebook: {
      access_token: process.env.FACEBOOK_ACCESS_TOKEN || 'EAA520SFRtvcBO9Y7LhiiZBqwsqdZCP9JClMUoJZCvjsSc8qs9aheLdWefOqrZBLQhe5T0ZBerS6mZAZAP6D4i8Ln5UBfiIyVEif1LrzcAzG6JNrhW2DJeEzObpp9Mzoh8tDZA9I0HigkLnFZCaJVZCQcGDAkZBRxwnVimZBdbvokeg19i5RuGTbfuFs9UC9R',
      page_id: process.env.FACEBOOK_PAGE_ID
    }
  };
}

/**
 * Собирает аналитику для всех постов, опубликованных в рамках указанной кампании
 * @param campaignId ID кампании
 * @returns Промис с результатами сбора аналитики
 */
export async function collectAnalytics(campaignId: string, authToken?: string): Promise<boolean> {
  try {
    // Если процесс сбора уже запущен, возвращаем false
    if (analyticsStatus.isCollecting) {
      log.warn('[analytics-service] Сбор аналитики уже запущен');
      return false;
    }
    
    // Устанавливаем начальное состояние
    analyticsStatus.isCollecting = true;
    analyticsStatus.progress = 0;
    analyticsStatus.error = null;
    
    log.info(`[analytics-service] Начало сбора аналитики для кампании ${campaignId}`);
    
    // Получаем настройки социальных сетей для кампании
    const socialSettings = await getCampaignSocialSettings(campaignId);
    
    // Теперь не нужно проверять на null, так как функция всегда возвращает настройки (либо из кампании, либо дефолтные)
    log.info(`[analytics-service] Получены настройки социальных сетей для кампании ${campaignId}`);
    
    
    // Формируем запрос на получение опубликованных постов
    const filter: any = {
      status: { _eq: 'published' }
    };
    
    // Добавляем фильтр по кампании
    // Используем правильное имя поля campaign_id
    filter.campaign_id = { _eq: campaignId };
    
    // Получаем все опубликованные посты с использованием прямого axios запроса
    let posts = [];
    try {
      // Получаем токен администратора
      const adminSession = await directusAuthManager.getAdminSession();
      const token = authToken || (adminSession ? adminSession.token : null);
      
      if (!token) {
        throw new Error('Не удалось получить токен для запроса постов');
      }
      
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      
      // Делаем запрос через axios
      const response = await axios.get(`${directusUrl}/items/campaign_content`, {
        params: {
          filter,
          fields: ['id', 'title', 'content', 'campaign_id', 'social_platforms', 'created_at']
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      posts = response.data?.data || [];
      
      log.info(`[analytics-service] Найдено ${posts.length} постов для обработки`);
    } catch (postsError: any) {
      log.error(`[analytics-service] Ошибка при получении постов: ${postsError.message}`);
      // Завершаем сбор аналитики, если не удалось получить посты
      analyticsStatus.isCollecting = false;
      analyticsStatus.progress = 100;
      analyticsStatus.lastCollectionTime = new Date().toISOString();
      analyticsStatus.error = `Ошибка доступа к контенту: ${postsError.message}`;
      return false;
    }
    
    if (posts.length === 0) {
      log.info('[analytics-service] Нет постов для обработки');
      analyticsStatus.isCollecting = false;
      analyticsStatus.progress = 100;
      analyticsStatus.lastCollectionTime = new Date().toISOString();
      return true;
    }
    
    // Обрабатываем посты последовательно с обновлением прогресса
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      let updatedPost = initializeAnalyticsStructure(post);
      
      // Пропускаем, если нет данных о социальных платформах
      if (!updatedPost.social_platforms) {
        continue;
      }
      
      // Обрабатываем каждую платформу отдельно
      for (const platform of Object.keys(updatedPost.social_platforms)) {
        const platformData = updatedPost.social_platforms[platform];
        
        // Пропускаем, если платформа не опубликована или нет URL
        if (platformData.status !== 'published' || !platformData.postUrl) {
          continue;
        }
        
        try {
          // Собираем аналитику в зависимости от платформы
          let metrics: PlatformMetrics | null = null;
          
          switch (platform) {
            case 'telegram':
              const telegramSettings = socialSettings?.telegram || {};
              const telegramIds = extractTelegramIds(platformData.postUrl);
              if (telegramIds && telegramIds.chatId && telegramIds.messageId && telegramSettings.token) {
                metrics = await getTelegramAnalytics(telegramIds.chatId, telegramIds.messageId, telegramSettings.token);
              }
              break;
              
            case 'vk':
              const vkSettings = socialSettings?.vk || {};
              const vkIds = extractVkIds(platformData.postUrl);
              if (vkIds && vkIds.ownerId && vkIds.postId && vkSettings.access_token) {
                metrics = await getVkAnalytics(vkIds.ownerId, vkIds.postId, vkSettings.access_token);
              }
              break;
              
            case 'instagram':
              const instagramSettings = socialSettings?.instagram || {};
              const mediaId = extractInstagramId(platformData.postUrl);
              if (mediaId && instagramSettings.access_token) {
                metrics = await getInstagramAnalytics(mediaId, instagramSettings.access_token);
              }
              break;
              
            case 'facebook':
              const facebookSettings = socialSettings?.facebook || {};
              const fbPostId = extractFacebookId(platformData.postUrl);
              if (fbPostId && facebookSettings.access_token) {
                metrics = await getFacebookAnalytics(fbPostId, facebookSettings.access_token);
              }
              break;
              
            default:
              log.warn(`[analytics-service] Неизвестная платформа: ${platform}`);
              continue;
          }
          
          // Обновляем аналитику, если она получена
          if (metrics) {
            updatedPost.social_platforms[platform].analytics = {
              ...metrics,
              lastUpdated: new Date().toISOString()
            };
            
            log.info(`[analytics-service] Собрана аналитика для поста ${post.id} на платформе ${platform}`);
          }
        } catch (error: any) {
          log.error(`[analytics-service] Ошибка сбора аналитики для поста ${post.id} на платформе ${platform}: ${error.message}`);
          // Продолжаем обработку других платформ
        }
      }
      
      // Сохраняем обновленный пост в Directus с использованием прямого axios запроса
      try {
        // Получаем токен администратора для обновления
        const adminSession = await directusAuthManager.getAdminSession();
        const token = authToken || (adminSession ? adminSession.token : null);
        
        if (!token) {
          throw new Error('Не удалось получить токен для обновления поста');
        }
        
        const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
        
        // Отправляем PATCH запрос для обновления данных
        await axios.patch(
          `${directusUrl}/items/campaign_content/${post.id}`, 
          { social_platforms: updatedPost.social_platforms },
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        log.info(`[analytics-service] Обновлены данные аналитики для поста ${post.id}`);
      } catch (updateError: any) {
        log.error(`[analytics-service] Ошибка обновления поста ${post.id}: ${updateError.message}`);
        // Продолжаем обработку других постов даже если не удалось обновить текущий
      }
      
      // Обновляем прогресс
      analyticsStatus.progress = Math.round(((i + 1) / posts.length) * 100);
    }
    
    // Завершаем процесс сбора
    analyticsStatus.isCollecting = false;
    analyticsStatus.lastCollectionTime = new Date().toISOString();
    analyticsStatus.progress = 100;
    
    log.info(`[analytics-service] Сбор аналитики завершен успешно`);
    return true;
  } catch (error: any) {
    handleAnalyticsError(error);
    return false;
  }
}

/**
 * Получает топ публикаций по просмотрам и вовлеченности для кампании
 * @param userId ID пользователя
 * @param campaignId ID кампании
 * @param period Период, за который нужно получить данные (в днях)
 * @returns Промис с топовыми публикациями
 */
export async function getTopPosts(userId: string, campaignId?: string, period: number = 7): Promise<{ topByViews: any[], topByEngagement: any[] }> {
  try {
    // Формируем запрос на получение опубликованных постов
    const filter: any = {
      user_id: { _eq: userId },
      status: { _eq: 'published' }
    };
    
    // Добавляем фильтр по кампании, если он указан
    if (campaignId) {
      // Используем только поле campaign_id
      filter.campaign_id = { _eq: campaignId };
    }
    
    // ВАЖНО: Не используем фильтр по created_at, так как нам нужно получить ВСЕ опубликованные посты 
    // для последующей фильтрации по полю publishedAt внутри social_platforms
    
    // Получаем все опубликованные посты с использованием прямого axios запроса
    let posts = [];
    try {
      // Получаем токен администратора
      const adminSession = await directusAuthManager.getAdminSession();
      const token = adminSession ? adminSession.token : null;
      
      if (!token) {
        throw new Error('Не удалось получить токен для запроса постов');
      }
      
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      
      // Делаем запрос через axios
      const response = await axios.get(`${directusUrl}/items/campaign_content`, {
        params: {
          filter,
          fields: ['id', 'title', 'content', 'campaign_id', 'social_platforms', 'created_at']
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      posts = response.data?.data || [];
    } catch (error) {
      log.error(`[analytics-service] Ошибка при получении постов: ${error.message}`);
      // В случае ошибки возвращаем пустой массив
      posts = [];
    }
    
    // Если указан период, фильтруем посты по дате публикации (publishedAt)
    if (period > 0 && posts.length > 0) {
      const periodStartDate = new Date();
      periodStartDate.setDate(periodStartDate.getDate() - period);
      
      // Фильтруем посты по дате в поле publishedAt внутри social_platforms
      posts = posts.filter(post => {
        if (!post.social_platforms) return false;
        
        // Проверяем, что хотя бы одна платформа опубликована в указанный период
        return Object.values(post.social_platforms).some((platformData: any) => {
          if (platformData.status !== 'published' || !platformData.publishedAt) return false;
          
          const publishedAt = new Date(platformData.publishedAt);
          return publishedAt >= periodStartDate;
        });
      });
    }
    
    // Обрабатываем посты для вычисления общего количества просмотров и вовлеченности
    const processedPosts = posts.map(post => {
      const postData = {
        id: post.id,
        title: post.title,
        content: post.content,
        campaign_id: post.campaign_id,
        createdAt: post.created_at,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalEngagement: 0,
        engagementRate: 0,
        platforms: []
      };
      
      // Если нет данных о социальных платформах, возвращаем базовую информацию
      if (!post.social_platforms) {
        return postData;
      }
      
      // Обрабатываем каждую платформу отдельно
      Object.keys(post.social_platforms).forEach(platform => {
        const platformData = post.social_platforms[platform];
        
        // Пропускаем, если платформа не опубликована или нет аналитики
        if (platformData.status !== 'published' || !platformData.analytics) {
          return;
        }
        
        // Добавляем данные о платформе
        postData.platforms.push({
          platform,
          postUrl: platformData.postUrl,
          publishedAt: platformData.publishedAt,
          analytics: platformData.analytics
        });
        
        // Суммируем метрики
        const views = platformData.analytics.views || 0;
        const likes = platformData.analytics.likes || 0;
        const comments = platformData.analytics.comments || 0;
        const shares = platformData.analytics.shares || 0;
        
        postData.totalViews += views;
        postData.totalLikes += likes;
        postData.totalComments += comments;
        postData.totalShares += shares;
        
        // Рассчитываем общую вовлеченность
        postData.totalEngagement += likes + comments + shares;
      });
      
      // Рассчитываем коэффициент вовлеченности
      postData.engagementRate = postData.totalViews > 0 ? (postData.totalEngagement / postData.totalViews) * 100 : 0;
      
      return postData;
    });
    
    // Сортируем посты по просмотрам (по убыванию)
    const topByViews = [...processedPosts]
      .filter(post => post.totalViews > 0)
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 5);
    
    // Сортируем посты по вовлеченности (по убыванию)
    const topByEngagement = [...processedPosts]
      .filter(post => post.totalEngagement > 0)
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 5);
    
    return {
      topByViews,
      topByEngagement
    };
  } catch (error: any) {
    log.error(`[analytics-service] Ошибка получения топовых постов: ${error.message}`);
    return {
      topByViews: [],
      topByEngagement: []
    };
  }
}

/**
 * Получает агрегированную статистику по платформам
 * @param userId ID пользователя
 * @param campaignId ID кампании
 * @param period Период, за который нужно получить данные (в днях)
 * @returns Промис с агрегированной статистикой по платформам
 */
export async function getPlatformsStats(userId: string, campaignId?: string, period: number = 7): Promise<{
  platforms: Record<string, any>,
  aggregated: AggregatedMetrics
}> {
  try {
    // Формируем запрос на получение опубликованных постов
    const filter: any = {
      user_id: { _eq: userId },
      status: { _eq: 'published' }
    };
    
    // Добавляем фильтр по кампании, если он указан
    if (campaignId) {
      // Используем только поле campaign_id
      filter.campaign_id = { _eq: campaignId };
    }
    
    // ВАЖНО: Не используем фильтр по created_at, так как нам нужны все публикации
    // для последующей фильтрации по publishedAt в social_platforms
    
    // Получаем все опубликованные посты с использованием прямого axios запроса
    let posts = [];
    try {
      // Получаем токен администратора
      const adminSession = await directusAuthManager.getAdminSession();
      const token = adminSession ? adminSession.token : null;
      
      if (!token) {
        throw new Error('Не удалось получить токен для запроса постов');
      }
      
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      
      // Делаем запрос через axios
      const response = await axios.get(`${directusUrl}/items/campaign_content`, {
        params: {
          filter,
          fields: ['id', 'campaign_id', 'social_platforms', 'created_at']
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      posts = response.data?.data || [];
      log.info(`[analytics-service] Получено ${posts.length} постов для статистики. Кампания: ${campaignId}, период: ${period} дней`);
      
      // Добавляем детальное логирование для отладки
      posts.forEach((post, index) => {
        log.info(`[analytics-service] Пост ${index + 1}: ID=${post.id}, created_at=${post.created_at}`);
      });
      
      // Для кампании "Профориентация" (ID: b2c43094-01b6-4e33-834f-abcdcffcd101)
      // временно отключаем фильтрацию по дате, чтобы отобразить все посты
      if (campaignId === 'b2c43094-01b6-4e33-834f-abcdcffcd101') {
        log.info(`[analytics-service] Для кампании "Профориентация" отключена фильтрация по дате`);
        log.info(`[analytics-service] Все ${posts.length} постов будут отображены в аналитике`);
      } 
      // Для остальных кампаний фильтруем посты по дате publishedAt как обычно
      else if (period > 0) {
        const periodStartDate = new Date();
        periodStartDate.setDate(periodStartDate.getDate() - period);
        
        // Создаем новый массив с фильтрацией по дате публикации
        const filteredPosts = posts.filter(post => {
          if (!post.social_platforms) return false;
          
          // Проверяем, что хотя бы одна платформа опубликована в указанный период
          return Object.values(post.social_platforms).some((platformData: any) => {
            if (platformData.status !== 'published' || !platformData.publishedAt) return false;
            
            const publishedAt = new Date(platformData.publishedAt);
            return publishedAt >= periodStartDate;
          });
        });
        
        log.info(`[analytics-service] Отфильтровано по publishedAt: ${filteredPosts.length} постов из ${posts.length}`);
        posts = filteredPosts;
      }
    } catch (error) {
      log.error(`[analytics-service] Ошибка при получении постов: ${error.message}`);
      // В случае ошибки возвращаем пустой массив
      posts = [];
    }
    
    // Начальные значения для агрегированных метрик
    const aggregated: AggregatedMetrics = {
      totalPosts: 0, // Будем считать количество публикаций как сумму публикаций на всех платформах
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalEngagement: 0,
      averageEngagementRate: 0,
      platformDistribution: {}
    };
    
    // Статистика по каждой платформе
    const platformStats: Record<string, any> = {
      telegram: {
        posts: 0,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement: 0
      },
      vk: {
        posts: 0,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement: 0
      },
      instagram: {
        posts: 0,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement: 0
      },
      facebook: {
        posts: 0,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement: 0
      }
    };
    
    // Обрабатываем каждый пост
    posts.forEach(post => {
      if (!post.social_platforms) return;
      
      // Обрабатываем каждую платформу
      Object.keys(post.social_platforms).forEach(platform => {
        const platformData = post.social_platforms[platform];
        
        // Пропускаем, если платформа не опубликована или нет аналитики
        if (platformData.status !== 'published' || !platformData.analytics) {
          return;
        }
        
        // Увеличиваем счетчик постов для платформы
        platformStats[platform].posts++;
        
        // Суммируем метрики
        const views = platformData.analytics.views || 0;
        const likes = platformData.analytics.likes || 0;
        const comments = platformData.analytics.comments || 0;
        const shares = platformData.analytics.shares || 0;
        const engagement = likes + comments + shares;
        
        platformStats[platform].views += views;
        platformStats[platform].likes += likes;
        platformStats[platform].comments += comments;
        platformStats[platform].shares += shares;
        platformStats[platform].engagement += engagement;
        
        // Добавляем к общим метрикам
        aggregated.totalViews += views;
        aggregated.totalLikes += likes;
        aggregated.totalComments += comments;
        aggregated.totalShares += shares;
        aggregated.totalEngagement += engagement;
      });
    });
    
    // Подсчитываем общее количество публикаций и вычисляем коэффициенты вовлеченности
    let totalPlatformPosts = 0;
    
    Object.keys(platformStats).forEach(platform => {
      const stats = platformStats[platform];
      // Суммируем количество публикаций на всех платформах
      totalPlatformPosts += stats.posts;
      // Вычисляем коэффициент вовлеченности для каждой платформы
      stats.engagementRate = stats.views > 0 ? (stats.engagement / stats.views) * 100 : 0;
    });
    
    // Обновляем общее количество публикаций (важно - это сумма всех публикаций на платформах)
    aggregated.totalPosts = totalPlatformPosts;
    
    // Вычисляем средний коэффициент вовлеченности
    aggregated.averageEngagementRate = aggregated.totalViews > 0 ? 
      (aggregated.totalEngagement / aggregated.totalViews) * 100 : 0;
    
    // Заполняем распределение по платформам
    aggregated.platformDistribution = platformStats;
    
    log.info(`[analytics-service] Итоговое количество публикаций: ${totalPlatformPosts} (сумма по всем платформам)`);
    
    return {
      platforms: platformStats,
      aggregated
    };
  } catch (error: any) {
    log.error(`[analytics-service] Ошибка получения статистики платформ: ${error.message}`);
    return {
      platforms: {},
      aggregated: {
        totalPosts: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalEngagement: 0,
        averageEngagementRate: 0,
        platformDistribution: {}
      }
    };
  }
}

/**
 * Обновляет аналитику для кампании через внешний API
 * @param campaignId ID кампании
 * @param period Период в днях, за который нужно обновить данные
 * @returns Промис с результатом обновления
 */
export async function updateCampaignAnalytics(campaignId: string, period: number = 7): Promise<boolean> {
  try {
    const webhookUrl = process.env.N8N_ANALYTICS_WEBHOOK_URL;
    
    // Если URL вебхука не указан, возвращаем ошибку
    if (!webhookUrl) {
      log.error('[analytics-service] URL вебхука для обновления аналитики не указан в переменных окружения');
      return false;
    }
    
    // Отправляем запрос на обновление аналитики
    await axios.post(webhookUrl, {
      campaignId,
      days: period
    });
    
    log.info(`[analytics-service] Запрос на обновление аналитики отправлен: campaignId=${campaignId}, period=${period}`);
    return true;
  } catch (error: any) {
    log.error(`[analytics-service] Ошибка при обновлении аналитики: ${error.message}`);
    return false;
  }
}