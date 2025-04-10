# Руководство по тестированию публикации в Telegram

## Введение

Это руководство предназначено для тестирования модифицированной логики публикации постов в Telegram. Мы внесли изменения в алгоритм для корректной обработки текстов разной длины и публикации контента согласно требованиям документации.

## Что нужно протестировать

1. Корректную обработку текстов трёх типов:
   - Короткие тексты (≤1024 символов) - должны отправляться вместе с изображением как подпись
   - Средние тексты (>1024 и ≤4096 символов) - должны отправляться отдельно после изображений
   - Длинные тексты (>4096 символов) - должны обрезаться до 4093 символов и добавляться "..."

2. Корректную работу планировщика публикаций
3. Корректную генерацию URL публикаций

## Методы тестирования

### 1. Тестирование через API приложения

#### Эндпоинт для публикации вручную

```bash
POST /api/publish/now
```

**Пример запроса**:
```json
{
  "id": "ID_ПУБЛИКАЦИИ_ИЗ_DIRECTUS",
  "socialPlatforms": ["telegram"],
  "userId": "ВАШ_ID_ПОЛЬЗОВАТЕЛЯ"
}
```

**Необходимые заголовки**:
- `Authorization: Bearer ВАШ_ТОКЕН`

#### Эндпоинт для проверки теста

```bash
POST /api/test/telegram-post
```

**Пример запроса**:
```json
{
  "content": {
    "title": "Тестовый заголовок",
    "content": "Текст публикации...",
    "imageUrl": "URL_ИЗОБРАЖЕНИЯ",
    "additionalImages": ["URL_ДОПОЛНИТЕЛЬНОГО_ИЗОБРАЖЕНИЯ1", "URL_ДОПОЛНИТЕЛЬНОГО_ИЗОБРАЖЕНИЯ2"]
  },
  "chatId": "ID_ВАШЕГО_КАНАЛА",
  "token": "ТОКЕН_ВАШЕГО_БОТА"
}
```

## Тестовые сценарии

### Сценарий 1: Короткий текст с одним изображением

**Цель**: Проверить, что короткий текст отправляется как подпись к изображению.

**Шаги**:
1. Создайте файл `test-short-text.js`:

```javascript
const axios = require('axios');

async function testShortText() {
  try {
    const response = await axios.post('http://localhost:5000/api/test/telegram-post', {
      content: {
        title: "Тест: короткий текст",
        content: "Это короткий текст, который должен быть отправлен как подпись к изображению. Проверяем корректную работу алгоритма для текстов менее 1024 символов.",
        imageUrl: "https://placehold.co/600x400?text=Test+Image"
      },
      chatId: "ВАШ_CHAT_ID",
      token: "ВАШ_BOT_TOKEN"
    });
    
    console.log("Ответ:", response.data);
    console.log("URL публикации:", response.data.postUrl);
  } catch (error) {
    console.error("Ошибка:", error.response?.data || error.message);
  }
}

testShortText();
```

2. Запустите скрипт:
```bash
node test-short-text.js
```

3. **Ожидаемый результат**:
   - В Telegram-канале должно появиться одно сообщение
   - Изображение с текстом под ним как подпись
   - URL должен вести именно на это сообщение

### Сценарий 2: Средний текст с одним изображением

**Цель**: Проверить разделение текста и изображения при превышении 1024 символов.

**Шаги**:
1. Создайте файл `test-medium-text.js`:

```javascript
const axios = require('axios');

async function testMediumText() {
  // Генерируем текст длиннее 1024 символов
  let mediumText = "Тест среднего текста\n\n";
  for (let i = 0; i < 30; i++) {
    mediumText += `Параграф ${i+1}: Этот текст добавлен для увеличения длины публикации. `;
    mediumText += "Мы проверяем правильность работы алгоритма для текстов длиннее 1024 символов. ";
    mediumText += "В этом случае текст должен отправляться отдельным сообщением после изображения.\n\n";
  }

  try {
    const response = await axios.post('http://localhost:5000/api/test/telegram-post', {
      content: {
        title: "Тест: средний текст",
        content: mediumText,
        imageUrl: "https://placehold.co/600x400?text=Medium+Text+Test"
      },
      chatId: "ВАШ_CHAT_ID",
      token: "ВАШ_BOT_TOKEN"
    });
    
    console.log("Ответ:", response.data);
    console.log("URL публикации:", response.data.postUrl);
  } catch (error) {
    console.error("Ошибка:", error.response?.data || error.message);
  }
}

testMediumText();
```

2. Запустите скрипт:
```bash
node test-medium-text.js
```

3. **Ожидаемый результат**:
   - В Telegram-канале должны появиться два сообщения:
     1. Изображение без подписи
     2. Отдельное текстовое сообщение с полным текстом
   - URL должен вести на сообщение с текстом (не с изображением)

### Сценарий 3: Длинный текст (>4096 символов)

