#!/usr/bin/env node

/**
 * Скрипт для создания реального контента для компании Nplanner.ru
 * Использует QuestionnaireContentGenerator для создания персонализированного контента
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Настройки для Nplanner.ru
const NPLANNER_QUESTIONNAIRE = {
  companyName: 'Nplanner.ru',
  industry: 'Медицинское программное обеспечение',
  targetAudience: 'Медицинские специалисты, врачи, медсестры, администраторы клиник',
  productDescription: 'Система планирования для медицинских учреждений с возможностью записи пациентов, управления расписанием врачей и оптимизации рабочих процессов',
  uniqueValueProposition: 'Упрощаем медицинскую практику через умное планирование',
  businessGoals: 'Помочь медицинским учреждениям повысить эффективность работы и улучшить качество обслуживания пациентов',
  keyProducts: 'Система онлайн записи, управление расписанием, аналитика загруженности врачей',
  painPoints: 'Сложность координации расписаний, потери времени на административные задачи, неэффективное использование ресурсов',
  brandTone: 'профессиональный и дружелюбный',
  contentTopics: 'планирование в медицине, оптимизация рабочих процессов, цифровизация здравоохранения, эффективность медицинских услуг'
};

// Настройки для публикации
const PUBLICATION_CONFIG = {
  campaignId: '45daab2a-4c6f-4578-8665-3a04df3c5b3a', // ID кампании Nplanner
  platforms: ['vk', 'telegram'],
  contentCount: 3
};

console.log('🚀 Запуск генерации контента для Nplanner.ru...');
console.log('📊 Используется анкета компании:', NPLANNER_QUESTIONNAIRE.companyName);
console.log('🎯 Целевая аудитория:', NPLANNER_QUESTIONNAIRE.targetAudience);

/**
 * Создает контент через API endpoint
 */
async function generateContent() {
  try {
    const response = await axios.post(`http://localhost:5000/api/generate-questionnaire-content/${PUBLICATION_CONFIG.campaignId}`, {
      numberOfPosts: PUBLICATION_CONFIG.contentCount
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`
      }
    });

    console.log('✅ Контент успешно сгенерирован!');
    console.log('📝 Количество постов:', response.data.data?.length || 0);
    
    if (response.data.data) {
      response.data.data.forEach((content, index) => {
        console.log(`\n📄 Пост ${index + 1}:`);
        console.log(`Заголовок: ${content.title || 'Без заголовка'}`);
        console.log(`Контент: ${content.content?.substring(0, 150)}...`);
      });
    }

    return response.data;

  } catch (error) {
    console.error('❌ Ошибка генерации контента:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Создает публикации в системе
 */
async function createPublications(contents) {
  console.log('\n📤 Создание публикаций в системе...');
  
  const results = [];
  
  for (const content of contents) {
    try {
      const publicationData = {
        campaign_id: PUBLICATION_CONFIG.campaignId,
        title: content.title,
        content: content.content,
        hashtags: content.hashtags?.join(' ') || '',
        platforms: content.platforms || PUBLICATION_CONFIG.platforms,
        status: 'published',
        published_at: new Date().toISOString(),
        created_by_script: true,
        source: 'questionnaire_generator',
        metadata: {
          questionnaire: NPLANNER_QUESTIONNAIRE,
          generatedAt: new Date().toISOString(),
          script: 'create-nplanner-content-working.js'
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
      console.error(`❌ Ошибка создания публикации:`, error.response?.data || error.message);
    }
  }

  return results;
}

/**
 * Основная функция
 */
async function main() {
  try {
    console.log('\n🎬 Начинаем процесс создания контента для Nplanner.ru');
    
    // 1. Генерируем контент на основе анкеты
    const generatedData = await generateContent();
    
    if (!generatedData.data || generatedData.data.length === 0) {
      throw new Error('Не удалось сгенерировать контент');
    }

    // 2. Создаем публикации в системе
    const publications = await createPublications(generatedData.data);
    
    console.log(`\n🎉 Процесс завершен!`);
    console.log(`📊 Статистика:`);
    console.log(`   - Сгенерировано постов: ${generatedData.data.length}`);
    console.log(`   - Создано публикаций: ${publications.length}`);
    console.log(`   - Платформы: ${PUBLICATION_CONFIG.platforms.join(', ')}`);
    console.log(`   - Кампания: ${PUBLICATION_CONFIG.campaignId}`);
    
    // Выводим результаты
    publications.forEach((pub, index) => {
      console.log(`\n📄 Публикация ${index + 1}:`);
      console.log(`   ID: ${pub.id}`);
      console.log(`   Заголовок: ${pub.title}`);
      console.log(`   Статус: ${pub.status}`);
    });

  } catch (error) {
    console.error('\n💥 Критическая ошибка:', error.message);
    process.exit(1);
  }
}

// Запуск скрипта
main().catch(console.error);