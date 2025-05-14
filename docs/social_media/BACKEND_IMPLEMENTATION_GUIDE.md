# Руководство по реализации бэкенда для Instagram Stories

## 1. Основные компоненты, требующие доработки

На основе анализа текущей кодовой базы и с учетом того, что публикация через n8n уже работает для всех платформ кроме Facebook, для полноценной поддержки Instagram Stories необходимо внести следующие изменения:

### 1.1 Обнаружение контента типа "Stories"

Во всех системных компонентах, где происходит публикация или обработка контента, необходимо добавить универсальную функцию определения типа "Stories":

```typescript
/**
 * Определяет, является ли контент типа "Stories"
 * @param content Объект контента для проверки
 * @returns true если контент является Stories, иначе false
 */
export function isStoriesContent(content: any): boolean {
  if (!content) return false;
  
  return (
    content.contentType === 'stories' || 
    content.content_type === 'stories' ||
    content.type === 'stories' ||
    content.isStories === true ||
    content.hasStories === true ||
    (content.title && (
      content.title.toLowerCase().includes('[stories]') || 
      content.title.toLowerCase().includes('#stories')
    ))
  );
}
```

Эта функция уже реализована в `publish-scheduler.ts` (метод `isContentTypeStories`), но её нужно вынести в отдельный утилитарный модуль, например, `server/utils/content-helpers.ts` для использования во всей системе.

### 1.2 Модификация маршрутизатора публикаций

В `server/api/social-publishing-router.ts` уже реализована большая часть логики:

1. Обнаружение контента типа Stories
2. Фильтрация платформ (только Instagram для Stories)
3. Маршрутизация на стандартный webhook Instagram 

Поскольку публикация через n8n уже работает для всех платформ кроме Facebook, основные изменения, которые следует внести:

```typescript
// Обновление кода маршрутизации около строки 257
log(`[Social Publishing] Используем обычный вебхук Instagram для публикации Stories`, 'social');
// Убедиться, что передается параметр content_type='stories' для корректной обработки
return publishViaN8n(contentId, 'instagram', req, res, { content_type: 'stories' });
```

Если функция `publishViaN8n` еще не поддерживает дополнительные параметры, необходимо модифицировать ее:

```typescript
/**
 * Публикует контент через n8n вебхук
 * @param contentId ID контента для публикации
 * @param platform Платформа для публикации
 * @param req Исходный запрос
 * @param res Исходный ответ
 * @param additionalParams Дополнительные параметры для передачи в webhook
 */
async function publishViaN8n(
  contentId: string, 
  platform: string, 
  req: express.Request, 
  res: express.Response, 
  additionalParams?: Record<string, any>
) {
  // Существующий код...
  
  // Формируем данные для отправки в webhook
  const webhookData = {
    contentId,
    platform,
    ...additionalParams // Добавляем дополнительные параметры
  };
  
  // Остальной код...
}
```

### 1.3 Интеграция с планировщиком публикаций

Планировщик публикаций (`server/services/publish-scheduler.ts`) уже содержит метод `isContentTypeStories` для определения контента типа Stories. Необходимо добавить следующие модификации в метод `checkScheduledContent` (примерно после строки 800):

```typescript
// В цикле обработки каждого контента, добавляем проверку на тип Stories
for (const content of scheduledContent) {
  try {
    // Определяем, является ли контент типа Stories
    const isStories = this.isContentTypeStories(content);
    
    // Если это Stories, применяем специальную логику платформ
    if (isStories) {
      log(`Контент ${content.id} определен как Instagram Stories`, 'scheduler');
      
      // Для Stories фильтруем платформы, оставляя только Instagram
      socialPlatforms = { instagram: socialPlatforms.instagram };
      log(`Для контента типа Stories используем только платформу Instagram: ${JSON.stringify(Object.keys(socialPlatforms))}`, 'scheduler');
    }
    
    // Остальная логика обработки контента...
  } catch (error) {
    // Обработка ошибок...
  }
}
```

Также необходимо модифицировать метод `publishPlatformContent` для добавления параметра `content_type` при публикации Stories:

```typescript
// В методе публикации контента для платформы
async publishPlatformContent(content: CampaignContent, platform: string) {
  try {
    // Определяем, является ли контент типа Stories
    const isStories = this.isContentTypeStories(content);
    
    // Формируем параметры запроса
    const params: Record<string, any> = {
      contentId: content.id,
      platform
    };
    
    // Если это Stories, добавляем специальный параметр
    if (isStories && platform === 'instagram') {
      params.content_type = 'stories';
    }
    
    // Формируем URL для запроса API
    const apiUrl = `${this.getApiBaseUrl()}/api/publish`;
    
    // Отправляем запрос на публикацию
    const response = await axios.post(apiUrl, params);
    
    // Остальной код обработки ответа...
  } catch (error) {
    // Обработка ошибок...
  }
}
```

### 1.4 Обработка webhook для Instagram Stories

В `server/api/instagram-stories-webhook.ts` уже реализована основная логика для обработки Stories. Необходимо обновить эту логику для совместимости с единым endpoint:

```typescript
// Обновление маршрута для работы с новым унифицированным подходом
router.post('/', async (req: Request, res: Response) => {
  try {
    const { contentId, content_type } = req.body;
    
    // Проверка, является ли запрос для Stories
    const isStories = content_type === 'stories';
    
    // Если это не Stories, но запрос пришел на этот endpoint, логируем предупреждение
    if (!isStories) {
      log(`Внимание: получен запрос без тега stories, но на специальный endpoint для Stories: ${JSON.stringify(req.body)}`, 'instagram-webhook');
    }
    
    // Существующий код обработки...
  } catch (error) {
    // Обработка ошибок...
  }
});
```

## 2. Реализация статуса публикации для Stories

### 2.1 Дополнение схемы статусов публикации

В `server/storage.ts` (или `shared/schema.ts`) необходимо добавить поддержку метаданных для Stories:

```typescript
// Расширяем интерфейс PlatformPublishInfo
export interface PlatformPublishInfo {
  // Существующие поля
  status: 'pending' | 'scheduled' | 'published' | 'failed';
  publishedAt?: string | null;
  scheduledAt?: string | null;
  postId?: string | null;
  postUrl?: string | null;
  error?: string | null;
  
  // Добавляем поля специфичные для Stories
  storiesMetadata?: {
    expiresAt?: string; // Время истечения Stories (24 часа после публикации)
    views?: number;     // Количество просмотров
    replies?: number;   // Количество ответов
  };
}
```

### 2.2 Обновление обработчика статусов публикации

В методе `updatePublicationStatus` класса `PublishScheduler` необходимо добавить обработку метаданных для Stories:

```typescript
// В методе обновления статуса публикации после получения ответа от API
if (platform === 'instagram' && this.isContentTypeStories(content)) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 часа
  
  // Добавляем метаданные для Stories
  platformStatus.storiesMetadata = {
    expiresAt: expiresAt.toISOString(),
    views: 0, // Начальное значение
    replies: 0 // Начальное значение
  };
  
  log(`Установлены метаданные для Instagram Stories, время истечения: ${expiresAt.toISOString()}`, 'scheduler');
}
```

## 3. Обработка ошибок и предотвращение дублирования

### 3.1 Расширение системы блокировок для предотвращения дублей

В `social-publishing-router.ts` уже реализован механизм блокировки с использованием Map (`inProgressPublications`). Необходимо добавить дополнительную защиту для Stories:

```typescript
// В функции isPublicationInProgress добавляем специальную логику для Stories
const isStoriesContent = /* определение по контенту */;

// Для Stories устанавливаем более строгую блокировку
if (isStoriesContent && platform === 'instagram') {
  // Увеличиваем интервал блокировки для Stories до 5 минут
  if (timeSinceLock < 5 * 60 * 1000) { // 5 минут вместо 3
    log(`Публикация Stories ${key} защищена увеличенной блокировкой еще ${Math.floor((5 * 60 * 1000 - timeSinceLock) / 1000)} сек`, 'social-publishing');
    return true;
  }
}
```

### 3.2 Обработка ошибок интеграции с Instagram

В `instagram-stories-webhook.ts` необходимо улучшить обработку ошибок:

