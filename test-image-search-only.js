// Тест только сервиса поиска изображений
import imageSearchService from './server/services/image-search-service.js';

async function testImageSearch() {
  console.log('🔍 Тестируем сервис поиска реальных изображений...\n');
  
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
    }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`🔎 Поиск для: "${testCase.text}"`);
      console.log(`🏷️ Ключевые слова: ${JSON.stringify(testCase.keywords)}`);
      
      const result = await imageSearchService.findAndPrepareImage(testCase.text, testCase.keywords);
      
      console.log(`✅ Успех: ${result.success}`);
      console.log(`📏 Размер: ${result.size} байт`);
      console.log(`🌐 Источник: ${result.source || 'fallback'}`);
      console.log(`🔗 URL: ${result.originalUrl || 'нет URL'}`);
      console.log('---\n');
      
    } catch (error) {
      console.error(`❌ Ошибка: ${error.message}\n`);
    }
  }
}

testImageSearch();