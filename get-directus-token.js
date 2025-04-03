// Скрипт для получения токена авторизации Directus
import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const DIRECTUS_EMAIL = process.env.DIRECTUS_EMAIL;
const DIRECTUS_PASSWORD = process.env.DIRECTUS_PASSWORD;
const DIRECTUS_URL = 'https://directus.nplanner.ru';

async function getDirectusToken() {
  try {
    console.log(`🔐 Получаем токен авторизации Directus...`);
    console.log(`📧 Email: ${DIRECTUS_EMAIL}`);
    console.log(`🔑 Password: ${'*'.repeat(DIRECTUS_PASSWORD?.length || 8)}`);
    
    const response = await axios.post(
      `${DIRECTUS_URL}/auth/login`, 
      {
        email: DIRECTUS_EMAIL,
        password: DIRECTUS_PASSWORD
      }
    );
    
    const { access_token, refresh_token } = response.data.data;
    
    console.log(`✅ Токен успешно получен!`);
    console.log(`📝 Access token: ${access_token.substring(0, 15)}...`);
    console.log(`🔄 Refresh token: ${refresh_token.substring(0, 15)}...`);
    
    // Сохраняем токен в .env файл
    let envContent = fs.readFileSync('.env', 'utf8');
    
    // Проверяем, есть ли уже переменная DIRECTUS_TOKEN
    if (envContent.includes('DIRECTUS_TOKEN=')) {
      // Обновляем существующую переменную
      envContent = envContent.replace(
        /DIRECTUS_TOKEN=.*/,
        `DIRECTUS_TOKEN=${access_token}`
      );
    } else {
      // Добавляем новую переменную
      envContent += `\nDIRECTUS_TOKEN=${access_token}`;
    }
    
    // Записываем обновленные переменные в .env файл
    fs.writeFileSync('.env', envContent);
    console.log(`💾 Токен сохранен в .env файл`);
    
    return access_token;
  } catch (error) {
    console.error(`❌ Ошибка при получении токена:`);
    if (error.response) {
      console.error(`📊 Статус ответа: ${error.response.status}`);
      console.error(`📝 Данные ответа:`, error.response.data);
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

// Запускаем функцию получения токена
getDirectusToken()
  .then(token => {
    console.log(`🎉 Операция завершена успешно!`);
  })
  .catch(err => {
    console.error(`❌ Ошибка при выполнении: ${err}`);
    process.exit(1);
  });