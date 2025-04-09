/**
 * Утилита для очистки и упрощения HTML для публикации в Telegram
 * Telegram поддерживает только ограниченный набор HTML-тегов:
 * <b>, <i>, <u>, <s>, <a href="...">
 * 
 * Данная утилита:
 * 1. Оставляет только поддерживаемые Telegram HTML-теги
 * 2. Заменяет <p> на одинарный перенос строки \n
 * 3. Преобразует сложные вложенные теги в последовательные
 * 4. Гарантирует правильный порядок закрытия тегов
 */

/**
 * Очищает и упрощает HTML-код для использования в Telegram
 * @param {string} html Исходный HTML-код
 * @returns {string} Очищенный HTML-код, подходящий для Telegram
 */
export function cleanHtmlForTelegram(html) {
  if (!html) return '';

  // Упрощенный подход: просто оставляем базовую разметку и переносы строк
  
  // 1. Удаляем HTML-комментарии и специальные конструкции
  let cleanedHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?([\s\S]*?)\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '');

  // 2. Обрабатываем блочные элементы
  cleanedHtml = cleanedHtml
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n')
    .replace(/<br\s*\/?>/gi, '\n');

  // 3. Обрабатываем списки
  cleanedHtml = cleanedHtml
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');

  // 4. Обрабатываем форматирование текста
  return processHtmlTags(cleanedHtml);
}

/**
 * Обрабатывает HTML-теги последовательно для избегания вложенности
 * @param {string} html Исходный HTML-код
 * @returns {string} Обработанный HTML-код для Telegram
 */
function processHtmlTags(html) {
  // Совершенно новый подход для решения проблемы форматирования
  
  // 1. Токенизируем HTML, разделяя его на текст и теги
  const tokens = tokenizeHtml(html);
  
  // 2. Обрабатываем токены и создаем новый HTML
  return rebuildHtml(tokens);
}

/**
 * Разбивает HTML на токены (текст и теги)
 * @param {string} html HTML-строка для токенизации
 * @returns {Array<Object>} Массив токенов {type: 'text'|'tag', content: string, tagName: string, isClosing: boolean}
 */
function tokenizeHtml(html) {
  const tokens = [];
  let currentPosition = 0;
  const tagRegex = /<\/?([a-z][a-z0-9]*)(?: [^>]*)?>/gi;
  let match;
  
  // Найти все теги в HTML
  while ((match = tagRegex.exec(html)) !== null) {
    // Добавить текст до тега
    if (match.index > currentPosition) {
      tokens.push({
        type: 'text',
        content: html.substring(currentPosition, match.index)
      });
    }
    
    // Добавить тег
    const tagName = match[1].toLowerCase();
    const isClosing = match[0].startsWith('</');
    
    tokens.push({
      type: 'tag',
      content: match[0],
      tagName,
      isClosing
    });
    
    currentPosition = match.index + match[0].length;
  }
  
  // Добавить оставшийся текст после последнего тега
  if (currentPosition < html.length) {
    tokens.push({
      type: 'text',
      content: html.substring(currentPosition)
    });
  }
  
  return tokens;
}

/**
 * Восстанавливает HTML из токенов с правильной обработкой тегов для Telegram
 * @param {Array<Object>} tokens Массив токенов
 * @returns {string} Очищенный HTML
 */
