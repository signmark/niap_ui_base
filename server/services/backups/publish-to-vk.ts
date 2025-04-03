import axios from 'axios';
import { log } from '../../utils/logger';
import { CampaignContent, SocialMediaSettings, SocialPublication } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';

/**
 * Публикует контент в ВКонтакте
 * @param content Контент для публикации
 * @param vkSettings Настройки VK API
 * @param processImageUrl Функция для обработки URL изображения
 * @param processAdditionalImages Функция для обработки дополнительных изображений
 * @param formatHtmlContent Функция для форматирования HTML-контента
 * @returns Результат публикации
 */
export async function publishToVk(
  content: CampaignContent,
  vkSettings: SocialMediaSettings['vk'] | undefined,
  processImageUrl: (url: string, platform: string) => string,
  processAdditionalImages: (content: CampaignContent, platform: string) => CampaignContent,
  formatHtmlContent: (content: string, platform: 'telegram' | 'vk' | 'facebook' | 'instagram') => string
): Promise<SocialPublication> {
  log(`▶️ Начата публикация в VK. Контент ID: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
  log(`▶️ Настройки для публикации в VK: groupId=${vkSettings?.groupId}, token=${vkSettings?.token?.substring(0, 6)}...`, 'social-publishing');
  
  if (!vkSettings?.token || !vkSettings?.groupId) {
    log(`❌ ОШИБКА: Отсутствуют настройки для VK (token=${!!vkSettings?.token}, groupId=${!!vkSettings?.groupId})`, 'social-publishing');
    return {
      platform: 'vk',
      status: 'failed',
      publishedAt: null,
      error: 'Отсутствуют настройки для VK (токен или ID группы)'
    };
  }

  try {
    const { token, groupId } = vkSettings;
    log(`Публикация в VK. Группа: ${groupId}, Токен: ${token.substring(0, 6)}...`, 'social-publishing');

    // Обработка контента и дополнительных изображений
    content = processAdditionalImages(content, 'vk');
    log(`VK публикация - обрабатываем контент: ${content.id}, тип данных additionalImages: ${typeof content.additionalImages}`, 'social-publishing');
    log(`Обработанный контент для VK имеет ${content.additionalImages ? content.additionalImages.length : 0} дополнительных изображений`, 'social-publishing');
    
    // Форматируем текст для VK
    const formattedText = formatHtmlContent(content.content, 'vk');
    log(`Форматированный текст для VK: длина ${formattedText.length} символов`, 'social-publishing');
    
    // Создаем временную директорию для файлов
    const tempDir = path.join(os.tmpdir(), 'vk_uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Массив для хранения путей к временным файлам (для последующего удаления)
    const tempFiles: string[] = [];
    
    // Публикация в зависимости от типа контента
    if (content.contentType === 'text') {
      log(`Публикация текстового контента в VK (ID: ${content.id})`, 'social-publishing');
      
      try {
        // Для текстового контента просто публикуем на стене группы
        const response = await axios.post('https://api.vk.com/method/wall.post', {
          owner_id: -parseInt(groupId), // Минус для групп
          from_group: 1,
          message: formattedText,
          v: '5.131', // Версия API VK
          access_token: token
        });
        
        log(`Успешная публикация текста в VK: ${JSON.stringify(response.data)}`, 'social-publishing');
        
        // Проверяем ответ от API
        if (response.data.response && response.data.response.post_id) {
          const postId = response.data.response.post_id;
          const postUrl = `https://vk.com/wall-${groupId}_${postId}`;
          
          return {
            platform: 'vk',
            status: 'published',
            publishedAt: new Date(),
            publishedUrl: postUrl,
            postId: postId.toString()
          };
        } else {
          log(`Ошибка при публикации текста в VK: неожиданный формат ответа`, 'social-publishing');
          return {
            platform: 'vk',
            status: 'failed',
            publishedAt: null,
            error: 'Неожиданный формат ответа API'
          };
        }
      } catch (error: any) {
        log(`Ошибка при публикации текста в VK: ${error.message}`, 'social-publishing');
        if (error.response) {
          log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
        }
        
        return {
          platform: 'vk',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка публикации текста: ${error.message}`
        };
      }
    } 
    else if (content.contentType === 'image' || content.contentType === 'carousel') {
      log(`Публикация ${content.contentType === 'image' ? 'изображения' : 'карусели'} в VK (ID: ${content.id})`, 'social-publishing');
      
      // Собираем все URL изображений
      const imageUrls: string[] = [];
      
      // Добавляем основное изображение, если оно есть
      if (content.imageUrl) {
        const processedUrl = processImageUrl(content.imageUrl, 'vk');
        imageUrls.push(processedUrl);
        log(`Добавлено основное изображение для VK: ${processedUrl.substring(0, 100)}...`, 'social-publishing');
      }
      
      // Добавляем дополнительные изображения для карусели
      if (content.contentType === 'carousel' && content.additionalImages && Array.isArray(content.additionalImages)) {
        content.additionalImages.forEach((imgUrl, index) => {
          if (typeof imgUrl === 'string' && imgUrl.trim()) {
            const processedUrl = processImageUrl(imgUrl, 'vk');
            imageUrls.push(processedUrl);
            log(`Добавлено дополнительное изображение #${index + 1} для VK: ${processedUrl.substring(0, 100)}...`, 'social-publishing');
          } else if (typeof imgUrl === 'object' && imgUrl.url) {
            const processedUrl = processImageUrl(imgUrl.url, 'vk');
            imageUrls.push(processedUrl);
            log(`Добавлено дополнительное изображение (объект) #${index + 1} для VK: ${processedUrl.substring(0, 100)}...`, 'social-publishing');
          }
        });
      }
      
      if (imageUrls.length === 0) {
        log(`Ошибка: Не найдено валидных URL изображений для публикации в VK`, 'social-publishing');
        return {
          platform: 'vk',
          status: 'failed',
          publishedAt: null,
          error: 'Отсутствуют URL изображений для публикации'
        };
      }
      
      try {
        // Шаг 1: Получаем URL для загрузки фотографий на сервер VK
        log(`Шаг 1: Получаем URL для загрузки фотографий в VK`, 'social-publishing');
        const uploadUrlResponse = await axios.get('https://api.vk.com/method/photos.getWallUploadServer', {
          params: {
            group_id: groupId,
            v: '5.131',
            access_token: token
          }
        });
        
        if (!uploadUrlResponse.data.response || !uploadUrlResponse.data.response.upload_url) {
          log(`Ошибка: Не удалось получить URL для загрузки фотографий в VK`, 'social-publishing');
          return {
            platform: 'vk',
            status: 'failed',
            publishedAt: null,
            error: 'Не удалось получить URL для загрузки фотографий'
          };
        }
        
        const uploadUrl = uploadUrlResponse.data.response.upload_url;
        log(`Получен URL для загрузки фотографий: ${uploadUrl}`, 'social-publishing');
        
        // Шаг 2: Загружаем каждое изображение на сервер и сохраняем в стене группы
        const photoAttachments: string[] = [];
        
        for (let i = 0; i < imageUrls.length; i++) {
          const url = imageUrls[i];
          log(`Загрузка изображения ${i + 1}/${imageUrls.length} в VK: ${url.substring(0, 100)}...`, 'social-publishing');
          
          // Шаг 2.1: Скачиваем изображение во временный файл
          try {
            // Генерируем уникальное имя файла
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 10);
            const tempFilePath = path.join(tempDir, `vk_${timestamp}_${randomString}.jpg`);
            tempFiles.push(tempFilePath); // Добавляем в список для последующего удаления
            
            // Скачиваем изображение
            const response = await axios.get(url, {
              responseType: 'arraybuffer',
              timeout: 30000,
              headers: {
                'Accept': 'image/*',
                'User-Agent': 'Mozilla/5.0 SMM Planner Bot'
              }
            });
            
            // Проверяем размер данных
            const dataSize = response.data.length;
            if (dataSize === 0) {
              log(`ОШИБКА: Скачан пустой файл (0 байт) для изображения ${i+1} в VK`, 'social-publishing');
              continue; // Пропускаем это изображение
            }
            
            // Сохраняем во временный файл
            fs.writeFileSync(tempFilePath, Buffer.from(response.data));
            log(`Сохранено изображение ${i+1} во временный файл: ${tempFilePath}, размер: ${fs.statSync(tempFilePath).size} байт`, 'social-publishing');
            
            // Шаг 2.2: Загружаем изображение на сервер VK
            const formData = new FormData();
            formData.append('photo', fs.createReadStream(tempFilePath), { filename: `image_${timestamp}.jpg` });
            
            const uploadResponse = await axios.post(uploadUrl, formData, {
              headers: {
                ...formData.getHeaders(),
                'Accept': 'application/json'
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
              timeout: 30000
            });
            
            log(`Ответ сервера VK на загрузку изображения: ${JSON.stringify(uploadResponse.data)}`, 'social-publishing');
            
            if (!uploadResponse.data.photo || !uploadResponse.data.server || !uploadResponse.data.hash) {
              log(`Ошибка: Неполный ответ от сервера загрузки VK для изображения ${i+1}`, 'social-publishing');
              continue;
            }
            
            // Шаг 2.3: Сохраняем фотографию в стене группы
            const saveResponse = await axios.post('https://api.vk.com/method/photos.saveWallPhoto', {
              group_id: groupId,
              photo: uploadResponse.data.photo,
              server: uploadResponse.data.server,
              hash: uploadResponse.data.hash,
              v: '5.131',
              access_token: token
            });
            
            log(`Ответ на сохранение фотографии в VK: ${JSON.stringify(saveResponse.data)}`, 'social-publishing');
            
            if (saveResponse.data.response && saveResponse.data.response.length > 0) {
              const photoObj = saveResponse.data.response[0];
              const photoAttachment = `photo${photoObj.owner_id}_${photoObj.id}`;
              photoAttachments.push(photoAttachment);
              log(`Добавлено фото-вложение: ${photoAttachment}`, 'social-publishing');
            } else {
              log(`Ошибка: Не удалось сохранить фотографию в VK для изображения ${i+1}`, 'social-publishing');
            }
            
          } catch (uploadError: any) {
            log(`Ошибка при загрузке изображения ${i+1} в VK: ${uploadError.message}`, 'social-publishing');
            if (uploadError.response) {
              log(`Данные ответа при ошибке: ${JSON.stringify(uploadError.response.data)}`, 'social-publishing');
            }
          }
        }
        
        // Удаляем все временные файлы
        tempFiles.forEach(file => {
          try {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
              log(`Удален временный файл: ${file}`, 'social-publishing');
            }
          } catch (unlinkError: any) {
            log(`Ошибка при удалении временного файла: ${unlinkError.message}`, 'social-publishing');
          }
        });
        
        // Проверяем, есть ли фотографии для публикации
        if (photoAttachments.length === 0) {
          log(`Ошибка: Не удалось загрузить ни одно изображение в VK`, 'social-publishing');
          return {
            platform: 'vk',
            status: 'failed',
            publishedAt: null,
            error: 'Не удалось загрузить ни одно изображение'
          };
        }
        
        // Шаг 3: Публикуем пост с текстом и вложениями
        const attachmentsString = photoAttachments.join(',');
        log(`Строка вложений для публикации в VK: ${attachmentsString}`, 'social-publishing');
        
        const postResponse = await axios.post('https://api.vk.com/method/wall.post', {
          owner_id: -parseInt(groupId), // Минус для групп
          from_group: 1,
          message: formattedText,
          attachments: attachmentsString,
          v: '5.131',
          access_token: token
        });
        
        log(`Ответ на публикацию поста в VK: ${JSON.stringify(postResponse.data)}`, 'social-publishing');
        
        if (postResponse.data.response && postResponse.data.response.post_id) {
          const postId = postResponse.data.response.post_id;
          const postUrl = `https://vk.com/wall-${groupId}_${postId}`;
          
          return {
            platform: 'vk',
            status: 'published',
            publishedAt: new Date(),
            publishedUrl: postUrl,
            postId: postId.toString()
          };
        } else {
          log(`Ошибка при публикации поста в VK: неожиданный формат ответа`, 'social-publishing');
          return {
            platform: 'vk',
            status: 'failed',
            publishedAt: null,
            error: 'Неожиданный формат ответа API при публикации поста'
          };
        }
        
      } catch (error: any) {
        // Удаляем все временные файлы при ошибке
        tempFiles.forEach(file => {
          try {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
          } catch (e) {
            // Игнорируем ошибки при очистке
          }
        });
        
        log(`Общая ошибка при публикации в VK: ${error.message}`, 'social-publishing');
        if (error.response) {
          log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
        }
        
        return {
          platform: 'vk',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка публикации: ${error.message}`
        };
      }
    }
    
    // Если тип контента не поддерживается
    log(`Неподдерживаемый тип контента для VK: ${content.contentType}`, 'social-publishing');
    return {
      platform: 'vk',
      status: 'failed',
      publishedAt: null,
      error: `Неподдерживаемый тип контента: ${content.contentType}`
    };
    
  } catch (error: any) {
    log(`Общая ошибка при публикации в VK: ${error.message}`, 'social-publishing');
    
    return {
      platform: 'vk',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка публикации: ${error.message}`
    };
  }
}