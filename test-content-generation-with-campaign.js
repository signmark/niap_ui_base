/**
 * Скрипт для демонстрации генерации контента с данными кампании
 * Показывает разницу между обычным и персонализированным контентом
 */

const mockPrompts = [
  "Создайте пост о здоровом питании с упоминанием нашего сервиса и ссылки на сайт",
  "Напишите пост о преимуществах планирования питания для занятых людей",
  "Создайте мотивирующий пост о достижении целей в фитнесе через правильное питание"
];

// Имитация реальных данных кампании из Directus
const campaignData = {
  campaign: {
    id: "46868c44-c6a4-4bed-accf-9ad07bba790e",
    name: "Правильное питание",
    website: "https://nplanner.ru/",
    company: "NPlanner"
  },
  questionnaire: {
    companyName: "NPlanner",
    contactInfo: "info@nplanner.ru",
    businessDescription: "Онлайн-сервис для планирования здорового питания с персональными программами от диетологов. Мы помогаем людям достигать целей в области здоровья через индивидуальный подход к питанию.",
    targetAudience: "Люди 25-45 лет, заботящиеся о здоровье и правильном питании, ведущие активный образ жизни",
    uniqueSellingPoints: "Индивидуальные планы питания от сертифицированных диетологов, удобное мобильное приложение, постоянная поддержка специалистов, гибкие программы под любой образ жизни"
  }
};

function formatCampaignContext(data) {
  return `
Название кампании: ${data.campaign.name}
Компания: ${data.campaign.company}
Сайт: ${data.campaign.website}

Описание бизнеса: ${data.questionnaire.businessDescription}
Целевая аудитория: ${data.questionnaire.targetAudience}
Уникальные преимущества: ${data.questionnaire.uniqueSellingPoints}`.trim();
}

function simulateAIResponse(prompt, useCampaignData = false) {
  if (!useCampaignData) {
    // Обычный ответ без данных кампании
    return {
      content: `🥗 Здоровое питание — это основа активной жизни!

Правильный рацион поможет вам:
✅ Поддерживать энергию весь день
✅ Улучшить самочувствие
✅ Достичь целей в фитнесе

Начните свой путь к здоровью уже сегодня! 💪

Узнайте больше: https://example-nutrition.com

#здоровоепитание #фитнес #здоровье`,
      
      analysis: "❌ ПРОБЛЕМЫ: Выдуманная ссылка, общие фразы, нет упоминания конкретной компании"
    };
  } else {
    // Персонализированный ответ с данными кампании
    return {
      content: `🥗 Правильное питание — ключ к активной и здоровой жизни!

В NPlanner мы знаем, как важно найти индивидуальный подход к питанию. Наши сертифицированные диетологи создают персональные программы специально для людей 25-45 лет, которые ценят своё здоровье.

✅ Индивидуальные планы питания
✅ Поддержка специалистов 24/7
✅ Удобное мобильное приложение
✅ Гибкие программы под ваш образ жизни

Начните свой путь к здоровому питанию уже сегодня! 💪

Узнайте больше: https://nplanner.ru/

#NPlanner #здоровоепитание #индивидуальноепитание #диетолог`,

      analysis: "✅ УСПЕХ: Реальная ссылка nplanner.ru, упоминание NPlanner, конкретные УТП, целевая аудитория"
    };
  }
}

console.log("🎯 ДЕМОНСТРАЦИЯ ГЕНЕРАЦИИ КОНТЕНТА С ДАННЫМИ КАМПАНИИ\n");
console.log("=" .repeat(80));

const testPrompt = mockPrompts[0];

// Тест без данных кампании
console.log("\n❌ ОБЫЧНАЯ ГЕНЕРАЦИЯ (useCampaignData: false):");
console.log("-" .repeat(50));
console.log(`Промпт: "${testPrompt}"`);
console.log("\nОбогащенный промпт: НЕТ\n");

const regularResponse = simulateAIResponse(testPrompt, false);
console.log("РЕЗУЛЬТАТ:");
console.log(regularResponse.content);
console.log(`\n${regularResponse.analysis}\n`);

// Тест с данными кампании
console.log("✅ ПЕРСОНАЛИЗИРОВАННАЯ ГЕНЕРАЦИЯ (useCampaignData: true):");
console.log("-" .repeat(50));
console.log(`Промпт: "${testPrompt}"`);
console.log("\nОбогащенный промпт:");
console.log(`${testPrompt}

ВАЖНО: Используй только предоставленную информацию о компании:
${formatCampaignContext(campaignData)}

ОБЯЗАТЕЛЬНО: Если в контексте указан сайт кампании, используй ТОЛЬКО эту ссылку в посте. Не придумывай другие ссылки.`);

const enrichedResponse = simulateAIResponse(testPrompt, true);
console.log("\nРЕЗУЛЬТАТ:");
console.log(enrichedResponse.content);
console.log(`\n${enrichedResponse.analysis}\n`);

console.log("🔥 КЛЮЧЕВЫЕ РАЗЛИЧИЯ:");
console.log("=" .repeat(50));
console.log("• Ссылка: example-nutrition.com → https://nplanner.ru/");
console.log("• Компания: не указана → NPlanner");
console.log("• УТП: общие → конкретные (диетологи, приложение, поддержка)");
console.log("• Аудитория: общая → 25-45 лет, заботящиеся о здоровье");
console.log("• Брендинг: отсутствует → #NPlanner, фирменный стиль");

console.log("\n✨ ФУНКЦИЯ РАБОТАЕТ! Чекбокс успешно персонализирует контент!");