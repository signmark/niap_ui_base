/**
 * Типы для социальных публикаций
 */

// Поддерживаемые социальные платформы
export type SocialPlatform = 
  | 'telegram'
  | 'vk'
  | 'instagram'
  | 'facebook'
  | 'youtube' 
  | 'pinterest'
  | 'dzen'
  | 'twitter'
  | 'site';

// Статус публикации
export type PublicationStatus = 'pending' | 'published' | 'failed' | 'scheduled';

// Результат публикации контента в социальную сеть
export interface SocialPublication {
  // Название платформы
  platform: SocialPlatform;
  
  // Статус публикации
  status: PublicationStatus;
  
  // Дата публикации (null если не опубликовано)
  publishedAt: Date | null;
  
  // URL публикации (опционально)
  postUrl?: string;
  
  // ID публикации в социальной сети (опционально)
  postId?: string;
  
  // ID сообщения для Telegram (опционально)
  messageId?: number | string;
  
  // Ошибка, если публикация не удалась (опционально)
  error?: string | null;
  
  // ID пользователя, выполнившего публикацию (опционально)
  userId?: string;
  
  // ID контейнера для Instagram (опционально)
  containerId?: string;
  
  // Дополнительная отладочная информация (опционально)
  debug?: any;
}

// Настройки социальных сетей
export interface SocialMediaSettings {
  // Настройки Telegram
  telegram?: {
    token: string | null;
    chatId: string | null;
  };
  
  // Настройки VK
  vk?: {
    token: string | null;
    groupId: string | null;
  };
  
  // Настройки Instagram
  instagram?: {
    token: string | null;
    accessToken: string | null;
    businessAccountId: string | null;
  };
  
  // Настройки Facebook
  facebook?: {
    token: string | null;
    pageId: string | null;
  };
  
  // Настройки YouTube - должны соответствовать shared/schema.ts
  youtube?: {
    apiKey: string | null;
    channelId: string | null;
  };
}