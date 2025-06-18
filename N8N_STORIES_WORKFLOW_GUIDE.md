# 📱 N8N Stories Workflow - Полное руководство

## 🔄 Что должен делать ваш workflow:

### 1. Получение данных (✅ работает)
```javascript
// Extract Data node
const body = $input.item.json.body || $input.item.json;
return {
  contentId: body.contentId
};
```

### 2. Загрузка контента из базы (✅ работает)
```sql
-- Get Content node
SELECT * FROM campaign_content WHERE id = '{{ $json.contentId }}'
```

### 3. Обработка данных Stories (❌ нужно добавить)
```javascript
// Process Content node
const content = $input.all()[0].json;
const metadata = content.additional_media || {};
const storyData = metadata.storyData || {};

// Проверяем интерактивные элементы
const hasInteractive = storyData.slides?.some(slide => 
  slide.elements?.some(element => 
    ['poll', 'quiz', 'slider', 'question'].includes(element.type)
  )
) || false;

return {
  contentId: content.id,
  title: content.title,
  storyData: storyData,
  hasInteractive: hasInteractive,
  contentType: content.content_type
};
```

### 4. Выбор метода публикации (❌ нужно добавить)
```javascript
// Логика выбора:
if (hasInteractive) {
  // Используем instagrapi для интерактивности
  method = 'instagrapi';
} else {
  // Используем Graph API для обычных Stories
  method = 'graph_api';
}
```

### 5. Публикация контента (❌ нужно добавить)
```javascript
// Для интерактивных Stories
const response = await fetch('http://your-server/api/publish-instagram-stories', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contentId: contentId,
    method: 'instagrapi',
    storyData: storyData
  })
});

// Для обычных Stories
const response = await fetch('http://your-server/api/publish-instagram-stories', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contentId: contentId,
    method: 'graph_api',
    storyData: storyData
  })
});
```

### 6. Обновление статуса (❌ нужно добавить)
```sql
-- Update Status node
UPDATE campaign_content 
SET status = 'published', published_at = NOW() 
WHERE id = '{{ $json.contentId }}'
```

## 🛠 Что нужно добавить в ваш workflow:

1. **Process Content node** - обработка данных из базы
2. **Check Interactive Elements** - проверка интерактивных элементов
3. **Publish Interactive Stories** - публикация через instagrapi
4. **Publish Static Stories** - публикация через Graph API
5. **Update Status** - обновление статуса в базе
6. **Error Handling** - обработка ошибок

## 📋 Готовый workflow в файле:
`scripts/n8n-stories-workflow-complete.json`

## 🔗 Endpoints для вызова из N8N:

1. **Интерактивные Stories**: `POST /api/stories/publish-interactive`
2. **Обычные Stories**: `POST /api/stories/publish-static`
3. **Генерация изображений**: `POST /generate-stories`

## ⚡ Быстрый тест:

```bash
curl -X POST https://n8n.roboflow.tech/webhook/publish-stories \
  -H "Content-Type: application/json" \
  -d '{"contentId": "YOUR_CONTENT_ID"}'
```

Импортируйте готовый workflow из `scripts/n8n-stories-workflow-complete.json` и он будет полностью обрабатывать Stories публикацию!