**Цель**: Проверить обрезку текста при превышении лимита Telegram.

**Шаги**:
1. Создайте файл `test-long-text.js`:

```javascript
const axios = require('axios');

async function testLongText() {
  // Генерируем текст длиннее 4096 символов
  let longText = "Тест длинного текста\n\n";
  for (let i = 0; i < 100; i++) {
    longText += `Параграф ${i+1}: Этот текст добавлен для создания очень длинной публикации. `;
    longText += "Мы проверяем корректность работы алгоритма для текстов длиннее 4096 символов. ";
    longText += "В этом случае текст должен быть обрезан до 4093 символов и добавлено многоточие.\n\n";
  }

  try {
    const response = await axios.post('http://localhost:5000/api/test/telegram-post', {
      content: {
        title: "Тест: длинный текст",
        content: longText,
        imageUrl: "https://placehold.co/600x400?text=Long+Text+Test"
      },
      chatId: "ВАШ_CHAT_ID",
      token: "ВАШ_BOT_TOKEN"
    });
    
    console.log("Ответ:", response.data);
    console.log("URL публикации:", response.data.postUrl);
  } catch (error) {
    console.error("Ошибка:", error.response?.data || error.message);
  }
}

testLongText();
```

2. Запустите скрипт:
```bash
node test-long-text.js
```

3. **Ожидаемый результат**:
   - В Telegram-канале должны появиться два сообщения:
     1. Изображение без подписи
     2. Текстовое сообщение с обрезанным текстом, заканчивающимся на "..."
   - URL должен вести на сообщение с текстом
   - Длина текстового сообщения не должна превышать 4096 символов

### Сценарий 4: Несколько изображений

**Цель**: Проверить отправку группы изображений.

**Шаги**:
1. Создайте файл `test-multiple-images.js`:

```javascript
const axios = require('axios');

async function testMultipleImages() {
  try {
    const response = await axios.post('http://localhost:5000/api/test/telegram-post', {
      content: {
        title: "Тест: множественные изображения",
        content: "Это тест для проверки отправки нескольких изображений. Текст должен отображаться как подпись к первому изображению в группе.",
        imageUrl: "https://placehold.co/600x400?text=Image+1",
        additionalImages: [
          "https://placehold.co/600x400?text=Image+2",
          "https://placehold.co/600x400?text=Image+3"
        ]
      },
      chatId: "ВАШ_CHAT_ID",
      token: "ВАШ_BOT_TOKEN"
    });
    
    console.log("Ответ:", response.data);
    console.log("URL публикации:", response.data.postUrl);
  } catch (error) {
    console.error("Ошибка:", error.response?.data || error.message);
  }
}

testMultipleImages();
```

2. Запустите скрипт:
```bash
node test-multiple-images.js
```

3. **Ожидаемый результат**:
   - В Telegram-канале должна появиться группа изображений (медиагруппа)
   - Первое изображение должно содержать подпись с текстом
   - URL должен вести на эту группу изображений

### Сценарий 5: Несколько изображений с длинным текстом

**Цель**: Проверить разделение группы изображений и длинного текста.

**Шаги**:
1. Создайте файл `test-multiple-images-long-text.js`:

```javascript
const axios = require('axios');

async function testMultipleImagesLongText() {
  // Генерируем текст длиннее 1024 символов
  let mediumText = "Тест множественных изображений с длинным текстом\n\n";
  for (let i = 0; i < 20; i++) {
    mediumText += `Параграф ${i+1}: Текст для проверки корректности отправки с несколькими изображениями. `;
    mediumText += "Длина текста превышает 1024 символа, поэтому он должен быть отправлен отдельным сообщением.\n\n";
  }

  try {
    const response = await axios.post('http://localhost:5000/api/test/telegram-post', {
      content: {
        title: "Тест: множественные изображения с длинным текстом",
        content: mediumText,
        imageUrl: "https://placehold.co/600x400?text=Image+1",
        additionalImages: [
          "https://placehold.co/600x400?text=Image+2",
          "https://placehold.co/600x400?text=Image+3"
        ]
      },
      chatId: "ВАШ_CHAT_ID",
      token: "ВАШ_BOT_TOKEN"
    });
    
    console.log("Ответ:", response.data);
    console.log("URL публикации:", response.data.postUrl);
  } catch (error) {
    console.error("Ошибка:", error.response?.data || error.message);
  }
}

testMultipleImagesLongText();
```

2. Запустите скрипт:
```bash
node test-multiple-images-long-text.js
```

3. **Ожидаемый результат**:
   - В Telegram-канале должны появиться два сообщения:
     1. Группа изображений без подписей
     2. Отдельное текстовое сообщение с полным текстом
   - URL должен вести на текстовое сообщение

### Сценарий 6: HTML форматирование

**Цель**: Проверить корректную обработку HTML-тегов в тексте.

