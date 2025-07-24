# Исправление проблемы Gemini API на стейдже

## Проблема
На стейдинг сервере анализ настроений выдает ошибку:
```
"User location is not supported for the API use."
```

Это означает что запросы к Gemini API идут напрямую из российской локации, минуя канадский SOCKS5 прокси.

## Решение

### 1. Добавить переменную окружения на стейдже
```bash
export FORCE_GEMINI_PROXY=true
export NODE_ENV=staging
```

### 2. Проверить что прокси-креды доступны
Убедитесь что на стейдже есть переменные:
```bash
export PROXY_HOST=138.219.123.68
export PROXY_PORT=9710
export PROXY_USERNAME=PGjuJV
export PROXY_PASSWORD=cwZmJ3
```

### 3. Перезапустить сервис
```bash
pm2 restart smm-app
# или
systemctl restart smm-app
```

## Проверка работы

### Тест анализа настроений:
```bash
curl -X POST "https://your-staging-domain.com/api/trend-sentiment/TREND_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Логи для отладки:
```bash
# Ищите в логах эти сообщения:
# ✅ "[gemini-proxy] 🇨🇦 Используется канадский SOCKS5 прокси"
# ❌ "[gemini-proxy] ⚠️ ВНИМАНИЕ: Прокси недоступен"

tail -f /var/log/smm-app/error.log | grep "gemini-proxy"
```

## Техническое объяснение

Исправление в `server/services/gemini-proxy.ts`:

1. **Добавлена проверка среды**: `isStaging = NODE_ENV === 'staging'`
2. **Принудительное использование прокси**: `forceProxy = FORCE_GEMINI_PROXY === 'true'`
3. **Логика включения прокси**: `if (isStaging || forceProxy || !isReplit)`

## В Replit
В Replit прокси НЕ используется (IP США, нет блокировок Google).

## На стейдже/продакшене
Прокси ОБЯЗАТЕЛЕН для обхода географических ограничений Google API.

## Альтернативное решение
Если прокси недоступен, можно использовать Vertex AI API:
- Изменить модель с `gemini-1.5-flash` на `gemini-2.5-flash`
- Vertex AI имеет меньше географических ограничений