import { campaigns, keywords, contents, type Campaign, type InsertCampaign, type Keyword, type InsertKeyword, type Content, type InsertContent } from "@shared/schema";

export interface IStorage {
  // Campaigns
  getCampaigns(userId: string): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  deleteCampaign(id: number): Promise<void>;
  
  // Keywords
  getKeywords(campaignId: number): Promise<Keyword[]>;
  addKeyword(keyword: InsertKeyword): Promise<Keyword>;
  updateKeyword(id: number, keyword: Partial<Keyword>): Promise<Keyword>;
  
  // Content
  getContent(campaignId: number): Promise<Content[]>;
  createContent(content: InsertContent): Promise<Content>;
}

export class MemStorage implements IStorage {
  private campaigns: Map<number, Campaign>;
  private keywords: Map<number, Keyword>;
  private contents: Map<number, Content>;
  private currentIds: { [key: string]: number };

  constructor() {
    this.campaigns = new Map();
    this.keywords = new Map();
    this.contents = new Map();
    this.currentIds = {
      campaign: 1,
      keyword: 1,
      content: 1
    };
  }

  async getCampaigns(userId: string): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).filter(c => c.userId === userId);
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    return this.campaigns.get(id);
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const id = this.currentIds.campaign++;
    const newCampaign = { ...campaign, id, createdAt: new Date() };
    this.campaigns.set(id, newCampaign);
    return newCampaign;
  }

  async deleteCampaign(id: number): Promise<void> {
    this.campaigns.delete(id);
  }

  async getKeywords(campaignId: number): Promise<Keyword[]> {
    return Array.from(this.keywords.values()).filter(k => k.campaignId === campaignId);
  }

  async addKeyword(keyword: InsertKeyword): Promise<Keyword> {
    const id = this.currentIds.keyword++;
    const newKeyword = { ...keyword, id };
    this.keywords.set(id, newKeyword);
    return newKeyword;
  }

  async updateKeyword(id: number, update: Partial<Keyword>): Promise<Keyword> {
    const keyword = this.keywords.get(id);
    if (!keyword) throw new Error('Keyword not found');
    const updated = { ...keyword, ...update };
    this.keywords.set(id, updated);
    return updated;
  }

  async getContent(campaignId: number): Promise<Content[]> {
    return Array.from(this.contents.values()).filter(c => c.campaignId === campaignId);
  }

  async createContent(content: InsertContent): Promise<Content> {
    const id = this.currentIds.content++;
    const newContent = { ...content, id, createdAt: new Date() };
    this.contents.set(id, newContent);
    return newContent;
  }
}

export const storage = new MemStorage();
