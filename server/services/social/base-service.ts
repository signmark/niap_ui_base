import axios from 'axios';
import { log } from '../../utils/logger';
import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { storage } from '../../storage';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import { imgurUploaderService } from '../imgur-uploader';

/**
 * Базовый класс для сервисов публикации в социальные сети
 */
export abstract class BaseSocialService {
  /**
   * Получает системный токен для доступа к API Directus
   * @returns Токен доступа или null в случае ошибки
   */
  protected async getSystemToken(): Promise<string | null> {
    try {
      const directusAuthManager = await import('../directus-auth-manager').then(m => m.directusAuthManager);
      const directusCrud = await import('../directus-crud').then(m => m.directusCrud);
      const adminUserId = process.env.DIRECTUS_ADMIN_USER_ID || '53921f16-f51d-4591-80b9-8caa4fde4d13';
      
      // 1. Приоритет - авторизация через логин/пароль (если есть учетные данные)
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      
      if (email && password) {
        log(`Попытка авторизации администратора с учетными данными из env`, 'social-publishing');
        try {
          const adminSession = await directusAuthManager.loginUserWithCredentials(email, password);
          if (adminSession) {
            log(`Авторизация администратора успешна через прямой API запрос`, 'social-publishing');
            return adminSession.accessToken;
          }
        } catch (e) {
          log(`Ошибка авторизации администратора: ${e}`, 'social-publishing');
        }
      }
      
      // 2. Вариант - использовать хранящуюся сессию администратора
      try {
        const adminSession = directusAuthManager.getUserSession(adminUserId);
        if (adminSession && adminSession.accessToken) {
          log(`Использование существующей авторизации администратора`, 'social-publishing');
          return adminSession.accessToken;
        }
      } catch (e) {
        log(`Не удалось получить существующую сессию администратора: ${e}`, 'social-publishing');
      }
      
      return null;
    } catch (error) {
      log(`Ошибка получения системного токена: ${error}`, 'social-publishing');
      return null;
    }
  }

  /**
   * Обрабатывает поле дополнительных изображений в контенте, проверяя и преобразуя его при необходимости
   * @param content Контент, содержащий дополнительные изображения
   * @param platform Название социальной платформы (для логирования)
   * @returns Обновленный контент с обработанным полем additionalImages
   */
  protected processAdditionalImages(content: CampaignContent, platform: string): CampaignContent {
    const updatedContent = { ...content };
    
    try {
      // Проверяем наличие поля additionalImages и его формат
      if (updatedContent.additionalImages) {
        // Если additionalImages - это строка, пытаемся преобразовать её в массив
        if (typeof updatedContent.additionalImages === 'string') {
          try {
            // Пробуем распарсить JSON
            const parsedImages = JSON.parse(updatedContent.additionalImages);
            
            // Проверка, что parsedImages является массивом
            if (Array.isArray(parsedImages)) {
              updatedContent.additionalImages = parsedImages;
              log(`Строковое представление additionalImages преобразовано в массив для ${platform}, найдено ${parsedImages.length} изображений`, 'social-publishing');
            } else {
              // Если это не массив, но объект с полем, содержащим массив
              if (parsedImages && typeof parsedImages === 'object') {
                // Проверяем наличие полей, которые могут содержать массив изображений
                const possibleArrayFields = Object.keys(parsedImages).filter(key => 
                  Array.isArray(parsedImages[key])
                );
                
                if (possibleArrayFields.length > 0) {
                  // Используем первое найденное поле с массивом
                  updatedContent.additionalImages = parsedImages[possibleArrayFields[0]];
                  log(`Найден массив изображений в поле ${possibleArrayFields[0]}, содержит ${updatedContent.additionalImages.length} элементов`, 'social-publishing');
                } else {
                  // Если не нашли массив, создаем пустой
                  updatedContent.additionalImages = [];
                  log(`additionalImages преобразован в пустой массив для ${platform} (не удалось найти массив в объекте)`, 'social-publishing');
                }
              } else {
                // Если не удалось распознать формат, создаем пустой массив
                updatedContent.additionalImages = [];
                log(`additionalImages преобразован в пустой массив для ${platform} (неизвестный формат)`, 'social-publishing');
              }
            }
          } catch (error) {
            // Если не удалось распарсить JSON, считаем это одиночным URL и создаем массив с одним элементом
            if (updatedContent.additionalImages.trim().startsWith('http')) {
              updatedContent.additionalImages = [updatedContent.additionalImages.trim()];
              log(`additionalImages в виде строки URL преобразован в массив с одним элементом для ${platform}`, 'social-publishing');
            } else {
              // Иначе создаем пустой массив
              updatedContent.additionalImages = [];
              log(`additionalImages преобразован в пустой массив для ${platform} (не удалось распарсить JSON)`, 'social-publishing');
            }
          }
        } 
        // Если additionalImages уже массив, проверяем его элементы
        else if (Array.isArray(updatedContent.additionalImages)) {
          // Фильтруем только строковые значения
          updatedContent.additionalImages = updatedContent.additionalImages.filter(img => typeof img === 'string' && img.trim() !== '');
          log(`additionalImages уже является массивом для ${platform}, содержит ${updatedContent.additionalImages.length} элементов после фильтрации`, 'social-publishing');
        } 
        // В остальных случаях создаем пустой массив
        else {
          updatedContent.additionalImages = [];
          log(`additionalImages преобразован в пустой массив для ${platform} (неизвестный тип)`, 'social-publishing');
        }
      } else {
        // Если additionalImages отсутствует, инициализируем его пустым массивом
        updatedContent.additionalImages = [];
        log(`additionalImages инициализирован пустым массивом для ${platform} (поле отсутствовало)`, 'social-publishing');
      }
      
      return updatedContent;
    } catch (error) {
      log(`Ошибка при обработке поля additionalImages для ${platform}: ${error}`, 'social-publishing');
      // В случае ошибки возвращаем контент с пустым массивом additionalImages
      return {
        ...updatedContent,
        additionalImages: []
      };
    }
  }

