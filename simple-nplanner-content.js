/**
 * Демонстрация контента для Nplanner.ru на основе анкеты
 */

const questionnaireData = {
  companyName: 'Nplanner.ru',
  industry: 'Медицинские услуги / Нутрициология',
  targetAudience: 'врачи, диетологи, нутрициологи, медицинские работники',
  uniqueSellingProposition: 'экономия времени до 80%, научные рекомендации РАМН, автоматический анализ питания',
  products: 'платформа для планирования питания пациентов',
  goals: 'привлечение медицинских специалистов',
  painPoints: 'ручное планирование питания занимает много времени, сложность создания научно обоснованных рационов'
};

const generatedContent = [
  {
    id: 1,
    title: "Экономьте 80% времени на планировании питания",
    content: "🏥 Врачи и диетологи! Nplanner.ru автоматизирует создание рационов питания. Научно обоснованные рекомендации от РАМН, безлимитные отчеты, экономия времени до 80%. Попробуйте бесплатно! 💪",
    hashtags: "#nplanner #диетология #питание #врачи #экономиявремени",
    platforms: ["vk", "telegram"],
    contentType: "promotional",
    targetAudience: "врачи, диетологи",
    generatedFrom: "УТП: экономия времени 80%",
    scheduledTime: "Через 30 минут",
    status: "Готов к публикации"
  },
  {
    id: 2,
    title: "Научно обоснованные рекомендации по питанию",
    content: "🔬 Базы данных НИИ питания РАМН теперь доступны в Nplanner.ru! Создавайте профессиональные рационы с научным обоснованием. Автоматический анализ питания пациентов. Качество которому доверяют!",
    hashtags: "#nplanner #РАМН #наука #нутрициология #профессионалы",
    platforms: ["vk", "telegram", "facebook"],
    contentType: "educational",
    targetAudience: "нутрициологи, врачи",
    generatedFrom: "УТП: научные рекомендации РАМН",
    scheduledTime: "Через 2 часа",
    status: "Готов к публикации"
  },
  {
    id: 3,
    title: "Автоматический анализ фактического питания",
    content: "📊 Nplanner.ru анализирует пищевые дневники пациентов автоматически! Получайте детальные отчеты по нутриентам, выявляйте дефициты, создавайте персональные рекомендации. Ваши клиенты будут довольны!",
    hashtags: "#nplanner #анализпитания #пациенты #отчеты #здоровье",
    platforms: ["vk", "telegram"],
    contentType: "howto",
    targetAudience: "диетологи, врачи",
    generatedFrom: "УТП: автоматический анализ питания",
    scheduledTime: "Через 4 часа",
    status: "Готов к публикации"
  }
];

console.log('🍎 КОНТЕНТ НА ОСНОВЕ АНКЕТЫ ДЛЯ NPLANNER.RU');
console.log('=' * 60);

console.log('\n📋 ДАННЫЕ ИЗ АНКЕТЫ:');
Object.entries(questionnaireData).forEach(([key, value]) => {
  const labels = {
    companyName: '🏢 Компания',
    industry: '🏭 Отрасль', 
    targetAudience: '🎯 Целевая аудитория',
    uniqueSellingProposition: '💡 Уникальные преимущества',
    products: '📦 Продукты/услуги',
    goals: '🎯 Цели',
    painPoints: '😰 Боли клиентов'
  };
  console.log(`${labels[key]}: ${value}`);
});

console.log('\n📝 СГЕНЕРИРОВАННЫЙ КОНТЕНТ:');

generatedContent.forEach((post, index) => {
  console.log(`\n${index + 1}. ${post.title}`);
  console.log(`   📄 Контент: ${post.content}`);
  console.log(`   🏷️ Хэштеги: ${post.hashtags}`);
  console.log(`   📱 Платформы: ${post.platforms.join(', ')}`);
  console.log(`   📂 Тип: ${post.contentType}`);
  console.log(`   🎯 Аудитория: ${post.targetAudience}`);
  console.log(`   🔗 Основа: ${post.generatedFrom}`);
  console.log(`   ⏰ Публикация: ${post.scheduledTime}`);
  console.log(`   ✅ Статус: ${post.status}`);
});

console.log('\n🤖 КАК РАБОТАЕТ СИСТЕМА:');
console.log('1. ✅ Анализирует данные анкеты компании');
console.log('2. ✅ Определяет целевую аудиторию (врачи, диетологи)');
console.log('3. ✅ Использует УТП (экономия времени 80%, РАМН)');
console.log('4. ✅ Создает релевантные хэштеги для отрасли');
console.log('5. ✅ Адаптирует тон под профессиональную аудиторию');
console.log('6. ✅ Добавляет призывы к действию');
console.log('7. ✅ Планирует время публикации');

console.log('\n🎯 ПЕРСОНАЛИЗАЦИЯ:');
console.log('• Медицинская терминология (нутриенты, рационы)');
console.log('• Научная обоснованность (РАМН, исследования)');
console.log('• Профессиональные боли (экономия времени)');
console.log('• Конкретные цифры (80% экономии времени)');
console.log('• Релевантные эмодзи (🏥, 🔬, 📊)');

console.log('\n✨ РЕЗУЛЬТАТ:');
console.log('Система автономного бота создала 3 персонализированные публикации');
console.log('для Nplanner.ru на основе анкеты, учитывая специфику медицинской');
console.log('отрасли и потребности целевой аудитории.');

console.log('\n📋 КОНТЕНТ ГОТОВ К ИСПОЛЬЗОВАНИЮ!');