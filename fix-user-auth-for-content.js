#!/usr/bin/env node

/**
 * Привязывает созданный контент к правильному пользователю
 * для отображения в интерфейсе
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';
const USER_ID = '53921f16-f51d-4591-80b9-8caa4fde4d13'; // из логов

async function fixContentUserBinding() {
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  console.log('🔧 Исправляю привязку контента к пользователю...\n');

  try {
    // 1. Получаем наш контент
    const response = await axios.get(
      `${API_BASE}/campaign-content?campaignId=${CAMPAIGN_ID}&limit=20`,
      { headers }
    );

    if (!response.data?.data) {
      console.log('❌ Контент не найден');
      return;
    }

    const nplannerContent = response.data.data.filter(item => 
      item.metadata?.source === 'nplanner_final_generator'
    );

    console.log(`📋 Найдено контента Nplanner: ${nplannerContent.length}`);

    // 2. Обновляем каждый элемент контента
    for (const item of nplannerContent) {
      console.log(`\n🔧 Обновляю контент: ${item.title}`);
      
      try {
        const updateData = {
          userId: USER_ID,
          user_id: USER_ID,
          metadata: {
            ...item.metadata,
            userId: USER_ID,
            fixedForUser: true,
            fixedAt: new Date().toISOString()
          }
        };

        // Обновляем через API
        const updateResponse = await axios.put(
          `${API_BASE}/campaign-content/${item.id}`,
          updateData,
          { headers }
        );

        if (updateResponse.status === 200) {
          console.log(`   ✅ Контент обновлен успешно`);
        } else {
          console.log(`   ⚠️ Неожиданный статус: ${updateResponse.status}`);
        }

      } catch (error) {
        console.log(`   ❌ Ошибка обновления: ${error.response?.data || error.message}`);
      }

      // Пауза между обновлениями
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 3. Проверяем результат
    console.log('\n🔍 Проверяю результат...');
    const checkResponse = await axios.get(
      `${API_BASE}/campaign-content?campaignId=${CAMPAIGN_ID}&limit=10`,
      { 
        headers: {
          ...headers,
          'X-User-ID': USER_ID // Передаем ID пользователя для фильтрации
        }
      }
    );

    if (checkResponse.data?.data) {
      const visibleContent = checkResponse.data.data.filter(item => 
        item.metadata?.source === 'nplanner_final_generator'
      );

      console.log(`✅ Видимого контента после исправления: ${visibleContent.length}`);
      
      if (visibleContent.length > 0) {
        console.log('\n📋 Исправленный контент:');
        visibleContent.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.title}`);
          console.log(`      Пользователь: ${item.userId || item.user_id || 'не указан'}`);
        });
      }
    }

    console.log('\n🎉 Исправление завершено!');
    console.log('💡 Теперь контент должен отображаться в интерфейсе');

  } catch (error) {
    console.error('❌ Ошибка исправления:', error.response?.data || error.message);
  }
}

fixContentUserBinding().catch(console.error);