  /**
   * Загружает изображения на Imgur для использования в социальных сетях
   * @param content Контент с изображениями для загрузки
   * @returns Контент с обновленными URLs изображений, загруженных на Imgur
   */
  protected async uploadImagesToImgur(content: CampaignContent): Promise<CampaignContent> {
    try {
      // Создаем копию контента
      const updatedContent = { ...content };
      
      // Обрабатываем основное изображение, если оно есть
      if (updatedContent.imageUrl && !updatedContent.imageUrl.startsWith('http')) {
        log(`Загрузка основного изображения на Imgur: ${updatedContent.imageUrl}`, 'social-publishing');
        
        try {
          const imgurUrl = await imgurUploaderService.uploadImageFromUrl(updatedContent.imageUrl);
          
          if (imgurUrl) {
            log(`Основное изображение успешно загружено на Imgur: ${imgurUrl}`, 'social-publishing');
            updatedContent.imageUrl = imgurUrl;
          } else {
            log(`Ошибка загрузки основного изображения на Imgur`, 'social-publishing');
          }
        } catch (uploadError) {
          log(`Исключение при загрузке основного изображения на Imgur: ${uploadError}`, 'social-publishing');
        }
      }
      
      // Обрабатываем дополнительные изображения, если они есть
      if (updatedContent.additionalImages && Array.isArray(updatedContent.additionalImages) && updatedContent.additionalImages.length > 0) {
        log(`Обработка ${updatedContent.additionalImages.length} дополнительных изображений для загрузки на Imgur`, 'social-publishing');
        
        // Отслеживаем только изображения, которые нужно загрузить (локальные пути)
        const localImages = updatedContent.additionalImages.filter(img => img && typeof img === 'string' && !img.startsWith('http'));
        
        if (localImages.length > 0) {
          log(`Найдено ${localImages.length} локальных дополнительных изображений для загрузки на Imgur`, 'social-publishing');
          
          // Загружаем все изображения параллельно
          const uploadPromises = localImages.map(imagePath => 
            imgurUploaderService.uploadImageFromUrl(imagePath)
              .catch(error => {
                log(`Ошибка загрузки дополнительного изображения ${imagePath} на Imgur: ${error}`, 'social-publishing');
                return null;
              })
          );
          
          const uploadResults = await Promise.all(uploadPromises);
          
          // Создаем маппинг старых путей к новым URL
          const imageUrlMap = new Map<string, string>();
          
          localImages.forEach((oldPath, index) => {
            const result = uploadResults[index];
            if (result) {
              imageUrlMap.set(oldPath, result);
              log(`Дополнительное изображение успешно загружено на Imgur: ${oldPath} -> ${result}`, 'social-publishing');
            } else {
              log(`Не удалось загрузить дополнительное изображение на Imgur: ${oldPath}`, 'social-publishing');
            }
          });
          
          // Обновляем URL изображений в контенте
          const imgurUrls = updatedContent.additionalImages.map(img => {
            // Если изображение локальное и было успешно загружено, заменяем URL
            if (img && typeof img === 'string' && !img.startsWith('http') && imageUrlMap.has(img)) {
              return imageUrlMap.get(img) as string;
            }
            return img;
          });
          
          updatedContent.additionalImages = imgurUrls;
          log(`Завершена загрузка дополнительных изображений на Imgur, всего: ${imgurUrls.length}`, 'social-publishing');
        }
      }
      
      return updatedContent;
    } catch (error) {
      log(`Ошибка при загрузке изображений на Imgur: ${error}`, 'social-publishing');
      return content; // Возвращаем оригинальный контент в случае ошибки
    }
  }

