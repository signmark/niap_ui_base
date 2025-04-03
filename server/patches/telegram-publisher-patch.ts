/**
 * Патч для интеграции класса TelegramPublisher в основной проект
 * Предоставляет функции для загрузки изображений из Directus с авторизацией
 * и отправки их в Telegram
 */

// Импортируем типы для TelegramPublisher
import type { 
  TelegramPublisherType, 
  TelegramPublisherInstance, 
  TelegramPublisherOptions,
  TelegramResponse
} from '../types/telegram-publisher';

// Пытаемся импортировать класс TelegramPublisher из mjs-модуля
let TelegramPublisher: TelegramPublisherType | null = null;

/**
 * Получает экземпляр TelegramPublisher для работы с Telegram API
 * Если модуль не удалось загрузить, возвращает заглушку
 * @returns Экземпляр TelegramPublisher или заглушка
 */
export async function getTelegramPublisher(): Promise<TelegramPublisherInstance> {
  if (TelegramPublisher === null) {
    try {
      // Динамически импортируем модуль
      const importedModule = await import('../../telegram-publisher.mjs');
      TelegramPublisher = importedModule.default;
      
      if (!TelegramPublisher) {
        console.error('[TelegramPublisherPatch] Модуль импортирован, но класс TelegramPublisher не найден');
        return createTelegramPublisherStub();
      }
      
      console.log('[TelegramPublisherPatch] Класс TelegramPublisher успешно импортирован');
    } catch (error) {
      console.error('[TelegramPublisherPatch] Ошибка при импорте TelegramPublisher:', error);
      return createTelegramPublisherStub();
    }
  }
  
  try {
    // Получаем учетные данные Directus из переменных окружения
    const directusEmail = process.env.DIRECTUS_EMAIL;
    const directusPassword = process.env.DIRECTUS_PASSWORD;
    const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8055';
    
    // Создаем экземпляр TelegramPublisher с нужными настройками
    const options: TelegramPublisherOptions = {
      verbose: true, // Включаем подробное логирование
      directusEmail,
      directusPassword,
      directusUrl
    };
    
    return new TelegramPublisher(options);
  } catch (error) {
    console.error('[TelegramPublisherPatch] Ошибка при создании экземпляра TelegramPublisher:', error);
    return createTelegramPublisherStub();
  }
}

/**
 * Отправляет изображение из Directus в Telegram
 * Удобная обертка для sendDirectusImageToTelegram
 */
export async function sendDirectusImageToTelegram(imageUrl, chatId, caption, token): Promise<TelegramResponse> {
  const publisher = await getTelegramPublisher();
  return publisher.sendDirectusImageToTelegram(imageUrl, chatId, caption, token);
}

/**
 * Скачивает изображение с авторизацией (если это URL Directus)
 */
export async function downloadImage(imageUrl): Promise<{ buffer: Buffer, contentType: string }> {
  const publisher = await getTelegramPublisher();
  return publisher.downloadImage(imageUrl);
}

/**
 * Отправляет изображение в Telegram
 */
export async function sendImageToTelegram(imageBuffer, contentType, chatId, caption, token): Promise<TelegramResponse> {
  const publisher = await getTelegramPublisher();
  return publisher.sendImageToTelegram(imageBuffer, contentType, chatId, caption, token);
}

/**
 * Создает заглушку для TelegramPublisher на случай ошибки импорта
 * Все методы логируют ошибку и возвращают промисы с ошибками
 */
function createTelegramPublisherStub(): TelegramPublisherInstance {
  const errorResponse: TelegramResponse = {
    ok: false,
    description: 'TelegramPublisher не доступен. Проверьте наличие файла telegram-publisher.mjs в корневой директории проекта'
  };
  
  return {
    log(message, level = 'error') {
      console[level](`[TelegramPublisherStub] ${message}`);
    },
    
    isTokenValid() {
      return false;
    },
    
    async getDirectusToken() {
      console.error('[TelegramPublisherStub] Попытка получить токен Directus из заглушки');
      return null;
    },
    
    async downloadImage(imageUrl) {
      console.error('[TelegramPublisherStub] Попытка скачать изображение из заглушки:', imageUrl);
      throw new Error('TelegramPublisher не доступен');
    },
    
    async sendImageToTelegram(imageBuffer, contentType, chatId, caption, token) {
      console.error('[TelegramPublisherStub] Попытка отправить изображение из заглушки');
      return errorResponse;
    },
    
    async sendDirectusImageToTelegram(imageUrl, chatId, caption, token) {
      console.error('[TelegramPublisherStub] Попытка отправить изображение из Directus из заглушки:', imageUrl);
      return errorResponse;
    }
  };
}