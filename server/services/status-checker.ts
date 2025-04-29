/**
 * Сервис для периодической проверки и обновления статусов публикаций
 * Это поможет решить проблему с контентом, который остается в статусе 'scheduled',
 * несмотря на то, что все платформы уже имеют статус 'published'
 */

import axios from 'axios';
import { log } from '../utils/logger';
import { storage } from '../storage';
import { SocialPlatform } from '@shared/schema';

class PublicationStatusChecker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 5 * 60 * 1000; // проверка каждые 5 минут
  
  // Кэш токенов администратора для использования в API запросах
  private adminTokenCache: string | null = null;
  private adminTokenTimestamp: number = 0;
  private tokenExpirationMs = 30 * 60 * 1000; // 30 минут
  
  /**
   * Запускает сервис проверки статусов публикаций
   */
  start() {
    if (this.isRunning) {
      log('Сервис проверки статусов публикаций уже запущен', 'status-checker');
      return;
    }
    
    log('Запуск сервиса проверки статусов публикаций', 'status-checker');
    
    // Запускаем немедленную первую проверку
    this.checkPublicationStatuses();
    
    // Запускаем регулярные проверки по интервалу
    this.intervalId = setInterval(() => {
      this.checkPublicationStatuses();
    }, this.checkIntervalMs);
    
    this.isRunning = true;
  }
  
  /**
   * Останавливает сервис проверки статусов
   */
  stop() {
    if (!this.isRunning || !this.intervalId) {
      return;
    }
    
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    
    log('Сервис проверки статусов публикаций остановлен', 'status-checker');
  }
  
  /**
   * Получает токен администратора для API запросов
   * с кэшированием для минимизации авторизаций
   */
  private async getAdminToken(): Promise<string | null> {
    if (this.adminTokenCache && (Date.now() - this.adminTokenTimestamp) < this.tokenExpirationMs) {
      log('Использование кэшированного токена администратора', 'status-checker');
      return this.adminTokenCache;
    }
    
    // Сначала пробуем получить токен из переменных окружения
    const envToken = process.env.DIRECTUS_ADMIN_TOKEN;
    if (envToken) {
      log('Использование токена администратора из переменных окружения', 'status-checker');
      this.adminTokenCache = envToken;
      this.adminTokenTimestamp = Date.now();
      return envToken;
    }
    
    // Если в переменных нет токена, пытаемся получить его через авторизацию
    try {
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      
      if (!email || !password) {
        log('Отсутствуют учетные данные администратора для авторизации', 'status-checker');
        return null;
      }
      
      log('Попытка авторизации администратора с учетными данными из env', 'status-checker');
      
      const authResponse = await axios.post(`${directusUrl}/auth/login`, {
        email,
        password
      });
      
      if (authResponse?.data?.data?.access_token) {
        const token = authResponse.data.data.access_token;
        log('Получен новый токен администратора', 'status-checker');
        
        // Кэшируем токен
        this.adminTokenCache = token;
        this.adminTokenTimestamp = Date.now();
        
        return token;
      }
      
      log('Не удалось получить токен из ответа авторизации', 'status-checker');
      return null;
    } catch (error: any) {
      log(`Ошибка при авторизации администратора: ${error.message}`, 'status-checker');
      return null;
    }
  }
  
  /**
   * Проверяет статусы публикаций и обновляет общие статусы контента
   * Имеет встроенные меры безопасности:
   * 1. Проверка статусов конкретной платформы (должны быть либо published, либо failed)
   * 2. Проверка, что все выбранные платформы достигли финального статуса
   * 3. Проверка, что хотя бы одна платформа успешно опубликована
   */
  private async checkPublicationStatuses() {
    try {
      // Снижаем уровень детализации логов
      log('Проверка статусов публикаций', 'status-checker');
      
      // Получаем токен администратора для запросов
      const adminToken = await this.getAdminToken();
      if (!adminToken) {
        log('Не удалось получить токен администратора для проверки статусов', 'status-checker');
        return;
      }
      
      // Получаем контент со статусом 'scheduled' через API
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      
      // Для отладки включаем все статусы кроме 'published'
      const includeStatuses = ['scheduled', 'draft'];
      const filters = includeStatuses.map(status => `filter[status][_eq]=${status}`).join('&');
      
      // Бóльшие лимиты для проверки большего количества контента за раз
      const response = await axios.get(
        `${directusUrl}/items/campaign_content?${filters}&limit=100`, 
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response?.data?.data || !Array.isArray(response.data.data)) {
        log('API вернул некорректный формат данных', 'status-checker');
        return;
      }
      
      const contentItems = response.data.data;
      
      // Счетчики для логирования
      let processedItems = 0;
      let updatedItems = 0;
      let skippedItems = 0;
      
      // Перебор всех элементов контента для проверки статусов
      for (const item of contentItems) {
        // Критически важная проверка на наличие поля social_platforms
        if (!item.social_platforms) {
          skippedItems++;
          continue;
        }
        
        // Преобразование данных социальных платформ, если они хранятся в виде строки
        let platformsData = item.social_platforms;
        if (typeof platformsData === 'string') {
          try {
            platformsData = JSON.parse(platformsData);
          } catch (error) {
            skippedItems++;
            continue;
          }
        }
        
        // Если данные платформ не являются объектом, пропускаем
        if (!platformsData || typeof platformsData !== 'object') {
          skippedItems++;
          continue;
        }
        
        // Получаем списки платформ по статусам
        const selectedPlatforms = Object.entries(platformsData)
          .filter(([_, platformData]: [string, any]) => platformData?.selected)
          .map(([platform]) => platform);
          
        const publishedPlatforms = Object.entries(platformsData)
          .filter(([_, platformData]: [string, any]) => platformData?.selected && platformData?.status === 'published')
          .map(([platform]) => platform);
          
        const failedPlatforms = Object.entries(platformsData)
          .filter(([_, platformData]: [string, any]) => platformData?.selected && (platformData?.status === 'failed' || platformData?.error))
          .map(([platform]) => platform);
          
        const pendingPlatforms = Object.entries(platformsData)
          .filter(([_, platformData]: [string, any]) => {
            return platformData?.selected && 
                   platformData?.status !== 'published' && 
                   platformData?.status !== 'failed' && 
                   !platformData?.error;
          })
          .map(([platform]) => platform);
        
        // Проверка условий для обновления статуса
        const allPublished = selectedPlatforms.length > 0 && 
                            selectedPlatforms.length === publishedPlatforms.length;
                            
        const allFinalized = pendingPlatforms.length === 0 && 
                            selectedPlatforms.length > 0;
        
        // Определяем необходимость обновления статуса
        let shouldUpdateStatus = false;
        let newStatus = item.status;
        
        if (allPublished) {
          // Если все платформы опубликованы, ставим статус 'published'
          shouldUpdateStatus = true;
          newStatus = 'published';
        } else if (allFinalized && publishedPlatforms.length > 0) {
          // Если все платформы завершили публикацию (успешно или с ошибкой) и есть хотя бы одна успешная,
          // также ставим статус 'published'
          shouldUpdateStatus = true;
          newStatus = 'published';
        }
        
        // Обновляем статус, если необходимо
        if (shouldUpdateStatus && newStatus !== item.status) {
          try {
            // Обновляем статус через storage для более высокой надежности
            const updated = await storage.updateCampaignContent(
              item.id,
              { status: newStatus, publishedAt: new Date() },
              adminToken
            );
            
            if (updated) {
              log(`Обновлен статус контента ID ${item.id} на ${newStatus}`, 'status-checker');
              updatedItems++;
            }
          } catch (updateError: any) {
            log(`Ошибка при обновлении контента ${item.id}`, 'status-checker');
          }
        }
        
        processedItems++;
      }
      
      // Только если были обновления, выводим статистику
      if (updatedItems > 0) {
        log(`Обновлено ${updatedItems} контент(ов)`, 'status-checker');
      }
    } catch (error: any) {
      log(`Ошибка при проверке статусов публикаций: ${error.message}`, 'status-checker');
    }
  }
}

// Экспортируем экземпляр класса для использования в других модулях
export const publicationStatusChecker = new PublicationStatusChecker();
