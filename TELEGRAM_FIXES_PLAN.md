# План исправления проблем интеграции с Telegram

## Приоритет 1: Исправление разделения текста и изображения

### Задача 1.1: Модифицировать логику отправки сообщений
**Файл:** `/server/services/social/telegram-service.js`
**Метод:** `publishContent()`

```javascript
// Улучшенная версия логики отправки контента
async publishContent(content, settings = {}) {
  try {
    // ... существующий код инициализации ...
    
    // ... код подготовки контента (без изменений) ...
    
    // Стратегия публикации зависит от наличия изображений и длины текста
    let result;
    
    // Telegram ограничивает длину подписи к изображениям 1024 символами
    const TELEGRAM_CAPTION_LIMIT = 1024;
    
    // 1. Сначала проверяем случай без изображений - только текст
    if (!validMainImageUrl && validAdditionalImageUrls.length === 0) {
      result = await this.sendTextMessage(formattedContent);
      return {
        success: true,
        messageIds: [result.messageId],
        messageUrl: result.messageUrl
      };
    }
    
    // 2. Если есть одно изображение и короткий текст - отправляем как подпись к изображению
    if (validMainImageUrl && validAdditionalImageUrls.length === 0 && 
        formattedContent.length <= TELEGRAM_CAPTION_LIMIT) {
      result = await this.sendImage(validMainImageUrl, formattedContent);
      return {
        success: true,
        messageIds: [result.messageId],
        messageUrl: result.messageUrl
      };
    }
    
    // 3. Если есть несколько изображений и короткий текст - отправляем медиа-группу с подписью
    if ((validMainImageUrl || validAdditionalImageUrls.length > 0) && 
        formattedContent.length <= TELEGRAM_CAPTION_LIMIT) {
      // Объединяем все изображения в один массив
      const allImages = [];
      if (validMainImageUrl) allImages.push(validMainImageUrl);
      allImages.push(...validAdditionalImageUrls);
      
      result = await this.sendMediaGroup(allImages, formattedContent);
      return {
        success: true,
        messageIds: result.messageIds,
        messageUrl: result.messageUrl
      };
    }
    
    // 4. Во всех остальных случаях (длинный текст) - сначала изображения, потом текст
    // Объединяем все изображения в один массив
    const allImages = [];
    if (validMainImageUrl) allImages.push(validMainImageUrl);
    allImages.push(...validAdditionalImageUrls);
    
    // Отправляем медиа-группу без подписи
    const mediaResult = await this.sendMediaGroup(allImages);
    
    // Затем отправляем текст отдельным сообщением
    const textResult = await this.sendTextMessage(formattedContent);
    
    // Возвращаем ID сообщений и URL медиа-группы
    return {
      success: true,
      messageIds: [...mediaResult.messageIds, textResult.messageId],
      messageUrl: mediaResult.messageUrl
    };
  } catch (error) {
    // ... код обработки ошибок (без изменений) ...
  }
}
```

### Задача 1.2: Улучшить метод sendImage()
**Файл:** `/server/services/social/telegram-service.js`
**Метод:** `sendImage()`

```javascript
async sendImage(imageUrl, caption = '', options = {}) {
  try {
    // ... существующий код проверки изображения ...
    
    // Если подпись содержит HTML-теги, форматируем ее
    let formattedCaption = '';
    if (caption) {
      try {
        formattedCaption = createImageCaption(caption);
      } catch (captionError) {
        log(`Ошибка при форматировании подписи: ${captionError.message}`, 'telegram');
        // В случае ошибки форматирования используем оригинальную подпись
        formattedCaption = caption.length > 1024 ? caption.substring(0, 1021) + '...' : caption;
      }
    }
    
    // ... остальной код отправки ...
  } catch (error) {
    // ... обработка ошибок ...
  }
}
```

## Приоритет 2: Исправление обработки HTML-тегов

### Задача 2.1: Переписать функцию formatHtmlForTelegram()
**Файл:** `/server/utils/telegram-formatter.js`
**Функция:** `formatHtmlForTelegram()`

