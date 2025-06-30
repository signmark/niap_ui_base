import { CampaignContent, SocialMediaSettings } from '@shared/schema';

export abstract class BaseSocialService {
  protected platformName: string;

  constructor(platformName: string) {
    this.platformName = platformName;
  }

  abstract publishContent(
    content: CampaignContent,
    campaignSettings: SocialMediaSettings,
    userId: string
  ): Promise<{ success: boolean; postUrl?: string; error?: string }>;
}