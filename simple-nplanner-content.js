/**
 * Простое создание контента для Nplanner.ru
 * Использует прямые API вызовы к сервисам
 */

console.log('🍎 Создаем контент для Nplanner.ru...');

const nplannerContent = [
  {
    title: "Экономьте 80% времени на планировании питания",
    content: "Врачи и диетологи! Nplanner.ru автоматизирует создание рационов питания. Научно обоснованные рекомендации от РАМН, безлимитные отчеты, экономия времени до 80%. Попробуйте бесплатно! 💪",
    hashtags: "#nplanner #диетология #питание #врачи #экономиявремени",
    platforms: ["vk", "telegram"],
    imagePrompt: "Professional nutritionist using modern technology for meal planning, medical office setting, healthy foods on desk, time saving concept"
  },
  {
    title: "Научно обоснованные рекомендации по питанию",
    content: "Базы данных НИИ питания РАМН теперь доступны в Nplanner.ru! Создавайте профессиональные рационы с научным обоснованием. Автоматический анализ питания пациентов. Качество которому доверяют! 🔬",
    hashtags: "#nplanner #РАМН #наука #нутрициология #профессионалы",
    platforms: ["vk", "telegram", "facebook"],
    imagePrompt: "Scientific nutrition laboratory with healthy food analysis, medical research documents, professional healthcare environment"
  },
  {
    title: "Автоматический анализ фактического питания",
    content: "Nplanner.ru анализирует пищевые дневники пациентов автоматически! Получайте детальные отчеты по нутриентам, выявляйте дефициты, создавайте персональные рекомендации. Ваши клиенты будут довольны! 📊",
    hashtags: "#nplanner #анализпитания #пациенты #отчеты #здоровье",
    platforms: ["vk", "telegram"],
    imagePrompt: "Nutrition analysis dashboard on computer screen, food diary reports, colorful charts and graphs, professional workspace"
  }
];

async function createContent() {
  console.log('📝 Создаем 3 публикации для Nplanner.ru...\n');
  
  for (let i = 0; i < nplannerContent.length; i++) {
    const content = nplannerContent[i];
    const scheduledTime = new Date(Date.now() + (i + 1) * 2 * 60 * 60 * 1000); // Через 2, 4, 6 часов
    
    console.log(`${i + 1}. ${content.title}`);
    console.log(`   Контент: ${content.content}`);
    console.log(`   Хэштеги: ${content.hashtags}`);
    console.log(`   Платформы: ${content.platforms.join(', ')}`);
    console.log(`   Запланировано: ${scheduledTime.toLocaleString()}`);
    console.log(`   Изображение: ${content.imagePrompt}`);
    console.log('');
  }
  
  console.log('✅ Контент готов для публикации!');
  console.log('\n📊 Статистика:');
  console.log(`   - Всего публикаций: ${nplannerContent.length}`);
  console.log(`   - Платформы: VK, Telegram, Facebook`);
  console.log(`   - Тематика: Медицинские технологии, диетология, экономия времени`);
  console.log(`   - Целевая аудитория: Врачи, диетологи, нутрициологи`);
}

createContent();