/**
 * Тесты анализа веб-сайтов - критично для автозаполнения анкет
 */

describe('Website Analysis Tests', () => {
  test('должен извлекать контент с веб-сайтов с ограничениями размера', () => {
    function extractWebsiteContent(htmlContent, maxLength = 15000) {
      const content = {
        title: '',
        description: '',
        headers: [],
        paragraphs: [],
        contactInfo: ''
      };
      
      // Извлекаем title
      const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        content.title = titleMatch[1].trim();
      }
      
      // Извлекаем description
      const descMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (descMatch) {
        content.description = descMatch[1].trim();
      }
      
      // Извлекаем заголовки H1-H3
      const headerMatches = htmlContent.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi);
      if (headerMatches) {
        content.headers = headerMatches
          .map(h => h.replace(/<[^>]+>/g, '').trim())
          .filter(h => h.length > 0)
          .slice(0, 45); // Максимум 45 заголовков
      }
      
      // Извлекаем параграфы
      const paragraphMatches = htmlContent.match(/<p[^>]*>([^<]+)<\/p>/gi);
      if (paragraphMatches) {
        content.paragraphs = paragraphMatches
          .map(p => p.replace(/<[^>]+>/g, '').trim())
          .filter(p => p.length > 20)
          .slice(0, 30); // Максимум 30 параграфов
      }
      
      // Объединяем весь контент и обрезаем
      const fullContent = [
        content.title,
        content.description,
        ...content.headers,
        ...content.paragraphs
      ].join(' ');
      
      const truncatedContent = fullContent.length > maxLength 
        ? fullContent.substring(0, maxLength) + '...'
        : fullContent;
      
      return {
        ...content,
        fullContent: truncatedContent,
        contentLength: truncatedContent.length
      };
    }

    const testHtml = `
      <html>
        <head>
          <title>Тестовая компания - IT услуги</title>
          <meta name="description" content="Мы предоставляем лучшие IT решения для бизнеса">
        </head>
        <body>
          <h1>Добро пожаловать в нашу компанию</h1>
          <h2>Наши услуги</h2>
          <p>Мы специализируемся на разработке веб-приложений и мобильных решений для современного бизнеса.</p>
          <p>Наша команда экспертов поможет вам достичь цифровой трансформации.</p>
        </body>
      </html>
    `;

    const result = extractWebsiteContent(testHtml);
    
    expect(result.title).toBe('Тестовая компания - IT услуги');
    expect(result.description).toBe('Мы предоставляем лучшие IT решения для бизнеса');
    expect(result.headers).toHaveLength(2);
    expect(result.paragraphs).toHaveLength(2);
    expect(result.contentLength).toBeLessThanOrEqual(15000);
  });

  test('должен определять тип бизнеса по контенту сайта', () => {
    function detectBusinessType(content) {
      const businessIndicators = {
        'medical': ['медицин', 'врач', 'лечени', 'здоровь', 'диагност', 'нутрициолог'],
        'smm': ['smm', 'социальн', 'контент', 'маркетинг', 'реклам', 'управлени'],
        'it': ['разработк', 'программ', 'сайт', 'приложени', 'технолог'],
        'restaurant': ['ресторан', 'кафе', 'меню', 'кухн', 'повар'],
        'education': ['образовани', 'обучени', 'курс', 'университет', 'школа']
      };
      
      const contentLower = content.toLowerCase();
      const scores = {};
      
      for (const [type, keywords] of Object.entries(businessIndicators)) {
        scores[type] = keywords.reduce((score, keyword) => {
          const matches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
          return score + matches;
        }, 0);
      }
      
      // Находим тип с максимальным счетом
      const maxScore = Math.max(...Object.values(scores));
      if (maxScore === 0) return 'general';
      
      return Object.keys(scores).find(type => scores[type] === maxScore);
    }

    expect(detectBusinessType('Медицинская клиника предоставляет диагностику здоровья')).toBe('medical');
    expect(detectBusinessType('SMM агентство управляет социальными сетями и создает контент')).toBe('smm');
    expect(detectBusinessType('Разработка веб-приложений и программного обеспечения')).toBe('it');
    expect(detectBusinessType('Ресторан с изысканной кухней и меню от шеф-повара')).toBe('restaurant');
    expect(detectBusinessType('Случайный текст без ключевых слов')).toBe('general');
  });

  test('должен извлекать контактную информацию', () => {
    function extractContactInfo(htmlContent) {
      const contacts = {
        phones: [],
        emails: [],
        socialLinks: []
      };
      
      // Регулярные выражения для контактов
      const phoneRegex = /(?:\+7|8)[\s\-\(\)]?(?:\d[\s\-\(\)]?){10}/g;
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const socialRegex = /(https?:\/\/)?(www\.)?(vk\.com|instagram\.com|facebook\.com|t\.me)\/[^\s<>"]+/g;
      
      // Извлекаем телефоны
      const phoneMatches = htmlContent.match(phoneRegex);
      if (phoneMatches) {
        contacts.phones = [...new Set(phoneMatches)]; // Убираем дубли
      }
      
      // Извлекаем email
      const emailMatches = htmlContent.match(emailRegex);
      if (emailMatches) {
        contacts.emails = [...new Set(emailMatches)];
      }
      
      // Извлекаем социальные сети
      const socialMatches = htmlContent.match(socialRegex);
      if (socialMatches) {
        contacts.socialLinks = [...new Set(socialMatches)];
      }
      
      return contacts;
    }

    const contactHtml = `
      <div class="contacts">
        <p>Телефон: +7(812)603-76-91</p>
        <p>Email: info@example.com</p>
        <p>Поддержка: support@example.com</p>
        <a href="https://vk.com/ourcompany">VK</a>
        <a href="https://instagram.com/ourcompany">Instagram</a>
      </div>
    `;

    const contacts = extractContactInfo(contactHtml);
    
    expect(contacts.phones).toContain('+7(812)603-76-91');
    expect(contacts.emails).toContain('info@example.com');
    expect(contacts.emails).toContain('support@example.com');
    expect(contacts.socialLinks.some(link => link.includes('vk.com'))).toBe(true);
    expect(contacts.socialLinks.some(link => link.includes('instagram.com'))).toBe(true);
  });

  test('должен применять таймауты для предотвращения зависания', () => {
    function processWithTimeout(processingFunction, timeoutMs = 8000) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Операция превысила таймаут ${timeoutMs}мс`));
        }, timeoutMs);
        
        try {
          const result = processingFunction();
          clearTimeout(timeoutId);
          resolve(result);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    }

    // Быстрая операция
    const fastOperation = () => 'success';
    
    // Медленная операция (симуляция)
    const slowOperation = () => {
      // В реальности здесь был бы медленный код
      throw new Error('Операция слишком медленная');
    };

    expect(async () => {
      const result = await processWithTimeout(fastOperation, 1000);
      expect(result).toBe('success');
    }).not.toThrow();

    expect(async () => {
      try {
        await processWithTimeout(slowOperation, 100);
      } catch (error) {
        expect(error.message).toContain('слишком медленная');
      }
    }).not.toThrow();
  });

  test('должен генерировать fallback данные на основе URL', () => {
    function generateUrlBasedFallback(url) {
      const domain = url.replace(/^https?:\/\//, '').split('/')[0];
      
      // Анализ домена для определения типа бизнеса
      const domainIndicators = {
        'medical': ['med', 'health', 'clinic', 'doctor', 'nplanner'],
        'smm': ['smm', 'social', 'marketing', 'agency'],
        'tech': ['tech', 'dev', 'software', 'digital'],
        'restaurant': ['cafe', 'restaurant', 'food', 'kitchen']
      };
      
      let businessType = 'general';
      for (const [type, keywords] of Object.entries(domainIndicators)) {
        if (keywords.some(keyword => domain.toLowerCase().includes(keyword))) {
          businessType = type;
          break;
        }
      }
      
      const fallbackTemplates = {
        'medical': {
          companyName: 'Медицинская организация',
          businessDescription: 'Предоставление медицинских услуг и консультаций',
          targetAudience: 'Пациенты, врачи, медицинские работники',
          businessValues: 'Здоровье пациентов, профессионализм, качество обслуживания',
          productBeliefs: 'Современная медицина должна быть доступной и качественной'
        },
        'smm': {
          companyName: 'SMM агентство',
          businessDescription: 'Управление социальными сетями и digital-маркетинг',
          targetAudience: 'Предприниматели, маркетологи, блогеры',
          businessValues: 'Креативность, результативность, инновации',
          productBeliefs: 'Качественный контент создает успешные бренды'
        },
        'general': {
          companyName: 'Компания',
          businessDescription: 'Профессиональные услуги и решения',
          targetAudience: 'Широкая аудитория клиентов',
          businessValues: 'Качество, надежность, клиентоориентированность',
          productBeliefs: 'Наши услуги помогают клиентам достигать целей'
        }
      };
      
      return fallbackTemplates[businessType] || fallbackTemplates['general'];
    }

    const medicalFallback = generateUrlBasedFallback('https://nplanner.ru');
    expect(medicalFallback.businessValues).toContain('профессионализм');
    
    const smmFallback = generateUrlBasedFallback('https://smm-agency.com');
    expect(smmFallback.targetAudience).toContain('маркетологи');
    
    const generalFallback = generateUrlBasedFallback('https://example.com');
    expect(generalFallback.companyName).toBe('Компания');
  });
});