```javascript
export function formatHtmlForTelegram(htmlContent) {
  if (!htmlContent) return '';
  
  try {
    // Лог исходного HTML для отладки
    log(`Форматирование HTML (вход): ${htmlContent.substring(0, 100)}...`, 'telegram-formatter');
    
    // Исправляем незакрытые теги в первую очередь
    const fixedHtml = fixUnclosedTags(htmlContent);
    log(`HTML после исправления тегов: ${fixedHtml.substring(0, 100)}...`, 'telegram-formatter');
    
    // Заменяем маркеры списков на символы
    const textWithBullets = replaceBulletPoints(fixedHtml);
    log(`HTML после обработки списков: ${textWithBullets.substring(0, 100)}...`, 'telegram-formatter');
    
    // Очищаем от атрибутов, которые не поддерживаются в Telegram
    const cleanedHtml = cleanupHtmlAttributes(textWithBullets);
    log(`HTML после очистки атрибутов: ${cleanedHtml.substring(0, 100)}...`, 'telegram-formatter');
    
    // Добавляем дополнительное форматирование
    const formattedHtml = enhanceFormatting(cleanedHtml);
    
    // Проверяем на наличие HTML-тегов после обработки
    const hasHtmlTags = /<[a-z][^>]*>/i.test(formattedHtml);
    log(`Форматирование HTML (выход): ${formattedHtml.substring(0, 100)}... HTML теги присутствуют: ${hasHtmlTags}`, 'telegram-formatter');
    
    return formattedHtml;
  } catch (error) {
    log(`Ошибка форматирования HTML для Telegram: ${error.message}`, 'telegram-formatter');
    // Попытка очистить текст от всех HTML-тегов в случае ошибки
    try {
      return htmlContent.replace(/<[^>]*>/g, '');
    } catch (e) {
      return htmlContent; // Возвращаем исходный текст в случае полной ошибки
    }
  }
}
```

### Задача 2.2: Улучшить функцию cleanupHtmlAttributes()
**Файл:** `/server/utils/telegram-formatter.js`
**Функция:** `cleanupHtmlAttributes()`

```javascript
function cleanupHtmlAttributes(html) {
  // Преобразуем стандартные теги в Telegram-совместимые до обработки атрибутов
  let processedHtml = html
    .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
    .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
    .replace(/<del>(.*?)<\/del>/g, '<s>$1</s>')
    .replace(/<strike>(.*?)<\/strike>/g, '<s>$1</s>');
    
  // Сохраняем только разрешенные атрибуты
  return processedHtml.replace(/<([a-z][a-z0-9]*)(?:\s+([^>]*))?>/gi, (match, tagName, attributes) => {
    const lowerTagName = tagName.toLowerCase();
    
    // Если тег не в списке разрешенных, заменяем его
    if (!ALLOWED_TAGS.includes(lowerTagName)) {
      if (lowerTagName === 'p') {
        // Параграфы заменяем на двойной перенос строки
        return '\n\n';
      } else if (lowerTagName === 'br') {
        return '\n'; // Переносы строк сохраняем
      } else if (lowerTagName === 'div') {
        return '\n'; // Div заменяем на перенос строки
      } else if (/^h[1-6]$/.test(lowerTagName)) {
        // Заголовки превращаем в жирный текст + двойной перенос
        return '<b>';
      } else {
        return ''; // Остальные неразрешенные теги просто удаляем
      }
    }
    
    // Для ссылок сохраняем только атрибут href
    if (lowerTagName === 'a' && attributes) {
      const hrefMatch = attributes.match(/href\s*=\s*["']([^"']*)["']/i);
      if (hrefMatch) {
        return `<a href="${hrefMatch[1]}">`;
      }
    }
    
    // Для остальных разрешенных тегов удаляем все атрибуты
    return `<${lowerTagName}>`;
  });
}
```

### Задача 2.3: Улучшить функцию fixUnclosedTags()
**Файл:** `/server/utils/telegram-formatter.js`
**Функция:** `fixUnclosedTags()`

```javascript
export function fixUnclosedTags(html) {
  // Расширенный список разрешенных тегов, включая те, которые мы заменим потом
  const extendedAllowedTags = [...ALLOWED_TAGS, 'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'strong', 'em', 'del', 'strike'];
  
  const stack = [];
  let result = html;
  
  // ... существующий код ...
  
  // Добавляем дополнительную логику для закрытия заголовков
  if (stack.length > 0) {
    let modified = false;
    for (let i = stack.length - 1; i >= 0; i--) {
      const tagName = stack[i].name;
      if (/^h[1-6]$/.test(tagName)) {
        // Если это незакрытый заголовок, добавляем закрытие + </b>
        result += `</${tagName}><b>`;
        modified = true;
      } else {
        // Для прочих незакрытых тегов
        result += `</${tagName}>`;
      }
    }
    // Если были изменения, логируем
    if (modified) {
      log(`Исправлены незакрытые теги заголовков`, 'telegram-formatter');
    }
  }
  
  return result;
}
```

## Приоритет 3: Улучшение разбиения длинных сообщений

