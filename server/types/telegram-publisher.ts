/**
 * Типы для работы с классом TelegramPublisher
 */

/**
 * Тип для класса TelegramPublisher
 */
export interface TelegramPublisherType {
  new (options?: TelegramPublisherOptions): TelegramPublisherInstance;
}

/**
 * Опции для создания экземпляра TelegramPublisher
 */
export interface TelegramPublisherOptions {
  /**
   * Включает подробное логирование
   */
  verbose?: boolean;
  
  /**
   * Email для авторизации в Directus
   */
  directusEmail?: string;
  
  /**
   * Пароль для авторизации в Directus
   */
  directusPassword?: string;
  
  /**
   * URL сервера Directus
   */
  directusUrl?: string;
  
  /**
   * Другие параметры, которые могут использоваться классом
   */
  [key: string]: any;
}

/**
 * Экземпляр TelegramPublisher с методами для работы с изображениями и Telegram API
 */
export interface TelegramPublisherInstance {
  /**
   * Полный процесс отправки изображения из Directus в Telegram
   * @param imageUrl URL изображения (может быть ссылкой на Directus)
   * @param chatId ID чата Telegram
   * @param caption Подпись к изображению (поддерживает HTML)
   * @param token Токен бота Telegram
   * @returns Результат отправки
   */
  sendDirectusImageToTelegram(
    imageUrl: string, 
    chatId: string, 
    caption: string, 
    token: string
  ): Promise<TelegramResponse>;
  
  /**
   * Скачивает изображение с авторизацией (если это URL Directus)
   * @param imageUrl URL изображения для скачивания
   * @returns Объект с буфером изображения и типом контента
   */
  downloadImage(imageUrl: string): Promise<{ buffer: Buffer, contentType: string, tempFilePath?: string }>;
  
  /**
   * Отправляет изображение в Telegram
   * @param imageBuffer Буфер с данными изображения
   * @param contentType MIME-тип изображения
   * @param chatId ID чата Telegram для отправки
   * @param caption Подпись к изображению
   * @param token Токен бота Telegram
   * @returns Результат отправки
   */
  sendImageToTelegram(
    imageBuffer: Buffer, 
    contentType: string, 
    chatId: string, 
    caption: string, 
    token: string,
    tempFilePath?: string | null
  ): Promise<TelegramResponse>;
  
  /**
   * Получает токен авторизации Directus
   * @returns Токен авторизации или null в случае ошибки
   */
  getDirectusToken(): Promise<string | null>;
  
  /**
   * Проверяет, не истек ли срок действия токена
   * @returns true если токен действителен, false если истек или не установлен
   */
  isTokenValid(): boolean;
  
  /**
   * Выводит сообщение в консоль, если включен режим подробного логирования
   * @param message Сообщение для логирования
   * @param level Уровень логирования (log, warn, error)
   */
  log(message: string, level?: string): void;
}

/**
 * Ответ от Telegram API
 */
export interface TelegramResponse {
  /**
   * Успешность запроса
   */
  ok: boolean;
  
  /**
   * Описание ошибки, если запрос не успешен
   */
  description?: string;
  
  /**
   * Результат запроса, если запрос успешен
   */
  result?: {
    /**
     * ID отправленного сообщения
     */
    message_id?: number;
    
    /**
     * Другие поля, возвращаемые API
     */
    [key: string]: any;
  };
}