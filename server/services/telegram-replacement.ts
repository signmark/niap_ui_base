  /**
   * Публикует контент в Telegram с использованием нового сервиса
   * Полная переработка с новой логикой форматирования и отправки сообщений
   */
  async publishToTelegram(
    content: CampaignContent,
    telegramSettings?: SocialMediaSettings['telegram']
  ): Promise<SocialPublication> {
    // Импортируем новый сервис для работы с Telegram
    // @ts-ignore
    const telegramService = require('./telegram-service-new.js');
    
    // Расширенное логирование для отладки
    log(`publishToTelegram вызван для контента: ${content.id}, title: "${content.title || 'без названия'}"`, 'telegram');
    log(`Параметры Telegram: ${JSON.stringify({
      settingsProvided: !!telegramSettings,
      tokenProvided: !!telegramSettings?.token,
      chatIdProvided: !!telegramSettings?.chatId,
      tokenLength: telegramSettings?.token ? telegramSettings.token.length : 0,
      chatIdValue: telegramSettings?.chatId || 'не задан'
    })}`, 'telegram');
    
    try {
      // Обработка дополнительных изображений и загрузка на Imgur
      let processedContent = this.processAdditionalImages(content, 'telegram');
      processedContent = await this.uploadImagesToImgur(processedContent);
      
      // Делегируем всю работу новому сервису
      const result = await telegramService.publishContent(processedContent, telegramSettings);
      
      return result;
    } catch (error: any) {
      log(`Ошибка при публикации в Telegram: ${error.message}`, 'telegram');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации в Telegram: ${error.message}`
      };
    }
  }