### Задача 3.1: Улучшить функцию splitLongMessage()
**Файл:** `/server/utils/telegram-formatter.js`
**Функция:** `splitLongMessage()`

```javascript
export function splitLongMessage(html, maxLength = 4096) {
  if (!html || html.length <= maxLength) {
    return [html];
  }
  
  const formattedHtml = formatHtmlForTelegram(html);
  
  // Если после форматирования сообщение уже укладывается в лимит
  if (formattedHtml.length <= maxLength) {
    return [formattedHtml];
  }
  
  // Попытка разбить текст по смысловым блокам (параграфам)
  const paragraphs = formattedHtml
    .split('\n\n')
    .filter(p => p.trim().length > 0);
    
  const parts = [];
  let currentPart = '';
  
  // Обрабатываем каждый параграф
  for (const paragraph of paragraphs) {
    // Если текущий параграф целиком помещается в текущую часть
    if (currentPart.length + paragraph.length + 2 <= maxLength) {
      // Добавляем параграф с двойным переносом строки
      currentPart += (currentPart ? '\n\n' : '') + paragraph;
    } 
    // Если параграф сам по себе больше максимальной длины
    else if (paragraph.length > maxLength) {
      // Если текущая часть не пуста, добавляем ее в результат
      if (currentPart) {
        parts.push(currentPart);
        currentPart = '';
      }
      
      // Разбиваем большой параграф на части с учетом тегов
      const tagStack = [];
      let tempPart = '';
      
      // Разбиваем HTML на токены (теги и текст)
      const tokens = paragraph.split(/(<[^>]*>)/);
      
      for (const token of tokens) {
        if (!token) continue;
        
        // Открывающий тег - добавляем в стек
        if (token.startsWith('<') && !token.startsWith('</')) {
          const tagName = token.match(/<([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase();
          if (tagName && ALLOWED_TAGS.includes(tagName)) {
            tagStack.push(tagName);
          }
          tempPart += token;
        } 
        // Закрывающий тег - удаляем из стека
        else if (token.startsWith('</')) {
          const tagName = token.match(/<\/([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase();
          if (tagName && tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
            tagStack.pop();
          }
          tempPart += token;
        }
        // Текстовый контент
        else {
          // Разбиваем длинный текст на части по словам
          if (tempPart.length + token.length > maxLength) {
            // Определяем место разрыва по ближайшему пробелу
            const maxTextLength = maxLength - tempPart.length - 3; // 3 символа для "..."
            
            // Находим ближайший пробел к максимальной длине
            let breakPoint = maxTextLength;
            while (breakPoint > 0 && token[breakPoint] !== ' ') {
              breakPoint--;
            }
            
            // Если пробел не найден, разбиваем по символу
            if (breakPoint === 0) {
              breakPoint = maxTextLength;
            }
            
            // Добавляем часть текста и закрываем все открытые теги
            const textPart = token.substring(0, breakPoint);
            
            // Формируем закрывающие теги
            let closingTags = '';
            for (let i = tagStack.length - 1; i >= 0; i--) {
              closingTags += `</${tagStack[i]}>`;
            }
            
            // Добавляем часть в результат
            parts.push(tempPart + textPart + closingTags + '...');
            
            // Формируем открывающие теги для следующей части
            let openingTags = '';
            for (const tag of tagStack) {
              openingTags += `<${tag}>`;
            }
            
            // Начинаем новую часть с оставшегося текста
            tempPart = openingTags + '...' + token.substring(breakPoint);
          } else {
            tempPart += token;
          }
        }
        
        // Если часть заполнена, добавляем в результат
        if (tempPart.length >= maxLength * 0.9) {
          parts.push(tempPart);
          
          // Формируем открывающие теги для следующей части
          let openingTags = '';
          for (const tag of tagStack) {
            openingTags += `<${tag}>`;
          }
          
          tempPart = openingTags;
        }
      }
      
      // Добавляем последнюю часть параграфа, если она не пуста
      if (tempPart) {
        parts.push(tempPart);
      }
    } 
    // Если новый параграф не помещается целиком, начинаем новую часть
    else {
      parts.push(currentPart);
      currentPart = paragraph;
    }
  }
  
  // Добавляем последнюю часть, если она не пуста
  if (currentPart) {
    parts.push(currentPart);
  }
  
  return parts;
}
```

## Приоритет 4: Тестирование изменений

### Задача 4.1: Создать тестовый скрипт для проверки исправлений

**Файл:** `/test-telegram-fixes.js`

