import fetch from 'node-fetch';

// URL тестового видео для обработки
const videoUrl = 'https://s3.ru1.storage.beget.cloud/6e679636ae90-ridiculous-seth/videos/example_video.mp4';

// Функция для тестирования API обработки видео
async function testVideoProcessorAPI() {
  try {
    console.log(`Тестирование API обработки видео`);
    console.log(`Отправка запроса на обработку видео: ${videoUrl}`);
    
    const response = await fetch('http://localhost:5001/api/video-processor/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl,
        platform: 'instagram'
      })
    });
    
    const result = await response.json();
    
    console.log('Результат обработки видео:');
    console.log(JSON.stringify(result, null, 2));
    
    // Также проверим статус API
    console.log('\nПроверка статуса API обработки видео...');
    const statusResponse = await fetch('http://localhost:5001/api/video-processor/status');
    const statusResult = await statusResponse.json();
    
    console.log('Статус API:');
    console.log(JSON.stringify(statusResult, null, 2));
    
  } catch (error) {
    console.error('Ошибка при тестировании API:', error.message);
  }
}

// Запускаем тест
testVideoProcessorAPI();