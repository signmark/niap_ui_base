/**
 * Тест обновления статуса quota_exceeded напрямую
 */

import { storage } from './server/storage.js';

async function testQuotaStatusUpdate() {
    try {
        console.log('🧪 ТЕСТ ОБНОВЛЕНИЯ СТАТУСА QUOTA_EXCEEDED');
        console.log('=' .repeat(50));
        
        // Тестируем с контентом из скриншота
        const contentId = '654701b6-a865-44f4-8453-0ea433cd5f90';
        const authToken = process.env.DIRECTUS_TOKEN;
        
        if (!authToken) {
            console.error('❌ Нет DIRECTUS_TOKEN в окружении');
            return;
        }
        
        // Получаем текущие данные контента
        console.log('📋 Получаем текущие данные контента...');
        const currentContent = await storage.getCampaignContentById(contentId, authToken);
        
        console.log('📊 Текущие social_platforms:', JSON.stringify(currentContent.social_platforms, null, 2));
        
        // Обновляем статус YouTube на quota_exceeded
        const updateData = {
            socialPlatforms: {
                ...currentContent.social_platforms,
                youtube: {
                    ...currentContent.social_platforms?.youtube,
                    status: 'quota_exceeded',
                    error: 'Превышена квота YouTube API (тест)',
                    lastAttempt: new Date().toISOString()
                }
            }
        };
        
        console.log('📤 Отправляем обновление:', JSON.stringify(updateData, null, 2));
        
        // Обновляем в базе данных
        await storage.updateCampaignContent(contentId, updateData, authToken);
        console.log('✅ Обновление отправлено');
        
        // Проверяем результат
        console.log('🔍 Проверяем результат...');
        const updatedContent = await storage.getCampaignContentById(contentId, authToken);
        
        console.log('📊 Обновленные social_platforms:', JSON.stringify(updatedContent.social_platforms, null, 2));
        
        const youtubeStatus = updatedContent.social_platforms?.youtube?.status;
        if (youtubeStatus === 'quota_exceeded') {
            console.log('✅ УСПЕХ: Статус quota_exceeded установлен корректно');
        } else {
            console.log(`❌ ОШИБКА: Ожидался quota_exceeded, получен ${youtubeStatus}`);
        }
        
    } catch (error) {
        console.error('❌ Ошибка теста:', error.message);
    }
}

testQuotaStatusUpdate();