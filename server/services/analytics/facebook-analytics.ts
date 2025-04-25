/**
 * Модуль для получения аналитики из Facebook
 */

import axios from 'axios';
import { log } from '../../utils/logger';

/**
 * Получает статистику публикации из Facebook через Graph API
 * @param postId ID публикации в Facebook
 * @param accessToken Токен доступа к API Facebook из настроек кампании
 * @returns Объект с метриками
 */
export async function getFacebookAnalytics(postId: string, accessToken: string): Promise<{ 
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement?: number;
  unique_views?: number;
}> {
  try {
    if (!accessToken) {
      log.error('[facebook-analytics] Не указан токен доступа Facebook');
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
    
    // Базовый URL для Facebook Graph API
    const baseUrl = 'https://graph.facebook.com/v17.0';
    
    // Получение основной информации о публикации
    const postResponse = await axios.get(`${baseUrl}/${postId}`, {
      params: {
        fields: 'id,message,created_time,permalink_url',
        access_token: accessToken
      }
    });
    
    if (!postResponse.data || !postResponse.data.id) {
      log.warn(`[facebook-analytics] Не удалось получить информацию о публикации ${postId}`);
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
    
    // Получение метрик публикации
    const insightsResponse = await axios.get(`${baseUrl}/${postId}/insights`, {
      params: {
        metric: 'post_impressions,post_impressions_unique,post_engaged_users,post_reactions_by_type_total',
        access_token: accessToken
      }
    });
    
    // Получение комментариев
    const commentsResponse = await axios.get(`${baseUrl}/${postId}/comments`, {
      params: {
        summary: true,
        access_token: accessToken
      }
    });
    
    // Получение количества репостов
    const sharesResponse = await axios.get(`${baseUrl}/${postId}/sharedposts`, {
      params: {
        summary: true,
        access_token: accessToken
      }
    });
    
    // Собираем метрики из ответа API
    const metricMap: Record<string, any> = {};
    let reactions: Record<string, number> = {};
    
    if (insightsResponse.data && insightsResponse.data.data) {
      insightsResponse.data.data.forEach((metric: any) => {
        if (metric.name === 'post_reactions_by_type_total') {
          // Отдельно обрабатываем реакции по типам
          reactions = metric.values[0].value || {};
        } else {
          metricMap[metric.name] = metric.values[0].value;
        }
      });
    }
    
    // Суммируем все типы лайков
    const totalLikes = 
      (reactions.like || 0) + 
      (reactions.love || 0) + 
      (reactions.wow || 0) + 
      (reactions.haha || 0) + 
      (reactions.sad || 0) + 
      (reactions.angry || 0) + 
      (reactions.thankful || 0);
    
    // Формируем объект с метриками
    return {
      views: metricMap.post_impressions || 0,
      unique_views: metricMap.post_impressions_unique || 0,
      engagement: metricMap.post_engaged_users || 0,
      likes: totalLikes,
      comments: commentsResponse.data?.summary?.total_count || 0,
      shares: sharesResponse.data?.summary?.total_count || 0
    };
  } catch (error: any) {
    log.error(`[facebook-analytics] Ошибка получения аналитики: ${error.message}`);
    return { views: 0, likes: 0, comments: 0, shares: 0 };
  }
}