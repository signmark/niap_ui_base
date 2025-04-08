/**
 * Типы для социальных платформ и API интеграций
 */

// Список поддерживаемых социальных платформ
export type SocialPlatform = 'instagram' | 'facebook' | 'telegram' | 'vk' | 'twitter' | 'youtube';

// Типы контента для публикаций
export type ContentType = 'text' | 'image' | 'video' | 'carousel' | 'story';

// Статусы публикации
export type PublicationStatus = 'published' | 'failed' | 'scheduled' | 'cancelled';

// Интерфейс для результата публикации в социальные сети
export interface SocialPublication {
  // Платформа, в которую был опубликован контент
  platform: SocialPlatform;
  
  // Статус публикации ('published', 'failed', 'scheduled' и т.д.)
  status: PublicationStatus;
  
  // Временная метка публикации (null, если публикация не состоялась)
  publishedAt: Date | null;
  
  // URL опубликованного поста (null, если публикация не состоялась)
  postUrl?: string | null;
  
  // ID поста в социальной сети (null, если публикация не состоялась)
  postId?: string | null;
  
  // Сообщение об ошибке, если публикация не удалась
  error?: string | null;
  
  // Дополнительные данные, специфичные для платформы (опционально)
  meta?: Record<string, any>;
}

// Интерфейс для настроек Instagram
export interface InstagramSettings {
  token: string;
  businessAccountId: string;
  accessToken?: string | null;
}

// Интерфейс для настроек Telegram
export interface TelegramSettings {
  token: string;
  chatId: string;
  chatUsername?: string;
}

// Интерфейс для настроек VK
export interface VkSettings {
  token: string;
  groupId: string;
}

// Интерфейс для настроек Facebook
export interface FacebookSettings {
  token: string;
  pageId: string;
}

// Объединенный интерфейс всех настроек социальных сетей
export interface SocialMediaSettings {
  instagram?: InstagramSettings;
  telegram?: TelegramSettings;
  vk?: VkSettings;
  facebook?: FacebookSettings;
}

// Интерфейс для информации о публикации на платформе
export interface PlatformPublishInfo {
  status: PublicationStatus;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  postUrl?: string | null;
  postId?: string | null;
  error?: string | null;
}

// Интерфейс для хранения статусов публикаций по платформам
export type SocialPublications = Record<SocialPlatform, PlatformPublishInfo>;