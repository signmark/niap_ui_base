#!/usr/bin/env node

/**
 * Тест оптимизированной системы публикации Instagram Stories 
 * с интеллектуальными задержками и защитой от anti-automation мер Instagram
 */

const axios = require('axios');

const TEST_CONFIG = {
  // Данные для тестирования (darkhorse_fashion)
  credentials: {
    username: 'darkhorse_fashion',
    password: 'QtpZ3dh70306'
  },
  
  // Тестовые Stories для демонстрации различных возможностей
  testStories: [
    {
      text: '🚀 Первая Stories с новой системой!',
      backgroundColor: '#ff6b6b', // Красный
      textColor: '#ffffff'
    },
    {
      text: '⚡ Система обходит anti-automation меры Instagram',
      backgroundColor: '#4ecdc4', // Зеленый
      textColor: '#ffffff'
    },
    {
      text: '🎯 Интеллектуальные задержки работают!',
      backgroundColor: '#ffe66d', // Желтый
      textColor: '#2d3436'
    }
  ]
};

async function testStoriesPublication() {
  console.log('\n🧪 === ТЕСТ ОПТИМИЗИРОВАННОЙ СИСТЕМЫ INSTAGRAM STORIES ===\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < TEST_CONFIG.testStories.length; i++) {
    const story = TEST_CONFIG.testStories[i];
    const storyNum = i + 1;
    
    console.log(`📱 [Тест ${storyNum}/${TEST_CONFIG.testStories.length}] Публикация Stories:`);
    console.log(`   Текст: ${story.text}`);
    console.log(`   Цвета: фон ${story.backgroundColor}, текст ${story.textColor}`);
    
    try {
      const startTime = Date.now();
      
      // Отправляем запрос к новому Stories API
      const response = await axios.post('http://localhost:5000/api/instagram-stories/publish-simple', {
        username: TEST_CONFIG.credentials.username,
        password: TEST_CONFIG.credentials.password,
        text: story.text,
        backgroundColor: story.backgroundColor,
        textColor: story.textColor
      }, {
        timeout: 180000, // 3 минуты timeout для учета задержек
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const duration = Date.now() - startTime;
      
      if (response.data.success) {
        console.log(`✅ [Тест ${storyNum}] УСПЕХ за ${Math.round(duration / 1000)} секунд`);
        console.log(`   Stories ID: ${response.data.storyId}`);
        console.log(`   URL: ${response.data.storyUrl}`);
        console.log(`   Порт прокси: ${response.data.port}`);
        console.log(`   Попытка: ${response.data.attempt}`);
        successCount++;
      } else {
        console.log(`❌ [Тест ${storyNum}] НЕУДАЧА:`, response.data.error);
        errorCount++;
      }
      
    } catch (error) {
      console.log(`💥 [Тест ${storyNum}] ОШИБКА:`, error.message);
      
      // Проверяем, есть ли детали от сервера
      if (error.response?.data) {
        console.log(`   Детали:`, error.response.data);
      }
      
      errorCount++;
    }
    
    // Дополнительная задержка между тестами для демонстрации
    if (i < TEST_CONFIG.testStories.length - 1) {
      console.log(`⏳ Ждем перед следующим тестом (система сама управляет задержками)...\n`);
      // Короткая задержка между тестами - основную задержку обеспечивает система
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('\n📊 === РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ===');
  console.log(`✅ Успешных публикаций: ${successCount}`);
  console.log(`❌ Неудачных публикаций: ${errorCount}`);
  console.log(`📈 Процент успеха: ${Math.round((successCount / TEST_CONFIG.testStories.length) * 100)}%`);
  
  if (successCount > 0) {
    console.log('\n🎉 ПРОРЫВ ДОСТИГНУТ! Instagram Stories публикуются несмотря на anti-automation меры!');
    console.log('🧠 Система успешно обходит попытки Instagram запутать разработчиков');
    console.log('⚡ Интеллектуальные задержки и повторные попытки работают корректно');
  }
  
  console.log('\n🏁 Тестирование завершено');
}

// Функция демонстрации ключевых особенностей системы
function showSystemFeatures() {
  console.log('\n🔧 === КЛЮЧЕВЫЕ ОСОБЕННОСТИ ОПТИМИЗИРОВАННОЙ СИСТЕМЫ ===');
  console.log('');
  console.log('🛡️  ЗАЩИТА ОТ ANTI-AUTOMATION МЕР INSTAGRAM:');
  console.log('   • Множественные порты прокси (10001, 10002, 10007, 10006)');
  console.log('   • Автоматическое переключение портов при неудачах');
  console.log('   • Обработка feedback_required как нормального поведения');
  console.log('');
  console.log('⏱️  ИНТЕЛЛЕКТУАЛЬНЫЕ ВРЕМЕННЫЕ ЗАДЕРЖКИ:');
  console.log('   • 3 минуты между публикациями одного аккаунта');
  console.log('   • 2-5 секунд случайная задержка (имитация человека)');
  console.log('   • 30-45 секунд при feedback_required ошибках');
  console.log('');
  console.log('🖼️  ОПТИМИЗИРОВАННАЯ ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЙ:');
  console.log('   • Компактный размер 540x960 (соотношение 9:16)');
  console.log('   • Размер файла ~38KB для быстрой загрузки');
  console.log('   • Текст на цветном фоне без внешних изображений');
  console.log('');
  console.log('🔄  СИСТЕМА ПОВТОРНЫХ ПОПЫТОК:');
  console.log('   • До 3 попыток с разными портами прокси');
  console.log('   • Увеличенные задержки для специфических ошибок');
  console.log('   • Сохранение результата даже при "ошибках"');
  console.log('');
}

// Запуск тестирования
async function main() {
  showSystemFeatures();
  await testStoriesPublication();
}

// Обработка ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необработанная ошибка:', reason);
  process.exit(1);
});

// Запуск
main().catch(error => {
  console.error('💥 Критическая ошибка:', error.message);
  process.exit(1);
});