/**
 * Скрипт для исправления проблемы с parse_mode в вызовах Telegram API
 * для правильного отображения HTML-форматирования в сообщениях
 */

import fs from 'fs';
import path from 'path';

// Файлы, которые нужно обработать
const files = [
  'server/services/social/telegram-service.ts',
  'server/services/social-publishing.ts',
  'server/services/social-publishing-with-imgur.ts'
];

// Функция для добавления parse_mode в запросы, где его нет
function addParseModeToFiles() {
  for (const filePath of files) {
    console.log(`\nОбработка файла: ${filePath}`);
    try {
      // Чтение содержимого файла
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Список регулярных выражений для определения мест, где нужно добавить parse_mode
      // Шаблон 1: Отправка фото без parse_mode
      const photoPatterns = [
        // Пример: { chat_id: formattedChatId, photo: imageUrl
        /(\{\s*chat_id[^}]*?,\s*photo\s*:[^}]*?)(\})/g,
        
        // Пример: { chat_id: formattedChatId, photo: processedContent.imageUrl...
        /(\{\s*chat_id[^}]*?,\s*photo\s*:[^,}]*?)(?=,\s*(?:caption|protect_content|disable_notification|\}))/g
      ];
      
      // Шаблон 2: Отправка сообщения без parse_mode
      const messagePatterns = [
        // Пример: { chat_id: formattedChatId, text: text
        /(\{\s*chat_id[^}]*?,\s*text\s*:[^}]*?)(\})/g,
        
        // Пример: { chat_id: formattedChatId, text: text, ...другие параметры
        /(\{\s*chat_id[^}]*?,\s*text\s*:[^,}]*?)(?=,\s*(?:protect_content|disable_notification|\}))/g
      ];
      
      // Шаблон 3: Отправка группы медиа без parse_mode
      const mediaGroupPatterns = [
        // Пример: { chat_id: formattedChatId, media: mediaGroup
        /(\{\s*chat_id[^}]*?,\s*media\s*:[^}]*?)(\})/g
      ];
      
      // Функция для логирования замен
      function logReplacement(pattern, count) {
        if (count > 0) {
          console.log(`  Добавлен parse_mode к ${count} вхождениям ${pattern}`);
        }
      }
      
      // Применение шаблонов и подсчет замен
      let photoReplacements = 0;
      for (const pattern of photoPatterns) {
        const before = content;
        content = content.replace(pattern, (match, p1, p2) => {
          // Проверяем, есть ли уже parse_mode в совпадении
          if (match.includes('parse_mode')) {
            return match;
          }
          return p2 ? `${p1}, parse_mode: "HTML"${p2}` : `${p1}, parse_mode: "HTML"`;
        });
        
        if (before !== content) {
          photoReplacements++;
        }
      }
      logReplacement('sendPhoto', photoReplacements);
      
      let messageReplacements = 0;
      for (const pattern of messagePatterns) {
        const before = content;
        content = content.replace(pattern, (match, p1, p2) => {
          // Проверяем, есть ли уже parse_mode в совпадении
          if (match.includes('parse_mode')) {
            return match;
          }
          return p2 ? `${p1}, parse_mode: "HTML"${p2}` : `${p1}, parse_mode: "HTML"`;
        });
        
        if (before !== content) {
          messageReplacements++;
        }
      }
      logReplacement('sendMessage', messageReplacements);
      
      let mediaGroupReplacements = 0;
      for (const pattern of mediaGroupPatterns) {
        const before = content;
        content = content.replace(pattern, (match, p1, p2) => {
          // Проверяем, есть ли уже parse_mode в совпадении
          if (match.includes('parse_mode')) {
            return match;
          }
          return p2 ? `${p1}, parse_mode: "HTML"${p2}` : `${p1}, parse_mode: "HTML"`;
        });
        
        if (before !== content) {
          mediaGroupReplacements++;
        }
      }
      logReplacement('sendMediaGroup', mediaGroupReplacements);
      
      // Если были внесены изменения, записываем файл
      const totalChanges = photoReplacements + messageReplacements + mediaGroupReplacements;
      if (totalChanges > 0) {
        // Создаем резервную копию файла
        const backupPath = `${filePath}.bak`;
        fs.writeFileSync(backupPath, fs.readFileSync(filePath));
        console.log(`  Создана резервная копия в ${backupPath}`);
        
        // Записываем обновленный файл
        fs.writeFileSync(filePath, content);
        console.log(`  Файл обновлен с ${totalChanges} изменениями`);
      } else {
        console.log(`  Изменения не требуются`);
      }
    } catch (error) {
      console.error(`  Ошибка при обработке файла ${filePath}:`, error);
    }
  }
}

// Запуск скрипта
console.log('=== Исправление проблемы с parse_mode в API Telegram ===');
addParseModeToFiles();
console.log('\n=== Завершено ===');
console.log('Запустите новый тест для проверки форматирования HTML в Telegram.');