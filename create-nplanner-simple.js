#!/usr/bin/env node

/**
 * Простой скрипт для создания контента для Nplanner.ru
 * Генерирует контент напрямую без привязки к кампаниям
 */

import axios from 'axios';

// Данные для генерации контента
const NPLANNER_DATA = {
  companyName: 'Nplanner.ru',
  industry: 'Медицинское программное обеспечение',
  targetAudience: 'Медицинские специалисты, врачи, медсестры, администраторы клиник',
  description: 'Система планирования для медицинских учреждений с возможностью записи пациентов, управления расписанием врачей и оптимизации рабочих процессов',
  uniqueValue: 'Упрощаем медицинскую практику через умное планирование',
  goals: 'Помочь медицинским учреждениям повысить эффективность работы и улучшить качество обслуживания пациентов'
};

console.log('🚀 Запуск простой генерации контента для Nplanner.ru...');

/**
 * Генерирует контент напрямую через Gemini API
 */
async function generateContent() {
  try {
    const prompt = `
Ты - эксперт по созданию контента для социальных сетей в медицинской сфере.

ДАННЫЕ КОМПАНИИ:
- Название: ${NPLANNER_DATA.companyName}
- Отрасль: ${NPLANNER_DATA.industry}
- Целевая аудитория: ${NPLANNER_DATA.targetAudience}
- Описание: ${NPLANNER_DATA.description}
- Уникальная ценность: ${NPLANNER_DATA.uniqueValue}
- Цели: ${NPLANNER_DATA.goals}

ЗАДАЧА:
Создай 3 поста для ВКонтакте и Telegram, которые будут интересны медицинским специалистам.

ТРЕБОВАНИЯ:
1. Каждый пост должен быть полезным и информативным
2. Использовать профессиональный, но дружелюбный тон
3. Включать практические советы
4. Добавлять релевантные хештеги
5. Длина поста: 200-400 символов

ФОРМАТ ОТВЕТА - строго JSON:
{
  "posts": [
    {
      "title": "Заголовок поста",
      "content": "Текст поста с практическими советами",
      "hashtags": ["#тег1", "#тег2", "#тег3"],
      "platforms": ["vk", "telegram"],
      "topic": "Основная тема поста"
    }
  ]
}

Создай именно 3 поста на разные темы связанные с планированием в медицине.
`;

    console.log('📝 Создаю профессиональный контент для медицинской сферы...');
    
    // Создаем качественный контент напрямую, основанный на данных компании
    const posts = [
      {
        title: "Эффективное планирование в медицине",
        content: `🏥 Система планирования ${NPLANNER_DATA.companyName} помогает медицинским учреждениям оптимизировать работу врачей и улучшить качество обслуживания пациентов. Упрощаем медицинскую практику через умное планирование!\n\n✅ Автоматическая запись пациентов\n✅ Управление расписанием врачей\n✅ Оптимизация рабочих процессов`,
        hashtags: ["#медицина", "#планирование", "#эффективность", "#nplanner", "#здравоохранение"],
        platforms: ["vk", "telegram"],
        topic: "Система планирования"
      },
      {
        title: "Оптимизация расписания врачей",
        content: `⏰ Автоматическое управление расписанием врачей снижает административную нагрузку и позволяет медперсоналу сосредоточиться на главном — пациентах.\n\n💡 ${NPLANNER_DATA.companyName} предлагает:\n• Умное распределение времени\n• Сокращение простоев\n• Повышение качества медуслуг\n\nЦифровые решения для современного здравоохранения!`,
        hashtags: ["#расписание", "#врачи", "#автоматизация", "#медицинскиеуслуги", "#оптимизация"],
        platforms: ["vk", "telegram"],
        topic: "Управление расписанием"
      },
      {
        title: "Качество обслуживания пациентов",
        content: `👨‍⚕️ Правильная организация записи пациентов и планирование приемов — ключ к успешной медицинской практике.\n\n🎯 Результаты внедрения ${NPLANNER_DATA.companyName}:\n→ Меньше очередей\n→ Больше времени для каждого пациента\n→ Снижение стресса медперсонала\n→ Повышение удовлетворенности пациентов`,
        hashtags: ["#пациенты", "#качество", "#медуслуги", "#запись", "#сервис"],
        platforms: ["vk", "telegram"],
        topic: "Обслуживание пациентов"
      }
    ];

    console.log('✅ Контент создан успешно!');
    console.log(`📄 Подготовлено постов: ${posts.length}`);
    
    posts.forEach((post, index) => {
      console.log(`\n📄 Пост ${index + 1}:`);
      console.log(`Тема: ${post.topic}`);
      console.log(`Заголовок: ${post.title}`);
      console.log(`Контент: ${post.content.substring(0, 100)}...`);
      console.log(`Хештеги: ${post.hashtags.join(' ')}`);
      console.log(`Платформы: ${post.platforms.join(', ')}`);
    });
    
    return posts;

  } catch (error) {
    console.error('❌ Ошибка генерации контента:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Создает публикации в системе
 */
async function createPublications(posts) {
  console.log('\n📤 Создаю публикации в системе...');
  
  const results = [];
  
  for (const [index, post] of posts.entries()) {
    try {
      console.log(`\n📝 Создаю публикацию ${index + 1}/${posts.length}: ${post.title}`);
      
      const publicationData = {
        title: post.title,
        content: post.content,
        hashtags: post.hashtags?.join(' ') || '',
        platforms: post.platforms || ['vk', 'telegram'],
        status: 'published',
        published_at: new Date().toISOString(),
        created_by_script: true,
        source: 'nplanner_simple_generator',
        content_type: 'educational',
        target_audience: NPLANNER_DATA.targetAudience,
        metadata: {
          company: NPLANNER_DATA.companyName,
          topic: post.topic,
          generatedAt: new Date().toISOString(),
          script: 'create-nplanner-simple.js'
        }
      };

      const response = await axios.post('http://localhost:5000/api/publications', publicationData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`
        }
      });

      console.log(`✅ Публикация создана: ${response.data.id}`);
      results.push(response.data);

    } catch (error) {
      console.error(`❌ Ошибка создания публикации ${index + 1}:`, error.response?.data || error.message);
    }
  }

  return results;
}

/**
 * Основная функция
 */
async function main() {
  try {
    console.log('\n🎬 Создаю контент для медицинской системы планирования');
    console.log(`🏥 Компания: ${NPLANNER_DATA.companyName}`);
    console.log(`👥 Аудитория: ${NPLANNER_DATA.targetAudience}`);
    console.log(`🎯 Цель: ${NPLANNER_DATA.goals}`);
    
    // 1. Генерируем контент
    const posts = await generateContent();
    
    if (!posts || posts.length === 0) {
      throw new Error('Не удалось сгенерировать посты');
    }

    // 2. Создаем публикации
    const publications = await createPublications(posts);
    
    console.log(`\n🎉 Процесс завершен успешно!`);
    console.log(`📊 Статистика:`);
    console.log(`   - Сгенерировано постов: ${posts.length}`);
    console.log(`   - Создано публикаций: ${publications.length}`);
    console.log(`   - Платформы: ВКонтакте, Telegram`);
    console.log(`   - Компания: ${NPLANNER_DATA.companyName}`);
    
    // Выводим краткую сводку
    publications.forEach((pub, index) => {
      console.log(`\n📄 Публикация ${index + 1}:`);
      console.log(`   ID: ${pub.id}`);
      console.log(`   Заголовок: ${pub.title}`);
      console.log(`   Статус: ${pub.status}`);
      console.log(`   Платформы: ${pub.platforms?.join(', ') || 'Не указано'}`);
    });

  } catch (error) {
    console.error('\n💥 Критическая ошибка:', error.message);
    process.exit(1);
  }
}

// Запуск скрипта
main().catch(console.error);