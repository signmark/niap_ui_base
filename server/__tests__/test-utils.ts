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
    title: 'Тестовый контент',
    text: 'Тестовый текст для публикации с <b>жирным текстом</b> и <i>курсивом</i>',
    status: 'draft',
    campaign_id: 'test-campaign-id',
    user_id: 'test-user-id',
    social_platforms: ['telegram', 'vk'],
    image_url: 'https://example.com/test-image.jpg',
    additional_images: ['https://example.com/additional-image-1.jpg', 'https://example.com/additional-image-2.jpg'],
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
      chatId: 'test-chat-id',
    },
    vk: {
      token: 'test-vk-token',
      groupId: 'test-group-id',
    },
    instagram: {
      token: 'test-instagram-token',
      businessAccountId: 'test-business-account-id',
    },
    facebook: {
      token: 'test-facebook-token',
      pageId: 'test-page-id',
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
      chat: {
        id: -1002302366310,
        title: 'Test Channel',
        username: 'testchannel',
        type: 'channel'
      },
      date: Math.floor(Date.now() / 1000),
      text: 'Тестовое сообщение'
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