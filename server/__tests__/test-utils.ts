/**
 * Вспомогательные функции для тестирования
 */

/**
 * Генерирует тестовый контент для публикации в социальных сетях
 * @param options Параметры контента
 * @returns Объект с контентом для публикации
 */
export function generateTestContent(options: {
  id: string;
  title: string;
  text: string;
  image_url: string | null;
  additional_images?: string[];
  social_platforms: string[];
  campaignId: string;
}) {
  return {
    id: options.id,
    userId: '53921f16-f51d-4591-80b9-8caa4fde4d13',
    createdAt: new Date(),
    campaignId: options.campaignId,
    title: options.title || null,
    content: options.text,
    contentType: 'text',
    imageUrl: options.image_url,
    additionalImages: options.additional_images || [],
    videoUrl: null,
    links: [],
    hashtags: [],
    keywords: [],
    status: 'scheduled',
    scheduledAt: new Date(),
    publishedAt: null,
    socialPlatforms: options.social_platforms,
    prompt: null,
    metadata: {}
  };
}

/**
 * Генерирует настройки социальных сетей для тестирования
 * @param settings Объект с настройками
 * @returns Объект, имитирующий возвращаемое значение getCampaignSettings
 */
export function generateSocialSettings(settings: any) {
  return settings;
}

/**
 * Мокирует ответ API Telegram
 * @param messageId ID сообщения
 * @returns Объект, имитирующий ответ API Telegram
 */
export function mockTelegramAPIResponse(messageId: number) {
  return {
    ok: true,
    result: {
      message_id: messageId,
      date: Math.floor(Date.now() / 1000),
      chat: {
        id: -1002302366310,
        title: 'Test Channel',
        type: 'channel'
      },
      from: {
        id: 7529101043,
        is_bot: true,
        first_name: 'Test Bot',
        username: 'test_bot'
      },
      text: 'Test message'
    }
  };
}

/**
 * Имитирует ответ Directus API с правильными настройками
 * @param campaignId ID кампании
 * @returns Объект с настройками социальных сетей
 */
export function mockDirectusGetCampaign(campaignId: string) {
  return {
    id: campaignId,
    socialMediaSettings: {
      telegram: {
        token: '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU',
        chatId: '-1002302366310'
      },
      vk: {
        token: 'vk1.a.0jlmORGkgmds1qIB5btPIIuT1FZ8C_bkGpCcowI9Ml214neQFgVMiYEnePWq48txdx3D7oTtKbEvgnEifytkkyjv1FvooFsI0y_YYPX8Cw__525Tnqt_H7C9hEEdmsqHXExr4Q3DK7CL0quCvnhrhN368Ter9yFLe6buYgpnamBXwUx4yZnRJPdBVfnPmObtZRrXw7NaZJboCqAK8sXLEA',
        groupId: 'club228626989'
      },
      instagram: {
        token: 'EAA520SFRtvcBO9Y7LhiiZBqwsqdZCP9JClMUoJZCvjsSc8qs9aheLdWefOqrZBLQhe5T0ZBerS6mZAZAP6D4i8Ln5UBfiIyVEif1LrzcAzG6JNrhW2DJeEzObpp9Mzoh8tDZA9I0HigkLnFZCaJVZCQcGDAkZBRxwnVimZBdbvokeg19i5RuGTbfuFs9UC9R',
        businessAccountId: '17841422577074562'
      },
      facebook: {
        token: 'EAA520SFRtvcBO9Y7LhiiZBqwsqdZCP9JClMUoJZCvjsSc8qs9aheLdWefOqrZBLQhe5T0ZBerS6mZAZAP6D4i8Ln5UBfiIyVEif1LrzcAzG6JNrhW2DJeEzObpp9Mzoh8tDZA9I0HigkLnFZCaJVZCQcGDAkZBRxwnVimZBdbvokeg19i5RuGTbfuFs9UC9R',
        pageId: '2120362494678794'
      }
    }
  };
}