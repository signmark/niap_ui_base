/**
 * Сервис для публикации контента и обновления статусов в Facebook
 */

import axios from 'axios';
import { log } from '../../utils/logger';
import { CampaignContent, SocialPublication } from '@shared/schema';
import { storage } from '../../storage';

/**
 * Facebook сервис для управления публикациями и статусами
 */
export class FacebookService {
  /**
   * Получает системный токен для доступа к API Directus
   * @returns Токен доступа или null в случае ошибки
   */
  private async getSystemToken(): Promise<string | null> {
    try {
      // Пытаемся получить кэшированный токен из DirectusAuthManager
      const directusAuthManager = await import('../directus-auth-manager').then(m => m.directusAuthManager);
      const sessions = directusAuthManager.getAllActiveSessions();
      
      if (sessions.length > 0) {
        // Берем самый свежий токен из активных сессий
        const latestToken = sessions[0].token;
        log(`Получен токен администратора из активных сессий для Facebook публикации`, 'facebook-service');
        return latestToken;
      }
      
      // Если нет активных сессий, используем токен из переменных окружения
      const envToken = process.env.DIRECTUS_ADMIN_TOKEN;
      if (envToken) {
        log(`Получен токен администратора из переменных окружения для Facebook публикации`, 'facebook-service');
        return envToken;
      }
      
      log(`Не удалось получить токен администратора для Facebook публикации`, 'facebook-service');
      return null;
    } catch (error) {
      log(`Ошибка при получении токена администратора: ${error}`, 'facebook-service');
      return null;
    }
  }

