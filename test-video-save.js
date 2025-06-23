// Простой тест сохранения видео
import axios from 'axios';

async function testVideoSave() {
  try {
    const token = process.env.DIRECTUS_TOKEN;
    
    const response = await axios.post('http://localhost:5000/api/campaign-content', {
      campaign_id: "46868c44-c6a4-4bed-accf-9ad07bba790e",
      content_type: "video-text", 
      text_content: "Простой тест видео",
      video_url: "https://6e679636ae90-ridiculous-seth.s3.ru1.storage.beget.cloud/mov_bbb.mp4"
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Успешно сохранено:', response.data);
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.data || error.message);
  }
}

testVideoSave();

// Очистка временного файла
import fs from 'fs';
setTimeout(() => {
  try { fs.unlinkSync('./test-video-save.js'); } catch {}
}, 2000);