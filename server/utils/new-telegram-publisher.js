/**
 * Новая оптимизированная версия публикации контента в Telegram
 * Следует требованиям:
 * 1. Преобразует HTML из поста в совместимый с ТГ
 * 2. Обрабатывает заголовок поста как жирный шрифт
 * 3. Отправляет изображения отдельно, если длина поста больше 1024 символов
 * 4. Отправляет множественные изображения группой
 * 5. Обрезает контент больше 4096 символов, добавляя "..."
 * 6. Сохраняет URL поста в БД
 */
async function publishToTelegram(content, telegramSettings) {
  // Импортируем новый процессор контента для Telegram
  // @ts-ignore
  const telegramProcessor = require('../utils/telegram-content-processor.js');
  
  // Переменная для хранения ID последнего отправленного сообщения
  let lastMessageId;
  
  // Расширенное логирование
  log(`Начинаем публикацию в Telegram контента: ${content.id}, title: "${content.title || 'без названия'}"`, 'telegram');
  log(`Настройки Telegram: ${JSON.stringify({
    hasSettings: !!telegramSettings,
    hasToken: !!telegramSettings?.token,
    hasChatId: !!telegramSettings?.chatId,
    token: telegramSettings?.token ? `${telegramSettings.token.substring(0, 6)}...` : 'отсутствует',
    chatId: telegramSettings?.chatId || 'отсутствует',
  })}`, 'telegram');
  
  // Проверяем наличие настроек
  if (!telegramSettings || !telegramSettings.token || !telegramSettings.chatId) {
    log(`Ошибка публикации в Telegram: отсутствуют настройки`, 'telegram');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: 'Отсутствуют настройки для Telegram (токен или ID чата). Убедитесь, что настройки заданы в кампании.'
    };
  }

  // Получаем токен и правильно форматированный chatId
  const token = telegramSettings.token;
  const chatId = telegramProcessor.formatChatId(telegramSettings.chatId);
  
  try {
    // Подготавливаем данные для публикации
    let postText = content.content || '';
    let titleText = content.title || '';
    const imageUrl = content.imageUrl || null;
    
    // Если есть заголовок, добавляем его как жирный текст в начало поста
    if (titleText) {
      postText = `<b>${titleText}</b>\n\n${postText}`;
    }
    
    // Обрабатываем дополнительные изображения
    const additionalImagesList = telegramProcessor.processAdditionalImages(content.additionalImages || []);
    
    log(`Подготовка публикации: наличие основного изображения: ${!!imageUrl}, дополнительных: ${additionalImagesList.length}, длина текста: ${postText.length}`, 'telegram');
    
    // Форматируем HTML-контент для Telegram
    const formattedPostText = telegramProcessor.processContentForTelegram(postText, 4093);
    
    // Определяем, нужно ли отправлять изображения отдельно от текста
    const sendImagesBeforeText = telegramProcessor.shouldSendImagesBeforeText(formattedPostText, 1024);
    
    // Создаем полный список изображений
    const allImages = [];
    if (imageUrl) {
      allImages.push(imageUrl);
    }
    allImages.push(...additionalImagesList);
    
    // Проверяем, есть ли изображения для отправки
    if (allImages.length === 0) {
      // 1. Только текст, без изображений
      log(`Отправка только текста в Telegram`, 'telegram');
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      try {
        const response = await axios.post(`${baseUrl}/sendMessage`, {
          chat_id: chatId,
          text: formattedPostText,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });
        
        if (!response.data || !response.data.ok) {
          log(`Ошибка при отправке текста: ${JSON.stringify(response.data)}`, 'telegram');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: response.data?.description || 'Ошибка отправки в Telegram'
          };
        }
        
        // Сообщение отправлено успешно
        lastMessageId = response.data.result.message_id;
        const messageUrl = this.constructTelegramMessageUrl(chatId, lastMessageId);
        
        log(`Текст успешно отправлен, message_id: ${lastMessageId}, URL: ${messageUrl}`, 'telegram');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          postId: lastMessageId?.toString(),
          postUrl: messageUrl
        };
      } catch (error) {
        log(`Ошибка API при отправке текста: ${error.message}`, 'telegram');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка API Telegram: ${error.message}`
        };
      }
    } else if (allImages.length === 1 && !sendImagesBeforeText) {
      // 2. Одно изображение с подписью (текст < 1024 символов)
      log(`Отправка одного изображения с подписью в Telegram`, 'telegram');
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      try {
        const response = await axios.post(`${baseUrl}/sendPhoto`, {
          chat_id: chatId,
          photo: allImages[0],
          caption: formattedPostText,
          parse_mode: 'HTML'
        });
        
        if (!response.data || !response.data.ok) {
          log(`Ошибка при отправке фото с подписью: ${JSON.stringify(response.data)}`, 'telegram');
          
          // Пробуем отправить только текст
          log(`Попытка отправить только текст`, 'telegram');
          return await this.sendFallbackTextMessage(token, chatId, formattedPostText);
        }
        
        // Сообщение отправлено успешно
        lastMessageId = response.data.result.message_id;
        const messageUrl = this.constructTelegramMessageUrl(chatId, lastMessageId);
        
        log(`Изображение с подписью успешно отправлено, message_id: ${lastMessageId}, URL: ${messageUrl}`, 'telegram');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          postId: lastMessageId?.toString(),
          postUrl: messageUrl
        };
      } catch (error) {
        log(`Ошибка API при отправке фото с подписью: ${error.message}`, 'telegram');
        
        // Пробуем отправить только текст
        return await this.sendFallbackTextMessage(token, chatId, formattedPostText);
      }
    } else {
      // 3. Несколько изображений как медиагруппа или изображения + длинный текст отдельно
      log(`Отправка ${allImages.length} изображений в Telegram, длинный текст: ${sendImagesBeforeText}`, 'telegram');
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      // Ограничиваем количество изображений до 10 (лимит Telegram)
      const MAX_TELEGRAM_MEDIA_GROUP = 10;
      const imagesToSend = allImages.slice(0, MAX_TELEGRAM_MEDIA_GROUP);
      
      if (allImages.length > MAX_TELEGRAM_MEDIA_GROUP) {
        log(`Превышен лимит Telegram (${MAX_TELEGRAM_MEDIA_GROUP}). Будет отправлено только ${MAX_TELEGRAM_MEDIA_GROUP} изображений.`, 'telegram');
      }
      
      try {
        let imageMessageId;
        
        // 3.1 Сначала отправляем изображения
        if (imagesToSend.length === 1) {
          // Отправляем одно изображение без подписи
          const imageResponse = await axios.post(`${baseUrl}/sendPhoto`, {
            chat_id: chatId,
            photo: imagesToSend[0],
            // Если текст короткий, отправляем его как подпись
            caption: sendImagesBeforeText ? '' : formattedPostText,
            parse_mode: 'HTML'
          });
          
          if (!imageResponse.data || !imageResponse.data.ok) {
            log(`Ошибка при отправке одиночного изображения: ${JSON.stringify(imageResponse.data)}`, 'telegram');
            
            // Пробуем отправить только текст
            return await this.sendFallbackTextMessage(token, chatId, formattedPostText);
          }
          
          imageMessageId = imageResponse.data.result.message_id;
          lastMessageId = imageMessageId;
          
          log(`Одиночное изображение успешно отправлено, message_id: ${imageMessageId}`, 'telegram');
        } else {
          // Отправляем группу изображений
          // Формируем media массив для отправки
          const mediaArray = imagesToSend.map((url, index) => {
            if (index === 0 && !sendImagesBeforeText) {
              // Первое изображение с подписью (если текст короткий)
              return {
                type: 'photo',
                media: url,
                caption: formattedPostText,
                parse_mode: 'HTML'
              };
            } else {
              // Остальные изображения без подписи
              return {
                type: 'photo',
                media: url
              };
            }
          });
          
          const mediaGroupResponse = await axios.post(`${baseUrl}/sendMediaGroup`, {
            chat_id: chatId,
            media: mediaArray
          });
          
          if (!mediaGroupResponse.data || !mediaGroupResponse.data.ok) {
            log(`Ошибка при отправке группы изображений: ${JSON.stringify(mediaGroupResponse.data)}`, 'telegram');
            
            // Пробуем отправить одно изображение + текст
            log(`Попытка отправить только первое изображение`, 'telegram');
            const singleImageResponse = await axios.post(`${baseUrl}/sendPhoto`, {
              chat_id: chatId,
              photo: imagesToSend[0],
              caption: sendImagesBeforeText ? '' : formattedPostText,
              parse_mode: 'HTML'
            });
            
            if (!singleImageResponse.data || !singleImageResponse.data.ok) {
              // Если и это не получилось, отправляем только текст
              return await this.sendFallbackTextMessage(token, chatId, formattedPostText);
            }
            
            imageMessageId = singleImageResponse.data.result.message_id;
            lastMessageId = imageMessageId;
            
            // Если текст длинный, отправляем его отдельно
            if (sendImagesBeforeText) {
              const textResponse = await axios.post(`${baseUrl}/sendMessage`, {
                chat_id: chatId,
                text: formattedPostText,
                parse_mode: 'HTML',
                disable_web_page_preview: true
              });
              
              if (textResponse.data && textResponse.data.ok) {
                lastMessageId = textResponse.data.result.message_id;
              }
            }
            
            const messageUrl = this.constructTelegramMessageUrl(chatId, lastMessageId);
            
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              postId: lastMessageId?.toString(),
              postUrl: messageUrl,
              warning: 'Группа изображений не отправлена, опубликовано только первое изображение'
            };
          }
          
          // Группа изображений отправлена успешно
          const messages = mediaGroupResponse.data.result || [];
          if (messages.length > 0) {
            imageMessageId = messages[0].message_id;
            lastMessageId = imageMessageId;
          }
          
          log(`Группа изображений успешно отправлена, message_id первого: ${imageMessageId}`, 'telegram');
        }
        
        // 3.2 Если текст длинный и изображения отправлены отдельно, отправляем текст отдельным сообщением
        if (sendImagesBeforeText) {
          log(`Отправка длинного текста отдельным сообщением`, 'telegram');
          const textResponse = await axios.post(`${baseUrl}/sendMessage`, {
            chat_id: chatId,
            text: formattedPostText,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          });
          
          if (textResponse.data && textResponse.data.ok) {
            // Обновляем lastMessageId на ID текстового сообщения, так как оно последнее
            lastMessageId = textResponse.data.result.message_id;
            log(`Текст успешно отправлен отдельным сообщением, message_id: ${lastMessageId}`, 'telegram');
          } else {
            log(`Предупреждение: изображения отправлены, но текст не удалось отправить`, 'telegram');
          }
        }
        
        // Формируем URL сообщения для возврата
        const messageUrl = this.constructTelegramMessageUrl(chatId, lastMessageId);
        
        log(`Публикация в Telegram завершена успешно, финальный message_id: ${lastMessageId}, URL: ${messageUrl}`, 'telegram');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          postId: lastMessageId?.toString(),
          postUrl: messageUrl
        };
      } catch (error) {
        log(`Ошибка API при отправке группы изображений: ${error.message}`, 'telegram');
        
        // Пробуем отправить только текст как запасной вариант
        return await this.sendFallbackTextMessage(token, chatId, formattedPostText);
      }
    }
  } catch (error) {
    log(`Общая ошибка при публикации в Telegram: ${error.message}`, 'telegram');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка при публикации в Telegram: ${error.message}`
    };
  }
}

