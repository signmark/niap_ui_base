/**
 * Типы для контента кампании
 */

export interface CampaignContent {
  id: string;
  campaignId: string;
  title?: string;
  text: string;
  status: string;
  // Основное изображение (может быть строкой URL или объектом с id)
  primary_image?: string | { id: string };
  // Дополнительные изображения (массив URL или объектов с id)
  additional_images?: Array<string | { id: string }>;
  // Социальные платформы для публикации
  social_platforms?: Record<string, boolean>;
  // Дополнительные метаданные
  meta?: Record<string, any>;
  // Сведения о публикациях
  publications?: Record<string, any>;
}