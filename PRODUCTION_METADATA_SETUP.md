# Добавление поля metadata в Production

## Быстрый способ - через SQL

Подключитесь к production базе данных и выполните:

```sql
-- Добавляем поле metadata в таблицу campaign_content
ALTER TABLE campaign_content 
ADD COLUMN metadata JSONB DEFAULT '{}';

-- Добавляем комментарий для поля
COMMENT ON COLUMN campaign_content.metadata IS 'Дополнительные данные контента (Stories, настройки и т.д.)';
```

## Через интерфейс Directus

1. **Откройте админ-панель Directus** - https://directus.nplanner.ru
2. **Войдите как администратор**
3. **Перейдите в Settings → Data Model**
4. **Выберите коллекцию campaign_content**
5. **Нажмите кнопку "+" для добавления поля**

### Настройки нового поля:

- **Название поля:** `metadata`
- **Тип:** `JSON`
- **Интерфейс:** Code (JSON)
- **Значение по умолчанию:** `{}`
- **Nullable:** Да
- **Заметка:** "Дополнительные данные контента (Stories, настройки и т.д.)"

### Дополнительные настройки интерфейса:

- **Language:** JSON
- **Template:** `{}`
- **Display:** Formatted JSON Value

## Добавление типа "Stories" в content_type

1. **В той же коллекции campaign_content**
2. **Найдите поле content_type**
3. **Откройте настройки поля**
4. **В разделе Interface → Options → Choices добавьте:**

```json
{
  "text": "Stories",
  "value": "stories"
}
```

## Автоматический скрипт (если есть Node.js)

Если на сервере установлен Node.js, используйте готовые скрипты:

```bash
# Установите переменные окружения
export PRODUCTION_ADMIN_EMAIL=admin@nplanner.ru
export PRODUCTION_ADMIN_PASSWORD=ваш_пароль

# Запустите скрипт
./deploy_stories_production.sh
```

## Проверка результата

После добавления поля:

1. **Обновите страницу Directus**
2. **Перейдите в коллекцию campaign_content**
3. **Проверьте наличие поля metadata в списке полей**
4. **В приложении попробуйте создать контент типа "Stories"**

## Устранение проблем

Если Stories редактор не открывается:

1. **Проверьте поле metadata** - должно быть типа JSON/JSONB
2. **Очистите кэш браузера**
3. **Перезапустите сервер приложения**

После добавления поля metadata Stories будут полностью функциональны.