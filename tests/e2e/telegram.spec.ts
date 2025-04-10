import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Проверяем наличие необходимых переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Примеры HTML для тестирования
const testHtmlExamples = [
  {
    name: 'Базовое форматирование',
    html: '<p>Текст с <b>жирным шрифтом</b> и <i>курсивом</i>.</p>'
  },
  {
    name: 'Списки',
    html: `<p>Маркированный список:</p>
<ul>
  <li>Первый пункт</li>
  <li>Второй пункт с <strong>жирным</strong></li>
  <li>Третий пункт с <em>курсивом</em></li>
</ul>`
  },
  {
    name: 'Вложенные теги',
    html: '<p>Текст с <b>жирным и <i>вложенным курсивом</i> внутри</b>.</p>'
  },
  {
    name: 'Ссылки',
    html: '<p>Текст со <a href="https://example.com">ссылкой</a> на сайт.</p>'
  },
  {
    name: 'Незакрытые теги',
    html: '<p>Текст с <b>незакрытым тегом и <i>вложенным</i> форматированием</p>'
  }
];

test.describe('Тестирование API Telegram', () => {
  test.beforeEach(async ({ page }) => {
    // Проверка наличия токена и chat ID
    test.skip(!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID, 
      'Пропуск: Отсутствуют TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в .env');
    
    // Авторизация через стандартный UI
    await page.goto('/auth/login');
    
    // Проверяем, что мы на странице логина
    await expect(page.locator('form')).toBeVisible();

    try {
      // Заполняем форму входа
      await page.fill('input[type="email"]', 'lbrspb@gmail.com');
      await page.fill('input[type="password"]', 'test12345'); // Используйте актуальные тестовые данные
      await page.click('button[type="submit"]');
      
      // Ждем перенаправления на главную страницу
      await page.waitForURL('**/campaigns', { timeout: 10000 });
      console.log('Успешная авторизация через стандартный UI');
    } catch (e) {
      console.log('Не удалось выполнить стандартную авторизацию, пробуем использовать auth-bypass...');
      
      // Альтернативный путь: используем специальный маршрут auth-bypass (если он существует)
      await page.goto('/test/auth-bypass');
      await page.waitForTimeout(2000); // Ждем завершения байпаса авторизации
      
      // Переходим на главную страницу
      await page.goto('/campaigns');
      await page.waitForTimeout(2000);
    }
    
    // Проверяем, что мы авторизованы (ищем что-то, что видно только авторизованным пользователям)
    await expect(page.locator('.layout-header')).toBeVisible({ timeout: 5000 });
  });

  test('проверка страницы тестирования Telegram', async ({ page }) => {
    // Переходим на страницу тестирования Telegram
    await page.goto('/test/telegram');
    
    // Проверяем, что страница загрузилась
    await expect(page).toHaveTitle(/Тест HTML-форматирования для Telegram/);
    
    // Проверяем наличие элементов управления
    await expect(page.locator('textarea#input')).toBeVisible();
    await expect(page.locator('button:has-text("Проверить форматирование")')).toBeVisible();
    await expect(page.locator('button:has-text("Отправить в Telegram")')).toBeVisible();
  });

  test('проверка форматирования HTML через API', async ({ page, request }) => {
    for (const example of testHtmlExamples) {
      console.log(`Тестирование примера: ${example.name}`);
      
      // Отправляем запрос на форматирование HTML
      const response = await request.post('/api/test/telegram/format-html', {
        data: { html: example.html }
      });
      
      // Проверяем успешность запроса
      expect(response.ok()).toBeTruthy();
      
      // Анализируем ответ
      const data = await response.json();
      expect(data.success).toBeTruthy();
      expect(data.formattedHtml).toBeDefined();
      
      // Проверяем, что форматирование выполнено корректно
      // Вывод для анализа
      console.log(`Исходный HTML: ${example.html}`);
      console.log(`Отформатированный HTML: ${data.formattedHtml}`);

      // Проверки для разных типов примеров
      if (example.name.includes('Базовое форматирование')) {
        expect(data.formattedHtml).toContain('<b>');
        expect(data.formattedHtml).toContain('</b>');
        expect(data.formattedHtml).toContain('<i>');
        expect(data.formattedHtml).toContain('</i>');
      } else if (example.name.includes('Списки')) {
        // Проверка преобразования списков в формат Telegram
        expect(data.formattedHtml).toContain('•'); // Символ маркера списка
      } else if (example.name.includes('Ссылки')) {
        expect(data.formattedHtml).toContain('<a href="');
        expect(data.formattedHtml).toContain('</a>');
      } else if (example.name.includes('Незакрытые теги')) {
        // Проверка исправления незакрытых тегов
        expect(data.formattedHtml).toContain('</b>');
      }
    }
  });

  test('отправка сообщения в Telegram через API', async ({ request }) => {
    // Используем простой пример для отправки
    const testHtml = '<b>Тестовое сообщение</b> от Playwright E2E теста';
    
    // Отправляем запрос на отправку сообщения в Telegram
    const response = await request.post('/api/test/telegram-html', {
      data: {
        text: testHtml,
        chatId: TELEGRAM_CHAT_ID,
        token: TELEGRAM_BOT_TOKEN,
        parseMode: 'HTML'
      }
    });
    
    // Проверяем успешность запроса
    expect(response.ok()).toBeTruthy();
    
    // Анализируем ответ
    const data = await response.json();
    expect(data.success).toBeTruthy();
    expect(data.messageId).toBeDefined();
    
    // Проверка наличия URL сообщения
    if (data.messageUrl) {
      console.log(`Сообщение успешно отправлено: ${data.messageUrl}`);
    } else {
      console.log(`Сообщение успешно отправлено, ID: ${data.messageId}`);
    }
  });

  // Тест для отправки изображения с подписью
  test('отправка изображения с HTML-подписью', async ({ request }) => {
    // Тестовые данные
    const imageUrl = 'https://via.placeholder.com/800x400?text=Telegram+Test';
    const captionHtml = '<b>Тестовое изображение</b> с <i>HTML-подписью</i>';
    
    // Отправляем запрос на отправку изображения с подписью
    const response = await request.post('/api/test/telegram-html', {
      data: {
        text: captionHtml,
        imageUrl: imageUrl,
        chatId: TELEGRAM_CHAT_ID,
        token: TELEGRAM_BOT_TOKEN,
        parseMode: 'HTML'
      }
    });
    
    // Проверяем успешность запроса
    expect(response.ok()).toBeTruthy();
    
    // Анализируем ответ
    const data = await response.json();
    expect(data.success).toBeTruthy();
    expect(data.messageId).toBeDefined();
    
    console.log(`Изображение с подписью успешно отправлено, ID: ${data.messageId}`);
  });

  // Тест для проверки веб-интерфейса
  test('отправка HTML через веб-интерфейс', async ({ page }) => {
    // Переходим на страницу тестирования Telegram
    await page.goto('/test/telegram');
    
    // Дожидаемся загрузки страницы
    await page.waitForLoadState('networkidle');
    
    // Выбираем пример HTML
    await page.click('.example:nth-child(3)'); // Выбираем третий пример (маркированный список)
    
    // Проверяем, что текст загрузился в текстовое поле
    const textArea = page.locator('textarea#input');
    await expect(textArea).toHaveValue(/маркированный список/i);
    
    // Нажимаем кнопку "Проверить форматирование"
    await page.click('button:has-text("Проверить форматирование")');
    
    // Ждем результат
    await page.waitForSelector('#result:not(:empty)');
    
    // Проверяем, что результат отображается
    const resultText = await page.locator('#result').textContent();
    expect(resultText).toContain('Результаты проверки форматирования');
    
    // Нажимаем кнопку "Отправить в Telegram"
    await page.click('button:has-text("Отправить в Telegram")');
    
    // Ждем результат отправки
    await page.waitForSelector('#result:has-text("Сообщение успешно отправлено")');
    
    // Проверяем успешность отправки
    const sendResult = await page.locator('#result').textContent();
    expect(sendResult).toContain('Сообщение успешно отправлено');
    expect(sendResult).toContain('Message ID:');
  });
});

