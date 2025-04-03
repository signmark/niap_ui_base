/**
 * Типы для модуля публикации в Telegram
 */

/**
 * Опции для инициализации издателя Telegram
 */
export interface TelegramPublisherOptions {
  /** Включить подробное логирование */
  verbose?: boolean;
  /** Email для авторизации в Directus */
  directusEmail?: string;
  /** Пароль для авторизации в Directus */
  directusPassword?: string;
  /** URL Directus API */
  directusUrl?: string;
}

/**
 * Результат скачивания изображения
 */
export interface DownloadImageResult {
  /** Буфер с данными изображения */
  buffer: Buffer;
  /** MIME-тип изображения */
  contentType: string;
  /** Путь к временному файлу изображения */
  tempFilePath: string;
}

/**
 * Ответ от Telegram API при отправке
 */
export interface TelegramSendResponse {
  /** Успешность операции */
  ok: boolean;
  /** Результат операции в случае успеха */
  result?: {
    /** Идентификатор сообщения */
    message_id: number;
    /** Информация о чате */
    chat: {
      /** Идентификатор чата */
      id: number;
      /** Название чата */
      title?: string;
      /** Имя пользователя в чате */
      username?: string;
      /** Тип чата */
      type: string;
    };
    /** Дата отправки сообщения */
    date: number;
    /** Информация о фото */
    photo?: Array<{
      /** Идентификатор файла */
      file_id: string;
      /** Уникальный идентификатор файла */
      file_unique_id: string;
      /** Ширина изображения */
      width: number;
      /** Высота изображения */
      height: number;
      /** Размер файла в байтах */
      file_size?: number;
    }>;
  };
  /** Описание ошибки в случае неудачи */
  description?: string;
  /** Объект ошибки */
  error?: any;
}