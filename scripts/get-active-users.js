/**
 * Скрипт для получения информации об активных пользователях через API приложения
 */
import 'dotenv/config';
import { DirectusCrud } from '../server/services/directus-crud.js';
import { DirectusAuthManager } from '../server/services/directus-auth-manager.js';

async function getActiveUsers() {
  try {
    // Инициализируем сервисы
    const authManager = new DirectusAuthManager();
    const directusCrud = new DirectusCrud();
    
    // Авторизуемся как администратор
    const authResult = await authManager.loginAdmin(
      process.env.DIRECTUS_ADMIN_EMAIL,
      process.env.DIRECTUS_ADMIN_PASSWORD
    );
    
    if (!authResult) {
      throw new Error('Не удалось авторизоваться как администратор');
    }
    
    console.log('✓ Успешно авторизовались как администратор');
    
    // Получаем пользователей через DirectusCrud
    const users = await directusCrud.list('users', {
      authToken: authResult.access_token,
      limit: 100,
      fields: ['id', 'first_name', 'last_name', 'email', 'role', 'status', 'last_access']
    });
    
    if (!users || users.length === 0) {
      console.log('Пользователи не найдены');
      return;
    }
    
    console.log('\n=== Пользователи системы ===');
    console.log(`Всего пользователей: ${users.length}`);
    console.log('============================\n');
    
    // Выводим информацию о каждом пользователе
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.first_name || ''} ${user.last_name || ''} (${user.email})`);
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Статус: ${user.status === 'active' ? 'Активен' : 'Неактивен'}`);
      console.log(`   - Последний доступ: ${user.last_access ? new Date(user.last_access).toLocaleString() : 'Никогда'}`);
      console.log('');
    });
    
    // Выводим активных пользователей (те, у кого был доступ за последние 24 часа)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const activeUsers = users.filter(user => 
      user.last_access && new Date(user.last_access) > oneDayAgo
    );
    
    console.log('\n=== Активные пользователи (за последние 24 часа) ===');
    console.log(`Всего активных пользователей: ${activeUsers.length}`);
    console.log('====================================================\n');
    
    activeUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.first_name || ''} ${user.last_name || ''} (${user.email})`);
      console.log(`   - Последний доступ: ${new Date(user.last_access).toLocaleString()}`);
    });
    
  } catch (error) {
    console.error('Ошибка при получении информации о пользователях:');
    console.error(error.message);
    if (error.response) {
      console.error('Ответ API:', error.response.data);
    }
  }
}

// Запускаем функцию
getActiveUsers();