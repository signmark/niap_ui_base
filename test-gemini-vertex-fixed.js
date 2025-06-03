/**
 * Тест исправленного Gemini Vertex сервиса
 */

async function testGeminiVertexService() {
  try {
    console.log('=== Тест Gemini Vertex сервиса ===');
    
    const { geminiVertexService } = await import('./server/services/gemini-vertex.js');
    
    console.log('1. Тестирование улучшения текста...');
    
    const testText = 'Программа для питания хорошая';
    const testPrompt = 'Улучши этот текст, сделай его более профессиональным и информативным';
    
    const improvedText = await geminiVertexService.improveText({
      text: testText,
      prompt: testPrompt,
      model: 'gemini-2.5-flash-preview-0520'
    });
    
    console.log('✅ Исходный текст:', testText);
    console.log('✅ Улучшенный текст:', improvedText);
    
    console.log('\n2. Тестирование генерации текста...');
    
    const generatedText = await geminiVertexService.generateText({
      prompt: 'Напиши короткое описание преимуществ программы для нутрициологов',
      model: 'gemini-2.5-pro-preview-0506'
    });
    
    console.log('✅ Сгенерированный текст:', generatedText);
    
    console.log('\n✅ Все тесты пройдены успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
  }
}

// Запускаем тест
testGeminiVertexService();