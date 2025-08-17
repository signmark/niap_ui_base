/**
 * Создание публикаций для Nplanner.ru напрямую в базе данных
 */

import fetch from 'node-fetch';

const CAMPAIGN_ID = '8e4a1018-72ff-48eb-a3ff-9bd41bf83253';
const DIRECTUS_URL = 'https://directus.roboflow.space';
const ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;

const nplannerPublications = [
  {
    title: "Экономьте 80% времени на планировании питания",
    content: "🏥 Врачи и диетологи! Nplanner.ru автоматизирует создание рационов питания. Научно обоснованные рекомендации от РАМН, безлимитные отчеты, экономия времени до 80%. Попробуйте бесплатно! 💪",
    hashtags: "#nplanner #диетология #питание #врачи #экономиявремени",
    platforms: JSON.stringify(["vk", "telegram"]),
    content_type: "promotional",
    scheduled_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // Через 30 минут
  },
  {
    title: "Научно обоснованные рекомендации по питанию",
    content: "🔬 Базы данных НИИ питания РАМН теперь доступны в Nplanner.ru! Создавайте профессиональные рационы с научным обоснованием. Автоматический анализ питания пациентов. Качество которому доверяют!",
    hashtags: "#nplanner #РАМН #наука #нутрициология #профессионалы",
    platforms: JSON.stringify(["vk", "telegram", "facebook"]),
    content_type: "educational",
    scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // Через 2 часа
  },
  {
    title: "Автоматический анализ фактического питания",
    content: "📊 Nplanner.ru анализирует пищевые дневники пациентов автоматически! Получайте детальные отчеты по нутриентам, выявляйте дефициты, создавайте персональные рекомендации. Ваши клиенты будут довольны!",
    hashtags: "#nplanner #анализпитания #пациенты #отчеты #здоровье",
    platforms: JSON.stringify(["vk", "telegram"]),
    content_type: "howto",
    scheduled_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // Через 4 часа
  }
];

async function createPublication(pubData) {
  const publication = {
    campaign_id: CAMPAIGN_ID,
    title: pubData.title,
    content: pubData.content,
    hashtags: pubData.hashtags,
    platforms: pubData.platforms,
    status: 'scheduled',
    scheduled_at: pubData.scheduled_at,
    created_by_bot: true,
    content_type: pubData.content_type,
    target_audience: 'врачи, диетологи, нутрициологи'
  };

  try {
    console.log(`📝 Создаем: ${pubData.title}`);
    console.log(`📅 Время: ${new Date(pubData.scheduled_at).toLocaleString()}`);

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
      console.log(`✅ Создана публикация ID: ${result.data.id}`);
      return { success: true, id: result.data.id, title: pubData.title };
    } else {
      const errorText = await response.text();
      console.log(`❌ Ошибка: ${response.status} - ${errorText}`);
      return { success: false, error: `${response.status}: ${errorText}` };
    }
  } catch (error) {
    console.log(`❌ Исключение: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function createAllPublications() {
  console.log('🍎 Создаем публикации для Nplanner.ru');
  console.log(`🎯 Кампания: ${CAMPAIGN_ID}`);
  console.log(`📊 Публикаций: ${nplannerPublications.length}`);
  console.log(`🔑 Токен: ${ADMIN_TOKEN ? 'Есть' : 'Отсутствует'}\n`);

  const results = [];

  for (const pub of nplannerPublications) {
    const result = await createPublication(pub);
    results.push(result);
    console.log(''); // Пустая строка между публикациями
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('🎉 ЗАВЕРШЕНО!');
  console.log(`✅ Успешно: ${successful}`);
  console.log(`❌ Ошибок: ${failed}`);

  if (successful > 0) {
    console.log('\n📱 Публикации появятся в разделе "Публикации" кампании');
    console.log('⏰ Они будут автоматически опубликованы в запланированное время');
  }

  return { successful, failed, results };
}

createAllPublications()
  .then(result => {
    process.exit(result.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });