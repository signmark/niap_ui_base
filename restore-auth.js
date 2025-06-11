/**
 * Скрипт для восстановления авторизации после переключения веток
 * Автоматически авторизует пользователя и сохраняет токены в localStorage
 */

async function restoreAuth() {
  try {
    console.log('🔧 Восстановление авторизации...');
    
    // Очищаем старые токены
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('refresh_token');
    
    // Выполняем авторизацию
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@roboflow.tech',
        password: 'QtpZ3dh7'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.token && data.user) {
      // Сохраняем токены в localStorage
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user_id', data.user.id);
      localStorage.setItem('refresh_token', data.refresh_token);
      
      console.log('✅ Авторизация восстановлена!');
      console.log('👤 Пользователь:', data.user.email);
      console.log('🔑 Токен сохранен в localStorage');
      
      // Перезагружаем страницу для применения изменений
      window.location.reload();
      
      return true;
    } else {
      throw new Error('Неполные данные в ответе сервера');
    }
  } catch (error) {
    console.error('❌ Ошибка восстановления авторизации:', error);
    return false;
  }
}

// Автоматически выполняем восстановление при загрузке скрипта
restoreAuth();