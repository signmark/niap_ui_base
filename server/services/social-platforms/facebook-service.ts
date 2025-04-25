/**
 * Единый сервис для работы с Facebook API
 * Объединяет все существующие реализации публикации в Facebook
 */

import axios from 'axios';
import log from '../../utils/logger';
import { CampaignContent, SocialPlatform, SocialPublication } from '@shared/schema';

class FacebookService {
  private apiVersion = 'v19.0';

  /**
   * Получает токен страницы на основе токена пользователя
   * @param userAccessToken Токен доступа пользователя
   * @param pageId ID страницы Facebook
   * @returns Токен доступа страницы
   */
  async getPageAccessToken(userAccessToken: string, pageId: string): Promise<string> {
    try {
      log.info(`[Facebook] Получение токена страницы для ${pageId}`);
      
      // Получаем список страниц пользователя
      const pagesUrl = `https://graph.facebook.com/${this.apiVersion}/me/accounts`;
      const pagesResponse = await axios.get(pagesUrl, {
        params: { access_token: userAccessToken }
      });
      
      if (!pagesResponse.data?.data) {
        throw new Error('Не удалось получить список страниц');
      }
      
      log.info(`[Facebook] Получено ${pagesResponse.data.data.length} страниц`);
      
      // Ищем нужную страницу
      const pages = pagesResponse.data.data || [];
      let pageAccessToken = userAccessToken; // По умолчанию используем токен пользователя
      
      for (const page of pages) {
        if (page.id === pageId) {
          pageAccessToken = page.access_token;
          log.info(`[Facebook] Найден токен для страницы ${pageId}`);
          break;
        }
      }
      
      return pageAccessToken;
    } catch (error: any) {
      log.error(`[Facebook] Ошибка получения токена страницы: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Публикует текст с изображением на странице Facebook
   * @param pageId ID страницы Facebook
   * @param token Токен доступа страницы
   * @param imageUrl URL изображения
   * @param text Текст публикации
   * @returns Результат публикации с ID и URL поста
   */
  async publishImageWithText(pageId: string, token: string, imageUrl: string, text: string): Promise<{ id: string, permalink: string }> {
    try {
      log.info(`[Facebook] Публикация изображения с текстом на странице ${pageId}`);
      
      // Создаем POST запрос для публикации фото с текстом
      const apiUrl = `https://graph.facebook.com/${this.apiVersion}/${pageId}/photos`;
      
      const response = await axios.post(apiUrl, null, {
        params: {
          url: imageUrl,
          caption: text,
          access_token: token,
          published: true
        }
      });
      
      if (!response.data?.id) {
        throw new Error('Не удалось опубликовать изображение: нет ID в ответе API');
      }
      
      // Получаем permalink поста на основе ID
      const postId = response.data.id;
      const postUrl = await this.getPostPermalink(pageId, postId, token);
      
      log.info(`[Facebook] Публикация успешно создана: ${postUrl}`);
      
      return {
        id: postId,
        permalink: postUrl
      };
    } catch (error: any) {
      log.error(`[Facebook] Ошибка публикации: ${error.message}`);
      
      if (error.response?.data) {
        log.error(`[Facebook] Детали ошибки API: ${JSON.stringify(error.response.data)}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Получает постоянную ссылку (permalink) на пост
   * @param pageId ID страницы
   * @param postId ID поста
   * @param token Токен доступа
   * @returns URL поста
   */
  async getPostPermalink(pageId: string, postId: string, token: string): Promise<string> {
    try {
      // Конвертируем ID, удаляя префикс (если требуется)
      const cleanPostId = postId.includes('_') ? postId : `${pageId}_${postId}`;
      
      const response = await axios.get(`https://graph.facebook.com/${this.apiVersion}/${cleanPostId}`, {
        params: {
          fields: 'permalink_url',
          access_token: token
        }
      });
      
      if (response.data && response.data.permalink_url) {
        return response.data.permalink_url;
      } else {
        // Если не удалось получить permalink, формируем стандартный URL
        return `https://facebook.com/${pageId}/posts/${cleanPostId}`;
      }
    } catch (error: any) {
      log.warn(`[Facebook] Не удалось получить permalink: ${error.message}`);
      // Возвращаем стандартный URL в случае ошибки
      return `https://facebook.com/${pageId}/posts/${postId}`;
    }
  }
  
  /**
   * Публикует контент в Facebook
   * @param content Контент для публикации
   * @param settings Настройки Facebook (токен и pageId)
   * @returns Результат публикации
   */
  async publishToFacebook(content: CampaignContent, settings: any): Promise<SocialPublication> {
    try {
      log.info(`[Facebook] Начало публикации контента ${content.id} в Facebook`);
      
      const { token, pageId } = settings;
      
      if (!token || !pageId) {
        throw new Error('Не указаны обязательные параметры (token, pageId) для публикации в Facebook');
      }
      
      // Получаем URL изображения и текст
      const imageUrl = content.imageUrl;
      const text = content.content || '';
      
      if (!imageUrl) {
        throw new Error('Отсутствует URL изображения для публикации в Facebook');
      }
      
      // Получаем токен страницы на основе токена пользователя
      log.info(`[Facebook] Получение токена страницы ${pageId}`);
      const pageAccessToken = await this.getPageAccessToken(token, pageId);
      
      // Публикуем фото с текстом
      log.info(`[Facebook] Публикация на странице ${pageId}`);
      const { id, permalink } = await this.publishImageWithText(
        pageId,
        pageAccessToken,
        imageUrl,
        text
      );
      
      log.info(`[Facebook] Публикация успешно создана: ${permalink}`);
      
      // Возвращаем результат публикации
      return {
        platform: 'facebook',
        status: 'published',
        publishedAt: new Date(),
        postUrl: permalink,
        postId: id
      };
    } catch (error: any) {
      log.error(`[Facebook] Ошибка публикации: ${error.message}`);
      
      return {
        platform: 'facebook',
        status: 'failed',
        error: `Ошибка публикации в Facebook: ${error.message}`
      };
    }
  }
  
  /**
   * Обновляет статус публикации контента в Facebook
   * @param contentId ID контента
   * @param platformName Название платформы (всегда 'facebook')
   * @param publicationResult Результат публикации
   * @returns Обновленный контент или null в случае ошибки
   */
  async updatePublicationStatus(
    contentId: string,
    platformName: SocialPlatform,
    publicationResult: SocialPublication
  ): Promise<CampaignContent | null> {
    const operationId = `fb_update_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    log.info(`[${operationId}] Обновление статуса публикации для контента ${contentId} в Facebook`);
    
    try {
      // Получаем API URL системы
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      
      // Находим активную сессию администратора для получения системного токена
      const directusAuthManager = await import('../directus-auth-manager').then(m => m.directusAuthManager);
      let token = process.env.DIRECTUS_ADMIN_TOKEN || '';
      const sessions = directusAuthManager.getAllActiveSessions();
      
      if (sessions.length > 0) {
        // Берем самый свежий токен из активных сессий
        token = sessions[0].token;
        log.info(`[${operationId}] Используем токен из активных сессий`);
      } else if (!token) {
        log.error(`[${operationId}] Не найден токен администратора`);
        return null;
      }
      
      // 1. Получаем текущие данные контента
      log.info(`[${operationId}] Получение данных контента ${contentId}`);
      const contentResponse = await axios.get(`${directusUrl}/items/campaign_content/${contentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!contentResponse.data?.data) {
        throw new Error(`Контент с ID ${contentId} не найден`);
      }
      
      const content = contentResponse.data.data;
      log.info(`[${operationId}] Контент получен: ${content.id}, от user_id: ${content.user_id}`);
      
      // 2. Обрабатываем текущее значение social_platforms
      let socialPlatforms = content.social_platforms || {};
      
      // Если socialPlatforms - строка, парсим JSON
      if (typeof socialPlatforms === 'string') {
        try {
          socialPlatforms = JSON.parse(socialPlatforms);
        } catch (e) {
          log.error(`[${operationId}] Ошибка парсинга social_platforms: ${e}`);
          socialPlatforms = {};
        }
      }
      
      // ВАЖНО: Если socialPlatforms не объект, создаем новый
      if (typeof socialPlatforms !== 'object' || !socialPlatforms) {
        socialPlatforms = {};
      }
      
      log.info(`[${operationId}] Текущие платформы до обновления: ${Object.keys(socialPlatforms).join(', ')}`);
      
      // 3. Создаем глубокую копию объекта для безопасного обновления
      const updatedPlatforms = JSON.parse(JSON.stringify(socialPlatforms));
      
      // 4. Обновляем ТОЛЬКО данные Facebook, сохраняя данные других платформ
      updatedPlatforms.facebook = {
        ...(socialPlatforms.facebook || {}),
        status: publicationResult.status,
        publishedAt: publicationResult.publishedAt ? new Date(publicationResult.publishedAt).toISOString() : null,
        postUrl: publicationResult.postUrl || socialPlatforms.facebook?.postUrl || '',
        postId: publicationResult.postId || socialPlatforms.facebook?.postId || '',
        error: publicationResult.error || null,
        selected: socialPlatforms.facebook?.selected || true
      };
      
      log.info(`[${operationId}] Обновлена информация для Facebook: ${JSON.stringify(updatedPlatforms.facebook)}`);
      log.info(`[${operationId}] Платформы после обновления: ${Object.keys(updatedPlatforms).join(', ')}`);
      
      // 5. Проверка сохранности данных других платформ
      for (const platform of Object.keys(socialPlatforms)) {
        if (platform !== 'facebook' && !updatedPlatforms[platform]) {
          log.error(`[${operationId}] КРИТИЧЕСКАЯ ОШИБКА: потеряны данные платформы ${platform}`);
          // Восстанавливаем потерянную платформу
          updatedPlatforms[platform] = socialPlatforms[platform];
        }
      }
      
      // 6. Обновляем данные в Directus
      log.info(`[${operationId}] Отправка обновленных данных в Directus`);
      await axios.patch(`${directusUrl}/items/campaign_content/${contentId}`, {
        social_platforms: updatedPlatforms
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      log.info(`[${operationId}] Статус публикации в Facebook успешно обновлен`);
      
      // 7. Возвращаем обновленный объект контента
      return {
        ...content,
        id: content.id,
        content: content.content,
        userId: content.user_id,
        campaignId: content.campaign_id,
        status: content.status,
        contentType: content.content_type || 'text',
        title: content.title || null,
        imageUrl: content.image_url,
        socialPlatforms: updatedPlatforms
      };
    } catch (error: any) {
      log.error(`[${operationId}] Ошибка при обновлении статуса: ${error.message}`);
      
      if (error.response?.data) {
        log.error(`[${operationId}] Детали ошибки API: ${JSON.stringify(error.response.data)}`);
      }
      
      return null;
    }
  }
}

// Экспорт сервиса как синглтон
export const facebookService = new FacebookService();