import axios from 'axios';

async function testDsignmarkPost() {
    console.log('🚀 Тестируем публикацию в dsignmark...\n');
    
    // Простая красная картинка 100x100
    const testImage = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=`;
    
    try {
        const response = await axios.post('http://localhost:5000/api/instagram-direct/publish-photo', {
            username: 'dsignmark',
            password: 'K<2Y#DJh-<WCb!S',
            imageData: testImage,
            caption: '🎯 TEST dsignmark успешно интегрирован!\n\n✅ Авторизация: OK\n📅 Дата: 22 июля 2025\n🔧 Система: SMM Manager\n\n#dsignmark #test #success',
            campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e'
        }, {
            timeout: 30000 // 30 секунд
        });
        
        console.log('📊 РЕЗУЛЬТАТ ПУБЛИКАЦИИ:');
        console.log(`✅ Успех: ${response.data.success}`);
        console.log(`📝 Сообщение: ${response.data.message || 'нет сообщения'}`);
        console.log(`🔗 URL поста: ${response.data.postUrl || 'не указан'}`);
        console.log(`🆔 ID поста: ${response.data.postId || 'не указан'}`);
        
        if (response.data.success) {
            console.log('\n🎉 УСПЕХ! dsignmark готов к работе в кампании 46868c44-c6a4-4bed-accf-9ad07bba790e');
        }
        
    } catch (error) {
        console.log('❌ Ошибка публикации:');
        console.log(`Status: ${error.response?.status || 'неизвестен'}`);
        console.log(`Error: ${error.response?.data?.error || error.message}`);
        console.log(`Details: ${error.response?.data?.details || 'нет деталей'}`);
        
        // Проверим статус системы
        console.log('\n🔍 Проверяем статус Instagram API...');
        try {
            const statusResponse = await axios.get('http://localhost:5000/api/instagram-direct/status');
            console.log(`Статус API: ${statusResponse.data.status}`);
            console.log(`Сохраненные аккаунты: ${statusResponse.data.sessions.stored.join(', ')}`);
        } catch (statusError) {
            console.log('Ошибка проверки статуса:', statusError.message);
        }
    }
}

testDsignmarkPost().catch(console.error);