#!/usr/bin/env node

/**
 * Создает контент для Nplanner.ru БЕЗ публикации в социальных сетях
 * Только сохраняет в базу данных как черновики
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e'; // Nplanner.ru campaign

console.log('📝 Создаю контент для Nplanner.ru (только черновики)...');

// Данные для генерации контента
const contentTopics = [
  {
    topic: 'Эффективность планирования',
    angle: 'Как система планирования помогает медицинским учреждениям',
    audience: 'Главные врачи и администраторы клиник'
  },
  {
    topic: 'Автоматизация расписания',
    angle: 'Автоматическое управление расписанием врачей',
    audience: 'Медицинские администраторы и секретари'
  },
  {
    topic: 'Качество обслуживания',
    angle: 'Улучшение качества обслуживания пациентов',
    audience: 'Врачи и медсестры'
  },
  {
    topic: 'Оптимизация ресурсов',
    angle: 'Эффективное использование медицинских ресурсов',
    audience: 'Руководители медицинских учреждений'
  },
  {
    topic: 'Цифровизация медицины',
    angle: 'Переход к цифровым решениям в медицине',
    audience: 'IT-специалисты в медицине'
  }
];

async function createContent() {
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  const createdContent = [];

  for (let i = 0; i < contentTopics.length; i++) {
    const topic = contentTopics[i];
    
    console.log(`\n📄 Создаю контент ${i + 1}/${contentTopics.length}: ${topic.topic}`);
    
    try {
      // Создаем контент через endpoint генерации из анкеты
      const response = await axios.post(
        `${API_BASE}/generate-questionnaire-content/${CAMPAIGN_ID}`,
        {
          topic: topic.topic,
          angle: topic.angle,
          targetAudience: topic.audience,
          createOnly: true, // Только создать, не публиковать
          platforms: ['vk', 'telegram'],
          postType: 'text'
        },
        { headers }
      );

      if (response.data && response.data.success) {
        console.log(`✅ Контент "${topic.topic}" создан успешно`);
        console.log(`   ID: ${response.data.contentId || 'не указан'}`);
        console.log(`   Заголовок: ${response.data.title || 'не указан'}`);
        
        createdContent.push({
          topic: topic.topic,
          id: response.data.contentId,
          title: response.data.title,
          status: 'draft'
        });
      } else {
        console.log(`❌ Ошибка создания контента "${topic.topic}"`);
        console.log(`   Ответ: ${JSON.stringify(response.data, null, 2)}`);
      }
      
      // Небольшая пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Ошибка при создании контента "${topic.topic}":`, error.response?.data || error.message);
    }
  }

  return createdContent;
}

async function main() {
  try {
    console.log('🏥 Компания: Nplanner.ru');
    console.log('🎯 Аудитория: Медицинские специалисты и администраторы');
    console.log('📝 Создается контента: ' + contentTopics.length);
    
    const results = await createContent();
    
    console.log('\n🎉 Процесс завершен!');
    console.log(`📊 Статистика:`);
    console.log(`   - Запланировано: ${contentTopics.length}`);
    console.log(`   - Создано успешно: ${results.length}`);
    console.log(`   - Статус: Черновики (не опубликованы)`);
    
    if (results.length > 0) {
      console.log('\n📋 Созданный контент:');
      results.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title || item.topic} (ID: ${item.id || 'неизвестен'})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error.message);
  }
}

// Запуск
main().catch(console.error);