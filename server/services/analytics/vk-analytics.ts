/**
 * Модуль для получения аналитики из ВКонтакте
 */

import axios from 'axios';
import { log } from '../../utils/logger';

/**
 * Получает статистику публикации из ВКонтакте
 * @param ownerId ID владельца публикации (группы или пользователя)
 * @param postId ID публикации
 * @param accessToken Токен доступа к API ВКонтакте из настроек кампании
 * @returns Объект с метриками просмотров и взаимодействий
 */
export async function getVkAnalytics(ownerId: string, postId: string, accessToken: string): Promise<{
  views: number;
  likes: number;
  comments: number;
  shares: number;
}> {
  try {
    if (!accessToken) {
      log.error('[vk-analytics] Не указан токен доступа VK');
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
    
    // Базовый URL для API ВКонтакте
    const baseUrl = 'https://api.vk.com/method';
    
    // Получаем информацию о публикации, включая просмотры, лайки, комментарии и репосты
    const response = await axios.get(`${baseUrl}/wall.getById`, {
      params: {
        posts: `${ownerId}_${postId}`,
        extended: 1,
        access_token: accessToken,
        v: '5.131'
      }
    });
    
    // Если запрос неуспешен, возвращаем нулевые метрики
    if (!response.data || !response.data.response || !response.data.response.items || !response.data.response.items[0]) {
      log.warn(`[vk-analytics] Не удалось получить данные публикации ${ownerId}_${postId}`);
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
    
    const post = response.data.response.items[0];
    
    // Извлекаем метрики из ответа API
    const views = post.views?.count || 0;
    const likes = post.likes?.count || 0;
    const comments = post.comments?.count || 0;
    const shares = post.reposts?.count || 0;
    
    return { views, likes, comments, shares };
  } catch (error: any) {
    log.error(`[vk-analytics] Ошибка получения аналитики: ${error.message}`);
    return { views: 0, likes: 0, comments: 0, shares: 0 };
  }
}