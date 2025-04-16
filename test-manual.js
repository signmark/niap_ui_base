/**
 * Скрипт для ручного тестирования изменений в updatePublicationStatus
 */

import axios from 'axios';

// ========== КОНФИГУРАЦИЯ ==========
// URL для API
const API_URL = 'http://localhost:5000/api';

// Пример данных
const TEST_DATA = {
  "vk": {
    "error": null,
    "postId": null,
    "status": "scheduled",
    "postUrl": null,
    "publishedAt": null,
    "scheduledAt": "2025-04-16T10:30:00.000Z",
    "scheduled_at": "2025-04-16T10:30:00.000Z"
  },
  "telegram": {
    "error": null,
    "postId": null,
    "status": "scheduled",
    "postUrl": null,
    "publishedAt": null,
    "scheduledAt": "2025-04-16T10:25:00.000Z",
    "scheduled_at": "2025-04-16T10:25:00.000Z"
  }
};

// Данные для имитации публикации в Telegram
const TELEGRAM_PUBLICATION = {
  "platform": "telegram",
  "status": "published",
  "postId": "1387",
  "postUrl": "https://t.me/ya_delayu_moschno/1387",
  "publishedAt": new Date().toISOString(),
};

// ID контента для обновления (подставьте реальный ID)
const CONTENT_ID = "12345678-1234-1234-1234-123456789abc";

// ========== ОСНОВНАЯ ЛОГИКА ==========

/**
 * Обработка ошибок HTTP запросов
 * @param {Error} error - Объект ошибки axios
 */
function handleError(error) {
  console.error("Ошибка:", error.message);
  if (error.response) {
    console.error("Статус:", error.response.status);
    console.error("Данные:", error.response.data);
  }
}

/**
 * Обновляет данные платформы напрямую через updatePublicationStatus
 */
async function testUpdatePublicationStatus() {
  try {
    console.log("Вызов метода updatePublicationStatus напрямую...");
    
    const response = await axios.post(
      `${API_URL}/manual-test/update-publication-status`, 
      {
        contentId: CONTENT_ID,
        platform: TELEGRAM_PUBLICATION.platform,
        publicationResult: TELEGRAM_PUBLICATION,
        initialSocialPlatforms: TEST_DATA
      }
    );
    
    console.log("Статус ответа:", response.status);
    console.log("Результат:", JSON.stringify(response.data, null, 2));
    
    // Проверяем, сохранились ли данные VK в обновленном объекте
    const updatedPlatforms = response.data.socialPlatforms;
    
    if (updatedPlatforms && updatedPlatforms.vk) {
      console.log("✅ ТЕСТ ПРОЙДЕН: Данные VK сохранены после обновления Telegram");
      console.log("Данные VK:", JSON.stringify(updatedPlatforms.vk, null, 2));
      console.log("Данные Telegram:", JSON.stringify(updatedPlatforms.telegram, null, 2));
    } else {
      console.log("❌ ТЕСТ НЕ ПРОЙДЕН: Данные VK потеряны после обновления Telegram");
      console.log("Обновленные данные:", JSON.stringify(updatedPlatforms, null, 2));
    }
  } catch (error) {
    handleError(error);
  }
}

// Запускаем тест
testUpdatePublicationStatus();