  /**
   * Обновляет статус публикации контента в Facebook
   * Использует ГЛУБОКУЮ КОПИЮ social_platforms для избежания потери данных
   * 
   * @param contentId ID контента
   * @param platform Социальная платформа ('facebook')
   * @param publicationResult Результат публикации
   * @returns Обновленный контент или null в случае ошибки
   */
  public async updatePublicationStatus(
    contentId: string,
    platform: string,
    publicationResult: SocialPublication
  ): Promise<CampaignContent | null> {
    // Для отлавливания всех шагов создаем уникальный ID операции
    const operationId = `fb_update_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    try {
      log(`[${operationId}] Обновление статуса Facebook публикации для контента ${contentId}`, 'facebook-service');
      
      // Получаем токен доступа к Directus API
      const systemToken = await this.getSystemToken();
      if (!systemToken) {
        log(`[${operationId}] Не удалось получить токен для обновления статуса Facebook`, 'facebook-service');
        return null;
      }
      
      // URL Directus API
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      
      // Получаем актуальные данные контента напрямую через API
      log(`[${operationId}] Получение данных контента ${contentId} через API`, 'facebook-service');
      const contentResponse = await axios.get(`${directusUrl}/items/campaign_content/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${systemToken}`
        }
      });
      
      if (!contentResponse.data?.data) {
        log(`[${operationId}] Не удалось получить данные контента ${contentId}`, 'facebook-service');
        return null;
      }
      
      const contentData = contentResponse.data.data;
      log(`[${operationId}] Получены данные контента ${contentId}`, 'facebook-service');
      
      // Извлекаем текущее значение social_platforms
      let socialPlatforms = contentData.social_platforms || {};
      
      // Если socialPlatforms - строка, парсим JSON
      if (typeof socialPlatforms === 'string') {
        try {
          socialPlatforms = JSON.parse(socialPlatforms);
        } catch (e) {
          log(`[${operationId}] Ошибка при парсинге JSON поля social_platforms: ${e}`, 'facebook-service');
          socialPlatforms = {};
        }
      }
      
      // Логируем текущее состояние ПЕРЕД обновлением
      log(`[${operationId}] Текущее состояние social_platforms: ${JSON.stringify(socialPlatforms)}`, 'facebook-service');
      log(`[${operationId}] Платформы до обновления: ${Object.keys(socialPlatforms).join(', ')}`, 'facebook-service');
      
      // ВАЖНО: Создаем глубокую копию объекта social_platforms чтобы избежать мутаций
      const updatedPlatforms = JSON.parse(JSON.stringify(socialPlatforms));
      
      // Обновляем только данные Facebook, сохраняя все остальные платформы
      updatedPlatforms.facebook = {
        // Сохраняем все существующие данные о Facebook, если они есть
        ...(socialPlatforms.facebook || {}),
        // Обновляем данные Facebook новой информацией
        status: publicationResult.status,
        publishedAt: publicationResult.publishedAt ? new Date(publicationResult.publishedAt).toISOString() : null,
        postUrl: publicationResult.postUrl || (socialPlatforms.facebook?.postUrl || ''),
        error: publicationResult.error || null
      };
      
      // Логируем ПОСЛЕ обновления для проверки
      log(`[${operationId}] Обновленное состояние social_platforms: ${JSON.stringify(updatedPlatforms)}`, 'facebook-service');
      log(`[${operationId}] Платформы после обновления: ${Object.keys(updatedPlatforms).join(', ')}`, 'facebook-service');
      
      // ВАЖНАЯ ПРОВЕРКА: убедимся, что все платформы сохранены и нет потери данных
      for (const platformName of Object.keys(socialPlatforms)) {
        if (!updatedPlatforms[platformName]) {
          log(`[${operationId}] КРИТИЧЕСКАЯ ОШИБКА: Потеряны данные платформы ${platformName}!`, 'facebook-service');
          updatedPlatforms[platformName] = socialPlatforms[platformName];
        }
      }
      
      // Дополнительная проверка VK, Telegram и Instagram
      log(`[${operationId}] Проверка VK: ${JSON.stringify(updatedPlatforms.vk || 'отсутствует')}`, 'facebook-service');
      log(`[${operationId}] Проверка Telegram: ${JSON.stringify(updatedPlatforms.telegram || 'отсутствует')}`, 'facebook-service');
      log(`[${operationId}] Проверка Instagram: ${JSON.stringify(updatedPlatforms.instagram || 'отсутствует')}`, 'facebook-service');
      
      // Обновляем контент в Directus через API
      log(`[${operationId}] Отправка обновленных данных в Directus`, 'facebook-service');
      
      try {
        await axios.patch(`${directusUrl}/items/campaign_content/${contentId}`, {
          social_platforms: updatedPlatforms
        }, {
          headers: {
            'Authorization': `Bearer ${systemToken}`
          }
        });
        
        log(`[${operationId}] Статус публикации Facebook успешно обновлен`, 'facebook-service');
        
        // Проверка обновления - получаем данные снова
        const verifyResponse = await axios.get(`${directusUrl}/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${systemToken}`
          }
        });
        
        if (verifyResponse.data?.data?.social_platforms) {
          let verifiedPlatforms = verifyResponse.data.data.social_platforms;
          
          if (typeof verifiedPlatforms === 'string') {
            verifiedPlatforms = JSON.parse(verifiedPlatforms);
          }
          
          log(`[${operationId}] Проверка после обновления: ${JSON.stringify(verifiedPlatforms)}`, 'facebook-service');
          log(`[${operationId}] Платформы после проверки: ${Object.keys(verifiedPlatforms).join(', ')}`, 'facebook-service');
        }
        
        // Преобразуем данные в формат CampaignContent и возвращаем
        return {
          id: contentData.id,
          userId: contentData.user_id,
          campaignId: contentData.campaign_id,
          content: contentData.content,
          title: contentData.title,
          imageUrl: contentData.image_url,
          videoUrl: contentData.video_url,
          additionalImages: contentData.additional_images,
          additionalMedia: contentData.additional_media || null,
          status: contentData.status,
          contentType: contentData.content_type || 'text',
          createdAt: new Date(contentData.date_created),
          scheduledAt: contentData.scheduled_at ? new Date(contentData.scheduled_at) : null,
          publishedAt: contentData.published_at ? new Date(contentData.published_at) : null,
          socialPlatforms: updatedPlatforms,
          keywords: contentData.keywords || [],
          hashtags: contentData.hashtags || [],
          links: contentData.links || [],
          prompt: contentData.prompt || null,
          metadata: contentData.metadata || {}
        };
      } catch (updateError: any) {
        log(`[${operationId}] Ошибка при обновлении статуса публикации: ${updateError.message}`, 'facebook-service');
        
        if (updateError.response?.data) {
          log(`[${operationId}] Ошибка API: ${JSON.stringify(updateError.response.data)}`, 'facebook-service');
        }
        
        // Возвращаем null в случае ошибки
        return null;
      }
    } catch (error: any) {
      log(`[${operationId}] Общая ошибка при обновлении статуса Facebook: ${error.message}`, 'facebook-service');
      return null;
    }
  }
}

export const facebookService = new FacebookService();