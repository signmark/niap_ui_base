/**
 * Тесты обработки данных - критично для целостности системы
 */

describe('Data Processing Tests', () => {
  test('должен валидировать и очищать пользовательский ввод', () => {
    function sanitizeUserInput(input, type = 'text') {
      if (input === null || input === undefined) {
        return '';
      }
      
      let sanitized = String(input).trim();
      
      switch (type) {
        case 'text':
          // Удаляем опасные HTML теги
          sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
          sanitized = sanitized.replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
          sanitized = sanitized.replace(/javascript:/gi, '');
          sanitized = sanitized.replace(/on\w+\s*=/gi, '');
          break;
          
        case 'email':
          // Удаляем HTML теги сначала, потом оставляем только допустимые символы для email
          sanitized = sanitized.replace(/<[^>]*>/g, '');
          sanitized = sanitized.replace(/[^a-zA-Z0-9._%+-@]/g, '');
          break;
          
        case 'phone':
          // Оставляем только цифры, плюс, дефисы, скобки
          sanitized = sanitized.replace(/[^0-9+\-().\s]/g, '');
          break;
          
        case 'url':
          // Базовая валидация URL
          try {
            const url = new URL(sanitized);
            if (!['http:', 'https:'].includes(url.protocol)) {
              return '';
            }
            sanitized = url.toString();
          } catch {
            return '';
          }
          break;
          
        case 'html':
          // Оставляем только безопасные HTML теги
          const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3'];
          const tagRegex = /<(\/?)([\w]+)[^>]*>/g;
          sanitized = sanitized.replace(tagRegex, (match, closing, tagName) => {
            if (allowedTags.includes(tagName.toLowerCase())) {
              return `<${closing}${tagName.toLowerCase()}>`;
            }
            return '';
          });
          break;
      }
      
      return sanitized;
    }

    // Тест очистки текста
    const maliciousText = '<script>alert("xss")</script>Нормальный текст<iframe src="evil.com"></iframe>';
    const cleanText = sanitizeUserInput(maliciousText, 'text');
    expect(cleanText).toBe('Нормальный текст');
    expect(cleanText).not.toContain('<script>');
    expect(cleanText).not.toContain('<iframe>');

    // Тест очистки email
    const dirtyEmail = 'user@example.com<script>alert(1)</script>';
    const cleanEmail = sanitizeUserInput(dirtyEmail, 'email');
    expect(cleanEmail).toBe('user@example.com');

    // Тест очистки URL
    const validUrl = sanitizeUserInput('https://example.com/path', 'url');
    expect(validUrl).toBe('https://example.com/path');
    
    const invalidUrl = sanitizeUserInput('javascript:alert(1)', 'url');
    expect(invalidUrl).toBe('');

    // Тест HTML с разрешенными тегами
    const htmlInput = '<p>Текст</p><script>evil()</script><strong>жирный</strong>';
    const cleanHtml = sanitizeUserInput(htmlInput, 'html');
    expect(cleanHtml).toBe('<p>Текст</p><strong>жирный</strong>');
  });

  test('должен обрабатывать JSON данные безопасно', () => {
    function safeJsonParse(jsonString, defaultValue = null) {
      if (!jsonString || typeof jsonString !== 'string') {
        return defaultValue;
      }
      
      // Проверяем размер JSON
      if (jsonString.length > 1024 * 1024) { // 1MB лимит
        throw new Error('JSON слишком большой');
      }
      
      try {
        const parsed = JSON.parse(jsonString);
        
        // Проверяем глубину вложенности
        const checkDepth = (obj, depth = 0) => {
          if (depth > 10) {
            throw new Error('JSON слишком глубоко вложен');
          }
          
          if (obj && typeof obj === 'object') {
            for (const key in obj) {
              checkDepth(obj[key], depth + 1);
            }
          }
        };
        
        checkDepth(parsed);
        return parsed;
      } catch (error) {
        if (error.message.includes('глубоко') || error.message.includes('большой')) {
          throw error;
        }
        return defaultValue;
      }
    }

    // Валидный JSON
    const validJson = '{"name": "test", "value": 123}';
    const parsed = safeJsonParse(validJson);
    expect(parsed.name).toBe('test');
    expect(parsed.value).toBe(123);

    // Невалидный JSON
    const invalidJson = '{"name": "test"';
    const parsedInvalid = safeJsonParse(invalidJson, {});
    expect(parsedInvalid).toEqual({});

    // Слишком глубоко вложенный JSON
    let deepJson = '{"a":';
    for (let i = 0; i < 15; i++) {
      deepJson += '{"b":';
    }
    deepJson += '1';
    for (let i = 0; i < 15; i++) {
      deepJson += '}';
    }
    deepJson += '}';

    expect(() => safeJsonParse(deepJson)).toThrow('слишком глубоко вложен');
  });

  test('должен корректно преобразовывать типы данных', () => {
    function convertDataTypes(data, schema) {
      const converted = {};
      
      for (const [key, config] of Object.entries(schema)) {
        const value = data[key];
        
        if (value === undefined || value === null) {
          if (config.required) {
            throw new Error(`Поле ${key} обязательно`);
          }
          converted[key] = config.default !== undefined ? config.default : null;
          continue;
        }
        
        try {
          switch (config.type) {
            case 'string':
              converted[key] = String(value).trim();
              if (config.maxLength && converted[key].length > config.maxLength) {
                converted[key] = converted[key].substring(0, config.maxLength);
              }
              break;
              
            case 'number':
              const num = Number(value);
              if (isNaN(num)) {
                throw new Error(`${key} должно быть числом`);
              }
              if (config.min !== undefined && num < config.min) {
                throw new Error(`${key} должно быть >= ${config.min}`);
              }
              if (config.max !== undefined && num > config.max) {
                throw new Error(`${key} должно быть <= ${config.max}`);
              }
              converted[key] = num;
              break;
              
            case 'boolean':
              if (typeof value === 'boolean') {
                converted[key] = value;
              } else {
                const str = String(value).toLowerCase();
                converted[key] = ['true', '1', 'yes', 'on'].includes(str);
              }
              break;
              
            case 'array':
              if (Array.isArray(value)) {
                converted[key] = value;
              } else {
                converted[key] = [value];
              }
              if (config.maxItems && converted[key].length > config.maxItems) {
                converted[key] = converted[key].slice(0, config.maxItems);
              }
              break;
              
            case 'date':
              const date = new Date(value);
              if (isNaN(date.getTime())) {
                throw new Error(`${key} должно быть валидной датой`);
              }
              converted[key] = date.toISOString();
              break;
              
            default:
              converted[key] = value;
          }
        } catch (error) {
          if (config.required) {
            throw error;
          }
          converted[key] = config.default !== undefined ? config.default : null;
        }
      }
      
      return converted;
    }

    const schema = {
      name: { type: 'string', required: true, maxLength: 50 },
      age: { type: 'number', min: 0, max: 150 },
      active: { type: 'boolean', default: false },
      tags: { type: 'array', maxItems: 5 },
      created: { type: 'date' }
    };

    const rawData = {
      name: '  Тестовое имя  ',
      age: '25',
      active: 'true',
      tags: 'single-tag',
      created: '2023-01-01T00:00:00Z'
    };

    const converted = convertDataTypes(rawData, schema);
    
    expect(converted.name).toBe('Тестовое имя');
    expect(converted.age).toBe(25);
    expect(converted.active).toBe(true);
    expect(converted.tags).toEqual(['single-tag']);
    expect(converted.created).toBe('2023-01-01T00:00:00.000Z');

    // Тест с невалидными данными
    const invalidData = { age: 'not-a-number' };
    expect(() => convertDataTypes(invalidData, schema)).toThrow('name обязательно');
  });

  test('должен обрабатывать пагинацию данных', () => {
    function createPaginator(totalItems, pageSize = 10) {
      return {
        getPage(pageNumber) {
          if (pageNumber < 1) pageNumber = 1;
          
          const totalPages = Math.ceil(totalItems / pageSize);
          if (pageNumber > totalPages) pageNumber = totalPages;
          
          const offset = (pageNumber - 1) * pageSize;
          const limit = Math.min(pageSize, totalItems - offset);
          
          return {
            pageNumber,
            pageSize,
            totalPages,
            totalItems,
            offset,
            limit,
            hasNext: pageNumber < totalPages,
            hasPrev: pageNumber > 1,
            nextPage: pageNumber < totalPages ? pageNumber + 1 : null,
            prevPage: pageNumber > 1 ? pageNumber - 1 : null
          };
        },
        
        getOffsetLimit(pageNumber) {
          const page = this.getPage(pageNumber);
          return { offset: page.offset, limit: page.limit };
        }
      };
    }

    const paginator = createPaginator(95, 10);
    
    // Первая страница
    const firstPage = paginator.getPage(1);
    expect(firstPage.pageNumber).toBe(1);
    expect(firstPage.offset).toBe(0);
    expect(firstPage.limit).toBe(10);
    expect(firstPage.hasNext).toBe(true);
    expect(firstPage.hasPrev).toBe(false);
    expect(firstPage.totalPages).toBe(10);

    // Последняя страница
    const lastPage = paginator.getPage(10);
    expect(lastPage.pageNumber).toBe(10);
    expect(lastPage.offset).toBe(90);
    expect(lastPage.limit).toBe(5); // Остаток от 95
    expect(lastPage.hasNext).toBe(false);
    expect(lastPage.hasPrev).toBe(true);

    // Несуществующая страница
    const invalidPage = paginator.getPage(15);
    expect(invalidPage.pageNumber).toBe(10); // Автоматически корректируется
  });

  test('должен кэшировать данные с TTL', () => {
    function createTTLCache(defaultTTL = 5000) {
      const cache = new Map();
      
      return {
        set(key, value, ttl = defaultTTL) {
          const expiresAt = Date.now() + ttl;
          cache.set(key, { value, expiresAt });
        },
        
        get(key) {
          const item = cache.get(key);
          if (!item) return null;
          
          if (Date.now() > item.expiresAt) {
            cache.delete(key);
            return null;
          }
          
          return item.value;
        },
        
        has(key) {
          return this.get(key) !== null;
        },
        
        delete(key) {
          return cache.delete(key);
        },
        
        clear() {
          cache.clear();
        },
        
        size() {
          return cache.size;
        },
        
        cleanup() {
          const now = Date.now();
          let cleaned = 0;
          for (const [key, item] of cache.entries()) {
            if (now > item.expiresAt) {
              cache.delete(key);
              cleaned++;
            }
          }
          return cleaned;
        }
      };
    }

    const cache = createTTLCache(100); // 100ms TTL
    
    // Базовые операции
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
    expect(cache.has('key1')).toBe(true);
    
    // Кастомный TTL
    cache.set('key2', 'value2', 50);
    
    // Ждем истечения TTL будет проверено в cleanup
    expect(cache.get('key1')).toBe('value1'); // Пока еще валиден
    
    // Очистка кэша
    cache.set('key3', 'value3');
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  test('должен обрабатывать массовые операции', () => {
    function processBatch(items, batchSize = 10, processorFn) {
      if (!Array.isArray(items)) {
        throw new Error('Items должен быть массивом');
      }
      
      const results = [];
      const errors = [];
      
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        try {
          const batchResults = batch.map((item, index) => {
            try {
              return {
                index: i + index,
                item,
                result: processorFn(item, i + index),
                success: true
              };
            } catch (error) {
              return {
                index: i + index,
                item,
                error: error.message,
                success: false
              };
            }
          });
          
          results.push(...batchResults);
        } catch (error) {
          errors.push({
            batchStart: i,
            batchEnd: Math.min(i + batchSize - 1, items.length - 1),
            error: error.message
          });
        }
      }
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      return {
        total: items.length,
        processed: results.length,
        successful: successful.length,
        failed: failed.length,
        successRate: successful.length / items.length,
        results: successful.map(r => r.result),
        errors: failed.concat(errors.map(e => ({ error: e.error })))
      };
    }

    const testItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    
    // Процессор который удваивает числа, но падает на четных
    const processor = (item) => {
      if (item % 2 === 0) {
        throw new Error(`Четное число: ${item}`);
      }
      return item * 2;
    };

    const result = processBatch(testItems, 3, processor);
    
    expect(result.total).toBe(11);
    expect(result.successful).toBe(6); // 1,3,5,7,9,11
    expect(result.failed).toBe(5); // 2,4,6,8,10
    expect(result.results).toEqual([2, 6, 10, 14, 18, 22]);
    expect(result.successRate).toBe(6/11);
  });
});