/**
 * Вспомогательный метод для отправки текстового сообщения в случае ошибок с изображениями
 * @param {string} token Токен бота Telegram 
 * @param {string} chatId ID чата
 * @param {string} text Отформатированный текст для отправки
 * @returns {Promise<SocialPublication>} Результат публикации
 */
async function sendFallbackTextMessage(token, chatId, text) {
  log(`Отправка резервного текстового сообщения в Telegram`, 'telegram');
  const baseUrl = `https://api.telegram.org/bot${token}`;
  
  try {
    const response = await axios.post(`${baseUrl}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    
    if (!response.data || !response.data.ok) {
      log(`Ошибка при отправке резервного текста: ${JSON.stringify(response.data)}`, 'telegram');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: response.data?.description || 'Ошибка отправки текста в Telegram'
      };
    }
    
    // Сообщение отправлено успешно
    const messageId = response.data.result.message_id;
    const messageUrl = this.constructTelegramMessageUrl(chatId, messageId);
    
    log(`Резервный текст успешно отправлен, message_id: ${messageId}, URL: ${messageUrl}`, 'telegram');
    
    return {
      platform: 'telegram',
      status: 'published',
      publishedAt: new Date(),
      postId: messageId.toString(),
      postUrl: messageUrl,
      warning: 'Изображения не отправлены, опубликован только текст'
    };
  } catch (error) {
    log(`Критическая ошибка API при отправке резервного текста: ${error.message}`, 'telegram');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Критическая ошибка API Telegram: ${error.message}`
    };
  }
}