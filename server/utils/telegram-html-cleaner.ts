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
 * @param html Исходный HTML-код
 * @returns Очищенный HTML-код, подходящий для Telegram
 */
export function cleanHtmlForTelegram(html: string): string {
  if (!html) return '';

  // Набор тегов, поддерживаемых Telegram
  const supportedTags = ['b', 'strong', 'i', 'em', 'u', 'ins', 'code', 'pre', 's', 'strike', 'del', 'a'];
  
  // Преобразование тегов к стандартным для Telegram
  const tagMapping: Record<string, string> = {
    'strong': 'b',
    'em': 'i',
    'ins': 'u',
    'strike': 's',
    'del': 's'
  };

  // 1. Удаляем HTML-комментарии и специальные конструкции
  let cleanedHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?([\s\S]*?)\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '');

  // 2. Заменяем параграфы на переносы строк (одинарные, как запросил пользователь)
  cleanedHtml = cleanedHtml
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n')
    .replace(/<br\s*\/?>/gi, '\n');

  // Обработка списков (ul, ol, li)
  cleanedHtml = cleanedHtml
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');

  // 3. Удаляем все атрибуты из тегов, кроме href в <a>
  cleanedHtml = cleanedHtml.replace(/<(b|i|u|s|code|pre)(?:\s+[^>]*)?>/gi, '<$1>');
  cleanedHtml = cleanedHtml.replace(/<a(?:\s+[^>]*?(?:href=["']([^"']*)["'])[^>]*)?>/gi, (match, href) => {
    return href ? `<a href="${href}">` : '<a>';
  });

  // 4. Стандартизируем поддерживаемые теги (strong->b, em->i, etc.)
  for (const [originalTag, standardTag] of Object.entries(tagMapping)) {
    cleanedHtml = cleanedHtml
      .replace(new RegExp(`<${originalTag}(?:\\s+[^>]*)?>(.*?)<\\/${originalTag}>`, 'gi'), 
               `<${standardTag}>$1</${standardTag}>`);
  }

  // 5. Удаляем все неподдерживаемые теги, сохраняя их содержимое
  const supportedTagPattern = new RegExp(`<\\/?(?!${supportedTags.join('|')}\\b)[^>]+>`, 'gi');
  cleanedHtml = cleanedHtml.replace(supportedTagPattern, '');

  // 6. Обработка вложенных тегов и правильного порядка закрытия
  return fixNestedTags(cleanedHtml);
}

/**
 * Исправляет вложенные HTML-теги для корректного отображения в Telegram
 * @param html HTML-код с возможными проблемами вложенности
 * @returns HTML-код с исправленной структурой тегов
 */
function fixNestedTags(html: string): string {
  // Используем DOM-парсер для правильной обработки вложенных тегов
  // Поскольку мы не можем использовать DOM в Node.js напрямую,
  // реализуем упрощенный стековый алгоритм для обработки тегов

  // Регулярное выражение для поиска открывающих и закрывающих тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)(?: [^>]*)?>/gi;
  
  // Стек для отслеживания открытых тегов
  const openTags: string[] = [];
  
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
 * @param html Исходный HTML
 * @returns HTML с закрытыми тегами
 */
export function fixUnclosedTags(html: string): string {
  if (!html) return '';
  
  // Список поддерживаемых в Telegram тегов
  const supportedTags = ['b', 'strong', 'i', 'em', 'u', 'ins', 'code', 'pre', 's', 'strike', 'del', 'a'];
  
  // Соответствие тегов (для стандартизации)
  const tagMapping: Record<string, string> = {
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
    const unclosedTags: string[] = [];
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