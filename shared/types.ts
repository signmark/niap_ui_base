/**
 * Общие типы для всего приложения
 * 
 * Этот файл содержит типы данных, используемые в приложении
 * как на стороне сервера, так и на стороне клиента.
 */

// Типы социальных платформ
export type SocialPlatform = 
  | 'telegram' 
  | 'instagram' 
  | 'facebook' 
  | 'vk' 
  | 'youtube' 
  | 'dzen'
  | 'pinterest'
  | 'site'
  | 'rss';

// Типы контента
export type ContentType = 'text' | 'image' | 'video' | 'mixed';

// Статусы контента
export type ContentStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'archived';

// Структура настроек социальных сетей
export interface SocialMediaSettings {
  telegram?: {
    token: string;
    chatId: string;
  };
  instagram?: {
    token: string;
    businessAccountId: string;
  };
  facebook?: {
    token: string;
    pageId: string;
  };
  vk?: {
    token: string;
    groupId: string;
  };
  youtube?: {
    token: string;
    channelId: string;
  };
  dzen?: {
    token: string;
    channelId: string;
  };
  pinterest?: {
    token: string;
    boardId: string;
  };
  site?: {
    url: string;
  };
  rss?: {
    url: string;
  };
}

// Структура публикации в социальных сетях
export interface SocialPublication {
  status: 'published' | 'failed' | 'scheduled' | 'pending';
  publishedAt: Date | null;
  postUrl: string | null;
  error?: string | null;
  messageId?: string | number;
  result?: any;
}

// Структура социальных публикаций по платформам
export interface SocialPublications {
  [key: string]: SocialPublication;
}

// Структура контента кампании
export interface CampaignContent {
  id: string;
  userId: string;
  campaignId: string;
  title: string | null;
  content: string;
  contentType: string;
  imageUrl: string | null;
  additionalImages: string[] | null;
  videoUrl?: string | null;
  status: string;
  prompt?: string | null;
  hashtags: string[];
  keywords?: string[];
  links: string[];
  scheduledAt?: Date | null;
  publishedAt?: Date | null;
  createdAt: Date | null;
  socialPlatforms: string[];
  socialPublications?: SocialPublications | null;
  metadata: unknown;
}

// Структура кампании
export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  createdAt: Date | null;
  socialMediaSettings: SocialMediaSettings;
  trendAnalysisSettings?: unknown;
}

// Аутентификация пользователя
export interface AuthResult {
  token: string;
  refreshToken: string;
  userId: string;
  email: string;
  role: string;
}

// Параметры для публикации контента
export interface PublishContentParams {
  contentId: string;
  platform: SocialPlatform;
  credentials?: {
    telegram?: {
      token: string;
      chatId: string;
    };
    instagram?: {
      token: string;
      businessAccountId: string;
    };
    // Добавить другие платформы по мере необходимости
  };
}

// Результат публикации контента
export interface PublishContentResult {
  success: boolean;
  platform: SocialPlatform;
  messageId?: string | number;
  postUrl?: string;
  error?: string;
}