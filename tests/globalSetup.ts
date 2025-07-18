export default async function globalSetup() {
  // Настройка глобального окружения для всех тестов
  console.log('🧪 Настройка тестового окружения...');
  
  // Устанавливаем тестовые переменные окружения
  process.env.NODE_ENV = 'test';
  process.env.DISABLE_PUBLISHING = 'true';
  process.env.LOG_LEVEL = 'error';
  
  console.log('✅ Тестовое окружение настроено');
}