**Шаги**:
1. Создайте файл `test-html-formatting.js`:

```javascript
const axios = require('axios');

async function testHtmlFormatting() {
  const htmlText = `
<b>Жирный текст</b>
<i>Курсивный текст</i>
<u>Подчеркнутый текст</u>
<s>Зачеркнутый текст</s>
<code>Моноширинный текст для кода</code>
<pre>Предварительно отформатированный текст
с сохранением переносов строк</pre>
<a href="https://example.com">Ссылка на example.com</a>

Комбинированное форматирование:
<b>Жирный <i>и курсивный</i> текст</b>

Маркированный список:
• Пункт 1
• Пункт 2
• Пункт 3

Нумерованный список:
1. Первый пункт
2. Второй пункт
3. Третий пункт

<b>Незакрытый тег жирного текста
<i>Незакрытый тег курсива

<div>Неподдерживаемый тег div</div>
`;

  try {
    const response = await axios.post('http://localhost:5000/api/test/telegram-post', {
      content: {
        title: "Тест HTML форматирования",
        content: htmlText
      },
      chatId: "ВАШ_CHAT_ID",
      token: "ВАШ_BOT_TOKEN"
    });
    
    console.log("Ответ:", response.data);
    console.log("URL публикации:", response.data.postUrl);
  } catch (error) {
    console.error("Ошибка:", error.response?.data || error.message);
  }
}

testHtmlFormatting();
```

2. Запустите скрипт:
```bash
node test-html-formatting.js
```

3. **Ожидаемый результат**:
   - В Telegram-канале должно появиться сообщение с правильно отформатированным текстом
   - Все поддерживаемые HTML-теги должны корректно отображаться
   - Незакрытые теги должны быть автоматически закрыты
   - Неподдерживаемые теги должны быть правильно обработаны

### Сценарий 7: Проверка планировщика

**Цель**: Проверить корректную работу планировщика публикаций.

**Шаги**:
1. Через интерфейс Directus создайте новую публикацию:
   - Заполните необходимые поля (заголовок, текст, изображение)
   - Укажите платформу Telegram
   - Установите статус "scheduled"
   - Установите время публикации на 2-3 минуты в будущем

2. Дождитесь наступления запланированного времени

3. Проверьте логи на сервере:
```bash
grep "scheduler" logs/server.log | tail -n 50
```

4. **Ожидаемый результат**:
   - Публикация должна появиться в Telegram-канале в указанное время
   - В логах должна быть информация об успешной публикации
   - Статус публикации в Directus должен измениться на "published"

## Проверка результатов

### Для каждого теста проверьте:

1. **Содержимое публикации**:
   - Текст отображается полностью и корректно
   - Изображения отображаются корректно
   - HTML-форматирование работает правильно

2. **URL публикации**:
   - URL имеет формат `https://t.me/{username}/{message_id}`
   - URL ведет на нужное сообщение
   - ID сообщения в URL совпадает с фактическим ID в Telegram

3. **Статус публикации**:
   - В ответе API статус должен быть "published"
   - В Directus статус также должен быть "published"

## Анализ ошибок

Если тесты выявляют проблемы, обратите внимание на следующие компоненты:

1. **Для проблем с текстом**:
   - Проверьте методы `formatTextForTelegram` и `fixUnclosedTags` в `telegram-service.ts`
   - Проверьте логику проверки длины текста в методе `publishToTelegram`

2. **Для проблем с изображениями**:
   - Проверьте метод `sendImagesToTelegram` в `telegram-service.ts`
   - Убедитесь, что URL изображений корректные и доступные

3. **Для проблем с URL**:
   - Проверьте метод `generatePostUrl` в `telegram-service.ts`
   - Убедитесь, что имя пользователя канала правильно получается

4. **Для проблем с планировщиком**:
   - Проверьте логику в `publish-scheduler.ts`
   - Убедитесь, что время корректно сравнивается

## Чек-лист для финальной проверки

- [ ] Короткие сообщения отправляются как подпись к изображению
- [ ] Средние сообщения отправляются отдельно после изображений
- [ ] Длинные сообщения корректно обрезаются
- [ ] Группы изображений корректно отправляются
- [ ] HTML-теги корректно отображаются
- [ ] Незакрытые теги автоматически закрываются
- [ ] URL публикаций имеют правильный формат
- [ ] Планировщик публикует контент в запланированное время

## Контактные данные для отчета о проблемах

При обнаружении проблем с публикацией в Telegram, пожалуйста, сообщите:
- Точный текст ошибки
- ID публикации
- Скриншот проблемы
- Логи сервера

## Дополнительные материалы

- [TELEGRAM_POSTING_ALGORITHM.md](TELEGRAM_POSTING_ALGORITHM.md) - Документация по алгоритму публикации
- [PUBLISHING_WORKFLOW.md](PUBLISHING_WORKFLOW.md) - Общий рабочий процесс публикации