```javascript
/**
 * Тестовый скрипт для проверки исправлений в интеграции с Telegram
 * Запуск: node test-telegram-fixes.js
 */
import axios from 'axios';
import { config } from 'dotenv';

// Загружаем переменные окружения
config();

// API URL по умолчанию
const API_URL = process.env.API_URL || 'http://localhost:5000';

// Настройки Telegram
const settings = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '[ВАШ_ТОКЕН]',
    chatId: process.env.TELEGRAM_CHAT_ID || '[ВАШ_CHAT_ID]'
  }
};

// Тестовые кейсы для проверки исправлений
const testCases = [
  {
    name: '1. Одно изображение с коротким текстом',
    description: 'Текст должен отправиться как подпись к изображению',
    imageUrl: 'https://picsum.photos/800/600',
    text: '<b>Тестовый заголовок</b>\n\nКороткое описание с <i>форматированием</i>.'
  },
  {
    name: '2. Одно изображение с текстом на границе лимита',
    description: 'Текст размером 1024 символа должен отправиться как подпись',
    imageUrl: 'https://picsum.photos/800/600',
    text: '<b>Длинный текст ровно 1024 символа</b>\n\n' + 'А'.repeat(975)
  },
  {
    name: '3. Несколько изображений с коротким текстом',
    description: 'Должна отправиться медиа-группа с подписью к первому изображению',
    imageUrls: [
      'https://picsum.photos/800/600',
      'https://picsum.photos/800/601'
    ],
    text: '<b>Тестовая группа изображений</b>\n\nПодпись к первому изображению в группе.'
  },
  {
    name: '4. Одно изображение с длинным текстом',
    description: 'Текст >1024 символов должен отправиться отдельным сообщением',
    imageUrl: 'https://picsum.photos/800/600',
    text: '<b>Длинный текст</b>\n\n' + 'Очень '.repeat(300) + 'длинный текст'
  },
  {
    name: '5. Текст с вложенным форматированием',
    description: 'Проверка корректной обработки вложенных тегов',
    text: '<p><b>Заголовок с <i>вложенным</i> форматированием</b></p>\n\n<p>Текст <b>с <i>множеством</i> <u>разных</u></b> <i>тегов</i></p>'
  }
];

/**
 * Выполняет тест отправки сообщения в Telegram
 * @param {object} testCase Тестовый случай
 * @returns {Promise<object>} Результат теста
 */
async function runTest(testCase) {
  console.log(`\n----- Тест: ${testCase.name} -----`);
  console.log(`Описание: ${testCase.description}`);
  
  try {
    let endpoint;
    let payload;
    
    // Формируем запрос в зависимости от типа теста
    if (testCase.imageUrls && testCase.imageUrls.length > 1) {
      // Тест с группой изображений
      endpoint = '/api/test/telegram-post-media-group';
      payload = {
        text: testCase.text,
        imageUrls: testCase.imageUrls,
        chatId: settings.telegram.chatId,
        token: settings.telegram.token
      };
    } else if (testCase.imageUrl) {
      // Тест с одним изображением
      endpoint = '/api/test/telegram-post-image';
      payload = {
        text: testCase.text,
        imageUrl: testCase.imageUrl,
        chatId: settings.telegram.chatId,
        token: settings.telegram.token
      };
    } else {
      // Тест только с текстом
      endpoint = '/api/test/telegram-post';
      payload = {
        text: testCase.text,
        chatId: settings.telegram.chatId,
        token: settings.telegram.token
      };
    }
    
    console.log(`Отправка запроса на: ${endpoint}`);
    const response = await axios.post(`${API_URL}${endpoint}`, payload);
    
    if (response.data && response.data.success) {
      console.log(`✅ УСПЕХ: ${testCase.name}`);
      
      if (response.data.data && response.data.data.postUrl) {
        console.log(`Ссылка на пост: ${response.data.data.postUrl}`);
      }
      
      if (response.data.data && response.data.data.messageIds) {
        console.log(`ID сообщений: ${response.data.data.messageIds.join(', ')}`);
      }
      
      return {
        success: true,
        name: testCase.name,
        result: response.data.data
      };
    } else {
      console.log(`❌ ОШИБКА: ${testCase.name}`);
      console.log(`Ответ сервера: ${JSON.stringify(response.data, null, 2)}`);
      
      return {
        success: false,
        name: testCase.name,
        error: response.data.error || 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    console.log(`❌ ОШИБКА: ${testCase.name}`);
    console.log(`Сообщение: ${error.message}`);
    
    if (error.response) {
      console.log(`Статус: ${error.response.status}`);
      console.log(`Данные: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    return {
      success: false,
      name: testCase.name,
      error: error.message
    };
  }
}

