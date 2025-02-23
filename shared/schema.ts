import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const campaigns = pgTable("user_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const keywords = pgTable("campaign_keywords", {
  id: serial("id").primaryKey(),
  word: text("word").notNull(),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  trend: integer("trend"),
  competition: integer("competition"),
  volume: integer("volume"),
  added: boolean("added").default(false),
  createdAt: timestamp("created_at").defaultNow()
});

export const insertCampaignSchema = createInsertSchema(campaigns).pick({
  name: true,
  description: true,
  userId: true
});

export const insertKeywordSchema = createInsertSchema(keywords).pick({
  word: true,
  campaignId: true,
  trend: true,
  competition: true,
  volume: true
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export type Keyword = typeof keywords.$inferSelect;
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;

// xmlriver API response type
export interface XmlRiverResponse {
  data: {
    keywords: Array<{
      keyword: string;
      difficulty: number;
      competition: number;
      volume: number;
    }>;
  };
}