/**
 * Типы социальных платформ для публикаций
 */

// Определяем типы социальных платформ для безопасного использования
export const safeSocialPlatforms = ['instagram', 'facebook', 'telegram', 'vk'] as const;
export type SafeSocialPlatform = typeof safeSocialPlatforms[number];

// Платформы на русском для отображения
export const platformNames: Record<SafeSocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  telegram: 'Telegram',
  vk: 'ВКонтакте'
};

// Типы статусов публикаций
export type PublicationStatus = 'pending' | 'scheduled' | 'published' | 'failed' | 'cancelled';

// Информация о платформе для публикации
export interface PlatformPublishInfo {
  status?: PublicationStatus;
  scheduledAt?: string | Date | null;
  publishedAt?: string | Date | null;
  postId?: string | null;
  postUrl?: string | null;
  error?: string | null;
}

// Формат данных социальных платформ
export interface SocialPlatforms {
  instagram?: PlatformPublishInfo;
  facebook?: PlatformPublishInfo;
  telegram?: PlatformPublishInfo;
  vk?: PlatformPublishInfo;
  [key: string]: PlatformPublishInfo | undefined;
}