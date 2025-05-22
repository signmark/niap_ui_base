/**
 * Типы данных для модуля аналитики
 */

// Структура аналитических данных платформы
export interface PlatformAnalytics {
  likes: number;
  views: number;
  shares: number;
  comments: number;
  lastUpdated: string;
}

// Структура данных платформы в social_platforms
export interface SocialPlatform {
  postId?: string | null;
  status: string;
  postUrl?: string | null;
  platform?: string;
  selected?: boolean;
  publishedAt: string;
  analytics?: PlatformAnalytics;
}

// Структура поста с социальными платформами
export interface CampaignPost {
  id: string;
  title: string;
  content: string;
  campaign_id: string;
  created_at: string;
  social_platforms: Record<string, SocialPlatform>;
}

// Агрегированные метрики
export interface AggregatedMetrics {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalEngagement: number;
  averageEngagementRate: number;
}

// Статистика по платформе
export interface PlatformStats {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  engagementRate: number;
}

// Топ пост
export interface TopPost {
  id: string;
  title: string;
  totalViews: number;
  totalEngagement: number;
  engagementRate: number;
  publishedAt: string;
  platforms: string[];
}

// Ответы API
export interface PlatformsStatsResponse {
  success: boolean;
  data: {
    platforms: Record<string, PlatformStats>;
    aggregated: AggregatedMetrics;
  };
}

export interface TopPostsResponse {
  success: boolean;
  data: {
    topByViews: TopPost[];
    topByEngagement: TopPost[];
  };
}

// Запрос на обновление данных через n8n
export interface AnalyticsUpdateRequest {
  campaignId: string;
  days: 7 | 30;
}