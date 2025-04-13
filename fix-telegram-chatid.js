/**
 * Скрипт для исправления chatId в настройках кампаний
 * Обновляет ID чата Telegram с "-1001955550242" на "-1002302366310"
 */

import 'dotenv/config';
import axios from 'axios';

// Конфигурационные константы
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL;
const DIRECTUS_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD;
const INCORRECT_CHAT_ID = '-1001955550242';
const CORRECT_CHAT_ID = '-1002302366310';

// Логирование
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Авторизация в Directus
 * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
 */
async function authenticate() {
  try {
    log('Попытка авторизации...');
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });
    
    log('Авторизация успешна');
    return response.data.data.access_token;
  } catch (error) {
    log(`Ошибка авторизации: ${error.message}`);
    return null;
  }
}

/**
 * Получает все кампании
 * @param {string} token Токен авторизации
 * @returns {Promise<Array|null>} Массив кампаний или null в случае ошибки
 */
async function getAllCampaigns(token) {
  try {
    log('Получение списка кампаний...');
    const response = await axios.get(`${DIRECTUS_URL}/items/campaigns`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    log(`Получено ${response.data.data.length} кампаний`);
    return response.data.data;
  } catch (error) {
    log(`Ошибка получения кампаний: ${error.message}`);
    return null;
  }
}

/**
 * Находит кампании с неправильным chatId
 * @param {Array} campaigns Массив кампаний
 * @returns {Array} Массив кампаний с неправильным chatId
 */
function findCampaignsWithIncorrectChatId(campaigns) {
  const incorrectCampaigns = [];
  
  for (const campaign of campaigns) {
    // Проверяем settings
    if (campaign.settings?.telegram?.chatId === INCORRECT_CHAT_ID) {
      incorrectCampaigns.push({
        id: campaign.id,
        name: campaign.name,
        field: 'settings'
      });
    }
    
    // Проверяем socialMediaSettings
    if (campaign.socialMediaSettings?.telegram?.chatId === INCORRECT_CHAT_ID) {
      // Если кампания уже добавлена из-за неправильного settings, обновляем запись
      const existingIndex = incorrectCampaigns.findIndex(c => c.id === campaign.id);
      if (existingIndex !== -1) {
        incorrectCampaigns[existingIndex].field = 'both';
      } else {
        incorrectCampaigns.push({
          id: campaign.id,
          name: campaign.name,
          field: 'socialMediaSettings'
        });
      }
    }
  }
  
  return incorrectCampaigns;
}

/**
 * Обновляет chatId в настройках кампании
 * @param {string} campaignId ID кампании
 * @param {string} field Поле для обновления (settings, socialMediaSettings или both)
 * @param {string} token Токен авторизации
 * @returns {Promise<boolean>} Успешно ли обновление
 */
async function updateCampaignChatId(campaignId, field, token) {
  try {
    log(`Обновление кампании ${campaignId}, поле "${field}"...`);
    
    // Получаем текущие настройки кампании
    const campaignResponse = await axios.get(`${DIRECTUS_URL}/items/campaigns/${campaignId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    const campaign = campaignResponse.data.data;
    const updateData = {};
    
    // Обновляем settings
    if (field === 'settings' || field === 'both') {
      const settings = JSON.parse(JSON.stringify(campaign.settings || {}));
      if (settings.telegram) {
        settings.telegram.chatId = CORRECT_CHAT_ID;
        updateData.settings = settings;
      }
    }
    
    // Обновляем socialMediaSettings
    if (field === 'socialMediaSettings' || field === 'both') {
      const socialMediaSettings = JSON.parse(JSON.stringify(campaign.socialMediaSettings || {}));
      if (socialMediaSettings.telegram) {
        socialMediaSettings.telegram.chatId = CORRECT_CHAT_ID;
        updateData.socialMediaSettings = socialMediaSettings;
      }
    }
    
    // Обновляем кампанию
    await axios.patch(`${DIRECTUS_URL}/items/campaigns/${campaignId}`, updateData, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    log(`Кампания ${campaignId} успешно обновлена`);
    return true;
  } catch (error) {
    log(`Ошибка обновления кампании ${campaignId}: ${error.message}`);
    return false;
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  log('Запуск скрипта исправления chatId...');
  
  // Авторизация
  const token = await authenticate();
  if (!token) {
    log('Не удалось авторизоваться. Проверьте учетные данные.');
    return;
  }
  
  // Получение кампаний
  const campaigns = await getAllCampaigns(token);
  if (!campaigns) {
    log('Не удалось получить список кампаний.');
    return;
  }
  
  // Поиск кампаний с неправильным chatId
  const incorrectCampaigns = findCampaignsWithIncorrectChatId(campaigns);
  log(`Найдено ${incorrectCampaigns.length} кампаний с неправильным chatId:`);
  
  for (const campaign of incorrectCampaigns) {
    log(`- ${campaign.name} (${campaign.id}), поле: ${campaign.field}`);
  }
  
  // Обновление кампаний
  if (incorrectCampaigns.length > 0) {
    log('Начинаем обновление кампаний...');
    
    let successCount = 0;
    for (const campaign of incorrectCampaigns) {
      const success = await updateCampaignChatId(campaign.id, campaign.field, token);
      if (success) {
        successCount++;
      }
    }
    
    log(`Обновление завершено. Успешно обновлено ${successCount} из ${incorrectCampaigns.length} кампаний.`);
  } else {
    log('Нет кампаний для обновления. Все chatId уже корректны.');
  }
}

// Запуск скрипта
main().catch(error => {
  log(`Неожиданная ошибка: ${error.message}`);
  log(error.stack);
});