```typescript
try {
  const webhookResponse = await axios.post(n8nWebhookUrl, dataForN8n);
  log(`Данные успешно отправлены на n8n webhook, ответ: ${JSON.stringify(webhookResponse.data || 'Нет данных в ответе')}`, 'instagram-webhook');
  
  // Добавляем обработку статуса ответа
  if (webhookResponse.data && webhookResponse.data.error) {
    // Если в ответе есть поле error, значит публикация не удалась
    log(`Ошибка при публикации Stories через n8n: ${webhookResponse.data.error}`, 'instagram-webhook');
    
    // Обновляем статус публикации на 'failed'
    socialPublications.instagram.status = 'failed';
    socialPublications.instagram.message = `Ошибка: ${webhookResponse.data.error}`;
    
    // Обновляем статус в Directus
    try {
      await directusApiManager.patch(`/items/campaign_content/${contentId}`, {
        social_platforms: socialPublications
      }, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      
      log(`Обновлен статус публикации для контента ${contentId} на 'failed'`, 'instagram-webhook');
    } catch (updateError) {
      log(`Ошибка при обновлении статуса: ${updateError.message}`, 'instagram-webhook');
    }
    
    // Возвращаем сообщение об ошибке
    return res.status(400).json({
      success: false,
      error: webhookResponse.data.error,
      result: {
        platform: 'instagram',
        status: 'failed',
        error: webhookResponse.data.error
      }
    });
  }
} catch (webhookError) {
  // Существующая обработка ошибки...
}
```

## 4. Алгоритм работы с Stories в планировщике

### 4.1 Логика проверки запланированных Stories

В методе `checkScheduledContent` класса `PublishScheduler` необходимо добавить специальную логику для обработки контента типа Stories:

```typescript
// При проверке наступления времени публикации для каждой платформы
for (const platformKey of Object.keys(socialPlatforms)) {
  try {
    const platform = socialPlatforms[platformKey];
    
    // Пропускаем платформы, которые не Instagram, если это Stories
    if (isStories && platformKey !== 'instagram') {
      log(`Пропускаем публикацию Stories для платформы ${platformKey} - поддерживается только Instagram`, 'scheduler');
      continue;
    }
    
    // Для Instagram Stories добавляем особую проверку на блокировку повторной публикации
    if (isStories && platformKey === 'instagram' && this.isPublicationLocked(content.id, 'instagram')) {
      log(`Публикация Instagram Stories для контента ${content.id} заблокирована для предотвращения дублей`, 'scheduler');
      continue;
    }
    
    // Остальной код проверки времени публикации...
  } catch (error) {
    // Обработка ошибок...
  }
}
```

### 4.2 Проверка истечения срока действия Stories

Добавьте новый метод в класс `PublishScheduler` для проверки и обновления статуса истекших Stories:

```typescript
/**
 * Проверяет истекшие Stories и обновляет их статус
 * Stories считаются истекшими через 24 часа после публикации
 */
async checkExpiredStories() {
  try {
    log('Проверка истекших Stories', 'scheduler');
    
    // Получаем токен для доступа к API
    const authToken = await this.getSystemToken();
    if (!authToken) {
      log('Не удалось получить токен для проверки истекших Stories', 'scheduler');
      return;
    }
    
    // Получаем весь контент типа Stories со статусом published
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };
    
    // Получаем только контент со статусом published и типом stories
    const response = await axios.get(`${directusUrl}/items/campaign_content`, {
      headers,
      params: {
        filter: JSON.stringify({
          status: { _eq: 'published' },
          _or: [
            { contentType: { _eq: 'stories' } },
            { content_type: { _eq: 'stories' } },
            { title: { _contains: '[stories]' } },
            { title: { _contains: '#stories' } }
          ]
        })
      }
    });
    
    const storiesContent = response.data.data || [];
    log(`Найдено ${storiesContent.length} опубликованных Stories`, 'scheduler');
    
    // Проверяем каждый контент на истечение срока
    const now = new Date();
    let expiredCount = 0;
    
    for (const content of storiesContent) {
      try {
        // Получаем платформы контента
        let socialPlatforms = content.social_platforms;
        
        // Преобразуем в объект, если это строка
        if (typeof socialPlatforms === 'string') {
          try {
            socialPlatforms = JSON.parse(socialPlatforms);
          } catch (e) {
            continue; // Пропускаем, если не удалось распарсить
          }
        }
        
        // Проверяем Instagram Stories
        if (socialPlatforms?.instagram?.status === 'published' && 
            socialPlatforms.instagram.publishedAt) {
          
          // Проверяем время публикации
          const publishedAt = new Date(socialPlatforms.instagram.publishedAt);
          const expiresAt = socialPlatforms.instagram.storiesMetadata?.expiresAt 
            ? new Date(socialPlatforms.instagram.storiesMetadata.expiresAt)
            : new Date(publishedAt.getTime() + 24 * 60 * 60 * 1000); // 24 часа
          
          // Если Stories истекли
          if (now > expiresAt) {
            log(`Stories ${content.id} истекли: опубликованы ${publishedAt.toISOString()}, истекли ${expiresAt.toISOString()}`, 'scheduler');
            
            // Обновляем статус на 'expired'
            socialPlatforms.instagram.status = 'expired';
            socialPlatforms.instagram.message = 'Stories истекли (24 часа)';
            
            // Обновляем в Directus
            await axios.patch(`${directusUrl}/items/campaign_content/${content.id}`, {
              social_platforms: socialPlatforms
            }, { headers });
            
            expiredCount++;
          }
        }
      } catch (error: any) {
        log(`Ошибка при проверке истечения Stories ${content.id}: ${error.message}`, 'scheduler');
      }
    }
    
    log(`Обновлен статус ${expiredCount} истекших Stories`, 'scheduler');
  } catch (error: any) {
    log(`Ошибка при проверке истекших Stories: ${error.message}`, 'scheduler');
  }
}
```

