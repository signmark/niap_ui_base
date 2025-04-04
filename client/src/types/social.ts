/**
 * Типы поддерживаемых социальных платформ
 */
export type SocialPlatform = 'telegram' | 'vk' | 'instagram' | 'facebook';

/**
 * Интерфейс настроек социальной платформы
 */
export interface SocialPlatformSettings {
  platform: SocialPlatform;
  enabled: boolean;
  token?: string;
  chatId?: string; // для Telegram
  groupId?: string; // для VK
  accountId?: string; // для Instagram и Facebook
}

/**
 * Интерфейс результата публикации
 */
export interface PublishResult {
  success: boolean;
  platformId: SocialPlatform;
  messageId?: string | number;
  url?: string;
  error?: string;
}