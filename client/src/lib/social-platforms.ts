import { SocialPlatform } from '@/types';

/**
 * Объект с названиями социальных платформ на русском языке
 */
export const platformNames: Record<SocialPlatform, string> = {
  telegram: 'Telegram',
  instagram: 'Instagram',
  vk: 'ВКонтакте',
  facebook: 'Facebook',
};

/**
 * Получает массив доступных платформ из настроек социальных сетей кампании
 * @param socialMediaSettings Настройки социальных сетей
 * @returns Массив кодов доступных платформ
 */
export function getAvailablePlatforms(socialMediaSettings: any): SocialPlatform[] {
  if (!socialMediaSettings) return [];
  
  const platforms: SocialPlatform[] = [];
  
  if (socialMediaSettings.telegram?.token && socialMediaSettings.telegram?.chatId) {
    platforms.push('telegram');
  }
  
  if (socialMediaSettings.vk?.token && socialMediaSettings.vk?.groupId) {
    platforms.push('vk');
  }
  
  if (socialMediaSettings.instagram?.token || socialMediaSettings.instagram?.accessToken) {
    platforms.push('instagram');
  }
  
  if (socialMediaSettings.facebook?.token && socialMediaSettings.facebook?.pageId) {
    platforms.push('facebook');
  }
  
  return platforms;
}

/**
 * Безопасно извлекает объект социальных платформ из контента
 * Преобразует различные форматы в стандартный объект
 * @param socialPlatforms Объект социальных платформ из контента
 * @returns Стандартизированный объект социальных платформ
 */
export function safeSocialPlatforms(socialPlatforms: any): Record<SocialPlatform, any> {
  if (!socialPlatforms || typeof socialPlatforms !== 'object') {
    return {} as Record<SocialPlatform, any>;
  }
  
  // Проверяем возможные форматы и преобразуем их в стандартный
  if (Array.isArray(socialPlatforms)) {
    // Если это массив, преобразуем его в объект
    const result: Record<string, any> = {};
    socialPlatforms.forEach(platform => {
      if (typeof platform === 'string') {
        result[platform] = { status: 'pending' };
      } else if (platform && typeof platform === 'object' && platform.name) {
        result[platform.name] = { 
          status: platform.status || 'pending',
          scheduledAt: platform.scheduledAt || null,
          publishedAt: platform.publishedAt || null,
          postId: platform.postId || null,
          postUrl: platform.postUrl || null,
          error: platform.error || null
        };
      }
    });
    return result as Record<SocialPlatform, any>;
  }
  
  // Если это уже объект, убедимся что ключи - это правильные названия платформ
  const validPlatforms: SocialPlatform[] = ['telegram', 'instagram', 'vk', 'facebook'];
  const result: Record<string, any> = {};
  
  validPlatforms.forEach(platform => {
    if (platform in socialPlatforms) {
      result[platform] = socialPlatforms[platform];
    }
  });
  
  return result as Record<SocialPlatform, any>;
}

/**
 * Определяет, подходит ли контент для указанной платформы
 * @param content Контент для проверки
 * @param platform Социальная платформа
 * @returns true если контент подходит для платформы
 */
export function isContentSuitableForPlatform(content: any, platform: SocialPlatform): boolean {
  if (!content) return false;

  // Проверяем максимальную длину текста для разных платформ
  const contentText = content.content || '';
  const textLength = contentText.replace(/<[^>]+>/g, '').length; // Удаляем HTML-теги для подсчета

  switch (platform) {
    case 'telegram':
      return textLength <= 4096; // Telegram имеет лимит в 4096 символов
    
    case 'instagram':
      // Instagram предпочитает контент с изображениями
      return (!!content.imageUrl && textLength <= 2200);
    
    case 'facebook':
      return textLength <= 63206; // Facebook имеет большой лимит текста
    
    case 'vk':
      return textLength <= 16384; // ВКонтакте имеет лимит около 16K символов
    
    default:
      return true;
  }
}

/**
 * Проверяет, настроена ли социальная платформа для публикации
 * @param socialMediaSettings Настройки социальных сетей
 * @param platform Платформа для проверки
 * @returns true если платформа настроена корректно
 */
export function isPlatformConfigured(socialMediaSettings: any, platform: SocialPlatform): boolean {
  if (!socialMediaSettings) return false;
  
  switch (platform) {
    case 'telegram':
      return !!socialMediaSettings.telegram?.token && !!socialMediaSettings.telegram?.chatId;
    
    case 'vk':
      return !!socialMediaSettings.vk?.token && !!socialMediaSettings.vk?.groupId;
    
    case 'instagram':
      return !!socialMediaSettings.instagram?.token || !!socialMediaSettings.instagram?.accessToken;
    
    case 'facebook':
      return !!socialMediaSettings.facebook?.token && !!socialMediaSettings.facebook?.pageId;
    
    default:
      return false;
  }
}