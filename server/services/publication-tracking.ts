import { log } from '../utils/logger';
import axios from 'axios';

/**
 * Трекинг публикаций для предотвращения дублирования
 * Использует базу данных для персистентного хранения состояний
 */
export class PublicationTracker {
  private processedPublications = new Set<string>(); // contentId:platform
  private lockTimeout = 10 * 60 * 1000; // 10 минут на публикацию
  
  /**
   * Проверяет, можно ли публиковать контент на платформе
   */
  async canPublish(contentId: string, platform: string): Promise<boolean> {
    const lockKey = `${contentId}:${platform}`;
    
    // Проверяем локальный кэш
    if (this.processedPublications.has(lockKey)) {
      log(`📊 TRACKING: Контент ${contentId} уже обрабатывается в ${platform} (локальный кэш)`, 'publication-tracker');
      return false;
    }
    
    // Проверяем статус в базе данных
    try {
      const authToken = process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_ADMIN_TOKEN;
      if (!authToken) return true;
      
      const response = await axios.get(`${process.env.DIRECTUS_URL}/items/campaign_content/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          fields: 'social_platforms'
        }
      });
      
      const content = response?.data?.data;
      if (!content?.social_platforms) return true;
      
      let platforms = content.social_platforms;
      if (typeof platforms === 'string') {
        platforms = JSON.parse(platforms);
      }
      
      const platformData = platforms[platform];
      if (!platformData) return true;
      
      // Если уже опубликован - блокируем
      if (platformData.status === 'published' && platformData.postUrl && platformData.postUrl.trim() !== '') {
        log(`📊 TRACKING: Контент ${contentId} УЖЕ ОПУБЛИКОВАН в ${platform} (${platformData.postUrl})`, 'publication-tracker');
        this.markAsProcessed(contentId, platform);
        return false;
      }
      
      // Если в процессе публикации (статус pending с недавней датой)
      if (platformData.status === 'pending' && platformData.updatedAt) {
        const updatedTime = new Date(platformData.updatedAt).getTime();
        const now = Date.now();
        
        if (now - updatedTime < this.lockTimeout) {
          log(`📊 TRACKING: Контент ${contentId} в процессе публикации в ${platform} (pending ${Math.round((now - updatedTime) / 1000)}s)`, 'publication-tracker');
          this.markAsProcessed(contentId, platform);
          return false;
        }
      }
      
      return true;
      
    } catch (error: any) {
      log(`📊 TRACKING: Ошибка проверки статуса ${contentId}:${platform} - ${error.message}`, 'publication-tracker');
      return true; // В случае ошибки разрешаем публикацию
    }
  }
  
  /**
   * Отмечает контент как обрабатываемый
   */
  markAsProcessed(contentId: string, platform: string) {
    const lockKey = `${contentId}:${platform}`;
    this.processedPublications.add(lockKey);
    log(`📊 TRACKING: Отмечен как обрабатываемый ${lockKey}`, 'publication-tracker');
    
    // Автоматически удаляем через timeout
    setTimeout(() => {
      this.processedPublications.delete(lockKey);
      log(`📊 TRACKING: Блокировка снята для ${lockKey}`, 'publication-tracker');
    }, this.lockTimeout);
  }
  
  /**
   * Снимает блокировку с контента
   */
  releasePublication(contentId: string, platform: string) {
    const lockKey = `${contentId}:${platform}`;
    this.processedPublications.delete(lockKey);
    log(`📊 TRACKING: Принудительно снята блокировка ${lockKey}`, 'publication-tracker');
  }
  
  /**
   * Получает статистику трекинга
   */
  getStats() {
    return {
      activePublications: this.processedPublications.size,
      publicationsInProgress: Array.from(this.processedPublications)
    };
  }
}

// Синглтон для глобального использования
export const publicationTracker = new PublicationTracker();