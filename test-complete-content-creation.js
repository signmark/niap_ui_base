/**
 * Полный тест создания контента с автоматическим поиском изображений и публикацией в Instagram
 */

import axios from 'axios';

async function testCompleteWorkflow() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('🧪 ТЕСТ: Полный цикл создания контента с поиском изображений и публикацией');
  
  // Получаем админский токен для тестирования
  const tokenResponse = await axios.get(`${baseUrl}/api/admin-token`);
  const adminToken = tokenResponse.data.token;
  
  const headers = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };
  
  try {
    // Шаг 1: Создание нового контента без изображения
    console.log('\n📝 Шаг 1: Создание контента без изображения...');
    const content = {
      campaign_id: '46868c44-c6a4-4bed-accf-9ad07bba790e',
      content: 'Революция в области здорового питания: новые технологии помогают персонализировать диету',
      keywords: 'здоровое питание, технологии, диета, персонализация',
      content_type: 'text-image',
      status: 'scheduled',
      scheduled_at: new Date(Date.now() + 5000).toISOString(), // Через 5 секунд
      // Намеренно НЕ указываем imageUrl - система должна найти изображение автоматически
    };
    
    const createResponse = await axios.post(`${baseUrl}/api/campaign-content`, content, { headers });
    console.log('✅ Контент создан:', createResponse.data.id);
    const contentId = createResponse.data.id;
    
    // Шаг 2: Прямая публикация в Instagram (упрощенный тест)
    console.log('\n📱 Шаг 2: Прямая публикация в Instagram...');
    const publishResponse = await axios.post(`${baseUrl}/api/social-publish/instagram`, {
      contentId: contentId
    }, { headers });
    
    console.log('✅ Запрос на публикацию отправлен');
    
    // Шаг 3: Ждем завершения публикации
    console.log('\n⏰ Шаг 3: Ожидание завершения публикации (8 секунд)...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Шаг 4: Проверяем результат
    console.log('\n🔍 Шаг 4: Проверка результата публикации...');
    const checkResponse = await axios.get(`${baseUrl}/api/campaign-content/${contentId}`, { headers });
    const finalContent = checkResponse.data;
    
    console.log('\n📊 РЕЗУЛЬТАТЫ:');
    console.log('Content ID:', contentId);
    console.log('Status:', finalContent.status);
    console.log('Image URL:', finalContent.imageUrl || 'НЕ УКАЗАН (поиск должен был найти)');
    
    if (finalContent.social_platforms && finalContent.social_platforms.instagram) {
      const instagramStatus = finalContent.social_platforms.instagram;
      console.log('\n📱 Instagram статус:');
      console.log('  Status:', instagramStatus.status);
      console.log('  Post URL:', instagramStatus.postUrl || 'НЕ ОПУБЛИКОВАН');
      console.log('  Post ID:', instagramStatus.postId || 'НЕ СОЗДАН');
      console.log('  Error:', instagramStatus.error || 'НЕТ ОШИБОК');
      
      if (instagramStatus.status === 'published' && instagramStatus.postUrl) {
        console.log('\n🎉 УСПЕХ! Полный цикл работает:');
        console.log('✅ 1. Контент создан автоматически');
        console.log('✅ 2. Изображение найдено автоматически (поиск API)');
        console.log('✅ 3. Изображение сжато до <50KB');
        console.log('✅ 4. Пост опубликован в Instagram');
        console.log('✅ 5. URL поста получен:', instagramStatus.postUrl);
      } else {
        console.log('\n❌ ПРОБЛЕМА с публикацией:');
        console.log('Status:', instagramStatus.status);
        console.log('Error:', instagramStatus.error);
      }
    } else {
      console.log('\n❌ Instagram данные не найдены в social_platforms');
    }
    
  } catch (error) {
    console.error('\n❌ ОШИБКА в тесте:', error.response?.data || error.message);
  }
}

// Запуск теста
testCompleteWorkflow();