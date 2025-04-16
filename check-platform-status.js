/**
 * Скрипт для проверки API маршрута на изменение логики обновления общего статуса контента
 */

import fs from 'fs';
import path from 'path';

// Путь к файлу маршрутов публикации
const publishingRoutesPath = path.resolve('./server/api/publishing-routes.ts');

// Прочитаем содержимое файла
try {
  let content = fs.readFileSync(publishingRoutesPath, 'utf-8');
  
  // Ищем место перед возвратом результата
  const targetString = `      }
      
      // Возвращаем результат
      if (hasSuccess) {`;
  
  const replacementString = `      }
      
      // Проверяем статусы всех платформ перед возвратом результата
      if (hasSuccess && systemToken) {
        try {
          // Получаем обновленный контент, чтобы иметь актуальные статусы платформ
          const updatedContent = await storage.getCampaignContentById(content.id);
          if (updatedContent && updatedContent.socialPlatforms) {
            // Проверяем статусы всех выбранных платформ
            const allPlatformsPublished = platforms.every(platformName => {
              const platformData = updatedContent.socialPlatforms?.[platformName];
              return platformData && platformData.status === 'published';
            });
            
            // Если все выбранные платформы опубликованы, только тогда меняем общий статус контента
            if (allPlatformsPublished) {
              await storage.updateCampaignContent(content.id, {
                status: 'published',
                publishedAt: new Date().toISOString()
              }, systemToken);
              
              log(\`Все платформы (\${platforms.join(', ')}) опубликованы, общий статус контента \${content.id} обновлен на published\`, 'api');
            } else {
              // Если не все платформы опубликованы, оставляем статус scheduled
              log(\`Не все платформы (\${platforms.join(', ')}) опубликованы, статус контента \${content.id} остается scheduled\`, 'api');
            }
          }
        } catch (checkError: any) {
          log(\`Ошибка при проверке общего статуса публикации: \${checkError.message}\`, 'api');
        }
      }
      
      // Возвращаем результат
      if (hasSuccess) {`;
  
  // Найдем все вхождения
  const countOccurrences = (content.match(new RegExp(targetString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  
  if (countOccurrences === 0) {
    console.log('Целевая строка не найдена в файле');
  } else if (countOccurrences > 1) {
    console.log(`Найдено ${countOccurrences} вхождений целевой строки. Требуется более точный поиск.`);
    
    // Находим все индексы вхождений
    let searchIndex = 0;
    let occurrenceIndices = [];
    
    while (true) {
      const foundIndex = content.indexOf(targetString, searchIndex);
      if (foundIndex === -1) break;
      
      occurrenceIndices.push(foundIndex);
      searchIndex = foundIndex + targetString.length;
    }
    
    console.log('Индексы вхождений:', occurrenceIndices);
    
    // Читаем файл построчно для идентификации контекста
    const lines = content.split('\n');
    for (const index of occurrenceIndices) {
      // Найдем номер строки для данного индекса
      let lineNumber = 0;
      let currentIndex = 0;
      
      for (let i = 0; i < lines.length; i++) {
        if (currentIndex + lines[i].length + 1 > index) {
          lineNumber = i;
          break;
        }
        currentIndex += lines[i].length + 1; // +1 для учета символа новой строки
      }
      
      console.log(`Вхождение на строке ${lineNumber}. Контекст:`);
      console.log(lines.slice(Math.max(0, lineNumber - 5), lineNumber + 5).join('\n'));
      console.log('-------------------');
    }
  } else {
    // Заменяем строку
    const newContent = content.replace(targetString, replacementString);
    
    // Проверяем, что замена действительно произошла
    if (newContent === content) {
      console.log('Замена не произведена, несмотря на то, что строка найдена');
    } else {
      // Записываем обновленное содержимое обратно в файл
      fs.writeFileSync(publishingRoutesPath, newContent, 'utf-8');
      console.log('Модификация успешно применена!');
    }
  }
} catch (error) {
  console.error('Ошибка при обработке файла:', error);
}