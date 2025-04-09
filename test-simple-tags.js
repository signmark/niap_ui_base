/**
 * Простой тест для обработки тегов форматирования
 */

// Пример текста 
const testText = "<i>Мини тест </i><b>Для проверки </b><u>Форматирования</u>";

// Регулярное выражение для добавления переносов строк между тегами форматирования
const formatTags = ["b", "i", "u", "s", "code"];
const formatTagsPattern = formatTags.join("|");

// Регулярное выражение для замены: любой закрывающий тег, за которым следует открывающий
const regex1 = new RegExp(`(<\\/(${formatTagsPattern})>)(<(${formatTagsPattern})>)`, "gi");
const result1 = testText.replace(regex1, "$1\n\n$3");
console.log("Регулярное выражение 1:");
console.log("До:", testText);
console.log("После:", result1);

// Замена другой версией регулярного выражения
const regex2 = new RegExp(`(<\\/[biusc][^>]*>)(<[biusc][^>]*>)`, "gi");
const result2 = testText.replace(regex2, "$1\n\n$2");
console.log("\nРегулярное выражение 2:");
console.log("До:", testText);
console.log("После:", result2);

// Попробуем еще один подход с использованием функции обратного вызова
function addLinebreaksBetweenTags(html) {
  const closingTagRegex = /<\/(b|i|u|s|code)>/gi;
  let lastIndex = 0;
  let result = '';
  let match;
  
  while ((match = closingTagRegex.exec(html)) !== null) {
    const endOfTag = match.index + match[0].length;
    // Добавляем текст до конца закрывающего тега включительно
    result += html.substring(lastIndex, endOfTag);
    
    // Проверяем, идет ли сразу после закрывающего тега открывающий тег форматирования
    if (endOfTag < html.length && html.substring(endOfTag, endOfTag + 3).match(/<[biusc]/i)) {
      result += '\n\n';
    }
    
    lastIndex = endOfTag;
  }
  
  // Добавляем оставшуюся часть текста
  result += html.substring(lastIndex);
  
  return result;
}

const result3 = addLinebreaksBetweenTags(testText);
console.log("\nПользовательская функция:");
console.log("До:", testText);
console.log("После:", result3);