/**
 * Запускает все тесты последовательно
 */
async function runAllTests() {
  console.log('=== ЗАПУСК ТЕСТОВ TELEGRAM ИНТЕГРАЦИИ ===');
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await runTest(testCase);
    results.push(result);
    
    // Пауза между тестами
    console.log('Пауза 3 секунды...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Выводим общий результат
  console.log('\n=== РЕЗУЛЬТАТЫ ТЕСТОВ ===');
  
  let successCount = 0;
  for (const result of results) {
    if (result.success) {
      successCount++;
      console.log(`✅ ${result.name}`);
    } else {
      console.log(`❌ ${result.name}: ${result.error}`);
    }
  }
  
  console.log(`\nИтого: ${successCount}/${results.length} тестов успешно`);
  
  if (successCount === results.length) {
    console.log('✅ Все тесты пройдены успешно!');
  } else {
    console.log('❌ Есть проблемы, требующие исправления.');
  }
}

// Запускаем тесты
runAllTests()
  .then(() => console.log('Тестирование завершено'))
  .catch(error => console.error('Ошибка при выполнении тестов:', error));
```

### Задача 4.2: Создать API-маршруты для тестирования

**Файл:** `/server/api/test-routes.js` (добавить новые маршруты)

```javascript
/**
 * Тестовый маршрут для отправки изображения с текстом
 */
router.post('/telegram-post-image', async (req, res) => {
  const { text, imageUrl, chatId, token } = req.body;
  
  if (!text || !imageUrl || !chatId || !token) {
    return res.status(400).json({
      success: false,
      error: 'Необходимо указать текст, URL изображения, ID чата и токен'
    });
  }
  
  try {
    // Создаем экземпляр TelegramService
    const telegramService = new TelegramService();
    telegramService.initialize(token, chatId);
    
    // Имитируем контент
    const content = {
      title: '',
      content: text,
      imageUrl: imageUrl,
      additionalImages: []
    };
    
    // Публикуем контент
    const result = await telegramService.publishContent(content);
    
    return res.json({
      success: true,
      data: {
        messageIds: Array.isArray(result.messageIds) ? result.messageIds : [result.messageId],
        postUrl: result.messageUrl || ''
      }
    });
  } catch (error) {
    console.error('Ошибка при отправке изображения:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Тестовый маршрут для отправки группы изображений с текстом
 */
router.post('/telegram-post-media-group', async (req, res) => {
  const { text, imageUrls, chatId, token } = req.body;
  
  if (!text || !Array.isArray(imageUrls) || imageUrls.length === 0 || !chatId || !token) {
    return res.status(400).json({
      success: false,
      error: 'Необходимо указать текст, массив URL изображений, ID чата и токен'
    });
  }
  
  try {
    // Создаем экземпляр TelegramService
    const telegramService = new TelegramService();
    telegramService.initialize(token, chatId);
    
    // Имитируем контент
    const content = {
      title: '',
      content: text,
      imageUrl: imageUrls[0],
      additionalImages: imageUrls.slice(1)
    };
    
    // Публикуем контент
    const result = await telegramService.publishContent(content);
    
    return res.json({
      success: true,
      data: {
        messageIds: Array.isArray(result.messageIds) ? result.messageIds : [result.messageId],
        postUrl: result.messageUrl || ''
      }
    });
  } catch (error) {
    console.error('Ошибка при отправке медиа-группы:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

## График выполнения работ

1. **День 1**: Приоритет 1 - Исправление разделения текста и изображения
   - Задача 1.1: Модифицировать логику отправки сообщений
   - Задача 1.2: Улучшить метод sendImage()
   - Первичное тестирование Приоритета 1

2. **День 2**: Приоритет 2 - Исправление обработки HTML-тегов
   - Задача 2.1: Переписать функцию formatHtmlForTelegram()
   - Задача 2.2: Улучшить функцию cleanupHtmlAttributes()
   - Задача 2.3: Улучшить функцию fixUnclosedTags()
   - Первичное тестирование Приоритета 2

3. **День 3**: Приоритет 3 и 4 - Улучшение разбиения длинных сообщений и тестирование
   - Задача 3.1: Улучшить функцию splitLongMessage()
   - Задача 4.1: Создать тестовый скрипт
   - Задача 4.2: Создать API-маршруты для тестирования
   - Комплексное тестирование всех исправлений

4. **День 4**: Завершение и документация
   - Отладка обнаруженных проблем
   - Финальное тестирование в разных условиях
   - Обновление документации
   - Подготовка PR с исправлениями