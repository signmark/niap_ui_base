/**
 * Демонстрация работы функции "Использовать данные кампании"
 * Показывает разницу между обычным промптом и обогащенным данными кампании
 */

// Имитация данных кампании NPlanner
const mockCampaignData = {
  campaign: {
    name: "Правильное питание",
    website: "https://nplanner.ru/",
    company: "NPlanner"
  },
  questionnaire: {
    businessDescription: "Онлайн-сервис для планирования здорового питания с персональными программами от диетологов",
    targetAudience: "Люди 25-45 лет, заботящиеся о здоровье и правильном питании",
    uniqueSellingPoints: "Индивидуальные планы питания, консультации с диетологами, удобное мобильное приложение"
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

// Исходный промпт пользователя
const userPrompt = "Создайте пост о здоровом питании с упоминанием нашего сервиса и ссылки на сайт";

// Обычный промпт (без данных кампании)
const regularPrompt = userPrompt;

// Обогащенный промпт (с данными кампании)
const enrichedPrompt = `${userPrompt}

ВАЖНО: Используй только предоставленную информацию о компании:
${formatCampaignContext(mockCampaignData)}

ОБЯЗАТЕЛЬНО: Если в контексте указан сайт кампании, используй ТОЛЬКО эту ссылку в посте. Не придумывай другие ссылки.`;

console.log("🎯 ДЕМОНСТРАЦИЯ ФУНКЦИИ 'ИСПОЛЬЗОВАТЬ ДАННЫЕ КАМПАНИИ'\n");

console.log("📝 ИСХОДНЫЙ ПРОМПТ ПОЛЬЗОВАТЕЛЯ:");
console.log("=" .repeat(50));
console.log(userPrompt);
console.log("\n");

console.log("❌ ОБЫЧНЫЙ ПРОМПТ (БЕЗ ДАННЫХ КАМПАНИИ):");
console.log("=" .repeat(50));
console.log(regularPrompt);
console.log("\n");

console.log("✅ ОБОГАЩЕННЫЙ ПРОМПТ (С ДАННЫМИ КАМПАНИИ):");
console.log("=" .repeat(50));
console.log(enrichedPrompt);
console.log("\n");

console.log("🔥 РЕЗУЛЬТАТ:");
console.log("=" .repeat(50));
console.log("• Обычный промпт → AI создаст общий пост с выдуманными названием компании и ссылкой");
console.log("• Обогащенный промпт → AI создаст персонализированный пост с:");
console.log("  - Реальной ссылкой: https://nplanner.ru/");
console.log("  - Названием компании: NPlanner");
console.log("  - Описанием сервиса: планирование здорового питания");
console.log("  - Целевой аудиторией: люди 25-45 лет");
console.log("  - УТП: индивидуальные планы, консультации диетологов");
console.log("\n✨ Функция готова к использованию!");