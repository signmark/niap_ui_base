/**
 * Утилиты для тестирования SMM Менеджера
 * Содержит вспомогательные функции, моки и тестовые данные
 */

// Константы для тестов
export const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';
export const USER_ID = '53921f16-f51d-4591-80b9-8caa4fde4d13';

// Типы контента для тестирования
export interface TestContentOptions {
  id?: string;
  title: string;
  text: string;
  image_url: string | null;
  additional_images?: string[];
  social_platforms: string[];
  campaignId: string;
  userId?: string;
  scheduledAt?: string;
}

/**
 * Генерирует тестовый контент с указанными параметрами
 * @param options Параметры контента
 * @returns Объект с тестовым контентом
 */
export function generateTestContent(options: TestContentOptions): any {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setHours(futureDate.getHours() + 1);
  
  return {
    id: options.id || `test-content-${Date.now()}`,
    title: options.title,
    text: options.text,
    image_url: options.image_url,
    additional_images: options.additional_images || [],
    social_platforms: options.social_platforms,
    campaign_id: options.campaignId,
    user_id: options.userId || USER_ID,
    status: 'draft',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    scheduled_at: options.scheduledAt || futureDate.toISOString(),
    content_type: 'standard'
  };
}

/**
 * Возвращает мок успешного ответа Telegram API
 * @param messageId ID сообщения
 * @returns Объект с ответом Telegram API
 */
export function mockTelegramAPIResponse(messageId: number) {
  return {
    ok: true,
    result: {
      message_id: messageId,
      from: {
        id: 7529101043,
        is_bot: true,
        first_name: 'TestBot',
        username: 'test_bot'
      },
      chat: {
        id: -1002302366310,
        title: 'Тестовый канал',
        type: 'channel'
      },
      date: Math.floor(Date.now() / 1000),
      text: 'Тестовое сообщение'
    }
  };
}

/**
 * Возвращает мок успешного ответа VK API
 * @param postId ID поста
 * @returns Объект с ответом VK API
 */
export function mockVkAPIResponse(postId: number) {
  return {
    response: {
      post_id: postId
    }
  };
}

/**
 * Возвращает мок ошибки API
 * @param platform Платформа (vk, telegram и т.д.)
 * @param errorCode Код ошибки
 * @param errorMessage Сообщение об ошибке
 * @returns Объект с ошибкой API
 */
export function mockAPIError(platform: string, errorCode: number, errorMessage: string) {
  switch (platform) {
    case 'telegram':
      return {
        ok: false,
        error_code: errorCode,
        description: errorMessage
      };
    case 'vk':
      return {
        error: {
          error_code: errorCode,
          error_msg: errorMessage
        }
      };
    case 'instagram':
      return {
        error: {
          message: errorMessage,
          code: errorCode
        }
      };
    default:
      return {
        error: errorMessage,
        code: errorCode
      };
  }
}

/**
 * Форматирует URL поста в Telegram
 * @param chatId ID чата
 * @param messageId ID сообщения
 * @returns URL поста
 */
export function formatTelegramUrl(chatId: string, messageId: number): string {
  // Удаляем префикс -100 из ID канала, если он есть
  const formattedChatId = chatId.toString().replace('-100', '');
  return `https://t.me/c/${formattedChatId}/${messageId}`;
}

/**
 * Форматирует URL поста во ВКонтакте
 * @param ownerId ID владельца (группы)
 * @param postId ID поста
 * @returns URL поста
 */
export function formatVkUrl(ownerId: string, postId: number): string {
  // Если ID группы передан в формате "clubXXXXXX", извлекаем числовой ID
  let numericOwnerId = ownerId;
  if (ownerId.startsWith('club')) {
    numericOwnerId = `-${ownerId.replace('club', '')}`;
  } else if (!ownerId.startsWith('-')) {
    numericOwnerId = `-${ownerId}`;
  }
  
  return `https://vk.com/wall${numericOwnerId}_${postId}`;
}

/**
 * Создает моковый объект для FormData
 * @returns Мок FormData
 */
export function createFormDataMock() {
  return {
    append: jest.fn(),
    getHeaders: jest.fn(() => ({})),
    getBuffer: jest.fn(() => Buffer.from('test')),
    getBoundary: jest.fn(() => 'test-boundary')
  };
}

/**
 * Возвращает заголовки для имитации multipart/form-data запроса
 * @returns Заголовки запроса
 */
export function getMultipartHeaders() {
  return {
    'Content-Type': 'multipart/form-data; boundary=test-boundary'
  };
}