// Проверяем статусы всех платформ перед возвратом результата
if (hasSuccess && systemToken) {
  try {
    // Получаем обновленный контент, чтобы иметь актуальные статусы платформ
    const updatedContent = await storage.getCampaignContentById(content.id);
    if (updatedContent && updatedContent.socialPlatforms) {
      // Проверяем статусы всех выбранных платформ
      const allPlatformsPublished = platforms.every(platformName => {
        const platformData = updatedContent.socialPlatforms?.[platformName];
        return platformData && platformData.status === 'published';
      });
      
      // Если все выбранные платформы опубликованы, только тогда меняем общий статус контента
      if (allPlatformsPublished) {
        await storage.updateCampaignContent(content.id, {
          status: 'published',
          publishedAt: new Date().toISOString()
        }, systemToken);
        
        log(`Все платформы (${platforms.join(', ')}) опубликованы, общий статус контента ${content.id} обновлен на published`, 'api');
      } else {
        // Если не все платформы опубликованы, оставляем статус scheduled
        log(`Не все платформы (${platforms.join(', ')}) опубликованы, статус контента ${content.id} остается scheduled`, 'api');
      }
    }
  } catch (checkError: any) {
    log(`Ошибка при проверке общего статуса публикации: ${checkError.message}`, 'api');
  }
}