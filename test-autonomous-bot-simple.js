/**
 * Простой тест автономного бота для создания контента для Nplanner.ru
 */

console.log('🤖 Тестируем автономный бот для создания контента Nplanner.ru');

// Симулируем запрос к автономному боту
const testData = {
  campaignId: '8e4a1018-72ff-48eb-a3ff-9bd41bf83253',
  companyProfile: {
    name: 'Nplanner.ru',
    description: 'Профессиональный аналитический сервис для планирования питания',
    targetAudience: 'врачи, диетологи, нутрициологи, фитнес-тренеры',
    businessType: 'B2B SaaS платформа',
    usp: 'Экономия времени до 80%, научно обоснованные рекомендации РАМН',
    keywords: 'планирование питания, диетология, нутрициология, анализ рациона'
  },
  contentTopics: [
    'Экономия времени врача на 80% с автоматизацией планирования питания',
    'Научно обоснованные рекомендации на базе данных НИИ питания РАМН',
    'Автоматический анализ фактического питания пациентов'
  ]
};

async function testAutonomousBot() {
  console.log('\n📋 Данные для генерации контента:');
  console.log(`   🏢 Компания: ${testData.companyProfile.name}`);
  console.log(`   🎯 Целевая аудитория: ${testData.companyProfile.targetAudience}`);
  console.log(`   💡 УТП: ${testData.companyProfile.usp}`);
  console.log(`   📝 Тем для контента: ${testData.contentTopics.length}`);

  console.log('\n🎨 Генерируемый контент:');
  
  testData.contentTopics.forEach((topic, index) => {
    const content = generateContentFromProfile(testData.companyProfile, topic);
    const scheduledTime = new Date(Date.now() + (index + 1) * 2 * 60 * 60 * 1000);
    
    console.log(`\n   ${index + 1}. ${content.title}`);
    console.log(`      📝 Контент: ${content.text}`);
    console.log(`      🏷️ Хэштеги: ${content.hashtags}`);
    console.log(`      📱 Платформы: ${content.platforms.join(', ')}`);
    console.log(`      ⏰ Запланировано: ${scheduledTime.toLocaleString()}`);
  });

  console.log('\n✅ Автономный бот готов к созданию контента!');
  console.log('\n📊 Преимущества использования анкеты компании:');
  console.log('   ✓ Персонализированный контент под целевую аудиторию');
  console.log('   ✓ Уникальные торговые предложения в каждом посте');
  console.log('   ✓ Релевантные хэштеги на основе ключевых слов');
  console.log('   ✓ Правильный тон общения с профессиональной аудиторией');
  console.log('   ✓ Конкретные преимущества и цифры из бизнес-профиля');
}

function generateContentFromProfile(profile, topic) {
  const templates = {
    title: `${topic} - ${profile.name}`,
    text: `🏥 ${profile.targetAudience}! ${topic}. ${profile.name} - ${profile.description}. ${profile.usp}. Попробуйте бесплатно!`,
    hashtags: ['#nplanner', '#диетология', '#питание', '#врачи', '#автоматизация'],
    platforms: ['vk', 'telegram', 'facebook']
  };

  // Персонализируем контент на основе темы
  if (topic.includes('экономия времени')) {
    templates.hashtags.push('#экономиявремени');
  } else if (topic.includes('научно')) {
    templates.hashtags.push('#РАМН', '#наука');
  } else if (topic.includes('анализ')) {
    templates.hashtags.push('#анализпитания', '#отчеты');
  }

  return templates;
}

testAutonomousBot();