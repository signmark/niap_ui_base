/**
 * Скрипт для получения и вывода информации об активных пользователях системы
 */
require('dotenv').config();
const axios = require('axios');

async function fetchUsers() {
  try {
    // Авторизуемся как администратор в Directus
    const authResponse = await axios.post('https://directus.nplanner.ru/auth/login', {
      email: process.env.DIRECTUS_ADMIN_EMAIL,
      password: process.env.DIRECTUS_ADMIN_PASSWORD
    });
    
    const token = authResponse.data.data.access_token;
    
    // Получаем список всех пользователей
    const usersResponse = await axios.get('https://directus.nplanner.ru/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const users = usersResponse.data.data;
    
    console.log('\n=== Пользователи системы ===');
    console.log(`Всего пользователей: ${users.length}`);
    console.log('============================\n');
    
    // Выводим информацию о каждом пользователе
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.first_name || ''} ${user.last_name || ''} (${user.email})`);
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Роль: ${user.role?.name || 'Не указана'}`);
      console.log(`   - Статус: ${user.status === 'active' ? 'Активен' : 'Неактивен'}`);
      console.log(`   - Последний логин: ${user.last_access ? new Date(user.last_access).toLocaleString() : 'Никогда'}`);
      console.log('');
    });
    
    // Получаем активные сессии (пользователи онлайн)
    try {
      const sessionsResponse = await axios.get('https://directus.nplanner.ru/server/ping', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('\n=== Статус системы ===');
      console.log('Directus API: Онлайн');
      console.log(`Версия: ${sessionsResponse.data?.server_version || 'Не определена'}`);
      console.log('============================\n');
    } catch (error) {
      console.log('\n=== Статус системы ===');
      console.log('Directus API: Ошибка подключения');
      console.log('============================\n');
    }
    
  } catch (error) {
    console.error('Ошибка при получении информации о пользователях:');
    console.error(error.response?.data || error.message);
  }
}

fetchUsers();