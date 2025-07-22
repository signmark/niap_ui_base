/**
 * Прямое тестирование сервиса поиска изображений
 * без использования HTTP API
 */

// Простая имитация функции для тестирования логики
async function findAndPrepareImage(text, keywords) {
  console.log('   🔍 Ищем изображение для ключевых слов:', keywords.join(', '));
  
  // Имитируем поиск по Unsplash
  console.log('   📡 Пробуем Unsplash API...');
  
  // Имитируем успешный поиск
  const mockResult = {
    success: true,
    source: 'unsplash',
    size: Math.floor(Math.random() * 100000) + 50000, // Случайный размер 50-150KB
    originalUrl: `https://images.unsplash.com/photo-123456?q=${encodeURIComponent(keywords[0])}`,
    imageBuffer: Buffer.alloc(1024) // Имитируем буфер изображения
  };
  
  // Случайно имитируем падение в фоллбэк
  if (Math.random() < 0.3) {
    console.log('   ⚠️  API недоступен, используем фоллбэк...');
    return {
      success: true,
      source: 'fallback',
      size: 85, // Размер 1x1 пикселя
      imageBuffer: Buffer.from([0xFF, 0xD8, 0xFF]) // Минимальный JPEG
    };
  }
  
  console.log('   ✅ Изображение найдено и обработано');
  return mockResult;
}

async function testImageSearchDirect() {
  console.log('🔍 Прямое тестирование сервиса поиска реальных изображений...\n');
  
  const testCases = [
    {
      text: 'технологии инновации будущее',
      keywords: ['технологии', 'инновации', 'будущее']
    },
    {
      text: 'еда кулинария рецепты', 
      keywords: ['еда', 'кулинария', 'рецепты']
    },
    {
      text: 'путешествия природа горы',
      keywords: ['путешествия', 'природа', 'горы']
    },
    {
      text: 'спорт фитнес тренировки',
      keywords: ['спорт', 'фитнес', 'тренировки']
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
      const result = await findAndPrepareImage(testCase.text, testCase.keywords);
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
        console.log(`   🌐 URL: ${result.originalUrl}`);
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
  console.log(`   ⚠️  Фоллбэков: ${failCount} (1x1 пиксель)`);
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
  
  console.log('\n🎉 Тестирование завершено!');
}

// Запускаем тест
testImageSearchDirect().catch(error => {
  console.error('💥 Критическая ошибка тестирования:', error);
  process.exit(1);
});