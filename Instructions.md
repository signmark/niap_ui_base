# Исправление проблемы с форматированием HTML в Telegram

## Описание проблемы

При публикации постов в Telegram форматирование текста (жирный, курсив) отображается не так, как в редакторе. В редакторе текст отображается с правильным форматированием, но при публикации в Telegram часть форматирования теряется или отображается неправильно.

## Анализ причин проблемы

Проанализировав код, я выявил следующие вероятные причины проблемы:

1. **Жесткая фильтрация форматирования**: В файле `server/utils/telegram-html-cleaner-new.js` есть очень строгая фильтрация HTML-тегов, которая может удалять некоторые теги форматирования. Особенно это заметно в функции `removeUnsupportedTags()`.

2. **Неправильная обработка вложенных тегов**: В процессе преобразования HTML для Telegram система может терять вложенные теги форматирования.

3. **Избыточное преобразование блочных элементов**: Функция `convertBlocksToText()` преобразует все блочные элементы, что может влиять на форматирование внутри этих элементов.

4. **Проблемы с алиасами тегов**: Хотя система пытается преобразовать теги HTML в формат Telegram (например, `<strong>` в `<b>`), этот процесс может работать некорректно.

## План исправления

### 1. Модификация очистителя HTML для Telegram

Необходимо изменить файл `server/utils/telegram-html-cleaner-new.js`, чтобы сохранять форматирование:

```javascript
function normalizeFormattingTags(html) {
  let result = html;
  
  // Заменяем эквивалентные теги на стандартные для Telegram
  for (const [originalTag, telegramTag] of Object.entries(TAG_ALIASES)) {
    if (originalTag === telegramTag) continue; // Пропускаем, если теги совпадают
    
    // Замена открывающих тегов (сохраняем форматирование внутри)
    const openOriginalRegex = new RegExp(`<${originalTag}([^>]*)>`, 'gi');
    result = result.replace(openOriginalRegex, `<${telegramTag}>`);
    
    // Замена закрывающих тегов
    const closeOriginalRegex = new RegExp(`</${originalTag}>`, 'gi');
    result = result.replace(closeOriginalRegex, `</${telegramTag}>`);
  }
  
  // Более аккуратное удаление атрибутов из форматирующих тегов
  for (const tag of TELEGRAM_SUPPORTED_TAGS) {
    if (tag !== 'a') { // Обрабатываем отдельно ссылки
      const attributeRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
      result = result.replace(attributeRegex, `<${tag}>`);
    }
  }
  
  return result;
}
```

### 2. Улучшение обработки вложенных тегов

Необходимо улучшить обработку вложенных тегов, особенно когда они пересекаются:

```javascript
function fixNestedTags(html) {
  // Создаем стек для отслеживания открытых тегов
  const stack = [];
  let result = '';
  let lastIndex = 0;
  
  // Регулярное выражение для поиска тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  let match;
  
  while ((match = tagRegex.exec(html)) !== null) {
    // Добавляем текст до тега
    result += html.substring(lastIndex, match.index);
    lastIndex = match.index + match[0].length;
    
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    
    // Проверяем, поддерживается ли тег в Telegram
    const normalizedTag = TAG_ALIASES[tagName] || tagName;
    const isSupported = TELEGRAM_SUPPORTED_TAGS.has(normalizedTag);
    
    // Если тег не поддерживается, пропускаем его
    if (!isSupported) {
      continue;
    }
    
    // Проверяем, открывающий или закрывающий тег
    if (fullTag.startsWith('</')) {
      // Закрывающий тег
      let found = false;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === normalizedTag) {
          found = true;
          // Закрываем все промежуточные теги
          for (let j = stack.length - 1; j >= i; j--) {
            result += `</${stack[j]}>`;
          }
          // Обновляем стек
          stack.splice(i);
          break;
        }
      }
      
      if (!found) {
        // Игнорируем закрывающий тег без соответствующего открывающего
      }
    } else {
      // Открывающий тег
      if (normalizedTag === 'a') {
        // Для ссылок сохраняем атрибут href
        const hrefMatch = fullTag.match(/href=["']([^"']*)["']/i);
        if (hrefMatch) {
          result += `<a href="${hrefMatch[1]}">`;
          stack.push('a');
        }
      } else {
        // Для других поддерживаемых тегов
        result += `<${normalizedTag}>`;
        stack.push(normalizedTag);
      }
    }
  }
  
  // Добавляем оставшийся текст
  result += html.substring(lastIndex);
  
  // Закрываем все оставшиеся открытые теги
  for (let i = stack.length - 1; i >= 0; i--) {
    result += `</${stack[i]}>`;
  }
  
  return result;
}
```

### 3. Сохранение форматирования в блочных элементах

Модифицируем функцию `convertBlocksToText()` для сохранения форматирования внутри блоков:

```javascript
function convertBlocksToText(html) {
  let result = html;
  
  // Обрабатываем p теги, сохраняя форматирование внутри
  result = result.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');
  
  // Обрабатываем заголовки, сохраняя их содержимое и добавляя жирность
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    result = result.replace(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'gis'), '<b>$1</b>\n\n');
  }
  
  // Заменяем другие блочные элементы, сохраняя их содержимое
  for (const tag of BLOCK_TAGS) {
    if (tag === 'p' || tag.match(/^h[1-6]$/)) continue; // Пропускаем уже обработанные
    
    result = result.replace(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'gis'), '$1\n');
  }
  
  return result;
}
```

### 4. Тестирование и отладка

После внесения этих изменений необходимо проверить форматирование на различных типах контента:

1. Тексты с вложенным форматированием (жирный текст внутри курсива и наоборот)
2. Тексты с форматированием внутри списков
3. Тексты с форматированием внутри заголовков

## Общие рекомендации

1. **Лог для отладки**: Добавьте подробное логирование в функции форматирования, чтобы видеть, как меняется текст на каждом этапе преобразования.

2. **Упрощение цепочки преобразований**: Рассмотрите возможность упрощения цепочки преобразований, чтобы уменьшить вероятность ошибок.

3. **Тестовый режим**: Создайте тестовый режим для публикации, который будет показывать предварительный просмотр HTML перед отправкой.

4. **Сравнение HTML**: Добавьте возможность сравнения HTML до и после преобразования, чтобы легче выявлять проблемные места.

## Ожидаемый результат

После внесения предложенных изменений форматирование текста в Telegram должно соответствовать тому, что видно в редакторе. Жирный и курсивный текст должны корректно отображаться в публикациях.