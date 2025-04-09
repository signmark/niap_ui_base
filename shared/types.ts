/**
 * Общие типы, используемые в приложении
 */

/**
 * Тип контента для кампании
 */
export interface CampaignContent {
  id: string;
  userId: string;
  campaignId: string;
  title: string;
  content: string;
  contentType: string;
  imageUrl: string | null;
  additionalImages?: string[];
  status: string;
  socialPlatforms: string[];
  createdAt: Date;
  hashtags: string[];
  links: string[];
  metadata: Record<string, any>;
}

/**
 * Тип для хранения учетных данных социальных сетей
 */
export interface SocialCredentials {
  platform: string;
  credentials: Record<string, string>;
}

/**
 * Тип для результата публикации
 */
export interface PublicationResult {
  success: boolean;
  platform: string;
  postId?: string;
  postUrl?: string;
  error?: string;
}