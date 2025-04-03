# Исправление для загрузки изображений Directus в Telegram

## Проблема

Текущий метод `uploadTelegramImageFromUrl` в классе `SocialPublishingService` не учитывает необходимость авторизации при загрузке изображений из Directus. В результате при попытке скачать изображение из Directus возникает ошибка 401 Unauthorized, и изображение не отправляется в Telegram.

## Решение

Решение заключается в добавлении логики авторизации для URL изображений, которые относятся к Directus. Нужно использовать актуальный токен из кэша `directusApiManager`, который всегда содержит свежий токен.

## Как применить исправление

1. Импортируйте `directusApiManager` в начале файла `social-publishing.ts`:

```typescript
import { directusApiManager } from '../directus';
```

2. Замените текущий метод `uploadTelegramImageFromUrl` на следующий код:

```typescript
private async uploadTelegramImageFromUrl(
  imageUrl: string,
  chatId: string,
  caption: string,
  token: string,
  baseUrl = 'https://api.telegram.org/bot'
): Promise<any> {
  try {
    log(`📤 Загрузка изображения в Telegram из URL: ${imageUrl.substring(0, 100)}...`, 'social-publishing');
    
    // Создаем временную директорию, если она не существует
    const tempDir = path.join(os.tmpdir(), 'telegram_uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Генерируем уникальное имя для временного файла
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const tempFilePath = path.join(tempDir, `telegram_${timestamp}_${randomString}.jpg`);
    
    // Подготовка заголовков с авторизацией для Directus
    const headers: Record<string, string> = {
      'Accept': 'image/*',
      'User-Agent': 'Mozilla/5.0 SMM Planner Bot',
      'Cache-Control': 'no-cache'
    };
    
    // Проверяем, является ли URL от Directus, и добавляем токен авторизации
    if (imageUrl.includes('directus.nplanner.ru')) {
      // Получаем токены всех пользователей (возьмем первый действующий)
      let directusToken = null;
      
      // Перебираем все ключи в кеше токенов
      const userIds = Object.keys(directusApiManager['authTokenCache'] || {});
      
      for (const userId of userIds) {
        const cachedToken = directusApiManager.getCachedToken(userId);
        if (cachedToken) {
          directusToken = cachedToken.token;
          log(`✅ Найден действующий токен Directus для пользователя ${userId}`, 'social-publishing');
          break;
        }
      }
      
      // Если у нас есть токен, добавляем его в заголовки
      if (directusToken) {
        headers['Authorization'] = `Bearer ${directusToken}`;
        log(`🔑 Добавлен токен авторизации для Directus URL ${imageUrl.substring(0, 50)}...`, 'social-publishing');
      } else {
        log(`⚠️ Не найден действующий токен Directus в кеше`, 'social-publishing');
      }
    }
    
    log(`🔄 Скачивание изображения во временный файл: ${tempFilePath}`, 'social-publishing');
    
    try {
      // Скачиваем изображение с улучшенной обработкой ошибок и заголовками авторизации
      console.time('⏱️ Время скачивания изображения');
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000, // Увеличенный таймаут для больших изображений
        headers: headers
      });
      console.timeEnd('⏱️ Время скачивания изображения');
      
      // Проверяем размер полученного файла
      const dataSize = response.data.length;
      if (dataSize === 0) {
        throw new Error(`📭 Скачан пустой файл (0 байт) с URL: ${imageUrl}`);
      }
      
      // Определяем тип контента
      const contentType = response.headers['content-type'] || 'image/jpeg';
      log(`📥 Получены данные изображения: ${dataSize} байт, тип контента: ${contentType}`, 'social-publishing');
      
      // Определяем расширение файла на основе MIME-типа
      const fileExtension = contentType.includes('png') ? 'png' : 'jpg';
      const finalTempFilePath = path.join(tempDir, `telegram_${timestamp}_${randomString}.${fileExtension}`);
      
      // Сохраняем файл на диск
      fs.writeFileSync(finalTempFilePath, Buffer.from(response.data));
      log(`💾 Изображение сохранено во временный файл: ${finalTempFilePath} (${fs.statSync(finalTempFilePath).size} байт)`, 'social-publishing');
      
      // Создаем FormData для отправки изображения
      const formData = new FormData();
      
      // Добавляем основные параметры
      formData.append('chat_id', chatId);
      
      // Если есть подпись, добавляем её и формат разметки
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }
      
      // Добавляем файл изображения
      const fileStream = fs.createReadStream(finalTempFilePath);
      formData.append('photo', fileStream, { 
        filename: `image_${timestamp}.${fileExtension}`,
        contentType: contentType
      });
      
      // Отправляем запрос в Telegram API
      log(`🚀 Отправка изображения в Telegram чат: ${chatId}`, 'social-publishing');
      console.time('⏱️ Время отправки в Telegram');
      const uploadResponse = await axios.post(`${baseUrl}${token}/sendPhoto`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000 // Увеличенный таймаут для больших изображений
      });
      console.timeEnd('⏱️ Время отправки в Telegram');
      
      // Закрываем поток чтения файла
      fileStream.destroy();
      
      // Удаляем временный файл
      try {
        fs.unlinkSync(finalTempFilePath);
        log(`🗑️ Временный файл удален: ${finalTempFilePath}`, 'social-publishing');
      } catch (unlinkError) {
        log(`⚠️ Не удалось удалить временный файл: ${unlinkError}`, 'social-publishing');
      }
      
      // Проверяем успешность отправки
      if (uploadResponse.data && uploadResponse.data.ok) {
        log(`✅ Изображение успешно отправлено в Telegram: message_id=${uploadResponse.data.result.message_id}`, 'social-publishing');
        return uploadResponse.data;
      } else {
        log(`❌ Ошибка при отправке изображения в Telegram: ${JSON.stringify(uploadResponse.data)}`, 'social-publishing');
        throw new Error(`API вернул ошибку: ${JSON.stringify(uploadResponse.data)}`);
      }
      
    } catch (downloadError: any) {
      // Если временный файл был создан, удаляем его
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          log(`🗑️ Временный файл удален после ошибки: ${tempFilePath}`, 'social-publishing');
        } catch (e) {
          // Игнорируем ошибки при очистке
        }
      }
      
      // Логируем и пробрасываем ошибку выше
      log(`❌ Ошибка при скачивании/отправке изображения: ${downloadError.message}`, 'social-publishing');
      if (downloadError.response) {
        log(`📊 Статус ответа: ${downloadError.response.status}`, 'social-publishing');
        log(`📝 Данные ответа при ошибке: ${JSON.stringify(downloadError.response.data)}`, 'social-publishing');
      }
      throw downloadError;
    }
    
  } catch (error: any) {
    log(`❌ Общая ошибка при загрузке изображения в Telegram: ${error.message}`, 'social-publishing');
    throw error;
  }
}
```

## Альтернативный вариант

Если в файле `social-publishing.ts` слишком много синтаксических ошибок, вы можете использовать отдельный класс `TelegramPublisher` из файла `standalone-telegram-publisher.js`.

### Интеграция отдельного класса в существующий код:

```typescript
// В методе publishToTelegram класса SocialPublishingService
const TelegramPublisher = require('../../standalone-telegram-publisher');
const telegramPublisher = new TelegramPublisher();

// Отправляем изображение через отдельный класс вместо метода uploadTelegramImageFromUrl
const response = await telegramPublisher.sendDirectusImageToTelegram(
  processedImageUrl,
  chatId,
  formattedText,
  token
);
```

## Итоговое решение

Независимо от выбранного подхода, решение позволяет корректно загружать изображения из Directus с авторизацией и отправлять их в Telegram без ошибок 401 Unauthorized.