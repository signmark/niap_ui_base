/**
 * Сервис для получения реальной аналитики из ВКонтакте
 * Использует VK API для получения актуальных данных по просмотрам, лайкам и другим метрикам постов
 */

import axios from 'axios';
import logger from '../../utils/logger';

// Интерфейс для формата данных аналитики ВКонтакте
interface VkAnalytics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagementRate: number;
  lastUpdated: string;
}

/**
 * Класс для работы с аналитикой ВКонтакте
 */
export class VkAnalyticsService {
  
  /**
   * Получает аналитику для опубликованного поста в ВКонтакте
   * @param accessToken Токен доступа ВКонтакте
   * @param postId ID поста в формате "owner_id_post_id" или полный URL
   * @returns Объект с данными аналитики или null в случае ошибки
   */
  async getPostAnalytics(
    accessToken: string,
    postId: string
  ): Promise<VkAnalytics | null> {
    try {
      // Извлекаем owner_id и post_id из полного URL или строки формата "owner_id_post_id"
      const postIds = this.extractVkPostIds(postId);
      
      if (!postIds || !postIds.ownerId || !postIds.itemId) {
        logger.warn(`Не удалось извлечь ID поста и владельца из ${postId}`, 'vk-analytics');
        return null;
      }
      
      const ownerId = postIds.ownerId;
      const itemId = postIds.itemId;
      
      // Получаем данные о просмотрах поста
      const viewsResponse = await this.getPostViews(accessToken, ownerId, itemId);
      
      // Получаем данные о лайках, комментариях и репостах
      const likesResponse = await this.getPostLikes(accessToken, ownerId, itemId);
      const commentsResponse = await this.getPostComments(accessToken, ownerId, itemId);
      const repostsResponse = await this.getPostReposts(accessToken, ownerId, itemId);
      
      // Формируем объект аналитики на основе полученных данных
      const views = viewsResponse?.views || 0;
      const likes = likesResponse?.likes || 0;
      const comments = commentsResponse?.count || 0;
      const shares = repostsResponse?.count || 0;
      
      // В ВК нет прямой метрики для кликов по ссылкам,
      // но можно запрашивать через метод для укороченных ссылок vk.cc
      // Для обычных постов без ссылок возвращаем 0
      const clicks = 0;
      
      // Расчет метрики вовлеченности (engagement rate)
      // (лайки + комментарии + репосты) / просмотры * 100%
      const engagementRate = views > 0
        ? Math.round(((likes + comments + shares) / views) * 100)
        : 0;
      
      // Формируем объект аналитики
      const analytics: VkAnalytics = {
        views,
        likes,
        comments,
        shares,
        clicks,
        engagementRate,
        lastUpdated: new Date().toISOString()
      };
      
      logger.log(`Получена аналитика ВКонтакте для поста ${ownerId}_${itemId}: ${views} просмотров, ${likes} лайков`, 'vk-analytics');
      
      return analytics;
    } catch (error: any) {
      logger.error(`Ошибка при получении аналитики ВКонтакте: ${error.message}`, error, 'vk-analytics');
      return null;
    }
  }
  
  /**
   * Получает количество просмотров поста в ВКонтакте
   * @param accessToken Токен доступа
   * @param ownerId ID владельца поста (страницы или группы)
   * @param postId ID поста
   * @returns Объект с количеством просмотров или null в случае ошибки
   */
  private async getPostViews(
    accessToken: string,
    ownerId: string,
    postId: string
  ): Promise<{ views: number } | null> {
    try {
      const url = 'https://api.vk.com/method/wall.getById';
      const params = {
        posts: `${ownerId}_${postId}`,
        extended: 1,
        access_token: accessToken,
        v: '5.131'
      };
      
      const response = await axios.get(url, { params });
      
      if (response.data && response.data.response && response.data.response.items && response.data.response.items.length > 0) {
        const post = response.data.response.items[0];
        return {
          views: post.views ? post.views.count : 0
        };
      }
      
      logger.warn(`Не удалось получить данные о просмотрах поста ${ownerId}_${postId}`, 'vk-analytics');
      return { views: 0 };
    } catch (error: any) {
      logger.error(`Ошибка при получении просмотров поста ВКонтакте: ${error.message}`, error, 'vk-analytics');
      return { views: 0 };
    }
  }
  
