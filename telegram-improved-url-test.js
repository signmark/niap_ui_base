/**
 * Скрипт для тестирования улучшенной функциональности генерации URL в TelegramService
 * Запуск: node telegram-improved-url-test.js
 */
import 'dotenv/config';
import { telegramService } from './server/services/social/telegram-service.js';
import { fixUnclosedTags } from './server/utils/telegram-formatter.js';
import { log } from './server/utils/logger.js';
import { sleep } from './server/utils/common-utils.js';

async function testTelegramURLGeneration() {
  try {
    // Получаем данные из переменных окружения
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      throw new Error('Необходимо указать TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в переменных окружения');
    }

    // Инициализируем сервис с данными из переменных окружения
    telegramService.initialize(token, chatId);

    log('Тестирование получения информации о чате...');
    const chatInfo = await telegramService.getChatInfo();
    log(`Получена информация о чате: ID=${chatInfo.id}, Username=${chatInfo.username || 'нет'}, Type=${chatInfo.type}`);

    // Тестирование отправки текстового сообщения
    log('\nТест 1: Отправка обычного текстового сообщения');
    const textResult = await telegramService.sendTextMessage(
      '<b>Тестовое сообщение</b>\n\nПроверка метода <i>generateMessageUrl</i> в <u>TelegramService</u>'
    );
    log(`Результат: ${textResult.success ? 'Успешно' : 'Ошибка'}`);
    log(`ID сообщения: ${textResult.messageId}`);
    log(`URL сообщения: ${textResult.messageUrl}`);

    // Ожидаем секунду между запросами
    await sleep(1000);

    // Тестирование отправки изображения с подписью
    log('\nТест 2: Отправка изображения с подписью');
    const imageResult = await telegramService.sendImage(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png', // Надежное тестовое изображение
      '<b>Тестовое изображение</b>\n\nПроверка метода <i>generateMessageUrl</i> для изображений'
    );
    log(`Результат: ${imageResult.success ? 'Успешно' : 'Ошибка'}`);
    log(`ID сообщения: ${imageResult.messageId}`);
    log(`URL сообщения: ${imageResult.messageUrl}`);

    // Ожидаем секунду между запросами
    await sleep(1000);

    // Тестирование отправки группы изображений
    log('\nТест 3: Отправка группы изображений');
    const mediaGroupResult = await telegramService.sendMediaGroup(
      [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Unofficial_JavaScript_logo_2.svg/240px-Unofficial_JavaScript_logo_2.svg.png',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Typescript_logo_2020.svg/240px-Typescript_logo_2020.svg.png',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/240px-React-icon.svg.png'
      ],
      '<b>Тестовая группа изображений</b>\n\nПроверка метода <i>generateMessageUrl</i> для групп изображений'
    );
    log(`Результат: ${mediaGroupResult.success ? 'Успешно' : 'Ошибка'}`);
    log(`ID сообщений: ${mediaGroupResult.messageIds.join(', ')}`);
    log(`URL первого сообщения в группе: ${mediaGroupResult.messageUrl}`);

    // Ожидаем секунду между запросами
    await sleep(1000);

    // Тестирование отправки сложного HTML с нашим улучшенным форматированием
    log('\nТест 4: Отправка сложного HTML-контента');
    
    // Создаем упрощенный HTML с только поддерживаемыми в Telegram тегами
    const complexHtml = `
<b>Заголовок с жирным форматированием</b>

<b>Первый абзац с жирным текстом</b>, который демонстрирует работу нового форматирования.

<i>Второй абзац с курсивом</i>, для проверки правильности обработки абзаца.

<b>Третий абзац с <i>вложенным форматированием</i> для проверки</b> правильности обработки.

• <b>Элемент списка 1</b> с форматированием
• <i>Элемент списка 2</i> с другим форматированием
• Обычный элемент списка 3

<u>Четвертый абзац с подчеркиванием</u> для проверки дополнительных форматирований.

<b>Финальный текст с жирным форматированием</b>
`;

    // Отправляем сложный HTML-контент
    const complexResult = await telegramService.sendRawHtmlToTelegram(complexHtml);
    log(`Результат: ${complexResult.success ? 'Успешно' : 'Ошибка'}`);
    log(`ID сообщения: ${complexResult.messageId}`);
    log(`URL сообщения: ${complexResult.messageUrl}`);

    log('\nТестирование успешно завершено!');
  } catch (error) {
    log(`Ошибка при тестировании: ${error.message}`);
    log(error.stack);
  }
}

// Запускаем тесты
testTelegramURLGeneration();