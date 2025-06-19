export interface CampainKeyword {
  id: string;
  keyword: string;
  trendScore: number;
  campaignId: string;
}

export interface TrendAnalysisSettings {
  minFollowers: {
    instagram: number;
    telegram: number;
    vk: number;
    facebook: number;
    youtube: number;
  };
  maxSourcesPerPlatform: number;
  maxTrendsPerSource: number;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: string;
  socialMediaSettings?: SocialCredentials | null;
  trendAnalysisSettings?: TrendAnalysisSettings;
}

export interface ContentSource {
  id: string;
  name: string;
  url: string;
  type: string;
  isActive: boolean;
  campaignId: string;
  createdAt: string;
  status: string | null;
}

export interface SocialCredentials {
  [key: string]: {
    token?: string;
    accessToken?: string;
    chatId?: string;
    groupId?: string;
    pageId?: string;
  }
}

// Типы статусов публикации контента
export type ContentStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'partial';

// Типы социальных платформ
export type SocialPlatform = 'instagram' | 'facebook' | 'telegram' | 'vk';

// Типы статусов публикации на платформе
export type PlatformPublishStatus = 'pending' | 'scheduled' | 'published' | 'failed' | 'cancelled';

// Информация о публикации на платформе
export interface PlatformPublishInfo {
  status: PlatformPublishStatus;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  postId?: string | null;
  postUrl?: string | null;
  error?: string | null;
}

// Типы контента
export type ContentType = 'text' | 'text-image' | 'video' | 'video-text' | 'mixed';

// Интерфейс для контента кампании
// Тип для медиа-файла
export interface MediaItem {
  url: string;
  type: 'image' | 'video';
  title?: string;
  description?: string;
}

export interface CampaignContent {
  id: string;
  title: string;
  content: string;
  contentType: ContentType;
  campaignId: string;
  createdAt: string;
  updatedAt?: string | null;
  imageUrl?: string | null;
  additionalImages?: string[] | null; // Для обратной совместимости
  videoUrl?: string | null;
  additionalVideos?: string[] | null; // Для обратной совместимости
  additionalMedia?: MediaItem[] | null; // Новое универсальное поле для всех типов медиа
  imagePrompt?: string | null;
  status: ContentStatus;
  keywords?: string[];
  metadata?: Record<string, any> | null;
  scheduledAt?: string | Date | null;
  publishedAt?: string | Date | null;
  socialPlatforms?: Record<SocialPlatform, PlatformPublishInfo> | null;
  userId?: string;
}