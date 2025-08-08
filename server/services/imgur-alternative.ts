import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

// Альтернативный сервис для загрузки изображений
export class ImgurAlternativeService {
  private readonly imgurClientId = 'f4c080ac9d02e7c'; // Публичный Imgur client ID
  
  async uploadImage(filePath: string): Promise<string | null> {
    try {
      console.log(`🔧 [ImgurAlternative] Попытка загрузки файла: ${filePath}`);
      
      // Сначала пробуем через imgbb (резервный)
      try {
        const imgbbResult = await this.uploadToImgBB(filePath);
        if (imgbbResult) {
          console.log(`✅ [ImgurAlternative] Успешно загружено через ImgBB: ${imgbbResult}`);
          return imgbbResult;
        }
      } catch (imgbbError) {
        console.log(`⚠️ [ImgurAlternative] ImgBB недоступен: ${imgbbError}`);
      }
      
      // Если imgbb не работает, пробуем реальный Imgur
      try {
        const imgurResult = await this.uploadToImgur(filePath);
        if (imgurResult) {
          console.log(`✅ [ImgurAlternative] Успешно загружено через Imgur: ${imgurResult}`);
          return imgurResult;
        }
      } catch (imgurError) {
        console.log(`⚠️ [ImgurAlternative] Imgur недоступен: ${imgurError}`);
      }
      
      // Если ничего не работает, возвращаем локальный URL
      console.log(`⚠️ [ImgurAlternative] Все сервисы недоступны, возвращаем локальный путь`);
      return this.createLocalUrl(filePath);
      
    } catch (error) {
      console.error(`❌ [ImgurAlternative] Критическая ошибка: ${error}`);
      return null;
    }
  }
  
  private async uploadToImgBB(filePath: string): Promise<string | null> {
    const formData = new FormData();
    formData.append('key', '24b7a2b8c7d4563497ca48e07d0c76ba');
    formData.append('image', fs.createReadStream(filePath));
    
    const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
      headers: formData.getHeaders(),
      timeout: 10000
    });
    
    return response.data?.success ? response.data.data.url : null;
  }
  
  private async uploadToImgur(filePath: string): Promise<string | null> {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(filePath));
    
    const response = await axios.post('https://api.imgur.com/3/image', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Client-ID ${this.imgurClientId}`
      },
      timeout: 10000
    });
    
    return response.data?.success ? response.data.data.link : null;
  }
  
  private createLocalUrl(filePath: string): string {
    // Создаем URL для локального доступа к файлу
    const fileName = filePath.split('/').pop();
    return `http://localhost:5000/uploads/images/${fileName}`;
  }
}

export const imgurAlternativeService = new ImgurAlternativeService();