/**
 * Скрипт для проверки и исправления проблем с HTML-форматированием в Telegram
 * 
 * Этот скрипт проверяет наличие параметра parse_mode: "HTML" во всех вызовах
 * Telegram API и форматирование HTML-разметки в редакторе для корректного
 * отображения в Telegram.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// Файлы для проверки
const servicesToCheck = [
  'server/services/social/telegram-service.ts',
  'server/services/social-publishing.ts',
  'server/services/social-publishing-with-imgur.ts'
];

// Файлы с функциями форматирования
const formatterFiles = [
  'server/utils/telegram-formatter.js', 
  'server/utils/telegram-formatter.ts'
];

/**
 * Проверяет наличие параметра parse_mode во всех вызовах API Telegram
 */
function checkParseModeInServices() {
  console.log('\n=== Проверка наличия parse_mode в вызовах API Telegram ===');
  
  let allFilesOk = true;
  
  for (const filePath of servicesToCheck) {
    if (!fs.existsSync(filePath)) {
      console.log(`Файл ${filePath} не существует, пропускаем`);
      continue;
    }
    
    console.log(`\nПроверка файла: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Шаблоны для поиска вызовов API без parse_mode
    const patterns = [
      { 
        name: 'sendPhoto', 
        regex: /\{\s*chat_id[^}]*?,\s*photo\s*:[^}]*?\}/g,
        check: (match) => !match.includes('parse_mode')
      },
      { 
        name: 'sendMessage', 
        regex: /\{\s*chat_id[^}]*?,\s*text\s*:[^}]*?\}/g,
        check: (match) => !match.includes('parse_mode')
      },
      { 
        name: 'sendMediaGroup', 
        regex: /\{\s*chat_id[^}]*?,\s*media\s*:[^}]*?\}/g,
        check: (match) => !match.includes('parse_mode')
      }
    ];
    
    let fileHasIssues = false;
    
    // Проверяем каждый шаблон
    for (const pattern of patterns) {
      const matches = content.match(pattern.regex);
      
      if (matches) {
        const invalidMatches = matches.filter(pattern.check);
        
        if (invalidMatches.length > 0) {
          console.log(`  Найдено ${invalidMatches.length} вызовов ${pattern.name} без parse_mode`);
          invalidMatches.forEach((match, i) => {
            if (i < 3) { // показываем только первые 3 примера
              console.log(`    Пример: ${match.substring(0, 100)}...`);
            }
          });
          fileHasIssues = true;
          allFilesOk = false;
        } else {
          console.log(`  Все вызовы ${pattern.name} содержат parse_mode`);
        }
      } else {
        console.log(`  Вызовы ${pattern.name} не найдены`);
      }
    }
    
    if (fileHasIssues) {
      console.log(`  Рекомендуется запустить скрипт fix-telegram-parsem-mode.js для исправления`);
    } else {
      console.log(`  Файл в порядке, все вызовы имеют параметр parse_mode`);
    }
  }
  
  return allFilesOk;
}

/**
 * Проверяет корректность функций форматирования HTML для Telegram
 */
function checkHtmlFormatters() {
  console.log('\n=== Проверка функций форматирования HTML для Telegram ===');
  
  let formatterFound = false;
  let formatterHasIssues = false;
  
  for (const filePath of formatterFiles) {
    if (!fs.existsSync(filePath)) {
      console.log(`Файл ${filePath} не существует, пропускаем`);
      continue;
    }
    
    console.log(`\nПроверка форматтера: ${filePath}`);
    formatterFound = true;
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Проверки для убедиться, что форматтер обрабатывает все нужные теги
    const requiredFormattingChecks = [
      { name: 'bold', regex: /\*\*(.*?)\*\*/g, replacement: '<b>$1</b>' },
      { name: 'italic', regex: /\*(.*?)\*/g, replacement: '<i>$1</i>' },
      { name: 'underline', regex: /__(.*?)__/g, replacement: '<u>$1</u>' },
      { name: 'strikethrough', regex: /~~(.*?)~~/g, replacement: '<s>$1</s>' },
      { name: 'paragraph', regex: /<p>(.*?)<\/p>/g, replacement: '$1\n\n' },
      { name: 'line-break', regex: /<br\s*\/?>/g, replacement: '\n' },
      { name: 'strong-to-bold', regex: /<strong>(.*?)<\/strong>/g, replacement: '<b>$1</b>' },
      { name: 'em-to-italic', regex: /<em>(.*?)<\/em>/g, replacement: '<i>$1</i>' }
    ];
    
    for (const check of requiredFormattingChecks) {
      const hasCheck = content.includes(check.regex.source) || content.includes(check.replacement);
      
      if (hasCheck) {
        console.log(`  ✅ Форматтер обрабатывает ${check.name}`);
      } else {
        console.log(`  ❌ Форматтер НЕ обрабатывает ${check.name}`);
        formatterHasIssues = true;
      }
    }
    
    // Проверка наличия функций для исправления незакрытых тегов
    if (content.includes('fixUnclosedTags') || content.includes('fix_unclosed_tags')) {
      console.log('  ✅ Форматтер имеет функцию для исправления незакрытых тегов');
    } else {
      console.log('  ❌ Форматтер НЕ имеет функции для исправления незакрытых тегов');
      formatterHasIssues = true;
    }
  }
  
  if (!formatterFound) {
    console.log('\n❌ Файлы форматтера не найдены! Необходимо создать утилиту для форматирования HTML');
    return false;
  }
  
  return !formatterHasIssues;
}

/**
 * Запускает имеющийся скрипт для исправления проблем с parse_mode
 */
function runFixScript() {
  return new Promise((resolve, reject) => {
    console.log('\n=== Запуск скрипта fix-telegram-parsem-mode.js ===');
    
    exec('node fix-telegram-parsem-mode.js', (error, stdout, stderr) => {
      if (error) {
        console.error(`Ошибка при запуске скрипта: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`Скрипт вернул ошибку: ${stderr}`);
      }
      console.log(stdout);
      resolve();
    });
  });
}

