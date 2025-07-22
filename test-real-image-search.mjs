/**
 * Реальное тестирование сервиса поиска изображений
 * Использует настоящий сервис для валидации интеграции
 */

import imageSearchService from './server/services/image-search-service.js';

async function testRealImageSearch() {
  console.log('🔍 Реальное тестирование сервиса поиска изображений...\n');
  
  const testCases = [
    {
      text: 'technology innovation future',
      keywords: ['technology', 'innovation', 'future']
    },
    {
      text: 'food cooking recipes',
      keywords: ['food', 'cooking', 'recipes'] 
    },
    {
      text: 'travel nature mountains',
      keywords: ['travel', 'nature', 'mountains']
    },
    {
      text: 'sports fitness workout',
      keywords: ['sports', 'fitness', 'workout']
    }
  ];

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    try {
      console.log(`📸 Тест ${i + 1}/4: Поиск изображения для "${testCase.text}"`);
      console.log(`   Ключевые слова: [${testCase.keywords.join(', ')}]`);
      
      const startTime = Date.now();
      const result = await imageSearchService.findAndPrepareImage(testCase.text, testCase.keywords);
      const duration = Date.now() - startTime;
      
      const testResult = {
        testNumber: i + 1,
        query: testCase.text,
        keywords: testCase.keywords,
        success: result.success,
        size: result.size,
        source: result.source || 'fallback',
        originalUrl: result.originalUrl || 'нет URL',
        hasBuffer: !!result.imageBuffer,
        duration: duration
      };
      
      results.push(testResult);
      
      if (result.success && result.source !== 'fallback') {
        console.log(`   ✅ Успех! Источник: ${result.source}, Размер: ${result.size} bytes`);
        if (result.originalUrl) {
          console.log(`   🌐 URL: ${result.originalUrl}`);
        }
        successCount++;
      } else {
        console.log(`   ⚠️  Фоллбэк изображение (1x1 пиксель), размер: ${result.size} bytes`);
        failCount++;
      }
      
      console.log(`   ⏱️  Время выполнения: ${duration}ms\n`);
      
    } catch (error) {
      console.error(`   ❌ Ошибка: ${error.message}\n`);
      results.push({
        testNumber: i + 1,
        query: testCase.text,
        keywords: testCase.keywords,
        error: error.message,
        duration: 0
      });
      failCount++;
    }
  }
  
  // Сводка результатов
  console.log('📊 СВОДКА РЕЗУЛЬТАТОВ:');
  console.log(`   🎯 Всего тестов: ${testCases.length}`);
  console.log(`   ✅ Успешных: ${successCount} (реальные изображения)`);
  console.log(`   ⚠️  Фоллбэков: ${failCount} (1x1 пиксель или ошибки)`);
  console.log(`   📈 Коэффициент успеха: ${((successCount / testCases.length) * 100).toFixed(1)}%`);
  
  // Детальные результаты
  console.log('\n📋 ДЕТАЛЬНЫЕ РЕЗУЛЬТАТЫ:');
  results.forEach((result, index) => {
    console.log(`${index + 1}. "${result.query}"`);
    if (result.error) {
      console.log(`   ❌ Ошибка: ${result.error}`);
    } else {
      console.log(`   ${result.success && result.source !== 'fallback' ? '✅' : '⚠️'} ${result.source} (${result.size} bytes, ${result.duration}ms)`);
    }
  });
  
  console.log('\n🎉 Реальное тестирование завершено!');
}

// Запускаем тест
testRealImageSearch().catch(error => {
  console.error('💥 Критическая ошибка тестирования:', error);
  process.exit(1);
});