  /**
   * Получает базовый URL приложения без использования process.env
   * @returns Базовый URL приложения
   */
  protected getAppBaseUrl(): string {
    // Приоритет имеют явно указанные URL
    // Сначала проверяем наличие переменных окружения
    const envBaseUrl = process.env.APP_URL || process.env.VITE_APP_URL;
    if (envBaseUrl) {
      return envBaseUrl.endsWith('/') ? envBaseUrl.slice(0, -1) : envBaseUrl;
    }

    // Если переменных нет, используем значения по умолчанию, в зависимости от среды
    const productionUrl = 'https://smm.nplanner.ru';
    
    // Проверка продакшн-режима
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      return productionUrl;
    } else {
      // Для локальной разработки
      return 'http://localhost:3000';
    }
  }
  
  /**
   * Обновляет статус публикации контента в социальной сети
   * @param contentId ID контента
   * @param platform Социальная платформа
   * @param publicationResult Результат публикации
   * @returns Обновленный контент или null в случае ошибки
   */
  public async updatePublicationStatus(
    contentId: string, 
    platform: SocialPlatform, 
    publicationResult: SocialPublication
  ): Promise<CampaignContent | null> {
    try {
      log(`Обновление статуса публикации: ${contentId}, платформа: ${platform}, статус: ${publicationResult.status}`, 'social-publishing');
      
      // Получаем текущий контент из Directus
      const token = await this.getSystemToken();
      
      if (!token) {
        log(`Не удалось получить токен для обновления статуса публикации`, 'social-publishing');
        return null;
      }
      
      const content = await storage.getCampaignContent(contentId, token);
      
      if (!content) {
        log(`Не удалось получить контент с ID ${contentId} для обновления статуса публикации`, 'social-publishing');
        return null;
      }
      
      // Создаем или обновляем поле socialPublications
      const socialPublications = content.socialPublications || {};
      
      socialPublications[platform] = {
        status: publicationResult.status,
        publishedAt: publicationResult.publishedAt ? new Date(publicationResult.publishedAt).toISOString() : null,
        postUrl: publicationResult.postUrl || null,
        error: publicationResult.error || null
      };
      
      // Обновляем контент
      const updatedContent = await storage.updateCampaignContent(contentId, {
        socialPublications,
        // Если публикация успешна, обновляем общий статус до "published"
        // только если мы публиковали на все выбранные платформы
        ...(publicationResult.status === 'published' ? {
          // Проверяем, были ли опубликованы все выбранные платформы
          status: this.shouldUpdateToPublished(content, socialPublications) ? 'published' : content.status
        } : {})
      }, token);
      
      if (updatedContent) {
        log(`Статус публикации успешно обновлен для ${contentId}, платформа: ${platform}`, 'social-publishing');
        return updatedContent;
      } else {
        log(`Ошибка при обновлении статуса публикации для ${contentId}`, 'social-publishing');
        return null;
      }
    } catch (error) {
      log(`Исключение при обновлении статуса публикации: ${error}`, 'social-publishing');
      return null;
    }
  }
  
  /**
   * Проверяет, следует ли обновить общий статус контента до "published"
   * @param content Оригинальный контент
   * @param socialPublications Обновленные статусы публикаций
   * @returns true, если все выбранные платформы опубликованы
   */
  private shouldUpdateToPublished(
    content: CampaignContent, 
    socialPublications: Record<string, any>
  ): boolean {
    // Проверяем, указаны ли социальные платформы
    if (!content.socialPlatforms || !Array.isArray(content.socialPlatforms) || content.socialPlatforms.length === 0) {
      log(`У контента ${content.id} нет выбранных социальных платформ`, 'social-publishing');
      return false;
    }
    
    // Проверяем, все ли выбранные платформы опубликованы
    const selectedPlatforms = content.socialPlatforms;
    let allPublished = true;
    
    for (const platform of selectedPlatforms) {
      // Если платформа выбрана, но не опубликована или публикация не прошла успешно
      if (
        !socialPublications[platform] || 
        socialPublications[platform].status !== 'published'
      ) {
        allPublished = false;
        log(`Платформа ${platform} не опубликована или публикация не прошла успешно`, 'social-publishing');
        break;
      }
    }
    
    log(`Проверка статуса публикации для ${content.id}: ${allPublished ? 'все платформы опубликованы' : 'не все платформы опубликованы'}`, 'social-publishing');
    return allPublished;
  }

  /**
   * Публикует контент в выбранную социальную платформу
   * @param content Контент для публикации
   * @param platform Социальная платформа
   * @param settings Настройки социальных сетей
   * @returns Результат публикации
   */
  public abstract publishToPlatform(
    content: CampaignContent,
    platform: SocialPlatform,
    settings: SocialMediaSettings
  ): Promise<SocialPublication>;
}