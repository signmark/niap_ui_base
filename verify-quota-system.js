/**
 * Проверка системы квот YouTube - находит все контенты с YouTube и их статусы
 */

import { storage } from './server/storage.js';

async function verifyQuotaSystem() {
    try {
        console.log('🔍 ПРОВЕРКА СИСТЕМЫ КВОТ YOUTUBE');
        console.log('=' .repeat(50));
        
        const authToken = process.env.DIRECTUS_TOKEN;
        if (!authToken) {
            console.error('❌ Нет DIRECTUS_TOKEN в окружении');
            return;
        }
        
        // Получаем все контенты напрямую через Directus API
        console.log('📋 Получаем все контенты...');
        
        const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech/';
        const response = await fetch(`${directusUrl}items/campaign_content`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        const result = await response.json();
        const allContent = result.data || [];
        
        console.log(`📊 Найдено контентов: ${allContent.length}`);
        
        // Фильтруем контенты с YouTube
        const youtubeContent = allContent.filter(content => {
            if (!content.social_platforms) return false;
            
            const platforms = typeof content.social_platforms === 'string' 
                ? JSON.parse(content.social_platforms) 
                : content.social_platforms;
                
            return platforms && platforms.youtube;
        });
        
        console.log(`🎬 Контентов с YouTube: ${youtubeContent.length}`);
        console.log('');
        
        // Анализируем статусы
        const statusCounts = {};
        youtubeContent.forEach(content => {
            const platforms = typeof content.social_platforms === 'string' 
                ? JSON.parse(content.social_platforms) 
                : content.social_platforms;
                
            const status = platforms.youtube.status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            console.log(`📹 ${content.id} (${content.title || 'Без названия'})`);
            console.log(`   Статус: ${status}`);
            console.log(`   Общий статус контента: ${content.status}`);
            
            if (platforms.youtube.error) {
                console.log(`   Ошибка: ${platforms.youtube.error}`);
            }
            
            if (platforms.youtube.lastAttempt) {
                console.log(`   Последняя попытка: ${platforms.youtube.lastAttempt}`);
            }
            console.log('');
        });
        
        console.log('📊 СТАТИСТИКА СТАТУСОВ:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   ${status}: ${count} контентов`);
        });
        
        // Проверяем планировщик
        const scheduledContent = youtubeContent.filter(content => 
            ['scheduled', 'partial'].includes(content.status)
        );
        
        console.log('');
        console.log(`⏰ Контентов готовых к обработке планировщиком: ${scheduledContent.length}`);
        
        scheduledContent.forEach(content => {
            const platforms = typeof content.social_platforms === 'string' 
                ? JSON.parse(content.social_platforms) 
                : content.social_platforms;
                
            const youtubeStatus = platforms.youtube.status;
            const shouldBeSkipped = youtubeStatus === 'quota_exceeded';
            
            console.log(`📅 ${content.id} - YouTube статус: ${youtubeStatus} ${shouldBeSkipped ? '(БУДЕТ ПРОПУЩЕН)' : '(БУДЕТ ОБРАБОТАН)'}`);
        });
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

verifyQuotaSystem();