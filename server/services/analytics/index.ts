/**
 * Главный модуль аналитики, экспортирующий все функции для работы с аналитикой социальных сетей
 */

// Экспортируем утилиты для извлечения идентификаторов из URL
export * from './url-extractor';

// Экспортируем функции для получения аналитики из различных социальных сетей
export * from './telegram-analytics';
export * from './vk-analytics';
export * from './instagram-analytics';
export * from './facebook-analytics';

// Экспортируем данные fallback для случаев недоступности Directus
export * from './fallback-data';

// СТАРЫЕ СЕРВИСЫ АНАЛИТИКИ ОТКЛЮЧЕНЫ - ИСПОЛЬЗУЕТСЯ ТОЛЬКО НОВЫЙ РОУТ В routes.ts
// export * from './analytics-service';
// export * from './analytics-service-fixed';