// Тесты для вспомогательных функций форматирования
test.describe('Тестирование вспомогательных функций Telegram', () => {
  test('проверка исправления незакрытых тегов', async ({ request }) => {
    const testHtml = '<b>Текст с незакрытым тегом';
    
    // Отправляем запрос на исправление незакрытых тегов
    const response = await request.post('/api/test/telegram/fix-unclosed-tags', {
      data: { html: testHtml }
    });
    
    // Проверяем успешность запроса
    expect(response.ok()).toBeTruthy();
    
    // Анализируем ответ
    const data = await response.json();
    expect(data.success).toBeTruthy();
    expect(data.fixedHtml).toBeDefined();
    expect(data.fixedHtml).toContain('</b>');
    
    console.log(`Исходный HTML: ${testHtml}`);
    console.log(`Исправленный HTML: ${data.fixedHtml}`);
  });
  
  test('проверка форматирования списков', async ({ request }) => {
    const testHtml = `<ul>
  <li>Первый пункт</li>
  <li>Второй пункт</li>
</ul>`;
    
    // Отправляем запрос на форматирование списков
    const response = await request.post('/api/test/telegram/format-lists', {
      data: { html: testHtml }
    });
    
    // Проверяем успешность запроса
    expect(response.ok()).toBeTruthy();
    
    // Анализируем ответ
    const data = await response.json();
    expect(data.success).toBeTruthy();
    expect(data.formattedHtml).toBeDefined();
    expect(data.formattedHtml).toContain('•');
    
    console.log(`Исходный HTML: ${testHtml}`);
    console.log(`Отформатированный HTML: ${data.formattedHtml}`);
  });
  
  test('проверка обработки эмодзи', async ({ request }) => {
    const testHtml = 'Текст с эмодзи 👍 и <b>форматированием</b> 🎉';
    
    // Отправляем запрос на проверку обработки эмодзи
    const response = await request.post('/api/test/telegram/format-emoji', {
      data: { html: testHtml }
    });
    
    // Проверяем успешность запроса
    expect(response.ok()).toBeTruthy();
    
    // Анализируем ответ
    const data = await response.json();
    expect(data.success).toBeTruthy();
    expect(data.formattedHtml).toBeDefined();
    expect(data.formattedHtml).toContain('👍');
    expect(data.formattedHtml).toContain('🎉');
    
    console.log(`Исходный HTML: ${testHtml}`);
    console.log(`Отформатированный HTML: ${data.formattedHtml}`);
  });
});