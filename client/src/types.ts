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