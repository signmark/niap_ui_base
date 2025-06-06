# Финальная настройка Global API Keys

## Шаг 1: Выполните SQL
Выполните SQL из файла `simple_global_api_keys.sql` в PostgreSQL админке:

```sql
CREATE TABLE IF NOT EXISTS global_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL UNIQUE,
    api_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_global_api_keys_service ON global_api_keys(service_name);

COMMENT ON TABLE global_api_keys IS 'Глобальные API ключи для AI сервисов';
COMMENT ON COLUMN global_api_keys.service_name IS 'Сервис';
COMMENT ON COLUMN global_api_keys.api_key IS 'API Ключ';
COMMENT ON COLUMN global_api_keys.is_active IS 'Активен';
COMMENT ON COLUMN global_api_keys.description IS 'Описание';
```

## Шаг 2: Обновите схему Directus
```bash
node refresh_directus_schema.js
```

## Результат
В Directus админке появится таблица Global API Keys с только нужными полями:
- ID
- Сервис  
- API Ключ
- Активен
- Описание

Никаких лишних полей (created_at, updated_at и прочее) не будет.