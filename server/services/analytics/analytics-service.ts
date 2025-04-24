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
 * @returns Объект с настройками социальных сетей или null в случае ошибки
 */
async function getCampaignSocialSettings(campaignId: string): Promise<any> {
  try {
    // Получаем информацию о кампании, включая настройки социальных сетей
    const campaigns = await directusCrud.searchItems('campaigns', {
      filter: {
        id: { _eq: campaignId }
      },
      fields: ['id', 'social_media_settings']
    });
    
    if (!campaigns || campaigns.length === 0) {
      log.warn(`[analytics-service] Не найдена кампания с ID ${campaignId}`);
      return null;
    }
    
    return campaigns[0].social_media_settings || null;
  } catch (error: any) {
    log.error(`[analytics-service] Ошибка получения настроек кампании: ${error.message}`);
    return null;
  }
}

/**
 * Собирает аналитику для всех постов, опубликованных в рамках указанной кампании
 * @param campaignId ID кампании
 * @returns Промис с результатами сбора аналитики
 */
export async function collectAnalytics(campaignId: string): Promise<boolean> {
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
    
    if (!socialSettings) {
      log.error(`[analytics-service] Не удалось получить настройки социальных сетей для кампании ${campaignId}`);
      analyticsStatus.isCollecting = false;
      analyticsStatus.error = 'Не удалось получить настройки социальных сетей';
      return false;
    }
    
    // Формируем запрос на получение опубликованных постов
    const filter: any = {
      status: { _eq: 'published' }
    };
    
    // Добавляем фильтр по кампании
    // Используем правильное имя поля campaign_id
    filter.campaign_id = { _eq: campaignId };
    
    // Получаем все опубликованные посты
    const posts = await directusCrud.searchItems('campaign_content', {
      filter,
      fields: ['id', 'title', 'content', 'campaign_id', 'social_platforms', 'created_at'],
      // Используем токен административного пользователя, если он передан
      ...(arguments.length > 1 && arguments[1] ? { authToken: arguments[1] } : {})
    });
    
    log.info(`[analytics-service] Найдено ${posts.length} постов для обработки`);
    
    if (posts.length === 0) {
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
              const { chatId, messageId } = extractTelegramIds(platformData.postUrl);
              if (chatId && messageId && telegramSettings.token) {
                metrics = await getTelegramAnalytics(chatId, messageId, telegramSettings.token);
              }
              break;
              
            case 'vk':
              const vkSettings = socialSettings?.vk || {};
              const { ownerId, postId } = extractVkIds(platformData.postUrl);
              if (ownerId && postId && vkSettings.access_token) {
                metrics = await getVkAnalytics(ownerId, postId, vkSettings.access_token);
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
      
      // Сохраняем обновленный пост в Directus
      await directusCrud.updateItem('campaign_content', post.id, {
        social_platforms: updatedPost.social_platforms
      });
      
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
      // Проверяем оба возможных имени поля (campaign_id или campaign)
      filter._or = [
        { campaign_id: { _eq: campaignId } },
        { campaign: { _eq: campaignId } }
      ];
    }
    
    // Если указан период, добавляем фильтр по дате публикации
    if (period > 0) {
      const periodStartDate = new Date();
      periodStartDate.setDate(periodStartDate.getDate() - period);
      
      filter.created_at = {
        _gte: periodStartDate.toISOString()
      };
    }
    
    // Получаем все опубликованные посты
    const posts = await directusCrud.searchItems('campaign_content', {
      filter,
      fields: ['id', 'title', 'content', 'campaign_id', 'campaign', 'social_platforms', 'created_at']
    });
    
    // Обрабатываем посты для вычисления общего количества просмотров и вовлеченности
    const processedPosts = posts.map(post => {
      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      
      // Если есть данные о социальных платформах, суммируем метрики
      if (post.social_platforms) {
        Object.keys(post.social_platforms).forEach(platform => {
          const platformData = post.social_platforms[platform];
          
          // Пропускаем, если платформа не опубликована или нет аналитики
          if (platformData.status !== 'published' || !platformData.analytics) {
            return;
          }
          
          totalViews += platformData.analytics.views || 0;
          totalLikes += platformData.analytics.likes || 0;
          totalComments += platformData.analytics.comments || 0;
          totalShares += platformData.analytics.shares || 0;
        });
      }
      
      // Вычисляем общее вовлечение и коэффициент вовлеченности
      const totalEngagement = totalLikes + totalComments + totalShares;
      const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;
      
      return {
        id: post.id,
        title: post.title,
        content: post.content,
        imageUrl: post.image_url,
        createdAt: post.created_at,
        campaignId: post.campaign_id || post.campaign,
        totalViews,
        totalEngagement,
        engagementRate,
        platforms: post.social_platforms
      };
    });
    
    // Сортируем и выбираем топ-4 поста по просмотрам и вовлеченности
    const topByViews = [...processedPosts]
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 4);
      
    const topByEngagement = [...processedPosts]
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 4);
    
    return { topByViews, topByEngagement };
  } catch (error: any) {
    log.error(`[analytics-service] Ошибка получения топ постов: ${error.message}`);
    return { topByViews: [], topByEngagement: [] };
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
      // Проверяем оба возможных имени поля (campaign_id или campaign)
      filter._or = [
        { campaign_id: { _eq: campaignId } },
        { campaign: { _eq: campaignId } }
      ];
    }
    
    // Если указан период, добавляем фильтр по дате публикации
    if (period > 0) {
      const periodStartDate = new Date();
      periodStartDate.setDate(periodStartDate.getDate() - period);
      
      filter.created_at = {
        _gte: periodStartDate.toISOString()
      };
    }
    
    // Получаем все опубликованные посты
    const posts = await directusCrud.searchItems('campaign_content', {
      filter,
      fields: ['id', 'social_platforms', 'created_at']
    });
    
    // Инициализируем структуру для хранения метрик по платформам
    const platforms: Record<string, {
      posts: number,
      views: number,
      likes: number,
      comments: number,
      shares: number,
      engagement: number,
      engagementRate: number
    }> = {
      telegram: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0 },
      vk: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0 },
      instagram: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0 },
      facebook: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0 }
    };
    
    // Агрегированные метрики по всем платформам
    const aggregated: AggregatedMetrics = {
      totalPosts: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalEngagement: 0,
      averageEngagementRate: 0,
      platformDistribution: {}
    };
    
    // Обрабатываем посты для агрегации метрик по платформам
    posts.forEach(post => {
      if (!post.social_platforms) return;
      
      Object.keys(post.social_platforms).forEach(platform => {
        const platformData = post.social_platforms[platform];
        
        // Пропускаем, если платформа не опубликована или нет аналитики
        if (platformData.status !== 'published' || !platformData.analytics) {
          return;
        }
        
        // Увеличиваем счетчик постов для платформы
        platforms[platform].posts += 1;
        aggregated.totalPosts += 1;
        
        // Добавляем метрики
        const views = platformData.analytics.views || 0;
        const likes = platformData.analytics.likes || 0;
        const comments = platformData.analytics.comments || 0;
        const shares = platformData.analytics.shares || 0;
        const engagement = likes + comments + shares;
        
        platforms[platform].views += views;
        platforms[platform].likes += likes;
        platforms[platform].comments += comments;
        platforms[platform].shares += shares;
        platforms[platform].engagement += engagement;
        
        aggregated.totalViews += views;
        aggregated.totalLikes += likes;
        aggregated.totalComments += comments;
        aggregated.totalShares += shares;
        aggregated.totalEngagement += engagement;
      });
    });
    
    // Вычисляем коэффициенты вовлеченности для каждой платформы
    Object.keys(platforms).forEach(platform => {
      if (platforms[platform].views > 0) {
        platforms[platform].engagementRate = (platforms[platform].engagement / platforms[platform].views) * 100;
      }
    });
    
    // Вычисляем средний коэффициент вовлеченности
    if (aggregated.totalViews > 0) {
      aggregated.averageEngagementRate = (aggregated.totalEngagement / aggregated.totalViews) * 100;
    }
    
    // Формируем распределение по платформам для возврата
    aggregated.platformDistribution = platforms;
    
    return { platforms, aggregated };
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