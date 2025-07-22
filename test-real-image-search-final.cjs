/**
 * Финальное тестирование интеграции сервиса поиска реальных изображений
 * Проверяет работоспособность всех API: Unsplash, Pexels, Pixabay
 */

const imageSearchService = require('./server/services/image-search-service');

async function testRealImageSearchFinal() {
  console.log('🔍 ФИНАЛЬНОЕ ТЕСТИРОВАНИЕ ИНТЕГРАЦИИ ПОИСКА РЕАЛЬНЫХ ИЗОБРАЖЕНИЙ');
  console.log('=' .repeat(70) + '\n');
  
  const testCases = [
    {
      text: 'technology innovation future',
      keywords: ['technology', 'innovation', 'future'],
      category: '🏢 Технологии'
    },
    {
      text: 'food cooking delicious',
      keywords: ['food', 'cooking', 'delicious'],
      category: '🍳 Кулинария' 
    },
    {
      text: 'travel nature landscape',
      keywords: ['travel', 'nature', 'landscape'],
      category: '🌍 Путешествия'
    },
    {
      text: 'fitness sport workout',
      keywords: ['fitness', 'sport', 'workout'],
      category: '💪 Спорт'
    }
  ];

  const results = [];
  let successCount = 0;
  let apiSuccessCount = 0;
  let fallbackCount = 0;
  let errorCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    console.log(`📸 ТЕСТ ${i + 1}/4: ${testCase.category}`);
    console.log(`   Запрос: "${testCase.text}"`);
    console.log(`   Ключевые слова: [${testCase.keywords.join(', ')}]`);
    
    try {
      const startTime = Date.now();
      const result = await imageSearchService.findAndPrepareImage(testCase.text, testCase.keywords);
      const duration = Date.now() - startTime;
      
      const testResult = {
        testNumber: i + 1,
        category: testCase.category,
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
      
      if (result.success) {
        successCount++;
        
        if (result.source && result.source !== 'fallback') {
          apiSuccessCount++;
          console.log(`   ✅ УСПЕХ! Источник: ${result.source.toUpperCase()}`);
          console.log(`   📊 Размер: ${(result.size / 1024).toFixed(1)} KB`);
          if (result.originalUrl) {
            console.log(`   🌐 URL: ${result.originalUrl.substring(0, 60)}...`);
          }
        } else {
          fallbackCount++;
          console.log(`   ⚠️  ФОЛЛБЭК: 1x1 пиксель (${result.size} bytes)`);
        }
      } else {
        errorCount++;
        console.log(`   ❌ ОШИБКА: ${result.error || 'Неизвестная ошибка'}`);
      }
      
      console.log(`   ⏱️  Время выполнения: ${duration}ms`);
      
    } catch (error) {
      console.error(`   💥 ИСКЛЮЧЕНИЕ: ${error.message}`);
      results.push({
        testNumber: i + 1,
        category: testCase.category,
        query: testCase.text,
        keywords: testCase.keywords,
        error: error.message,
        duration: 0
      });
      errorCount++;
    }
    
    console.log('');
  }
  
  // Детальная сводка результатов
  console.log('📊 СВОДКА РЕЗУЛЬТАТОВ ИНТЕГРАЦИИ');
  console.log('=' .repeat(70));
  console.log(`🎯 Всего тестов: ${testCases.length}`);
  console.log(`✅ Общий успех: ${successCount} (${((successCount / testCases.length) * 100).toFixed(1)}%)`);
  console.log(`🎨 Реальные API: ${apiSuccessCount} (${((apiSuccessCount / testCases.length) * 100).toFixed(1)}%)`);
  console.log(`⚠️  Фоллбэк: ${fallbackCount} (${((fallbackCount / testCases.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Ошибки: ${errorCount} (${((errorCount / testCases.length) * 100).toFixed(1)}%)`);
  
  // Оценка качества интеграции
  console.log('\n🏆 ОЦЕНКА КАЧЕСТВА ИНТЕГРАЦИИ:');
  if (apiSuccessCount >= 3) {
    console.log('🌟 ОТЛИЧНО! Интеграция работает превосходно');
  } else if (apiSuccessCount >= 2) {
    console.log('👍 ХОРОШО! Интеграция работает стабильно');
  } else if (successCount >= 3) {
    console.log('⚠️  УДОВЛЕТВОРИТЕЛЬНО! Работает на фоллбэке');
  } else {
    console.log('❌ ТРЕБУЕТ ВНИМАНИЯ! Много ошибок');
  }
  
  // Детальная таблица результатов
  console.log('\n📋 ДЕТАЛЬНАЯ ТАБЛИЦА РЕЗУЛЬТАТОВ:');
  console.log('-'.repeat(70));
  results.forEach((result, index) => {
    const status = result.error ? '❌ ОШИБКА' : 
                   (result.success && result.source !== 'fallback') ? '✅ API' : 
                   result.success ? '⚠️  ФОЛЛБЭК' : '💥 СБОЙ';
                   
    console.log(`${index + 1}. ${result.category} - ${status}`);
    console.log(`   "${result.query}"`);
    if (result.error) {
      console.log(`   Ошибка: ${result.error}`);
    } else if (result.source !== 'fallback') {
      console.log(`   ${result.source} (${(result.size / 1024).toFixed(1)} KB, ${result.duration}ms)`);
    } else {
      console.log(`   fallback (${result.size} bytes, ${result.duration}ms)`);
    }
    console.log('');
  });
  
  console.log('🎉 ФИНАЛЬНОЕ ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
  console.log('=' .repeat(70));
  
  // Возвращаем результаты для дальнейшего использования
  return {
    totalTests: testCases.length,
    successCount,
    apiSuccessCount,
    fallbackCount,
    errorCount,
    results
  };
}

// Запускаем финальное тестирование
if (require.main === module) {
  testRealImageSearchFinal()
    .then(results => {
      console.log('\n📈 ИТОГОВАЯ СТАТИСТИКА:');
      console.log(`Коэффициент успеха API: ${((results.apiSuccessCount / results.totalTests) * 100).toFixed(1)}%`);
      console.log(`Общая надежность: ${((results.successCount / results.totalTests) * 100).toFixed(1)}%`);
      
      process.exit(results.apiSuccessCount >= 2 ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 КРИТИЧЕСКАЯ ОШИБКА ФИНАЛЬНОГО ТЕСТИРОВАНИЯ:', error);
      process.exit(1);
    });
}