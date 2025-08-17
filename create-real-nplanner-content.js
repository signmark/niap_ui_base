/**
 * Создание реального контента в системе для Nplanner.ru
 */

import fetch from 'node-fetch';

const CAMPAIGN_ID = '8e4a1018-72ff-48eb-a3ff-9bd41bf83253';
const DIRECTUS_URL = 'https://directus.roboflow.space';
const ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;

const nplannerPosts = [
  {
    title: "Экономьте 80% времени на планировании питания",
    content: "🏥 Врачи и диетологи! Nplanner.ru автоматизирует создание рационов питания. Научно обоснованные рекомендации от РАМН, безлимитные отчеты, экономия времени до 80%. Попробуйте бесплатно! 💪",
    hashtags: "#nplanner #диетология #питание #врачи #экономиявремени",
    platforms: ["vk", "telegram"],
    content_type: "promotional"
  },
  {
    title: "Научно обоснованные рекомендации по питанию",
    content: "🔬 Базы данных НИИ питания РАМН теперь доступны в Nplanner.ru! Создавайте профессиональные рационы с научным обоснованием. Автоматический анализ питания пациентов. Качество которому доверяют!",
    hashtags: "#nplanner #РАМН #наука #нутрициология #профессионалы",
    platforms: ["vk", "telegram", "facebook"],
    content_type: "educational"
  },
  {
    title: "Автоматический анализ фактического питания",
    content: "📊 Nplanner.ru анализирует пищевые дневники пациентов автоматически! Получайте детальные отчеты по нутриентам, выявляйте дефициты, создавайте персональные рекомендации. Ваши клиенты будут довольны!",
    hashtags: "#nplanner #анализпитания #пациенты #отчеты #здоровье",
    platforms: ["vk", "telegram"],
    content_type: "howto"
  }
];

async function createPublication(postData, index) {
  const scheduledTime = new Date(Date.now() + (index + 1) * 2 * 60 * 60 * 1000).toISOString();
  
  const publication = {
    campaign_id: CAMPAIGN_ID,
    title: postData.title,
    content: postData.content,
    hashtags: postData.hashtags,
    platforms: postData.platforms,
    status: 'scheduled',
    scheduled_at: scheduledTime,
    created_by_bot: true,
    content_type: postData.content_type,
    target_audience: 'врачи, диетологи, нутрициологи'
  };

  try {
    const response = await fetch(`${DIRECTUS_URL}/items/publications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      },
      body: JSON.stringify(publication)
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: true,
        id: result.data.id,
        title: postData.title,
        scheduledTime: scheduledTime
      };
    } else {
      const error = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${error}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function createAllNplannerContent() {
  console.log('🍎 Создаем реальные публикации для Nplanner.ru в системе SMM Manager');
  console.log(`📁 Кампания: ${CAMPAIGN_ID}`);
  console.log(`🌐 Directus: ${DIRECTUS_URL}`);
  console.log(`📝 Публикаций: ${nplannerPosts.length}\n`);

  const results = [];

  for (let i = 0; i < nplannerPosts.length; i++) {
    const post = nplannerPosts[i];
    console.log(`📝 Создаем публикацию ${i + 1}/${nplannerPosts.length}: ${post.title}`);
    
    const result = await createPublication(post, i);
    results.push(result);
    
    if (result.success) {
      console.log(`   ✅ Создана: ID ${result.id}`);
      console.log(`   📅 Запланирована: ${new Date(result.scheduledTime).toLocaleString()}`);
      console.log(`   🎯 Платформы: ${post.platforms.join(', ')}`);
    } else {
      console.log(`   ❌ Ошибка: ${result.error}`);
    }
    console.log('');
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('🎉 Создание контента завершено!');
  console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА:');
  console.log(`   ✅ Успешно создано: ${successful}`);
  console.log(`   ❌ Ошибок: ${failed}`);
  console.log(`   📱 Платформы: VK, Telegram, Facebook`);
  console.log(`   🎯 Целевая аудитория: Врачи, диетологи, нутрициологи`);
  console.log(`   🤖 Созданы автоматически с использованием анкеты компании`);

  if (successful > 0) {
    console.log('\n✨ Публикации успешно запланированы и будут автоматически опубликованы!');
  }

  return {
    total: nplannerPosts.length,
    successful,
    failed,
    results
  };
}

createAllNplannerContent()
  .then(result => {
    process.exit(result.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });