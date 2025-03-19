import { SocialPlatform } from '@/types';

/**
 * Названия социальных платформ на русском языке
 */
export const platformNames: Record<SocialPlatform, string> = {
  telegram: 'Telegram',
  instagram: 'Instagram',
  vk: 'ВКонтакте',
  facebook: 'Facebook',
};

/**
 * Получает список настроенных социальных платформ из настроек кампании
 * @param socialMediaSettings Настройки социальных сетей кампании
 * @returns Массив идентификаторов платформ
 */
export function getConfiguredPlatforms(socialMediaSettings: any): SocialPlatform[] {
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
 * Проверяет, настроена ли платформа для публикации
 * @param socialMediaSettings Настройки социальных сетей
 * @param platform Платформа для проверки
 * @returns true если платформа настроена
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

/**
 * Получает список платформ из объекта социальных платформ контента
 * @param socialPlatforms Объект социальных платформ из контента
 * @returns Массив идентификаторов платформ
 */
export function getPlatformsFromContent(socialPlatforms: any): SocialPlatform[] {
  if (!socialPlatforms || typeof socialPlatforms !== 'object') {
    return [];
  }
  
  if (Array.isArray(socialPlatforms)) {
    return socialPlatforms
      .filter(p => typeof p === 'string' || (p && typeof p === 'object' && p.name))
      .map(p => typeof p === 'string' ? p : p.name) as SocialPlatform[];
  }
  
  // Если socialPlatforms - это объект с ключами-платформами
  return Object.keys(socialPlatforms).filter(key => {
    const validPlatforms: SocialPlatform[] = ['telegram', 'instagram', 'vk', 'facebook'];
    return validPlatforms.includes(key as SocialPlatform);
  }) as SocialPlatform[];
}

/**
 * Стандартизирует объект социальных платформ
 * @param socialPlatforms Объект социальных платформ из контента
 * @returns Стандартизированный объект платформ
 */
export function normalizeSocialPlatforms(socialPlatforms: any): Record<string, any> {
  if (!socialPlatforms || typeof socialPlatforms !== 'object') {
    return {};
  }
  
  const result: Record<string, any> = {};
  const validPlatforms: SocialPlatform[] = ['telegram', 'instagram', 'vk', 'facebook'];
  
  // Если socialPlatforms - это массив
  if (Array.isArray(socialPlatforms)) {
    socialPlatforms.forEach(platform => {
      if (typeof platform === 'string' && validPlatforms.includes(platform as SocialPlatform)) {
        result[platform] = { status: 'pending' };
      } else if (platform && typeof platform === 'object' && platform.name && validPlatforms.includes(platform.name as SocialPlatform)) {
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
    return result;
  }
  
  // Если socialPlatforms - это уже объект
  validPlatforms.forEach(platform => {
    if (socialPlatforms[platform]) {
      result[platform] = socialPlatforms[platform];
    }
  });
  
  return result;
}

/**
 * Фильтрует контент по платформе
 * @param content Массив контента
 * @param platform Платформа для фильтрации
 * @returns Отфильтрованный массив контента
 */
export function filterContentByPlatform(content: any[], platform: SocialPlatform | 'all'): any[] {
  if (platform === 'all') {
    return content;
  }
  
  return content.filter(item => {
    if (!item.socialPlatforms) return false;
    
    const platforms = normalizeSocialPlatforms(item.socialPlatforms);
    return platform in platforms;
  });
}