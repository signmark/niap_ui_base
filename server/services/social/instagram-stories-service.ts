/**
 * Сервис для публикации Instagram Stories
 * 
 * Обеспечивает функциональность для публикации сторис в Instagram
 * и получения прямых ссылок на опубликованные истории
 */

import axios from 'axios';
import FormData from 'form-data';
import { log } from '../../utils/logger';

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
    
    log('InstagramStoriesService: Сервис инициализирован');
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
    igUsername?: string;
    creationTime?: string;
    profileUrl?: string; // Добавляем поле для URL профиля
    error?: any;
  }> {
    try {
      log(`InstagramStoriesService: Подготовка к публикации Instagram Stories`);
      log(`InstagramStoriesService: Изображение: ${imageUrl}`);
      
      // Шаг 1: Создание контейнера для медиа
      const mediaContainerId = await this.createMediaContainer(imageUrl, caption);
      log(`InstagramStoriesService: Контейнер для медиа создан с ID: ${mediaContainerId}`);
      
      // Шаг 2: Публикация истории
      const publishResult = await this.publishMedia(mediaContainerId);
      const storyId = publishResult.id;
      
      log(`InstagramStoriesService: История успешно опубликована с ID: ${storyId}`);
      log(`InstagramStoriesService: Полные данные ответа: ${JSON.stringify(publishResult)}`);
      
      // Получаем дополнительную информацию о публикации, если она доступна
      const igUsername = this.getInstagramUsername();
      const creationTime = new Date().toISOString();
      
      // ID истории в Instagram не может быть использован для создания прямых ссылок
      // Вместо этого используем профиль пользователя
      
      // Форматируем URL истории - для Instagram Stories доступна только ссылка на профиль
      const storyUrl = `https://www.instagram.com/stories/${igUsername}/`;
      
      // Хотя мы сохраняем ID истории, важно понимать,
      // что его нельзя использовать для создания прямой ссылки на конкретную историю
      return {
        success: true,
        storyId,                // ID для обратной совместимости
        storyUrl,               // Ссылка на истории профиля
        mediaContainerId,       // ID контейнера для отладки
        igUsername,             // Имя пользователя Instagram
        creationTime,           // Время создания
        profileUrl: `https://www.instagram.com/${igUsername}/` // Ссылка на профиль для дополнительного использования
      };
    } catch (error: any) {
      log(`InstagramStoriesService: Ошибка при публикации истории: ${error.message || JSON.stringify(error)}`);
      return {
        success: false,
        error: error.message || error
      };
    }
  }
  
  /**
   * Создает контейнер для медиа в Instagram
   * @param imageUrl URL изображения
   * @param caption Текст подписи (опционально)
   * @returns ID созданного контейнера
   */
  private async createMediaContainer(imageUrl: string, caption?: string): Promise<string> {
    try {
      // Подготовка параметров для создания контейнера
      const formData = new FormData();
      formData.append('image_url', imageUrl);
      formData.append('media_type', 'STORIES');
      
      // Добавляем подпись, если она предоставлена. Подпись не отображается в истории,
      // но может использоваться как метаданные
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
    } catch (error: any) {
      log(`InstagramStoriesService: Ошибка при создании контейнера: ${error.message || JSON.stringify(error)}`);
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
    } catch (error: any) {
      log(`InstagramStoriesService: Ошибка при публикации: ${error.message || JSON.stringify(error)}`);
      throw error;
    }
  }
  
  /**
   * Получает имя пользователя Instagram из настроек
   * @returns Имя пользователя Instagram
   */
  private getInstagramUsername(): string {
    // Приоритеты для определения имени пользователя:
    // 1. Переменная окружения INSTAGRAM_USERNAME
    // 2. Переменная окружения IG_USERNAME
    // 3. Значение по умолчанию
    
    // Проверяем переменные окружения
    if (process.env.INSTAGRAM_USERNAME) {
      return process.env.INSTAGRAM_USERNAME;
    }
    
    if (process.env.IG_USERNAME) {
      return process.env.IG_USERNAME;
    }
    
    // Используем значение по умолчанию как последний вариант
    const defaultUsername = 'it.zhdanov';
    log(`InstagramStoriesService: Используем имя пользователя по умолчанию: ${defaultUsername}`);
    return defaultUsername;
  }
}

export default InstagramStoriesService;