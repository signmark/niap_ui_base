/**
 * Вспомогательные функции для тестирования
 */

/**
 * Генерирует тестовый контент
 * @param overrides Перезаписывает стандартные значения
 * @returns Тестовый объект контента
 */
export function generateTestContent(overrides = {}) {
  return {
    id: 'test-content-id',
    title: 'Тестовый заголовок',
    text: 'Тестовый текст поста',
    image_url: 'https://example.com/test-image.jpg',
    additional_images: [],
    status: 'draft',
    user_id: 'test-user-id',
    campaign_id: 'test-campaign-id',
    social_platforms: ['telegram', 'vk', 'instagram'],
    ...overrides
  };
}

/**
 * Генерирует тестовые настройки социальных сетей
 * @param overrides Перезаписывает стандартные значения
 * @returns Тестовый объект настроек
 */
export function generateSocialSettings(overrides = {}) {
  return {
    telegram: {
      token: 'test-telegram-token',
      chatId: '-1001234567890'
    },
    vk: {
      token: 'test-vk-token',
      groupId: '123456789'
    },
    instagram: {
      token: 'test-instagram-token',
      businessAccountId: '123456789'
    },
    facebook: {
      token: 'test-facebook-token',
      pageId: '123456789'
    },
    ...overrides
  };
}

/**
 * Имитирует ответ от Telegram API
 * @param messageId ID сообщения для ответа
 * @returns Имитация ответа API
 */
export function mockTelegramAPIResponse(messageId = 12345) {
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
        id: -1001234567890,
        title: 'Test Channel',
        type: 'channel'
      },
      date: Math.floor(Date.now() / 1000),
      text: 'Test message'
    }
  };
}

/**
 * Имитирует ответ от VK API
 * @param postId ID сообщения для ответа
 * @returns Имитация ответа API
 */
export function mockVKAPIResponse(postId = 12345) {
  return {
    response: {
      post_id: postId
    }
  };
}