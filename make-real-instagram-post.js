#!/usr/bin/env node

/**
 * Настоящий пост в Instagram через instagram-private-api
 * Используем реальный Instagram аккаунт darkhorse_fashion
 */

const { IgApiClient } = require('instagram-private-api');
const { SocksProxyAgent } = require('socks-proxy-agent');

const PROXY_URL = 'socks5://WeBZDZ7p9lh5:iOPNYl8D@mobpool.proxy.market:10000';

async function makeRealPost() {
  console.log('🏇 Создание настоящего поста в Instagram');
  console.log('👤 Аккаунт: darkhorse_fashion');
  console.log('');
  
  try {
    // Создаем Instagram API клиент
    const ig = new IgApiClient();
    
    // Настраиваем прокси
    const agent = new SocksProxyAgent(PROXY_URL);
    ig.request.defaults.agent = agent;
    
    console.log('🌐 Подключаемся через прокси:', PROXY_URL.replace(/:[^:]*@/, ':****@'));
    console.log('🔐 Авторизуемся в Instagram...');
    
    // Авторизуемся
    ig.state.generateDevice('darkhorse_fashion');
    await ig.simulate.preLoginFlow();
    
    const loggedInUser = await ig.account.login('darkhorse_fashion', 'QtpZ3dh70306');
    
    console.log('✅ Авторизация успешна!');
    console.log(`👤 User ID: ${loggedInUser.pk}`);
    console.log(`📝 Username: ${loggedInUser.username}`);
    console.log('');
    
    // Создаем простое изображение 1x1 пиксель
    const imageBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00,
      0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11,
      0x01, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF,
      0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00,
      0x0C, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0xAA,
      0xFF, 0xD9
    ]);
    
    console.log('📸 Публикуем настоящий пост...');
    
    const publishResult = await ig.publish.photo({
      file: imageBuffer,
      caption: `🏇 Dark Horse Fashion - Настоящий пост!

Это реальный пост через Instagram Private API!

#darkhorse #fashion #realpost #instagram #test

⏰ Опубликовано: ${new Date().toLocaleString()}`
    });
    
    console.log('🎉 Пост успешно опубликован!');
    console.log(`📊 Media ID: ${publishResult.media.id}`);
    console.log(`🔗 Instagram код: ${publishResult.media.code}`);
    console.log('');
    
    console.log('🔗 Прямая ссылка на пост:');
    console.log(`https://instagram.com/p/${publishResult.media.code}`);
    console.log('');
    
    console.log('📋 Детали поста:');
    console.log(`📅 Время создания: ${new Date(publishResult.media.taken_at * 1000).toLocaleString()}`);
    console.log(`👍 Лайки: ${publishResult.media.like_count || 0}`);
    console.log(`💬 Комментарии: ${publishResult.media.comment_count || 0}`);
    
  } catch (error) {
    console.error('❌ Ошибка при публикации:', error.message);
    
    // Показываем дополнительную информацию об ошибке
    if (error.response && error.response.body) {
      console.error('📄 Детали ошибки Instagram API:', JSON.stringify(error.response.body, null, 2));
    }
    
    if (error.name === 'IgLoginRequiredError') {
      console.error('🔐 Требуется повторная авторизация');
    } else if (error.name === 'IgCheckpointError') {
      console.error('⚠️ Аккаунт требует прохождения checkpoint');
    } else if (error.name === 'IgChallengeWrongCodeError') {
      console.error('🔢 Неверный код подтверждения');
    }
  }
}

makeRealPost();