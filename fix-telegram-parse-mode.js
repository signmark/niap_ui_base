/**
 * Скрипт для проверки и фиксации проблемы с parse_mode в Telegram
 * Проверяет, что все методы публикации в Telegram используют parse_mode: 'HTML'
 * 
 * Проблема: Контент публикуется, но форматирование HTML (жирный, курсив) не применяется, 
 * потому что отсутствует parse_mode: 'HTML' в запросе к API Telegram.
 */

import fs from 'fs';
import path from 'path';

// Список файлов для проверки
const filesToCheck = [
  'server/services/social/telegram-service.ts',
  'server/services/social-publishing.ts',
  'server/services/social-publishing-with-imgur.ts',
  'server/api/publishing-routes.ts',
  'server/api/test-routes.ts',
  'server/routes-imgur.ts'
];

// Счетчики для отчета
let totalChecked = 0;
let parseModeMissing = 0;
let parseModePresent = 0;
let filesParsed = 0;

// Функция для проверки содержимого файла
function checkFile(filePath) {
  console.log(`\nПроверка файла: ${filePath}`);
  try {
    filesParsed++;
    
    // Чтение файла
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Найти все вызовы API Telegram
    const sendMessagePattern = /sendMessage.*?chat_id.*?\}/gs;
    const sendPhotoPattern = /sendPhoto.*?chat_id.*?\}/gs;
    const sendVideoPattern = /sendVideo.*?chat_id.*?\}/gs;
    const sendMediaGroupPattern = /sendMediaGroup.*?chat_id.*?\}/gs;
    
    // Найти все совпадения
    const checks = [
      { name: 'sendMessage', matches: content.match(sendMessagePattern) || [] },
      { name: 'sendPhoto', matches: content.match(sendPhotoPattern) || [] },
      { name: 'sendVideo', matches: content.match(sendVideoPattern) || [] },
      { name: 'sendMediaGroup', matches: content.match(sendMediaGroupPattern) || [] }
    ];
    
    // Проверить каждое совпадение
    for (const check of checks) {
      console.log(`  Найдено ${check.matches.length} вызовов ${check.name}`);
      for (let i = 0; i < check.matches.length; i++) {
        const match = check.matches[i];
        totalChecked++;
        
        // Проверить наличие parse_mode
        const hasParseMode = match.includes('parse_mode');
        
        if (hasParseMode) {
          parseModePresent++;
          console.log(`    ✅ Вызов ${check.name} #${i+1} имеет parse_mode`);
        } else {
          parseModeMissing++;
          console.log(`    ❌ Вызов ${check.name} #${i+1} НЕ имеет parse_mode`);
          console.log(`       ${match.substring(0, 100)}...`);
        }
      }
    }
    
  } catch (error) {
    console.error(`  Ошибка при обработке файла ${filePath}:`, error.message);
  }
}

// Основная функция
function main() {
  console.log('=== Проверка наличия parse_mode в вызовах API Telegram ===');
  
  for (const file of filesToCheck) {
    if (fs.existsSync(file)) {
      checkFile(file);
    } else {
      console.log(`Файл не найден: ${file}`);
    }
  }
  
  // Итоговый отчет
  console.log('\n=== Итоговый отчет ===');
  console.log(`Проверено файлов: ${filesParsed}`);
  console.log(`Проверено вызовов API: ${totalChecked}`);
  console.log(`Имеют parse_mode: ${parseModePresent} (${(parseModePresent / totalChecked * 100).toFixed(2)}%)`);
  console.log(`Отсутствует parse_mode: ${parseModeMissing} (${(parseModeMissing / totalChecked * 100).toFixed(2)}%)`);
  
  if (parseModeMissing > 0) {
    console.log('\n⚠️ НЕОБХОДИМО ИСПРАВИТЬ: В некоторых вызовах API Telegram отсутствует parse_mode');
    console.log('   Это приводит к проблеме, когда HTML-форматирование не применяется к сообщениям.');
    console.log('   Добавьте параметр parse_mode: "HTML" во все вызовы API Telegram, которые отправляют форматированный текст.');
  } else {
    console.log('\n✅ Все проверенные вызовы API Telegram используют parse_mode');
  }
}

// Запуск скрипта
main();