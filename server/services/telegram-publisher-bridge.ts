/**
 * Мост для импорта TelegramPublisher из CommonJS-модуля в ESM-среду
 * Позволяет использовать TelegramPublisher в TypeScript-коде
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export interface TelegramPublisherOptions {
  /** Включить подробное логирование */
  verbose?: boolean;
  /** Email для авторизации в Directus */
  directusEmail?: string;
  /** Пароль для авторизации в Directus */
  directusPassword?: string;
  /** URL Directus API */
  directusUrl?: string;
  /** Директория для временных файлов */
  tempDir?: string;
}

export interface ITelegramPublisher {
  log(message: string, level?: string): void;
  isTokenValid(): boolean;
  getDirectusToken(): Promise<string | null>;
  downloadImage(imageUrl: string): Promise<{buffer: Buffer; contentType: string}>;
  sendImageToTelegram(
    imageBuffer: Buffer, 
    contentType: string, 
    chatId: string, 
    caption: string | null, 
    token: string
  ): Promise<any>;
  sendDirectusImageToTelegram(
    imageUrl: string,
    chatId: string,
    caption: string | null,
    token: string
  ): Promise<any>;
}

/**
 * Возвращает экземпляр TelegramPublisher для использования в TypeScript коде
 * @param options Опции для инициализации TelegramPublisher
 * @returns Экземпляр TelegramPublisher
 */
export async function getTelegramPublisher(options: TelegramPublisherOptions = {}): Promise<ITelegramPublisher> {
  try {
    console.log('[TelegramPublisherBridge] Loading TelegramPublisher module...');
    
    // Проверяем наличие файла standalone-telegram-publisher.js в корне проекта
    const modulePath = path.join(process.cwd(), 'standalone-telegram-publisher.js');
    
    if (!fs.existsSync(modulePath)) {
      throw new Error(`Файл TelegramPublisher не найден по пути: ${modulePath}`);
    }
    
    console.log(`[TelegramPublisherBridge] Файл найден: ${modulePath}`);
    
    // Динамический импорт модуля
    const { default: TelegramPublisher } = await import('../../standalone-telegram-publisher.js');
    
    if (!TelegramPublisher) {
      throw new Error('Failed to import TelegramPublisher class from module');
    }
    
    console.log('[TelegramPublisherBridge] TelegramPublisher класс успешно импортирован');
    
    // Создаем экземпляр с переданными опциями
    const publisher = new TelegramPublisher(options);
    console.log('[TelegramPublisherBridge] TelegramPublisher экземпляр успешно создан');
    
    // Поскольку log метод не имеет правильную типизацию в нашем интерфейсе
    publisher.log('[TelegramPublisherBridge] Мост успешно инициализирован', 'info');
    
    return publisher;
  } catch (error: any) {
    console.error('[TelegramPublisherBridge] Ошибка при инициализации:', error);
    throw new Error(`Не удалось инициализировать TelegramPublisher: ${error.message}`);
  }
}

/**
 * Вспомогательная функция для отправки изображения в Telegram
 * Создает экземпляр TelegramPublisher и использует его для отправки
 * @param imageUrl URL изображения
 * @param chatId ID чата Telegram
 * @param caption Подпись к изображению
 * @param token Токен бота Telegram
 * @returns Результат отправки
 */
export async function sendImageToTelegram(
  imageUrl: string,
  chatId: string,
  caption: string | null,
  token: string
): Promise<any> {
  try {
    const publisher = await getTelegramPublisher({
      verbose: true,
      directusEmail: process.env.DIRECTUS_EMAIL,
      directusPassword: process.env.DIRECTUS_PASSWORD,
      directusUrl: process.env.DIRECTUS_URL || 'https://db.nplanner.ru'
    });
    
    return await publisher.sendDirectusImageToTelegram(imageUrl, chatId, caption, token);
  } catch (error: any) {
    console.error('[TelegramPublisherBridge] Ошибка при отправке изображения:', error);
    return {
      ok: false,
      description: `Ошибка при отправке изображения: ${error.message}`
    };
  }
}