Добавьте вызов этого метода в метод `start`:

```typescript
// В методе start добавляем интервал для проверки истекших Stories
// Проверяем истекшие Stories каждый час
setInterval(() => {
  this.checkExpiredStories();
}, 60 * 60 * 1000); // 1 час
```

## 5. Тестирование реализации

### 5.1 Ручное тестирование

После внедрения всех изменений необходимо провести тестирование:

1. Создать контент с типом "stories"
2. Попытаться опубликовать его сразу, убедиться что выбрана только платформа Instagram
3. Запланировать публикацию контента типа "stories" и убедиться, что он публикуется только в Instagram
4. Проверить обработку ошибок при публикации
5. Убедиться, что статус обновляется корректно после публикации
6. Проверить механизм предотвращения дублирования публикаций

### 5.2 Автоматические тесты (опционально)

Рекомендуется написать модульные тесты для следующих компонентов:

1. Функция определения типа контента `isStoriesContent`
2. Логика фильтрации платформ для Stories
3. Механизм блокировки повторных публикаций
4. Обработка ответов от API Instagram

```typescript
// Пример теста для функции определения типа Stories
import { isStoriesContent } from '../utils/content-helpers';

describe('Content Type Detection', () => {
  test('Should detect Stories by contentType field', () => {
    const content = { contentType: 'stories', title: 'Test Content' };
    expect(isStoriesContent(content)).toBe(true);
  });
  
  test('Should detect Stories by title marker', () => {
    const content = { contentType: 'text', title: 'Test [Stories] Content' };
    expect(isStoriesContent(content)).toBe(true);
  });
  
  test('Should not detect regular content as Stories', () => {
    const content = { contentType: 'text', title: 'Regular Content' };
    expect(isStoriesContent(content)).toBe(false);
  });
});
```

## 6. Инструкции по развертыванию

### 6.1 Проверка перед развертыванием

Перед развертыванием изменений необходимо:

1. Убедиться, что все изменения протестированы в dev-среде
2. Проверить обратную совместимость с существующими функциями публикации
3. Создать резервную копию бэкенда перед внесением изменений

### 6.2 Процедура развертывания

1. Создать ветку `feature/instagram-stories-integration` на основе текущей `main`
2. Внести все необходимые изменения, описанные в этом руководстве
3. Протестировать изменения в dev-среде
4. Создать pull request для слияния с `main`
5. После успешного тестирования и ревью кода выполнить слияние с `main`
6. Развернуть изменения на production-сервере

## 7. Мониторинг и поддержка

### 7.1 Логирование

Добавьте специальные теги для логов, связанных с Instagram Stories:

```typescript
log(`[Instagram Stories] ${message}`, 'instagram-stories');
```

### 7.2 Алертинг

Настройте оповещения для следующих событий:

1. Ошибки публикации Instagram Stories
2. Превышение лимита попыток публикации
3. Блокировка аккаунта Instagram 

### 7.3 Обновление документации

После успешной реализации обновите документацию:

1. Добавьте раздел о работе с Instagram Stories в основную документацию
2. Создайте руководство для пользователей по работе с новым типом контента
3. Обновите API-документацию с описанием новых endpoints и параметров