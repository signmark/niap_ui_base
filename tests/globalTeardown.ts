export default async function globalTeardown() {
  console.log('🧹 Очистка после тестов...');
  // Здесь можно добавить очистку ресурсов если нужно
  console.log('✅ Очистка завершена');
}