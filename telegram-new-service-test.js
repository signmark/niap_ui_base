/**
 * Тест нового сервиса Telegram
 * 
 * Скрипт для тестирования нашего нового сервиса для Telegram
 * Отправляет тестовое сообщение с форматированием в Telegram
 * 
 * Запуск: node telegram-new-service-test.js
 */

import { formatHtmlForTelegram } from './server/utils/telegram-formatter.js';
import axios from 'axios';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Получаем данные из .env или из аргументов командной строки
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEfbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002302366310';

// Тестовый HTML-текст с форматированием
const testHtml = `<p>В ходе предыдущего <strong>обсуждения</strong> мы рассмотрели причины, по которым завтрак является наиболее важным приемом пищи, и его влияние на уровень энергии, метаболизм и контроль аппетита. 😊</p><p>В настоящее время целесообразно проанализировать роль перекусов, поскольку они могут как способствовать поддержанию здоровья <strong>"хорошего"</strong>, так и незаметно наносить вред фигуре и самочувствию. 🍎 Перекусы помогают избежать резких колебаний уровня сахара в крови, поддерживают энергетический баланс и предотвращают чрезмерное чувство голода, которое зачастую приводит к переедания во время основных приемов пищи. 🚫</p><p>Следует, однако, понимать, что не все перекусы одинаково полезны. ⚠️ К нежелательным перекусам относятся сладости, булочки, печенье, чипсы и прочие продукты фастфуда. 🍩 Они вызывают быстрое повышение уровня сахара в крови, обеспечивая кратковременный прилив энергии, но столь же стремительно приводят к усталости, усилению аппетита и накоплению жировых отложений. </p><p><em>Полезными перекусами являются те, которые обеспечивают чувство сытости, стабильный энергетический баланс и поступление питательных веществ.</em> 🥗 К ним можно отнести орехи, ягоды, фрукты, овощи с хумусом, яйца, греческий йогурт, творог, цельнозерновые хлебцы с авокадо или ореховой пастой. 🥑 🍞 🥒</p><p>Рекомендации по правильному перекусыванию: 📝</p><ul><li>Выбирайте перекусы, содержащие белок, полезные жиры и клетчатку – они дольше обеспечивают чувство сытости и поддерживают обмен веществ. 👍</li><li>Не употребляйте пищу автоматически – перекус необходим, если вы действительно испытываете легкое чувство голода, а не просто по привычке или от скуки. 🤔</li><li>Контролируйте размер порции – горсть орехов полезна, но если съесть полпакета, это уже станет полноценным приемом пищи. 🥜</li></ul><p>Если вы стремитесь разобраться в вопросах питания, избавиться от вредных привычек и выстроить комфортную систему питания, присоединяйтесь к нашему марафону на нашем телеграм-канале. 📱</p>`;

/**
 * Отправляет HTML-сообщение в Telegram, используя новый форматтер
 * @param {string} html HTML-текст для отправки
 * @returns {Promise<Object>} Результат отправки
 */
async function sendTelegramMessage(html) {
  // Форматируем HTML для Telegram
  const formattedHtml = formatHtmlForTelegram(html);
  
  console.log('Исходный HTML:', html.substring(0, 100) + '...');
  console.log('Отформатированный HTML:', formattedHtml.substring(0, 100) + '...');
  
  // Отправляем запрос
  try {
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: formattedHtml,
      parse_mode: 'HTML'
    });
    
    console.log('Ответ от Telegram API:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Отправляет несколько сообщений для проверки всех типов форматирования
 */
async function runTests() {
  console.log('=== ТЕСТ 1: ОСНОВНОЙ HTML-ТЕКСТ ===');
  try {
    await sendTelegramMessage(testHtml);
    console.log('✅ Тест 1 успешно пройден');
  } catch (error) {
    console.error('❌ Тест 1 не пройден:', error.message);
  }
  
  console.log('\n=== ТЕСТ 2: ПОСЛЕДОВАТЕЛЬНЫЕ ТЕГИ ===');
  const sequentialTags = '<b>Жирный текст</b> <i>Курсивный текст</i> <u>Подчеркнутый текст</u> <s>Зачеркнутый текст</s>';
  try {
    await sendTelegramMessage(sequentialTags);
    console.log('✅ Тест 2 успешно пройден');
  } catch (error) {
    console.error('❌ Тест 2 не пройден:', error.message);
  }
  
  console.log('\n=== ТЕСТ 3: ВЛОЖЕННЫЕ ТЕГИ ===');
  const nestedTags = '<b>Жирный <i>жирный курсив</i> просто жирный</b> <i>курсив <u>курсив подчеркнутый</u> просто курсив</i>';
  try {
    await sendTelegramMessage(nestedTags);
    console.log('✅ Тест 3 успешно пройден');
  } catch (error) {
    console.error('❌ Тест 3 не пройден:', error.message);
  }
  
  console.log('\n=== ТЕСТ 4: НЕПОЗВОЛИТЕЛЬНЫЕ ВЛОЖЕННОСТИ ===');
  const invalidNesting = '<b>Жирный <i>жирный курсив</b> просто курсив</i> обычный текст';
  try {
    await sendTelegramMessage(invalidNesting);
    console.log('✅ Тест 4 успешно пройден');
  } catch (error) {
    console.error('❌ Тест 4 не пройден:', error.message);
  }
  
  console.log('\n=== ТЕСТ 5: СПИСКИ И ЭМОДЗИ ===');
  const listAndEmoji = '<p>Пункты списка:</p><ul><li>Первый пункт 🍎</li><li>Второй пункт 🍌</li><li>Третий пункт 🍊</li></ul>';
  try {
    await sendTelegramMessage(listAndEmoji);
    console.log('✅ Тест 5 успешно пройден');
  } catch (error) {
    console.error('❌ Тест 5 не пройден:', error.message);
  }
}

// Запускаем тесты
console.log('Запуск тестов нового сервиса Telegram...');
runTests().then(() => {
  console.log('\nВсе тесты завершены. Проверьте результаты в Telegram.');
}).catch(error => {
  console.error('Произошла ошибка при выполнении тестов:', error);
});