  /**
   * Получает количество лайков поста в ВКонтакте
   * @param accessToken Токен доступа
   * @param ownerId ID владельца поста (страницы или группы)
   * @param postId ID поста
   * @returns Объект с количеством лайков или null в случае ошибки
   */
  private async getPostLikes(
    accessToken: string,
    ownerId: string,
    postId: string
  ): Promise<{ likes: number } | null> {
    try {
      const url = 'https://api.vk.com/method/likes.getList';
      const params = {
        type: 'post',
        owner_id: ownerId,
        item_id: postId,
        filter: 'likes',
        extended: 0,
        count: 1000,
        access_token: accessToken,
        v: '5.131'
      };
      
      const response = await axios.get(url, { params });
      
      if (response.data && response.data.response) {
        return {
          likes: response.data.response.count || 0
        };
      }
      
      logger.warn(`Не удалось получить данные о лайках поста ${ownerId}_${postId}`, 'vk-analytics');
      return { likes: 0 };
    } catch (error: any) {
      logger.error(`Ошибка при получении лайков поста ВКонтакте: ${error.message}`, error, 'vk-analytics');
      return { likes: 0 };
    }
  }
  
  /**
   * Получает количество комментариев поста в ВКонтакте
   * @param accessToken Токен доступа
   * @param ownerId ID владельца поста (страницы или группы)
   * @param postId ID поста
   * @returns Объект с количеством комментариев или null в случае ошибки
   */
  private async getPostComments(
    accessToken: string,
    ownerId: string,
    postId: string
  ): Promise<{ count: number } | null> {
    try {
      const url = 'https://api.vk.com/method/wall.getComments';
      const params = {
        owner_id: ownerId,
        post_id: postId,
        count: 1,
        access_token: accessToken,
        v: '5.131'
      };
      
      const response = await axios.get(url, { params });
      
      if (response.data && response.data.response) {
        return {
          count: response.data.response.count || 0
        };
      }
      
      logger.warn(`Не удалось получить данные о комментариях поста ${ownerId}_${postId}`, 'vk-analytics');
      return { count: 0 };
    } catch (error: any) {
      logger.error(`Ошибка при получении комментариев поста ВКонтакте: ${error.message}`, error, 'vk-analytics');
      return { count: 0 };
    }
  }
  
  /**
   * Получает количество репостов поста в ВКонтакте
   * @param accessToken Токен доступа
   * @param ownerId ID владельца поста (страницы или группы)
   * @param postId ID поста
   * @returns Объект с количеством репостов или null в случае ошибки
   */
  private async getPostReposts(
    accessToken: string,
    ownerId: string,
    postId: string
  ): Promise<{ count: number } | null> {
    try {
      const url = 'https://api.vk.com/method/wall.getReposts';
      const params = {
        owner_id: ownerId,
        post_id: postId,
        count: 1,
        access_token: accessToken,
        v: '5.131'
      };
      
      const response = await axios.get(url, { params });
      
      if (response.data && response.data.response) {
        return {
          count: response.data.response.count || 0
        };
      }
      
      logger.warn(`Не удалось получить данные о репостах поста ${ownerId}_${postId}`, 'vk-analytics');
      return { count: 0 };
    } catch (error: any) {
      logger.error(`Ошибка при получении репостов поста ВКонтакте: ${error.message}`, error, 'vk-analytics');
      return { count: 0 };
    }
  }
  
  /**
   * Извлекает ID владельца и поста из URL или строки формата "owner_id_post_id"
   * @param postUrl URL поста или строка формата "owner_id_post_id"
   * @returns Объект с ownerId и itemId или null
   */
  extractVkPostIds(postUrl: string): { ownerId: string, itemId: string } | null {
    try {
      // Проверяем, является ли postUrl URL-адресом или ID
      if (postUrl.includes('vk.com/wall')) {
        // Извлекаем ID из URL формата https://vk.com/wall-123456789_123
        const match = postUrl.match(/wall([^_]+)_(\d+)/);
        
        if (match && match.length >= 3) {
          const ownerId = match[1]; // Может быть со знаком минус для групп
          const itemId = match[2];
          
          return { ownerId, itemId };
        }
      } else if (postUrl.includes('_')) {
        // Если формат уже owner_id_post_id
        const parts = postUrl.split('_');
        
        if (parts.length === 2) {
          return {
            ownerId: parts[0],
            itemId: parts[1]
          };
        }
      } else {
        // Если передан только ID поста, и мы знаем, что это группа
        // В этом случае нужно вручную указать owner_id группы со знаком минус
        const match = postUrl.match(/(\d+)/);
        
        if (match && match.length >= 2) {
          // Предполагаем, что это пост группы с известным ID
          // ID группы 228626989 из https://vk.com/wall-228626989_263
          return {
            ownerId: '-228626989', // Знак минус для групп
            itemId: match[1]
          };
        }
      }
      
      logger.warn(`Не удалось извлечь ID из URL ВКонтакте: ${postUrl}`, 'vk-analytics');
      return null;
    } catch (error) {
      logger.error(`Ошибка при извлечении ID из URL ВКонтакте: ${error}`, error, 'vk-analytics');
      return null;
    }
  }
}

// Экспортируем экземпляр сервиса
export const vkAnalyticsService = new VkAnalyticsService();