function rebuildHtml(tokens) {
  // Поддерживаемые в Telegram теги
  const supportedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
  
  // Соответствия тегов (для нормализации)
  const tagMap = {
    'strong': 'b',
    'em': 'i',
    'ins': 'u',
    'strike': 's',
    'del': 's'
  };
  
  // Важная часть: мы обрабатываем ТОЛЬКО теги, которые Telegram поддерживает,
  // и все атрибуты, кроме href для ссылок
  let result = '';
  let currentOpenTags = [];  // Стек для отслеживания открытых тегов
  
  for (const token of tokens) {
    if (token.type === 'text') {
      // Текст просто добавляем как есть
      result += token.content;
    } else if (token.type === 'tag') {
      const normalizedTagName = tagMap[token.tagName] || token.tagName;
      
      // Проверяем, поддерживается ли тег в Telegram
      if (supportedTags.includes(normalizedTagName)) {
        if (token.isClosing) {
          // Закрывающий тег
          
          // Найти последний открытый соответствующий тег
          const lastOpenIndex = currentOpenTags.lastIndexOf(normalizedTagName);
          
          if (lastOpenIndex !== -1) {
            // Тег найден, закрываем его и все вложенные теги
            const tagsToClose = currentOpenTags.splice(lastOpenIndex);
            
            // Закрываем теги в обратном порядке
            for (let i = tagsToClose.length - 1; i >= 0; i--) {
              result += `</${tagsToClose[i]}>`;
            }
            
            // Повторно открываем теги, которые были вложены (выше закрываемого)
            for (let i = 0; i < lastOpenIndex; i++) {
              if (currentOpenTags[i]) {
                result += `<${currentOpenTags[i]}>`;
              }
            }
          }
        } else {
          // Открывающий тег
          
          // Особая обработка для <a> - сохраняем только href
          if (normalizedTagName === 'a') {
            const hrefMatch = token.content.match(/href\s*=\s*["']([^"']*)["']/i);
            if (hrefMatch) {
              result += `<a href="${hrefMatch[1]}">`;
              currentOpenTags.push('a');
            }
          } else {
            // Обычный открывающий тег
            result += `<${normalizedTagName}>`;
            currentOpenTags.push(normalizedTagName);
          }
        }
      }
    }
  }
  
  // Закрываем все оставшиеся открытые теги
  for (let i = currentOpenTags.length - 1; i >= 0; i--) {
    result += `</${currentOpenTags[i]}>`;
  }
  
  return result;
}

/**
 * Полностью упрощает HTML-код для Telegram
 * Оставляет только базовые теги и обеспечивает их правильное размещение и закрытие
 * 
 * @param {string} html Исходный HTML-код
 * @returns {string} Упрощенный HTML-код для Telegram
 */
function simplifyTags(html) {
  // Если пустой текст, сразу возвращаем
  if (!html || html.trim() === '') return '';
  
  // Для решения проблемы фокусируемся на создании очень простого HTML, 
  // который гарантированно будет правильно отображаться в Telegram
  
  // 1. Удаляем все пустые теги (например, <b></b>)
  html = html
    .replace(/<b><\/b>/g, '')
    .replace(/<i><\/i>/g, '')
    .replace(/<u><\/u>/g, '')
    .replace(/<s><\/s>/g, '')
    .replace(/<code><\/code>/g, '')
    .replace(/<pre><\/pre>/g, '');
  
  // 2. Идентифицируем каждый блок с тегами и внешний текст
  // Используем более конкретные паттерны для разных типов тегов
  
  // Паттерны для каждого из поддерживаемых тегов
  const boldPattern = /<b>([^<]+)<\/b>/g;
  const italicPattern = /<i>([^<]+)<\/i>/g;
  const underlinePattern = /<u>([^<]+)<\/u>/g;
  const strikePattern = /<s>([^<]+)<\/s>/g;
  const codePattern = /<code>([^<]+)<\/code>/g;
  const prePattern = /<pre>([^<]+)<\/pre>/g;
  const linkPattern = /<a\s+href=["']([^"']+)["']>([^<]+)<\/a>/g;
  
  // 3. Упрощаем обработку - заменяем все вложенные теги на последовательные
  // Сначала выделяем все теги в отдельные блоки
  
  // Функция для маркировки блоков с указанным тегом для последующей замены
  function markTagBlocks(text, pattern, tagStart, tagEnd) {
    return text.replace(pattern, (match, content) => {
      // Используем уникальные маркеры, которые вряд ли встретятся в тексте
      return `BLOCK_START_${tagStart}${content}BLOCK_END_${tagEnd}`;
    });
  }
  
  // Маркируем все теги в тексте
  let processedHtml = html;
  processedHtml = markTagBlocks(processedHtml, boldPattern, 'B', 'B');
  processedHtml = markTagBlocks(processedHtml, italicPattern, 'I', 'I');
  processedHtml = markTagBlocks(processedHtml, underlinePattern, 'U', 'U');
  processedHtml = markTagBlocks(processedHtml, strikePattern, 'S', 'S');
  processedHtml = markTagBlocks(processedHtml, codePattern, 'CODE', 'CODE');
  processedHtml = markTagBlocks(processedHtml, prePattern, 'PRE', 'PRE');
  
  // Особая обработка для ссылок, так как они содержат атрибуты
  processedHtml = processedHtml.replace(linkPattern, (match, href, content) => {
    return `BLOCK_START_A_${href}_${content}BLOCK_END_A`;
  });
  
  // 4. Восстанавливаем теги из маркеров
  // Для каждого типа тега отдельно
  
  function restoreTagBlocks(text) {
    // Восстанавливаем bold
    text = text.replace(/BLOCK_START_B([^BLOCK_END_B]+)BLOCK_END_B/g, '<b>$1</b>');
    
    // Восстанавливаем italic
    text = text.replace(/BLOCK_START_I([^BLOCK_END_I]+)BLOCK_END_I/g, '<i>$1</i>');
    
    // Восстанавливаем underline
    text = text.replace(/BLOCK_START_U([^BLOCK_END_U]+)BLOCK_END_U/g, '<u>$1</u>');
    
    // Восстанавливаем strike
    text = text.replace(/BLOCK_START_S([^BLOCK_END_S]+)BLOCK_END_S/g, '<s>$1</s>');
    
    // Восстанавливаем code
    text = text.replace(/BLOCK_START_CODE([^BLOCK_END_CODE]+)BLOCK_END_CODE/g, '<code>$1</code>');
    
    // Восстанавливаем pre
    text = text.replace(/BLOCK_START_PRE([^BLOCK_END_PRE]+)BLOCK_END_PRE/g, '<pre>$1</pre>');
    
    // Восстанавливаем ссылки
    text = text.replace(/BLOCK_START_A_([^_]+)_([^BLOCK_END_A]+)BLOCK_END_A/g, '<a href="$1">$2</a>');
    
    return text;
  }
  
  // Восстанавливаем всё форматирование
  processedHtml = restoreTagBlocks(processedHtml);
  
  // 5. Проверяем на незакрытые теги
  processedHtml = fixUnclosedTags(processedHtml);
  
  // 6. Удаляем все оставшиеся теги, кроме поддерживаемых
  const supportedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
  const supportedTagPattern = new RegExp(`<\\/?(?!${supportedTags.join('|')}\\b)[^>]+>`, 'gi');
  processedHtml = processedHtml.replace(supportedTagPattern, '');
  
  return processedHtml;
}

/**
 * Исправляет вложенные HTML-теги для корректного отображения в Telegram
 * @param {string} html HTML-код с возможными проблемами вложенности
 * @returns {string} HTML-код с исправленной структурой тегов
 */
function fixNestedTags(html) {
  // Используем DOM-парсер для правильной обработки вложенных тегов
  // Поскольку мы не можем использовать DOM в Node.js напрямую,
  // реализуем упрощенный стековый алгоритм для обработки тегов

  // Регулярное выражение для поиска открывающих и закрывающих тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)(?: [^>]*)?>/gi;
  
  // Стек для отслеживания открытых тегов
  const openTags = [];
  
  // Результирующий HTML
  let result = '';
  
  // Последняя позиция в строке
  let lastIndex = 0;
  
  // Проходим по всем тегам в HTML
  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    // Добавляем текст до текущего тега
    result += html.substring(lastIndex, match.index);
    
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = fullTag.startsWith('</');
    
    if (isClosing) {
      // Если это закрывающий тег
      if (openTags.length > 0) {
        // Получаем последний открытый тег
        const lastOpenTag = openTags[openTags.length - 1];
        
        if (lastOpenTag === tagName) {
          // Если последний открытый тег совпадает с закрывающим,
          // просто закрываем его
          openTags.pop();
          result += fullTag;
        } else {
          // Если не совпадает, проверяем, есть ли такой тег в стеке вообще
          const indexInStack = openTags.lastIndexOf(tagName);
          
          if (indexInStack >= 0) {
            // Если такой тег есть в стеке, закрываем все теги до него
            // и затем снова открываем их
            const tagsToClose = openTags.splice(indexInStack);
            
            // Закрываем теги в обратном порядке
            for (let i = tagsToClose.length - 1; i >= 0; i--) {
              result += `</${tagsToClose[i]}>`;
            }
            
            // Открываем обратно теги, которые были после нашего тега
            // (кроме самого закрываемого тега)
            for (let i = 0; i < tagsToClose.length - 1; i++) {
              openTags.push(tagsToClose[i]);
              result += `<${tagsToClose[i]}>`;
            }
          } else {
            // Если такого тега нет в стеке, значит это закрывающий тег
            // без соответствующего открывающего - игнорируем его
          }
        }
      } else {
        // Стек пуст, но получен закрывающий тег - игнорируем его
      }
    } else {
      // Если это открывающий тег
      // Проверяем, поддерживается ли он в Telegram
      if (tagName === 'a' || tagName === 'b' || tagName === 'i' || 
          tagName === 'u' || tagName === 's' || tagName === 'code' || 
          tagName === 'pre') {
        
        // Проверяем на вложенность одинаковых тегов
        if (openTags.includes(tagName)) {
          // Если уже есть такой открытый тег, закрываем предыдущий
          // перед открытием нового
          const indexInStack = openTags.lastIndexOf(tagName);
          for (let i = openTags.length - 1; i >= indexInStack; i--) {
            result += `</${openTags[i]}>`;
            openTags.pop();
          }
        }
        
        // Добавляем тег в стек и в результат
        openTags.push(tagName);
        result += fullTag;
      } else {
        // Неподдерживаемый тег - пропускаем его, но сохраняем содержимое
      }
    }
    
    lastIndex = match.index + fullTag.length;
  }
  
  // Добавляем оставшийся текст
  result += html.substring(lastIndex);
  
  // Закрываем все оставшиеся открытые теги
  for (let i = openTags.length - 1; i >= 0; i--) {
    result += `</${openTags[i]}>`;
  }
  
  return result;
}

/**
 * Более простой алгоритм для исправления незакрытых тегов
 * Работает быстро и надежно для простых случаев
 * @param {string} html Исходный HTML
 * @returns {string} HTML с закрытыми тегами
 */
export function fixUnclosedTags(html) {
  if (!html) return '';
  
  // Список поддерживаемых в Telegram тегов
  const supportedTags = ['b', 'strong', 'i', 'em', 'u', 'ins', 'code', 'pre', 's', 'strike', 'del', 'a'];
  
  // Соответствие тегов (для стандартизации)
  const tagMapping = {
    'strong': 'b',
    'em': 'i',
    'ins': 'u',
    'strike': 's',
    'del': 's'
  };
  
  // Регулярное выражение для поиска всех HTML-тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)(?: [^>]*)?>/gi;
  
  // Подсчет открывающих и закрывающих тегов
  const openingTagsCount = (html.match(/<[a-z][a-z0-9]*(?:\s[^>]*)?>+/gi) || []).length;
  const closingTagsCount = (html.match(/<\/[a-z][a-z0-9]*>/gi) || []).length;
  
  // Если количество открывающих и закрывающих тегов не совпадает,
  // значит есть незакрытые теги и нужно их исправить
  if (openingTagsCount !== closingTagsCount) {
    // Проходим по всем тегам и собираем информацию об открытых/закрытых
    let match;
    const matches = [];
    while ((match = tagRegex.exec(html)) !== null) {
      matches.push({
        full: match[0],
        name: match[1].toLowerCase(),
        isClosing: match[0].startsWith('</'),
        index: match.index
      });
    }
    
    // Находим незакрытые теги
    const unclosedTags = [];
    for (const tag of matches) {
      if (!tag.isClosing) {
        // Это открывающий тег
        // Проверяем, поддерживается ли он в Telegram
        if (supportedTags.includes(tag.name) || supportedTags.includes(tagMapping[tag.name])) {
          // Стандартизируем имя тега
          const standardTag = tagMapping[tag.name] || tag.name;
          unclosedTags.push(standardTag);
        }
      } else {
        // Это закрывающий тег
        // Находим соответствующий открывающий тег и удаляем его из списка незакрытых
        const standardTag = tagMapping[tag.name] || tag.name;
        const index = unclosedTags.lastIndexOf(standardTag);
        if (index !== -1) {
          unclosedTags.splice(index, 1);
        }
      }
    }
    
    // Если остались незакрытые теги, добавляем закрывающие теги в конец
    if (unclosedTags.length > 0) {
      let fixedHtml = html;
      
      // Добавляем закрывающие теги в обратном порядке
      for (let i = unclosedTags.length - 1; i >= 0; i--) {
        fixedHtml += `</${unclosedTags[i]}>`;
      }
      
      return fixedHtml;
    }
  }
  
  // Если количество тегов совпадает или нет поддерживаемых незакрытых тегов,
  // возвращаем исходный HTML
  return html;
}