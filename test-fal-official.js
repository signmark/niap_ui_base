/**
 * Тестовый скрипт для проверки работы FAL.AI API с использованием нового официального клиента
 * 
 * Использование: 
 * node test-fal-official.js
 */

import * as fal from '@fal-ai/client';

// Получаем ключ API из переменной окружения
const apiKey = process.env.FAL_AI_API_KEY;

// Функция для проверки API
async function testFalApi() {
  console.log('\n=== Тестирование FAL.AI API с официальным клиентом ===\n');
  
  if (!apiKey) {
    console.error('Ошибка: API ключ не указан в переменной FAL_AI_API_KEY');
    process.exit(1);
  }
  
  // Маскируем ключ для логов
  const maskedKey = apiKey.substring(0, 6) + '...';
  console.log(`Используемый API ключ (маскирован): ${maskedKey}`);
  
  try {
    // Настройка клиента
    const client = new fal.BrowserClient({
      // Если ключ не начинается с "Key ", то добавляем
      credentials: apiKey.startsWith('Key ') ? apiKey : `Key ${apiKey}`
    });
    
    console.log('\nПытаемся сгенерировать изображение с помощью модели schnell...');
    
    // Генерация изображения
    const result = await client.run(
      'fal-ai/schnell',
      {
        prompt: "A cute cat with blue eyes sitting in a garden",
        negative_prompt: "bad quality, blurry",
        num_images: 1,
        width: 512,
        height: 512
      }
    );
    
    console.log('\nУспешно получен ответ от API!');
    
    if (result && result.images && result.images.length > 0) {
      console.log(`Количество полученных изображений: ${result.images.length}`);
      console.log(`URL первого изображения: ${result.images[0].url}`);
    } else {
      console.log('Структура ответа:', JSON.stringify(result).substring(0, 300) + '...');
    }
    
    console.log('\n✅ Тест прошел успешно! API ключ работает корректно.');
    return true;
  } catch (error) {
    console.error('\n❌ Ошибка при тестировании API:');
    console.error(`Сообщение ошибки: ${error.message}`);
    
    if (error.response) {
      console.error(`Статус ошибки: ${error.response.status}`);
      console.error('Данные ответа:', error.response.data ? 
        JSON.stringify(error.response.data).substring(0, 300) : 'Нет данных');
    }
    
    console.error('\nВозможные причины проблемы:');
    console.error('1. Неверный API ключ или формат');
    console.error('2. Истек срок действия API ключа');
    console.error('3. Недостаточно привилегий для доступа к модели');
    console.error('4. Проблемы с соединением или с сервером FAL.AI');
    
    return false;
  }
}

// Запускаем тест
testFalApi()
  .then(success => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Неожиданная ошибка:', err);
    process.exit(1);
  });