  /**
   * Загружает изображение из URL и отправляет его в Telegram
   * @param imageUrl URL изображения для загрузки
   * @param chatId ID чата для отправки
   * @param caption Текст подписи к изображению
   * @param token Токен Telegram API
   * @param baseUrl Базовый URL Telegram API
   * @returns Ответ от Telegram API
   */
  private async uploadTelegramImageFromUrl(
    imageUrl: string,
    chatId: string,
    caption: string,
    token: string,
    baseUrl = 'https://api.telegram.org/bot'
  ): Promise<any> {
    try {
      log(`📥 [TG] НАЧАЛО ЗАГРУЗКИ ИЗОБРАЖЕНИЯ В TELEGRAM`, 'social-publishing');
      log(`🔵 [TG: ШАГ 1] Подготовка URL для загрузки: ${imageUrl.substring(0, 100)}...`, 'social-publishing');
      
      // ШАГ 2: Скачивание изображения из указанного URL
      log(`🟠 [TG: ШАГ 2] Скачиваем изображение напрямую: ${imageUrl.substring(0, 100)}...`, 'social-publishing');
      
      // Настройка запроса для скачивания файла с правильными заголовками
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // увеличиваем таймаут до 30 секунд
        headers: {
          'Accept': 'image/*',
          'User-Agent': 'Mozilla/5.0 SMM Planner Bot'
        }
      });
      
      log(`🟢 [TG: ШАГ 3] Получен ответ от сервера изображений, тип данных: ${typeof imageResponse.data}`, 'social-publishing');
      
      // Проверка типа полученных данных
      if (!imageResponse.data || !(imageResponse.data instanceof Buffer || imageResponse.data instanceof ArrayBuffer)) {
        log(`🔴 [TG: ШАГ 3] ОШИБКА: Неверный тип данных в ответе: ${typeof imageResponse.data}`, 'social-publishing');
        throw new Error(`Неверный тип данных при скачивании изображения: ${typeof imageResponse.data}`);
      }
      
      // Проверяем размер скачанных данных
      const dataSize = imageResponse.data.length;
      log(`🟢 [TG: ШАГ 4] Размер скачанных данных: ${dataSize} байт`, 'social-publishing');
      
      if (dataSize === 0) {
        log(`🟢 [TG: ШАГ 4] ОШИБКА: Скачан пустой файл (0 байт)`, 'social-publishing');
        throw new Error('Скачанный файл имеет нулевой размер');
      }
      
      if (dataSize < 100) {
        log(`🟢 [TG: ШАГ 4] ПРЕДУПРЕЖДЕНИЕ: Очень маленький размер файла (${dataSize} байт)`, 'social-publishing');
      }
      
      // ШАГ 5: Сохранение во временный файл
      log(`🔵 [TG: ШАГ 5] Сохраняем скачанные данные во временный файл...`, 'social-publishing');
      
      // Создаем временную директорию, если её нет
      const tempDir = path.join(os.tmpdir(), 'telegram_uploads');
      try {
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
          log(`🔵 [TG: ШАГ 5] Создана временная директория: ${tempDir}`, 'social-publishing');
        } else {
          log(`🔵 [TG: ШАГ 5] Временная директория уже существует: ${tempDir}`, 'social-publishing');
        }
      } catch (mkdirError: any) {
        log(`🔵 [TG: ШАГ 5] ОШИБКА при создании временной директории: ${mkdirError.message}`, 'social-publishing');
        log(`🔵 [TG: ШАГ 5] Используем корневую временную директорию`, 'social-publishing');
      }
    
      // Генерируем уникальное имя файла
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 10);
      const tempFilePath = path.join(tempDir, `telegram_${timestamp}_${randomString}.jpg`);
      
      // Сохраняем изображение во временный файл
      fs.writeFileSync(tempFilePath, Buffer.from(imageResponse.data));
      log(`💾 Создан временный файл: ${tempFilePath}, размер: ${fs.statSync(tempFilePath).size} байт`, 'social-publishing');
      
      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
      
      // Добавляем файл изображения в форму
      const fileStream = fs.createReadStream(tempFilePath);
      formData.append('photo', fileStream, { filename: `image_${timestamp}.jpg` });
      
      log(`📤 Отправляем файл в Telegram API через multipart/form-data`, 'social-publishing');
      
      try {
        // Отправляем запрос в Telegram API
        const response = await axios.post(`${baseUrl}${token}/sendPhoto`, formData, {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/json'
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 30000 // увеличиваем таймаут до 30 секунд
        });
        
        log(`✅ Успешный ответ от Telegram API: ${JSON.stringify(response.data)}`, 'social-publishing');
        return response.data;
      } catch (uploadError: any) {
        log(`❌ Ошибка при отправке изображения в Telegram API: ${uploadError.message}`, 'social-publishing');
        if (uploadError.response) {
          log(`📄 Данные ответа при ошибке: ${JSON.stringify(uploadError.response.data)}`, 'social-publishing');
        }
        throw uploadError;
      } finally {
        // Закрываем стрим чтения файла
        fileStream.destroy();
        
        // Удаляем временный файл
        try {
          fs.unlinkSync(tempFilePath);
          log(`🗑️ Временный файл удален: ${tempFilePath}`, 'social-publishing');
        } catch (unlinkError: any) {
          log(`⚠️ Ошибка при удалении временного файла: ${unlinkError.message}`, 'social-publishing');
        }
      }
    } catch (error: any) {
      log(`❌ ОШИБКА при загрузке изображения в Telegram: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`📄 Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      throw error;
    }
  }

  /**
   * Публикует контент в Telegram
   * @param content Контент для публикации
   * @param telegramSettings Настройки Telegram API
   * @returns Результат публикации
   */
  async publishToTelegram(
    content: CampaignContent,
    telegramSettings?: SocialMediaSettings['telegram']
  ): Promise<SocialPublication> {
    log(`▶️ Начата публикация в Telegram. Контент ID: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
    log(`▶️ Настройки для публикации в Telegram: chatId=${telegramSettings?.chatId?.substring(0, 6)}..., token=${telegramSettings?.token?.substring(0, 6)}...`, 'social-publishing');
    
    if (!telegramSettings?.token || !telegramSettings?.chatId) {
      log(`❌ ОШИБКА: Отсутствуют настройки для Telegram (token=${!!telegramSettings?.token}, chatId=${!!telegramSettings?.chatId})`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для Telegram (токен или ID чата)'
      };
    }

    try {
      const { token, chatId } = telegramSettings;
      log(`Публикация в Telegram. Контент: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
      log(`Публикация в Telegram. Чат: ${chatId}, Токен: ${token.substring(0, 6)}...`, 'social-publishing');

      // Обрабатываем поле additionalImages в контенте
      content = this.processAdditionalImages(content, 'telegram');
      
      // Форматируем HTML-контент для Telegram с сохранением структуры
      const formattedText = this.formatHtmlContent(content.content, 'telegram');
      log(`Форматированный текст для Telegram: длина ${formattedText.length} символов`, 'social-publishing');
      
      // Публикация в зависимости от типа контента
      if (content.contentType === 'text') {
        log(`Публикация текстового контента в Telegram (ID: ${content.id})`, 'social-publishing');
        
        // Базовый URL для API Telegram
        const baseUrl = 'https://api.telegram.org/bot';
        
        // Отправляем текстовый контент с форматированием HTML
        const response = await axios.post(`${baseUrl}${token}/sendMessage`, {
          chat_id: chatId,
          text: formattedText,
          parse_mode: 'HTML',
          disable_web_page_preview: false // Разрешаем предпросмотр веб-страниц в ссылках
        });
        
        log(`Успешная публикация в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
        
        // Получаем URL поста из ответа API
        const messageId = response.data.result.message_id;
        // Формируем URL поста в Telegram (формат t.me/c/channelid/messageid)
        const postUrl = chatId.startsWith('@')
          ? `https://t.me/${chatId.substring(1)}`
          : chatId.startsWith('-100')
            ? `https://t.me/c/${chatId.substring(4)}/${messageId}`
            : null;
            
        log(`URL поста в Telegram: ${postUrl}`, 'social-publishing');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          publishedUrl: postUrl,
          postId: messageId?.toString() || null
        };
      } 
      else if (content.contentType === 'image') {
        log(`Публикация изображения в Telegram (ID: ${content.id})`, 'social-publishing');
        
        // Проверка наличия изображения
        if (!content.imageUrl) {
          log(`Ошибка: Отсутствует URL изображения для публикации в Telegram`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: 'Отсутствует URL изображения'
          };
        }
        
        // Обрабатываем URL изображения для проксирования через наш сервер
        const processedImageUrl = this.processImageUrl(content.imageUrl, 'telegram');
        log(`Обработанный URL изображения для Telegram: ${processedImageUrl}`, 'social-publishing');
        
        // Базовый URL для API Telegram
        const baseUrl = 'https://api.telegram.org/bot';
        
        try {
          // Отправляем изображение с подписью
          const response = await this.uploadTelegramImageFromUrl(
            processedImageUrl,
            chatId,
            formattedText, // Используем форматированный HTML-текст как подпись
            token,
            baseUrl
          );
          
          log(`Успешная публикация изображения в Telegram: ${JSON.stringify(response)}`, 'social-publishing');
          
          // Получаем данные о публикации из ответа API
          const messageId = response.result.message_id;
          
          // Формируем URL поста в Telegram (формат t.me/c/channelid/messageid)
          const postUrl = chatId.startsWith('@')
            ? `https://t.me/${chatId.substring(1)}`
            : chatId.startsWith('-100')
              ? `https://t.me/c/${chatId.substring(4)}/${messageId}`
              : null;
              
          log(`URL поста с изображением в Telegram: ${postUrl}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            publishedUrl: postUrl,
            postId: messageId?.toString() || null
          };
        } catch (uploadError: any) {
          log(`Ошибка при загрузке изображения в Telegram: ${uploadError.message}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: `Ошибка загрузки изображения: ${uploadError.message}`
          };
        }
      }
      else if (content.contentType === 'carousel') {
        log(`Публикация карусели в Telegram (ID: ${content.id})`, 'social-publishing');
        
        // Проверяем наличие основного изображения или дополнительных изображений
        if (!content.imageUrl && (!content.additionalImages || content.additionalImages.length === 0)) {
          log(`Ошибка: Отсутствуют изображения для карусели в Telegram`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: 'Отсутствуют изображения для карусели'
          };
        }
        
        // Собираем все URL изображений
        const imageUrls: string[] = [];
        
        // Добавляем основное изображение, если оно есть
        if (content.imageUrl) {
          imageUrls.push(this.processImageUrl(content.imageUrl, 'telegram'));
        }
        
        // Добавляем дополнительные изображения
        if (content.additionalImages && Array.isArray(content.additionalImages) && content.additionalImages.length > 0) {
          content.additionalImages.forEach((imgUrl) => {
            if (typeof imgUrl === 'string' && imgUrl.trim()) {
              imageUrls.push(this.processImageUrl(imgUrl, 'telegram'));
            } else if (typeof imgUrl === 'object' && imgUrl.url) {
              imageUrls.push(this.processImageUrl(imgUrl.url, 'telegram'));
            }
          });
        }
        
        log(`Всего изображений для карусели в Telegram: ${imageUrls.length}`, 'social-publishing');
        
        if (imageUrls.length === 0) {
          log(`Ошибка: После обработки не найдено валидных URL изображений для карусели`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: 'Нет валидных URL изображений для карусели'
          };
        }
        
        // Для Telegram карусель отправляется как группа изображений через sendMediaGroup
        // Формируем массив медиа-объектов
        const mediaObjects = imageUrls.map((url, index) => {
          return {
            type: 'photo',
            media: url,
            caption: index === 0 ? formattedText : '', // Подпись только для первого изображения
            parse_mode: 'HTML'
          };
        });
        
        log(`Медиа-объекты для Telegram: ${JSON.stringify(mediaObjects)}`, 'social-publishing');
        
        // Создаем временные файлы для каждого изображения
        const tempFiles: string[] = [];
        const mediaItems = [];
        
        try {
          // Создаем временную директорию
          const tempDir = path.join(os.tmpdir(), 'telegram_carousel');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          // Скачиваем каждое изображение во временный файл
          for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 10);
            const tempFilePath = path.join(tempDir, `telegram_carousel_${i}_${timestamp}_${randomString}.jpg`);
            
            // Скачиваем изображение
            log(`Скачивание изображения ${i+1}/${imageUrls.length} для карусели: ${url.substring(0, 100)}...`, 'social-publishing');
            const response = await axios.get(url, {
              responseType: 'arraybuffer',
              timeout: 30000,
              headers: {
                'Accept': 'image/*',
                'User-Agent': 'Mozilla/5.0 SMM Planner Bot'
              }
            });
            
            // Проверяем размер
            const dataSize = response.data.length;
            if (dataSize === 0) {
              log(`ОШИБКА: Скачан пустой файл (0 байт) для изображения ${i+1}`, 'social-publishing');
              continue; // Пропускаем это изображение
            }
            
            // Сохраняем файл
            fs.writeFileSync(tempFilePath, Buffer.from(response.data));
            log(`Сохранено изображение ${i+1} во временный файл: ${tempFilePath}`, 'social-publishing');
            tempFiles.push(tempFilePath);
            
            // Создаем FormData для каждого изображения
            const formData = new FormData();
            formData.append('chat_id', chatId);
            
            // Первое изображение с подписью, остальные без
            if (i === 0) {
              formData.append('caption', formattedText);
              formData.append('parse_mode', 'HTML');
            }
            
            // Добавляем файл
            const fileStream = fs.createReadStream(tempFilePath);
            formData.append('photo', fileStream, { filename: `image_${timestamp}_${i}.jpg` });
            
            // Отправляем изображение в Telegram
            try {
              const baseUrl = 'https://api.telegram.org/bot';
              const uploadResponse = await axios.post(`${baseUrl}${token}/sendPhoto`, formData, {
                headers: {
                  ...formData.getHeaders(),
                  'Accept': 'application/json'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 30000
              });
              
              fileStream.destroy(); // Закрываем стрим
              
              log(`Успешно отправлено изображение ${i+1} в Telegram`, 'social-publishing');
              
              // Добавляем полученное медиа-ID в массив для формирования группы
              mediaItems.push({
                index: i,
                messageId: uploadResponse.data.result.message_id
              });
            } catch (uploadError: any) {
              fileStream.destroy(); // Обязательно закрываем стрим при ошибке
              log(`Ошибка при отправке изображения ${i+1} в Telegram: ${uploadError.message}`, 'social-publishing');
              if (uploadError.response) {
                log(`Данные ошибки: ${JSON.stringify(uploadError.response.data)}`, 'social-publishing');
              }
            }
          }
          
          // Удаляем временные файлы
          tempFiles.forEach(file => {
            try {
              fs.unlinkSync(file);
              log(`Удален временный файл: ${file}`, 'social-publishing');
            } catch (unlinkError) {
              log(`Ошибка при удалении временного файла: ${unlinkError}`, 'social-publishing');
            }
          });
          
          // Проверяем, успешно ли загружены какие-либо изображения
          if (mediaItems.length === 0) {
            log(`Ошибка: Не удалось отправить ни одно изображение для карусели`, 'social-publishing');
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: 'Не удалось отправить ни одно изображение для карусели'
            };
          }
          
          // Сортируем медиа-элементы по индексу
          mediaItems.sort((a, b) => a.index - b.index);
          
          // Формируем URL первого поста для возврата
          // Формируем URL поста в Telegram (формат t.me/c/channelid/messageid)
          const firstMessageId = mediaItems[0]?.messageId;
          const postUrl = chatId.startsWith('@')
            ? `https://t.me/${chatId.substring(1)}`
            : chatId.startsWith('-100')
              ? `https://t.me/c/${chatId.substring(4)}/${firstMessageId}`
              : null;
              
          log(`URL первого изображения карусели в Telegram: ${postUrl}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            publishedUrl: postUrl,
            postId: firstMessageId?.toString() || null
          };
          
        } catch (carouselError: any) {
          log(`Ошибка при публикации карусели в Telegram: ${carouselError.message}`, 'social-publishing');
          
          // Удаляем все временные файлы
          tempFiles.forEach(file => {
            try {
              if (fs.existsSync(file)) {
                fs.unlinkSync(file);
              }
            } catch (e) {
              // Игнорируем ошибки при очистке
            }
          });
          
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: `Ошибка публикации карусели: ${carouselError.message}`
          };
        }
      }
      
      // Если тип контента не поддерживается
      log(`Неподдерживаемый тип контента для Telegram: ${content.contentType}`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Неподдерживаемый тип контента: ${content.contentType}`
      };
    } catch (error: any) {
      log(`Общая ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
      
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка публикации: ${error.message}`
      };
    }
  }