# 🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ N8N Instagram Stories Workflow

## Проблема
Контейнер создается успешно, но публикация падает с ошибкой "(#100) The parameter creation_id is required"

## Корневая причина
N8N workflow использует неправильные параметры для Instagram Stories API

## 🚨 ОБЯЗАТЕЛЬНЫЕ ИЗМЕНЕНИЯ в N8N workflow:

### 1. В узле "Create Stories Video Container"

**ИЗМЕНИТЬ Body Parameters:**
```json
{
  "video_url": "{{ $node[\"Prepare Instagram Data\"].json.video_url }}",
  "media_type": "STORIES",
  "published": false
}
```

**ВАЖНО:** `media_type` должен быть `"STORIES"`, НЕ `"VIDEO"`!

### 2. В узле "Publish Story" 

**ПОЛНОСТЬЮ ИЗМЕНИТЬ URL и параметры:**

**Старый неправильный URL:**
```
https://graph.facebook.com/v18.0/{{ account_id }}/media_publish
```

**Новый правильный URL:**
```
https://graph.facebook.com/v18.0/{{ $json.id }}
```

**Новые Body Parameters:**
```json
{
  "published": true
}
```

**НЕ ИСПОЛЬЗОВАТЬ:** `creation_id` в body - это неправильно для Stories!

### 3. Альтернативное решение - Прямая публикация

Если двухэтапный не работает, используйте одноэтапную публикацию:

**URL:**
```
https://graph.facebook.com/v18.0/{{ account_id }}/media
```

**Body Parameters:**
```json
{
  "video_url": "{{ video_url }}",
  "media_type": "STORIES", 
  "published": true
}
```

## 🔍 Как проверить исправление

1. Запустите workflow с нашим payload
2. Если контейнер создался (есть `id` в ответе), но публикация падает - значит нужно исправить узел "Publish Story"  
3. Если и контейнер не создается - исправьте `media_type` на `"STORIES"`

## 📋 Наш payload уже содержит правильные указания

```json
{
  "instagram_config": {
    "media_type": "STORIES",
    "published": true,
    "stories_direct_mode": true,
    "body_parameters": {
      "media_type": "STORIES",
      "published": true
    }
  }
}
```

N8N должен читать эти параметры и использовать правильные значения.