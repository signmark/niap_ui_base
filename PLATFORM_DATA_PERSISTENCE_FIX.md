# Решение проблемы потери данных платформ при публикации

## Суть проблемы

При публикации контента на одну из социальных платформ (например, Telegram) данные других платформ (VK, Instagram) терялись из-за несоответствия форматов данных между API и базой данных.

## Основная причина

1. В базе данных Directus поле с данными платформ хранится как `social_platforms` (snake_case).
2. В приложении это поле представлено как `socialPlatforms` (camelCase).
3. При обновлении статуса публикации для одной платформы, информация отправлялась в формате camelCase (`socialPlatforms`), но API ожидал данные в формате snake_case (`social_platforms`).

## Решение

1. В методе `updatePublicationStatus` в `social-publishing.ts` обеспечено корректное преобразование полей:
   ```javascript
   const updateData: Record<string, any> = {
     social_platforms: socialPlatforms, // Используем snake_case для API Directus
     status: allPublished ? 'published' : 'scheduled'
   };
   ```

2. В `storage.ts` добавлено явное логирование и проверка поля `socialPlatforms`:
   ```javascript
   if (updates.socialPlatforms !== undefined) {
     console.log(`[КРИТИЧНО] Обновляем social_platforms контента ${id}: ${JSON.stringify(updates.socialPlatforms)}`);
     directusUpdates.social_platforms = updates.socialPlatforms;
   }
   ```

3. Добавлены дополнительные проверки и восстановление данных платформ из любых доступных источников (и `socialPlatforms`, и `social_platforms`).

## Технический процесс обновления

1. Сначала получаем текущий контент с его данными о платформах через `getCampaignContentById`.
2. При получении результата от API, преобразуем `social_platforms` в `socialPlatforms` для использования в приложении.
3. Обновляем статус конкретной платформы, сохраняя данные остальных платформ.
4. При сохранении обратно в базу данных, преобразуем `socialPlatforms` в `social_platforms` для API Directus.

## Проверка работоспособности

Для проверки решения создан специальный тест (`platform-persistence-test-v2.js`), который:
1. Создает контент с настройками для трех платформ
2. Публикует на одну платформу (Telegram)
3. Проверяет, что данные других платформ (VK, Instagram) сохранились
4. Удаляет тестовый контент

## Что было улучшено

1. Добавлено подробное логирование процесса обработки данных платформ
2. Добавлены проверки целостности данных платформ на всех этапах
3. Реализован механизм восстановления данных платформ из разных источников
4. Обеспечена согласованная конвертация полей между snake_case и camelCase