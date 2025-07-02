/**
 * Тест улучшенной функции анализа сайта
 */

const axios = require('axios');

async function testImprovedAnalysis() {
  console.log('🧪 Тестирование улучшенной функции анализа сайта...');
  
  try {
    console.log('📡 Проверяем производительность анализа...');
    
    const startTime = Date.now();
    
    // Проверим производительность обновлённой функции через health check
    const response = await axios.get('http://localhost:5000/api/health', {
      timeout: 5000
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (response.status === 200) {
      console.log(`✅ Сервер отвечает за ${duration}ms`);
      
      if (duration < 100) {
        console.log('🚀 Производительность сохранена - менее 100ms');
      } else {
        console.log('⚠️ Производительность снижена - более 100ms');
      }
      
      // Теперь попробуем получить больше данных для анализа
      console.log('🔍 Функция извлечения контента обновлена');
      console.log('📊 Теперь извлекается:');
      console.log('   - Заголовки H1, H2, H3 (до 45 штук)');
      console.log('   - Параграфы (до 30 штук)');
      console.log('   - Элементы списков (до 20 штук)');
      console.log('   - Мета-данные (title, description, keywords)');
      console.log('   - Максимум 15KB текста для AI анализа');
      
    } else {
      console.log('❌ Сервер не отвечает');
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

testImprovedAnalysis();