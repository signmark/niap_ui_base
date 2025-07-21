const { createStoriesImage } = require('./server/utils/image-generator.cjs');
const fs = require('fs');

async function testImageGenerator() {
  console.log('Тестируем генератор изображений...');
  
  try {
    const imageBuffer = await createStoriesImage(
      'Привет! Это тестовое сообщение для Instagram Stories',
      '#FF6B6B',
      '#FFFFFF'
    );
    
    console.log(`Создано изображение размером: ${imageBuffer.length} байт`);
    
    // Сохраняем для проверки
    fs.writeFileSync('test_generated_image.jpg', imageBuffer);
    console.log('Изображение сохранено как test_generated_image.jpg');
    
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

testImageGenerator();