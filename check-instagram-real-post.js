#!/usr/bin/env node

/**
 * Проверка реального поста в Instagram
 * Делаем реальный пост с настоящими credentials
 */

import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { InstagramApi } from 'instagram-private-api';

const PROXY_URL = 'socks5://WeBZDZ7p9lh5:iOPNYl8D@mobpool.proxy.market:10000';

async function makeRealPost() {
  console.log('🔍 Проверка реального поста в Instagram');
  console.log('👤 Аккаунт: darkhorse_fashion');
  console.log('');
  
  try {
    // Создаем прокси агент
    const agent = new SocksProxyAgent(PROXY_URL);
    
    // Создаем Instagram API клиент
    const ig = new InstagramApi();
    
    // Настраиваем прокси
    ig.request.defaults.agent = agent;
    
    console.log('🔐 Авторизация в Instagram...');
    
    // Авторизуемся
    await ig.simulate.preLoginFlow();
    const loginResponse = await ig.account.login('darkhorse_fashion', 'QtpZ3dh70306');
    
    console.log('✅ Авторизация успешна');
    console.log(`👤 User ID: ${loginResponse.pk}`);
    console.log(`📝 Username: ${loginResponse.username}`);
    console.log('');
    
    // Создаем простое изображение для поста
    const imageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    
    console.log('📸 Публикуем реальный пост...');
    
    const publishResult = await ig.publish.photo({
      file: imageBuffer,
      caption: `🏇 Dark Horse Fashion - Реальный тест

Это настоящий пост через Instagram Private API!

#darkhorse #fashion #test #realpost #instagram

Время: ${new Date().toLocaleString()}`
    });
    
    console.log('✅ Пост успешно опубликован!');
    console.log(`📊 Media ID: ${publishResult.media.id}`);
    console.log(`🔗 URL: https://instagram.com/p/${publishResult.media.code}`);
    console.log(`👍 Лайки: ${publishResult.media.like_count}`);
    console.log(`💬 Комментарии: ${publishResult.media.comment_count}`);
    console.log('');
    
    console.log('🎯 Прямая ссылка на пост:');
    console.log(`https://instagram.com/p/${publishResult.media.code}`);
    
  } catch (error) {
    console.error('❌ Ошибка при публикации:', error.message);
    
    if (error.response && error.response.body) {
      console.error('📄 Детали ошибки:', error.response.body);
    }
  }
}

makeRealPost();