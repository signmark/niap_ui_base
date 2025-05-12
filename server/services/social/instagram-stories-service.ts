/**
 * Сервис для публикации Instagram Stories
 * 
 * Обеспечивает функциональность для публикации сторис в Instagram
 * и получения прямых ссылок на опубликованные истории
 */

import axios from 'axios';
import FormData from 'form-data';
import { generateRandomCaption } from '../../utils/content-generation';
import { logger } from '../../utils/logger';

export class InstagramStoriesService {
  private token: string;
  private businessAccountId: string;
  
  /**
   * Конструктор сервиса Instagram Stories
   * @param token Instagram API токен
   * @param businessAccountId ID бизнес-аккаунта Instagram
   */
  constructor(token: string, businessAccountId: string) {
    this.token = token;
    this.businessAccountId = businessAccountId;
    
    logger.info('InstagramStoriesService: Сервис инициализирован');
  }
  
  /**
   * Публикует историю в Instagram
   * @param imageUrl URL изображения для публикации
   * @param caption Подпись для истории (опционально)
   * @returns Объект с результатами публикации, включая ID и URL истории
   */
  public async publishStory(imageUrl: string, caption?: string): Promise<{
    success: boolean;
    storyId?: string;
    storyUrl?: string;
    mediaContainerId?: string;
    error?: any;
  }> {
    try {
      logger.info(`InstagramStoriesService: Подготовка к публикации Instagram Stories`);
      logger.info(`InstagramStoriesService: Изображение: ${imageUrl}`);
      
      if (!caption) {
        caption = generateRandomCaption();
      }
      
      logger.info(`InstagramStoriesService: Текст: "${caption}"`);
      
      // Шаг 1: Создание контейнера для медиа
      const mediaContainerId = await this.createMediaContainer(imageUrl, caption);
      logger.info(`InstagramStoriesService: Контейнер для медиа создан с ID: ${mediaContainerId}`);
      
      // Шаг 2: Публикация истории
      const publishResult = await this.publishMedia(mediaContainerId);
      const storyId = publishResult.id;
      
      logger.info(`InstagramStoriesService: История успешно опубликована с ID: ${storyId}`);
      
      // Форматируем URL истории с корректным ID
      const storyUrl = `https://www.instagram.com/stories/${this.getInstagramUsername()}/${storyId}/`;
      
      return {
        success: true,
        storyId,
        storyUrl,
        mediaContainerId
      };
    } catch (error) {
      logger.error(`InstagramStoriesService: Ошибка при публикации истории: ${error.message || JSON.stringify(error)}`);
      return {
        success: false,
        error: error.message || error
      };
    }
  }
  
  /**
   * Создает контейнер для медиа в Instagram
   * @param imageUrl URL изображения
   * @param caption Текст подписи
   * @returns ID созданного контейнера
   */
  private async createMediaContainer(imageUrl: string, caption?: string): Promise<string> {
    try {
      // Подготовка параметров для создания контейнера
      const formData = new FormData();
      formData.append('image_url', imageUrl);
      formData.append('media_type', 'STORIES');
      
      // Добавляем подпись, если она предоставлена
      if (caption) {
        formData.append('caption', caption);
      }
      
      // Выполняем запрос к Instagram API для создания контейнера
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${this.businessAccountId}/media`,
        formData,
        {
          params: {
            access_token: this.token
          },
          headers: {
            ...formData.getHeaders()
          }
        }
      );
      
      // Возвращаем ID созданного контейнера
      return response.data.id;
    } catch (error) {
      logger.error(`InstagramStoriesService: Ошибка при создании контейнера: ${error.message || JSON.stringify(error)}`);
      throw error;
    }
  }
  
  /**
   * Публикует медиа как историю в Instagram
   * @param mediaContainerId ID контейнера с медиа
   * @returns Результат публикации
   */
  private async publishMedia(mediaContainerId: string): Promise<any> {
    try {
      // Подготовка формы для запроса
      const formData = new FormData();
      formData.append('creation_id', mediaContainerId);
      
      // Выполняем запрос к Instagram API для публикации контейнера
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${this.businessAccountId}/media_publish`,
        formData,
        {
          params: {
            access_token: this.token
          },
          headers: {
            ...formData.getHeaders()
          }
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error(`InstagramStoriesService: Ошибка при публикации: ${error.message || JSON.stringify(error)}`);
      throw error;
    }
  }
  
  /**
   * Получает имя пользователя Instagram из настроек
   * @returns Имя пользователя Instagram
   */
  private getInstagramUsername(): string {
    // В идеале это значение должно быть получено из настроек или переменных окружения
    // Для примера используем заглушку
    return process.env.INSTAGRAM_USERNAME || 'it.zhdanov';
  }
}

export default InstagramStoriesService;