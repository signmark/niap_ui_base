# N8N Stories Workflow Setup Guide

## 1. Импорт Enhanced Stories Workflow

### Шаг 1: Замена существующего workflow
1. Откройте ваш N8N
2. Найдите существующий "Instagram Stories Webhook" workflow
3. Нажмите на Settings → "Import from File"
4. Загрузите файл `scripts/n8n-stories-workflow-enhanced.json`

### Шаг 2: Настройка credentials
Убедитесь, что у вас настроены:
- **PostgreSQL credentials** с ID: `lO4gl1E2I2lsrRce`
- Доступ к вашей базе данных production

### Шаг 3: Обновление URL endpoints
В workflow замените URL-адреса на ваши:

**Generate Stories Image node:**
```
URL: https://your-server.com/generate-stories
```

**Publish via Instagrapi node:**
```  
URL: https://your-server.com/api/stories/publish-instagrapi
```

## 2. Новые возможности Enhanced Workflow

### ✨ Мульти-платформенность
- **Instagram**: Поддержка интерактивных элементов через instagrapi
- **Facebook**: Стандартные Stories через Graph API
- **VK**: Статичные Stories изображения
- **Telegram**: Stories поддержка

### ✨ Интеллектуальный роутинг
```javascript
// Автоматическое определение метода публикации
if (hasInteractiveElements && platform === 'instagram') {
  publishMethod = 'instagrapi'; // Для интерактивности
} else {
  publishMethod = 'official_api'; // Стандартный API
}
```

### ✨ Поддержка интерактивных элементов
- **Polls** - Голосования с 2 вариантами
- **Quizzes** - Викторины до 4 вариантов
- **Sliders** - Слайдеры с эмодзи
- **Questions** - Открытые вопросы

## 3. Структура данных для Stories

### Входные данные в webhook:
```json
{
  "contentId": "uuid-content-id",
  "platform": "instagram",
  "contentType": "stories",
  "metadata": {
    "storyData": {
      "slides": [
        {
          "background": "#FF6B6B",
          "elements": [
            {
              "type": "poll",
              "question": "Любите ли вы здоровое питание?",
              "options": ["Да", "Нет"],
              "position": { "x": 50, "y": 80 }
            }
          ]
        }
      ]
    }
  },
  "campaign": { "id": "campaign-uuid" },
  "token": "user-auth-token"
}
```

## 4. Platform Switch Logic

Workflow автоматически направляет Stories в соответствующий обработчик:

```
Input → Platform Switch → [Instagram|Facebook|VK|Telegram] Processor
```

### Instagram Path:
```
Instagram Processor → Needs Image? → Generate → Use Instagrapi? → [Instagrapi|Official API]
```

### Other Platforms Path:
```
[VK|Telegram] Processor → Generate Static Image → Platform API
```

## 5. Webhook URLs

После импорта ваши webhook URLs будут:

```
# Основной Stories webhook
POST https://your-n8n.com/webhook/publish-stories

# Тестовый endpoint  
POST https://your-n8n.com/webhook-test/publish-stories
```

## 6. Интеграция с системой

В вашем коде система будет автоматически отправлять Stories в N8N:

```typescript
// Планировщик автоматически определит Stories
if (content.content_type === 'stories') {
  await publishToN8nStories(content, platform);
}
```

## 7. Мониторинг и логи

Workflow обновляет статусы в базе данных:

```sql
-- Проверка статусов Stories
SELECT id, title, social_platforms 
FROM campaign_content 
WHERE content_type = 'stories';
```

## 8. Troubleshooting

### Проблема: Интерактивные элементы не работают
**Решение**: Убедитесь, что:
- Настроены credentials для instagrapi
- Python сервис доступен на порту 5001
- Metadata содержит правильную структуру элементов

### Проблема: Изображения не генерируются  
**Решение**: Проверьте:
- Доступность Python генератора на `/generate-stories`
- Корректность структуры storyData в metadata

### Проблема: Публикация не происходит
**Решение**: Проверьте:
- Настройки соцсетей в campaign settings
- Валидность токенов платформ
- Логи в N8N execution history