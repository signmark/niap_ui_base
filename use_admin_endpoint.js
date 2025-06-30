/**
 * Скрипт для обновления настроек кампании через новый admin эндпоинт
 */

import axios from 'axios';

const SERVER_URL = 'http://localhost:5000';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

const socialMediaSettings = {
  "telegram": {
    "token": "7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU",
    "chatId": "@ya_delayu_moschno"
  },
  "vk": {
    "token": "vk1.a.0jlmORGkgmds1qIB5btPIIuT1FZ8C_bkGpCcowI9Ml214neQFgVMiYEnePWq48txdx3D7oTtKbEvgnEifytkkyjv1FvooFsI0y_YYPX8Cw__525Tnqt_H7C9hEEdmsqHXExr4Q3DK7CL0quCvnhrhN368Ter9yFLe6buYgpnamBXwUx4yZnRJPdBVfnPmObtZRrXw7NaZJboCqAK8sXLEA",
    "groupId": "club228626989"
  },
  "instagram": {
    "token": "EAA520SFRtvcBO9Y7LhiiZBqwsqdZCP9JClMUoJZCvjsSc8qs9aheLdWefOqrZBLQhe5T0ZBerS6mZAZAP6D4i8Ln5UBfiIyVEif1LrzcAzG6JNrhW2DJeEzObpp9Mzoh8tDZA9I0HigkLnFZCaJVZCQcGDAkZBRxwnVimZBdbvokeg19i5RuGTbfuFs9UC9R",
    "accessToken": null,
    "businessAccountId": "17841422577074562"
  },
  "facebook": {
    "token": "EAA520SFRtvcBO40ZAUoxBvuj2y8mOjJ3SUZBcwG7ZAQFQXZA8z5dde8dCbQCP5WZA6NqMcZCUi9qbZBIwC8aqWIvZBHGUeGmMmbdAipFdU0N1W5bPDe1E8GJ98W5YM9rC1B6uvIE7E96RDcEj6LC1XpriuzGSWXTeLfFsYZCLpkOrXhbxDm1hXWWmccBKwuAn8KUoSfMI38a5",
    "pageId": "2120362494678794"
  },
  "youtube": {
    "apiKey": "AIzaSyAu3J57U9Xy4xN9xMaYJlHs6VPy30bHU00",
    "channelId": "UCh-jDILbZG-CbS-hWJuiXjA"
  }
};

async function updateCampaignViaAdminEndpoint() {
  try {
    console.log(`Обновление настроек кампании ${CAMPAIGN_ID} через admin эндпоинт...`);
    
    const response = await axios.post(`${SERVER_URL}/api/admin/update-campaign-settings/${CAMPAIGN_ID}`, {
      social_media_settings: socialMediaSettings
    });

    console.log('✅ Настройки кампании успешно обновлены!');
    console.log('📱 Настроенные платформы:', response.data.updated_platforms);
    console.log('📋 Ответ сервера:', response.data);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении настроек:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.error('🔍 Кампания не найдена - проверьте ID кампании');
    } else if (error.response?.status === 500) {
      console.error('🛠️ Ошибка сервера - проверьте логи приложения');
    }
    
    throw error;
  }
}

updateCampaignViaAdminEndpoint();