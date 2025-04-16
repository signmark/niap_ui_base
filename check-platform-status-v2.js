/**
 * Скрипт для проверки API маршрута на изменение логики обновления общего статуса контента
 * Версия 2: для конкретного маршрута
 */

import fs from 'fs';
import path from 'path';

// Путь к файлу маршрутов публикации
const publishingRoutesPath = path.resolve('./server/api/publishing-routes.ts');

// Прочитаем содержимое файла
try {
  let content = fs.readFileSync(publishingRoutesPath, 'utf-8');
  
  // Разделим файл на строки для более точного поиска
  const lines = content.split('\n');
  
  // Найдем строки, содержащие искомый паттерн
  const target = '// Возвращаем результат';
  
  // Ищем вхождение около строки 553
  const targetLineIndex = lines.findIndex((line, index) => {
    return line.includes(target) && index > 550 && index < 560;
  });
  
  if (targetLineIndex === -1) {
    console.log('Целевая строка не найдена в нужном диапазоне строк');
    process.exit(1);
  }
  
  console.log(`Найдена целевая строка на индексе ${targetLineIndex}`);
  
  // Преобразуем индекс строки обратно в индекс символа
  let characterIndex = 0;
  for (let i = 0; i < targetLineIndex; i++) {
    characterIndex += lines[i].length + 1; // +1 для учета символа новой строки
  }
  
  console.log(`Индекс символа: ${characterIndex}`);
  
  // Извлекаем контекст строк
  const contextBefore = lines[targetLineIndex - 2] + '\n' + 
                       lines[targetLineIndex - 1] + '\n' + 
                       lines[targetLineIndex];
  
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
      
      // Возвращаем результат`;
  
  // Заменяем строку в контексте
  const newContent = content.replace(contextBefore, replacementString);
  
  // Проверяем, что замена действительно произошла
  if (newContent === content) {
    console.log('Замена не произведена');
    
    // Создаем файл с патчем для ручного применения
    const patchContent = `
// Заменить:
${contextBefore}

// На:
${replacementString}
`;
    fs.writeFileSync('platform-status-patch.txt', patchContent, 'utf-8');
    console.log('Создан файл platform-status-patch.txt с патчем для ручного применения');
  } else {
    // Записываем обновленное содержимое обратно в файл
    fs.writeFileSync(publishingRoutesPath, newContent, 'utf-8');
    console.log('Модификация успешно применена!');
  }
} catch (error) {
  console.error('Ошибка при обработке файла:', error);
}