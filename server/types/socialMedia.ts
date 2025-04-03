/**
 * Типы для работы с социальными сетями
 */

/**
 * Типы поддерживаемых социальных платформ
 */
export type SocialPlatform = 'telegram' | 'instagram' | 'facebook' | 'vkontakte';

/**
 * Настройки для социальных сетей
 */
export interface SocialMediaSettings {
  /** Токен/ключ доступа к API платформы */
  token?: string;
  /** ID чата для Telegram или ID страницы для других платформ */
  chatId?: string;
  /** ID бизнес-аккаунта для Instagram */
  businessId?: string;
  /** Дополнительные настройки */
  options?: Record<string, any>;
}

/**
 * Результат публикации в социальные сети
 */
export interface SocialPublication {
  /** Платформа, в которую был опубликован контент */
  platform: SocialPlatform;
  /** Статус публикации */
  status: 'pending' | 'published' | 'error';
  /** Дата публикации */
  publishedAt: Date | null;
  /** Текст ошибки, если публикация не удалась */
  error: string | null;
  /** ID пользователя/группы/страницы, куда был опубликован контент */
  userId: string | null;
  /** ID публикации (если доступно) */
  postId?: string | null;
  /** URL к публикации (если доступно) */
  postUrl?: string | null;
}