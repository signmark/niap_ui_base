/**
 * Простой тест исправленной функции анализа сайтов
 */

import axios from 'axios';

async function extractFullSiteContent(url) {
  try {
    console.log(`Выполняется глубокий парсинг сайта: ${url}`);
    
    // Нормализуем URL, добавляя протокол, если его нет
    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    const response = await axios.get(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 15000, // Увеличен таймаут до 15 секунд
      maxContentLength: 5 * 1024 * 1024 // Максимум 5MB контента
    });
    
    // Разбираем HTML
    const htmlContent = response.data;
    
    // Извлекаем важные метаданные и структурированный контент
    let content = '';
    
    // 1. Получаем title и meta
    const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      content += `TITLE: ${titleMatch[1]}\n\n`;
    }
    
    const descriptionMatch = htmlContent.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"[^>]*>/i) || 
                             htmlContent.match(/<meta[^>]*content="([^"]+)"[^>]*name="description"[^>]*>/i);
    
    if (descriptionMatch && descriptionMatch[1]) {
      content += `DESCRIPTION: ${descriptionMatch[1]}\n\n`;
    }
    
    const keywordsMatch = htmlContent.match(/<meta[^>]*name="keywords"[^>]*content="([^"]+)"[^>]*>/i) ||
                          htmlContent.match(/<meta[^>]*content="([^"]+)"[^>]*name="keywords"[^>]*>/i);
    
    if (keywordsMatch && keywordsMatch[1]) {
      content += `KEYWORDS: ${keywordsMatch[1]}\n\n`;
    }
    
    // 2. Извлекаем заголовки (h1, h2, h3)
    content += `HEADINGS:\n`;
    
    const h1Matches = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/gis);
    if (h1Matches) {
      h1Matches.forEach(h => {
        const text = h.replace(/<[^>]*>/g, '').trim();
        if (text) content += `H1: ${text}\n`;
      });
    }
    
    const h2Matches = htmlContent.match(/<h2[^>]*>(.*?)<\/h2>/gis);
    if (h2Matches) {
      h2Matches.forEach(h => {
        const text = h.replace(/<[^>]*>/g, '').trim();
        if (text) content += `H2: ${text}\n`;
      });
    }
    
    const h3Matches = htmlContent.match(/<h3[^>]*>(.*?)<\/h3>/gis);
    if (h3Matches) {
      h3Matches.forEach(h => {
        const text = h.replace(/<[^>]*>/g, '').trim();
        if (text) content += `H3: ${text}\n`;
      });
    }
    
    content += `\n`;
    
    // 3. Извлекаем основной контент (параграфы) - ограничиваем количество для производительности
    content += `CONTENT:\n`;
    
    const paragraphs = htmlContent.match(/<p[^>]*>(.*?)<\/p>/gis);
    if (paragraphs) {
      const maxParagraphs = Math.min(paragraphs.length, 50); // Максимум 50 параграфов
      for (let i = 0; i < maxParagraphs; i++) {
        const text = paragraphs[i].replace(/<[^>]*>/g, '').trim();
        if (text && text.length > 10) { // Игнорируем короткие параграфы
          content += `${text}\n\n`;
        }
      }
    }
    
    // 4. Извлекаем списки (ul, ol, li) - ограничиваем количество
    const lists = htmlContent.match(/<[uo]l[^>]*>.*?<\/[uo]l>/gis);
    if (lists && lists.length > 0) {
      content += `LISTS:\n`;
      
      const maxLists = Math.min(lists.length, 10); // Максимум 10 списков
      for (let i = 0; i < maxLists; i++) {
        const items = lists[i].match(/<li[^>]*>(.*?)<\/li>/gis);
        if (items) {
          const maxItems = Math.min(items.length, 20); // Максимум 20 элементов списка
          for (let j = 0; j < maxItems; j++) {
            const text = items[j].replace(/<[^>]*>/g, '').trim();
            if (text) content += `- ${text}\n`;
          }
          content += `\n`;
        }
      }
    }
    
    // Ограничиваем общий размер контента для производительности
    if (content.length > 20000) {
      content = content.substring(0, 20000) + '...\n[КОНТЕНТ ОБРЕЗАН ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ]';
    }
    
    console.log(`Успешно извлечен контент для URL: ${url}, размер: ${content.length} символов`);
    
    if (content.length < 500) {
      // Если удалось извлечь мало контента, возможно сайт использует JS для рендеринга
      console.log(`Извлечено мало контента (${content.length} символов), возможно сайт требует JS-рендеринг`);
      // Дополняем исходным HTML, чтобы AI мог проанализировать структуру (ограничиваем размер)
      content += `\n\nRAW HTML STRUCTURE (для анализа):\n${htmlContent.substring(0, 3000)}...`;
    }
    
    return content;
  } catch (error) {
    console.error(`Ошибка при глубоком анализе сайта ${url}:`, error.message);
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function testSiteAnalysis() {
  const testUrl = 'https://www.cybersport.ru/tournaments/cs2/blast-tv-major-2025';
  
  console.log('=== ТЕСТ ОПТИМИЗИРОВАННОЙ ФУНКЦИИ АНАЛИЗА САЙТОВ ===');
  console.log(`Тестируем URL: ${testUrl}`);
  console.log('Засекаем время...\n');
  
  const startTime = Date.now();
  
  try {
    const result = await extractFullSiteContent(testUrl);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`\n=== РЕЗУЛЬТАТ ТЕСТА ===`);
    console.log(`Время выполнения: ${duration}ms`);
    console.log(`Размер извлеченного контента: ${result.length} символов`);
    console.log(`Успешно: ${!result.startsWith('Error:')}`);
    
    if (result.startsWith('Error:')) {
      console.log('ОШИБКА:', result);
    } else {
      console.log('\nПример извлеченного контента:');
      console.log(result.substring(0, 500) + '...');
    }
    
    // Проверяем производительность
    if (duration > 30000) {
      console.log('⚠️  ПРЕДУПРЕЖДЕНИЕ: Анализ занял больше 30 секунд');
    } else if (duration > 15000) {
      console.log('⚠️  ЗАМЕЧАНИЕ: Анализ занял больше 15 секунд');
    } else {
      console.log('✅ Производительность в норме');
    }
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`\n=== ОШИБКА ТЕСТА ===`);
    console.log(`Время до ошибки: ${duration}ms`);
    console.log(`Ошибка:`, error.message);
  }
}

// Запуск теста
testSiteAnalysis();