/**
 * Проверяет использование parse_mode в компонентах публикации
 */
function checkPublishingComponents() {
  console.log('\n=== Проверка компонентов публикации в Telegram ===');
  
  const componentsToCheck = [
    'client/src/components/TelegramPreview.tsx',
    'client/src/components/content/TelegramContentPreview.tsx'
  ];
  
  let allComponentsOk = true;
  
  for (const filePath of componentsToCheck) {
    if (!fs.existsSync(filePath)) {
      console.log(`Компонент ${filePath} не существует, пропускаем`);
      continue;
    }
    
    console.log(`\nПроверка компонента: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Проверяем, есть ли в компоненте отображение HTML-форматирования
    const hasHtmlFormatting = content.includes('dangerouslySetInnerHTML') || 
                              content.includes('innerHTML');
    
    if (hasHtmlFormatting) {
      console.log('  ✅ Компонент использует HTML-форматирование для предпросмотра');
    } else {
      console.log('  ❌ Компонент НЕ использует HTML-форматирование для предпросмотра');
      allComponentsOk = false;
    }
    
    // Проверяем, обрабатывает ли компонент HTML-теги для Telegram
    const hasHtmlProcessing = content.includes('formatHtmlForTelegram') || 
                             content.includes('processHtmlForTelegram') ||
                             content.includes('cleanHtml');
    
    if (hasHtmlProcessing) {
      console.log('  ✅ Компонент обрабатывает HTML-теги для Telegram');
    } else {
      console.log('  ⚠️ Компонент может не обрабатывать HTML-теги для Telegram корректно');
      allComponentsOk = false;
    }
  }
  
  return allComponentsOk;
}

/**
 * Создает демонстрационное сообщение с различными форматами HTML
 * для тестирования отображения в Telegram
 */
function createTestHtmlMessage() {
  console.log('\n=== Создание тестового HTML-сообщения для Telegram ===');
  
  const testMessage = `
<b>Жирный текст</b>
<i>Курсивный текст</i>
<u>Подчеркнутый текст</u>
<s>Зачеркнутый текст</s>
<b><i>Жирный и курсивный текст</i></b>
<code>Моноширинный текст (код)</code>

<b>Списки в Telegram:</b>
• Первый пункт
• Второй пункт
  • Вложенный пункт
  • Еще один вложенный пункт
• Третий пункт

<b>Форматирование из редактора:</b>
Обычный текст превращается в <b>жирный</b> при использовании выделения, а также может быть <i>курсивным</i> или <u>подчеркнутым</u>. 

<a href="https://telegram.org">Ссылка на Telegram</a>
`;

  const testFilePath = 'telegram-html-test-message.txt';
  fs.writeFileSync(testFilePath, testMessage);
  
  console.log(`Тестовое сообщение создано в файле ${testFilePath}`);
  console.log(`Используйте этот файл для тестирования отображения HTML в Telegram`);
  
  return testMessage;
}

/**
 * Основная функция скрипта
 */
async function main() {
  console.log('=== Проверка HTML-форматирования в Telegram ===');
  
  // 1. Проверяем наличие parse_mode во всех вызовах API
  const parseModeOk = checkParseModeInServices();
  
  // 2. Проверяем корректность функций форматирования
  const formattersOk = checkHtmlFormatters();
  
  // 3. Проверяем компоненты публикации
  const componentsOk = checkPublishingComponents();
  
  // 4. Создаем тестовое сообщение
  const testMessage = createTestHtmlMessage();
  
  // 5. Определяем необходимость исправлений
  if (!parseModeOk) {
    console.log('\n❗ Найдены вызовы API Telegram без параметра parse_mode');
    console.log('Запускаем скрипт исправления...');
    await runFixScript();
  }
  
  // 6. Выводим итоговую оценку и рекомендации
  console.log('\n=== Итоги проверки HTML-форматирования в Telegram ===');
  
  if (parseModeOk && formattersOk && componentsOk) {
    console.log('✅ Все проверки прошли успешно! HTML-форматирование должно корректно работать в Telegram.');
  } else {
    console.log('⚠️ Обнаружены потенциальные проблемы с HTML-форматированием в Telegram.');
    
    if (!parseModeOk) {
      console.log('❌ Не все вызовы API имеют параметр parse_mode. Запустите fix-telegram-parsem-mode.js');
    }
    
    if (!formattersOk) {
      console.log('❌ Функции форматирования HTML требуют доработки. Проверьте telegram-formatter.js|ts');
    }
    
    if (!componentsOk) {
      console.log('❌ Компоненты предпросмотра могут некорректно отображать форматирование. Проверьте их реализацию.');
    }
  }
  
  console.log('\nДля тестирования форматирования используйте следующий скрипт:');
  console.log('node direct-telegram-html-test.js');
  
  console.log('\nПример тестового сообщения с HTML-форматированием:');
  console.log(testMessage);
}

// Запуск скрипта
main().catch(console.error);