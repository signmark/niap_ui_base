/**
 * Тест генерации контента на основе анкеты для Nplanner.ru
 */

async function testQuestionnaireContent() {
  const campaignId = '8e4a1018-72ff-48eb-a3ff-9bd41bf83253'; // ID кампании Nplanner
  
  console.log('🍎 Тестируем генерацию контента на основе анкеты для Nplanner.ru');
  
  try {
    const response = await fetch('http://localhost:5000/api/generate-questionnaire-content/' + campaignId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        numberOfPosts: 3
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ Результат генерации контента:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log(`\n🎉 Успешно создано ${result.data.length} публикаций!`);
      result.data.forEach((post, index) => {
        console.log(`\n📝 Публикация ${index + 1}:`);
        console.log(`   ID: ${post.id}`);
        console.log(`   Тема: ${post.topic}`);
        console.log(`   Контент: ${post.content.substring(0, 100)}...`);
        console.log(`   Запланировано: ${new Date(post.scheduledTime).toLocaleString()}`);
        console.log(`   Изображение: ${post.hasImage ? 'Да' : 'Нет'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

testQuestionnaireContent();