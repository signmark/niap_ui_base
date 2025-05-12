/**
 * Утилиты для генерации контента
 */

/**
 * Генерирует случайную подпись для публикации
 * @returns Случайная подпись
 */
export function generateRandomCaption(): string {
  // Массив возможных заготовок для подписей
  const captions = [
    'Новый день - новые возможности! #stories',
    'Делюсь с вами важной информацией! #новости',
    'Посмотрите, что у нас нового! #update',
    'Интересные новости для вас! #смотри',
    'Важное обновление! #важно',
    'Только для наших подписчиков! #эксклюзив',
    'Не пропустите! #важнаяинформация',
    'Свежие новости! #последниеновости'
  ];
  
  // Выбираем случайную подпись из массива
  const randomIndex = Math.floor(Math.random() * captions.length);
  return captions[randomIndex];
}

/**
 * Форматирует текст для Instagram
 * Обрезает длинный текст и добавляет хэштеги
 * @param text Исходный текст
 * @returns Отформатированный текст
 */
export function formatTextForInstagram(text: string): string {
  // Максимальная длина текста для Instagram
  const MAX_LENGTH = 2200;
  
  // Если текст длиннее максимальной длины, обрезаем и добавляем многоточие
  let formattedText = text.length > MAX_LENGTH
    ? text.substring(0, MAX_LENGTH - 3) + '...'
    : text;
  
  // Добавляем базовые хэштеги, если их нет в тексте
  if (!formattedText.includes('#')) {
    formattedText += '\n\n#instastories #instaupdate';
  }
  
  return formattedText;
}

/**
 * Обрабатывает URL изображения, проверяя его доступность
 * @param url URL изображения
 * @returns Обработанный URL или запасной вариант
 */
export function processImageUrl(url: string): string {
  // Проверяем, что URL начинается с http:// или https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Если URL не содержит протокол, добавляем https://
    return `https://${url}`;
  }
  
  return url;
}