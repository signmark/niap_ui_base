/**
 * Типы для TelegramPublisher
 */

export interface TelegramPublisherOptions {
  directusUrl?: string;
  directusEmail?: string;
  directusPassword?: string;
  tempDir?: string;
  verbose?: boolean;
}

export interface TelegramPublisherType {
  new(options?: TelegramPublisherOptions): TelegramPublisherInstance;
}

export interface TelegramPublisherInstance {
  sendDirectusImageToTelegram(
    imageUrl: string,
    chatId: string,
    caption: string,
    token: string
  ): Promise<any>;
  
  downloadImage(imageUrl: string): Promise<{
    buffer: Buffer;
    contentType: string;
  }>;
  
  sendImageToTelegram(
    imageBuffer: Buffer,
    contentType: string,
    chatId: string,
    caption: string,
    token: string
  ): Promise<any>;
  
  getDirectusToken(): Promise<string | null>;
  
  isTokenValid(): boolean;
  
  log(message: string, level?: 'log' | 'warn' | 'error'): void;
}