import axios from 'axios';
import { log } from '../../utils/logger';
import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { BaseSocialService } from './base-service';

/**
 * Сервис для публикации контента в Telegram
 */
export class TelegramService extends BaseSocialService {
  // Храним username канала, полученный в процессе публикации
  private currentChatUsername?: string;
  /**
   * Форматирует текст для публикации в Telegram с учетом поддерживаемых HTML-тегов
   * @param content Исходный текст контента
   * @returns Отформатированный текст для Telegram с поддержкой HTML
   */
  public formatTextForTelegram(content: string): string {
    // Логируем начало обработки
    log(`Начало форматирования текста для Telegram, размер: ${content?.length || 0} символов`, 'social-publishing');
    if (!content || typeof content !== 'string') {
      return '';
    }
    
    // Сохраняем исходный текст для логирования
    const originalLength = content.length;
    
    try {
      // Telegram поддерживает только ограниченный набор HTML-тегов:
      // <b>, <strong>, <i>, <em>, <u>, <s>, <strike>, <code>, <pre>, <a href="...">
      
      log(`Форматирование текста для Telegram, исходная длина: ${originalLength} символов`, 'social-publishing');
      
      // Используем исходный контент HTML
      let cleanedContent = content;
      
      // Сразу начинаем обработку HTML
      let formattedText = cleanedContent;
        
      // Обработка многострочных блочных элементов
      formattedText = formattedText
        // Преобразуем разрывы строк
        .replace(/<br\s*\/?>/gi, '\n')
        // Двойной проход с использованием выражений для поддержки многострочных тегов
        .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
        .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
        .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n\n')
        
        // Преобразуем все остальные блочные элементы, которые не поддерживаются Telegram
        .replace(/<(?:article|section|aside|header|footer|nav|main)[^>]*>([\s\S]*?)<\/(?:article|section|aside|header|footer|nav|main)>/gi, '$1\n')
        
        // Обработка списков
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
        .replace(/<(?:ul|ol)[^>]*>([\s\S]*?)<\/(?:ul|ol)>/gi, '$1\n')
        
        // Обработка таблиц
        .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, '$1\n')
        .replace(/<(?:table|thead|tbody|tfoot)[^>]*>([\s\S]*?)<\/(?:table|thead|tbody|tfoot)>/gi, '$1\n\n')
        
        // Приводим HTML-теги к поддерживаемым в Telegram форматам
        .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>')
        .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '<b>$1</b>')
        .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>')
        .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '<i>$1</i>')
        .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>')
        .replace(/<ins[^>]*>([\s\S]*?)<\/ins>/gi, '<u>$1</u>')
        .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '<s>$1</s>')
        .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '<s>$1</s>')
        .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '<s>$1</s>')
        .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '<code>$1</code>')
        .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '<pre>$1</pre>')
        
        // Обрабатываем ссылки по формату Telegram
        .replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '<a href="$1">$2</a>');
      
      // Убираем лишние переносы строк (более 2 подряд)
      formattedText = formattedText.replace(/\n{3,}/g, '\n\n');
      
      // Сохраняем поддерживаемые HTML-теги и удаляем только неподдерживаемые
      formattedText = formattedText.replace(/<(?!\/?(?:b|i|u|s|code|pre|a\b)[^>]*>)[^>]+>/gi, '');
      
      // Удаление невидимых символов (сохраняем для совместимости)
      formattedText = formattedText
        .replace(/\u200B/g, '') // Zero-width space
        .replace(/\u200C/g, '') // Zero-width non-joiner
        .replace(/\u200D/g, '') // Zero-width joiner
        .replace(/\uFEFF/g, ''); // Zero-width no-break space
      
      // Проверка на длинные слова
      const longWordsFound = formattedText.match(/[^\s]{100,}/g);
      if (longWordsFound && longWordsFound.length > 0) {
        log(`Предупреждение: найдены очень длинные слова (>100 символов), которые могут вызвать проблемы в Telegram: ${longWordsFound.length} шт.`, 'social-publishing');
      }
      
      // Обрезаем текст до 4096 символов (максимальное количество для Telegram)
      if (formattedText.length > 4096) {
        formattedText = formattedText.substring(0, 4093) + '...';
        log(`Предупреждение: текст для Telegram был обрезан до 4096 символов (исходный: ${originalLength})`, 'social-publishing');
      }
      
      // Отладочный вывод образцов отформатированного текста
      if (formattedText.length > 0) {
        log(`Отформатированный текст для Telegram (${formattedText.length} символов) начинается с: ${formattedText.substring(0, Math.min(100, formattedText.length))}...`, 'social-publishing');
      }
      
      return formattedText;
      
    } catch (error) {
      log(`Ошибка при форматировании текста для Telegram: ${error}`, 'social-publishing');
      // В случае ошибки возвращаем обычный текст без форматирования
      if (content.length > 4096) {
        return content.substring(0, 4093) + '...';
      }
      return content;
    }
  }
  
  /**
   * Проверяет, является ли HTML-код валидным для Telegram
   * @param text Текст с HTML-разметкой
   * @returns true, если HTML валиден для Telegram
   */
  public isValidHtmlForTelegram(text: string): boolean {
    // Если текст не содержит HTML, считаем его валидным
    if (!text.includes('<') || !text.includes('>')) {
      return true;
    }
    
    // Проверяем количество открывающих и закрывающих тегов
    const openTagRegex = /<(b|strong|i|em|u|ins|s|strike|del|code|pre|a)(?:\s+[^>]*)?>/gi;
    const closeTagRegex = /<\/(b|strong|i|em|u|ins|s|strike|del|code|pre|a)>/gi;
    
    const openMatches = text.match(openTagRegex) || [];
    const closeMatches = text.match(closeTagRegex) || [];
    
    // Если количество не совпадает, значит есть незакрытые теги
    if (openMatches.length !== closeMatches.length) {
      log(`HTML не валиден для Telegram: открывающих тегов ${openMatches.length}, закрывающих ${closeMatches.length}`, 'social-publishing');
      return false;
    }
    
    // Проверяем наличие неподдерживаемых тегов
    const unsupportedTagRegex = /<(?!\/?(b|strong|i|em|u|ins|s|strike|del|code|pre|a))[a-z][^>]*>/gi;
    const unsupportedMatches = text.match(unsupportedTagRegex) || [];
    
    if (unsupportedMatches.length > 0) {
      log(`HTML содержит неподдерживаемые Telegram теги: ${unsupportedMatches.slice(0, 5).join(', ')}${unsupportedMatches.length > 5 ? '...' : ''}`, 'social-publishing');
      return false;
    }
    
    // Базовая проверка на корректное вложение тегов (в идеале нужен полноценный парсер)
    // Но для простых случаев это может быть достаточно
    return true;
  }
  
  /**
   * Исправляет незакрытые HTML-теги в тексте
   * @param text Текст с HTML-разметкой
   * @returns Текст с исправленными незакрытыми тегами
   */
  public fixUnclosedTags(text: string): string {
    // Расширенный список поддерживаемых Telegram тегов и их синонимов
    const tagMapping: { [key: string]: string } = {
      'b': 'b', 'strong': 'b',
      'i': 'i', 'em': 'i',
      'u': 'u', 'ins': 'u',
      's': 's', 'strike': 's', 'del': 's',
      'code': 'code', 'pre': 'pre', 'a': 'a'
    };
    
    // Список поддерживаемых тегов для проверки
    const supportedTags = Object.keys(tagMapping);
    
    // Подсчитываем количество открывающих и закрывающих тегов
    const openTagRegex = /<(b|strong|i|em|u|ins|s|strike|del|code|pre|a)(?:\s+[^>]*)?>/gi;
    const closeTagRegex = /<\/(b|strong|i|em|u|ins|s|strike|del|code|pre|a)>/gi;
    
    const openMatches = text.match(openTagRegex) || [];
    const closeMatches = text.match(closeTagRegex) || [];
    
    // Проверяем несоответствие в количестве тегов
    if (openMatches.length !== closeMatches.length) {
      log(`Внимание: количество открывающих (${openMatches.length}) и закрывающих (${closeMatches.length}) HTML-тегов не совпадает. Это может вызвать ошибку при отправке в Telegram.`, 'social-publishing');
    }
    
    // Преобразуем текст с помощью DOMParser для правильной обработки тегов
    // Но так как это серверный JS, используем регулярные выражения
    
    // Создаем стек для отслеживания открытых тегов
    const stack: string[] = [];
    
    // Регулярное выражение для поиска всех HTML-тегов, включая атрибуты
    const tagRegex = /<\/?([a-z]+)(?:\s+[^>]*)?>/gi;
    let match;
    let processedText = text;
    let lastIndex = 0;
    
    // Временная строка для построения обработанного текста
    let resultText = '';
    
    // Выполняем проход по всем тегам в тексте
    while ((match = tagRegex.exec(text)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      const mappedTag = tagMapping[tagName];
      
      // Проверяем, является ли тег поддерживаемым
      if (!supportedTags.includes(tagName)) {
        continue; // Пропускаем неподдерживаемые теги
      }
      
      // Получаем текст до текущего тега
      const textBeforeTag = text.substring(lastIndex, match.index);
      resultText += textBeforeTag;
      
      const isClosing = fullTag.startsWith('</');
      
      if (isClosing) {
        // Если это закрывающий тег
        if (stack.length > 0) {
          // Проверяем, соответствует ли он последнему открытому или его синониму
          const lastOpenTag = stack[stack.length - 1];
          const lastOpenMapped = tagMapping[lastOpenTag];
          const currentMapped = tagMapping[tagName];
          
          if (lastOpenMapped === currentMapped) {
            // Правильное закрытие, добавляем тег в стандартизированной форме
            resultText += `</${currentMapped}>`;
            stack.pop();
          } else {
            // Неправильный порядок закрытия, закрываем текущий тег так, как он был открыт
            resultText += `</${currentMapped}>`;
            
            // Ищем, есть ли такой тег в стеке
            const indexInStack = stack.findIndex(tag => tagMapping[tag] === currentMapped);
            if (indexInStack !== -1) {
              // Закрываем все теги до найденного
              for (let i = stack.length - 1; i > indexInStack; i--) {
                const tagToClose = tagMapping[stack[i]];
                resultText += `</${tagToClose}>`;
              }
              
              // Удаляем закрытые теги из стека
              stack.splice(indexInStack);
            }
          }
        } else {
          // Закрывающий тег без открывающего, просто добавляем его
          resultText += `</${mappedTag}>`;
        }
      } else {
        // Если это открывающий тег
        // Добавляем тег в стек
        stack.push(tagName);
        // Добавляем тег в результат (сохраняем оригинальный формат)
        resultText += fullTag;
      }
      
      lastIndex = match.index + fullTag.length;
    }
    
    // Добавляем оставшийся текст
    resultText += text.substring(lastIndex);
    
    // Закрываем все оставшиеся открытые теги
    for (let i = stack.length - 1; i >= 0; i--) {
      const tagToClose = tagMapping[stack[i]];
      resultText += `</${tagToClose}>`;
    }
    
    // Если есть незакрытые теги, логируем это
    if (stack.length > 0) {
      log(`Исправлены незакрытые HTML-теги: ${stack.join(', ')}`, 'social-publishing');
    }
    
    return resultText;
  }

  formatTelegramUrl(chatId: string, formattedChatId: string, messageId?: number | string | undefined, chatUsername?: string): string {
    // Сохраняем username для использования в generatePostUrl
    if (chatUsername) {
      this.currentChatUsername = chatUsername;
    }
    log(`Форматирование Telegram URL: chatId=${chatId}, formattedChatId=${formattedChatId}, messageId=${messageId || 'не указан'}, username=${chatUsername || 'не указан'}`, 'social-publishing');
    
    // Использование фиксированного канала для URL (как запросил пользователь)
    const hardcodedChannel = 'ya_delayu_moschno';
    
    // Если messageId не указан или пустой/null/undefined/"" - используем дефолтный URL с каналом
    if (!messageId) {
      log(`messageId не указан, используем URL для канала`, 'social-publishing');
      
      // По умолчанию используем hardcoded канал
      return `https://t.me/${hardcodedChannel}`;
    }
    
    // Если указан messageId, форматируем правильный URL поста с использованием hardcoded канала
    const url = `https://t.me/${hardcodedChannel}/${messageId}`;
    log(`Сформирован URL для канала с hardcoded именем: ${url}`, 'social-publishing');
    return url;
  }

  /**
   * Публикует контент в Telegram с использованием Imgur для изображений
   * @param content Контент для публикации
   * @param settings Настройки социальной сети
   * @returns Promise с результатом публикации
   */
  public async publishContent(content: CampaignContent, settings: SocialMediaSettings): Promise<SocialPublication> {
    const telegramSettings = settings.telegram;
    if (!telegramSettings) {
      throw new Error('Настройки Telegram не указаны');
    }
    
    const { token, chatId } = telegramSettings;
    if (!token || !chatId) {
      throw new Error('Токен бота или ID чата не указаны в настройках Telegram');
    }
    
    // Базовая информация о публикации
    const publication: SocialPublication = {
      platformType: SocialPlatform.TELEGRAM,
      contentId: content.id,
      status: 'draft',
      error: null
    };
    
    try {
      // Предварительно очищаем ID чата от возможных префиксов
      let formattedChatId = chatId;
      
      // Если это username канала (начинается с @), оставляем как есть
      if (!chatId.startsWith('@')) {
        // Если ID начинается с числа, добавляем префикс -100 для API
        if (!chatId.startsWith('-') && !isNaN(Number(chatId))) {
          formattedChatId = `-100${chatId}`;
          log(`Форматирование chatId: числовой ID ${chatId} преобразован в ${formattedChatId}`, 'social-publishing');
        }
      }
      
      // Формируем базовый URL для API Telegram
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      // Пробуем получить информацию о чате для определения типа и username
      let chatInfo: any = null;
      let chatType: string = 'unknown';
      let chatUsername: string | undefined = undefined;
      
      try {
        const chatResponse = await axios.get(`${baseUrl}/getChat`, {
          params: { chat_id: formattedChatId },
          validateStatus: () => true
        });
        
        if (chatResponse.status === 200 && chatResponse.data.ok && chatResponse.data.result) {
          chatInfo = chatResponse.data.result;
          chatType = chatInfo.type || 'unknown';
          chatUsername = chatInfo.username;
          
          log(`Получена информация о чате: ID=${chatId}, тип=${chatType}, username=${chatUsername || 'отсутствует'}`, 'social-publishing');
        } else {
          log(`Не удалось получить информацию о чате: ${JSON.stringify(chatResponse.data)}`, 'social-publishing');
        }
      } catch (error) {
        log(`Ошибка при запросе информации о чате: ${error}`, 'social-publishing');
      }
      
      // Проверяем тип контента (текст или изображение)
      let result: any;
      
      // Проверяем наличие изображения для публикации
      const hasMainImage = !!content.image;
      const hasAdditionalImages = Array.isArray(content.additional_images) && content.additional_images.length > 0;
      
      // Форматируем текст контента для Telegram с поддержкой HTML
      let formattedText = content.text || '';
      
      // Если текст содержит HTML-разметку, форматируем его
      if (formattedText.includes('<') && formattedText.includes('>')) {
        formattedText = this.formatTextForTelegram(formattedText);
        
        // Проверяем, нет ли незакрытых тегов, и исправляем их
        if (!this.isValidHtmlForTelegram(formattedText)) {
          log(`HTML-разметка содержит ошибки, попытка исправления...`, 'social-publishing');
          formattedText = this.fixUnclosedTags(formattedText);
        }
      }
      
      // Если есть изображения, отправляем их
      if (hasMainImage || hasAdditionalImages) {
        log(`Публикация контента с изображениями: hasMainImage=${hasMainImage}, hasAdditionalImages=${hasAdditionalImages}`, 'social-publishing');
        
        // Собираем все изображения для отправки
        const images: string[] = [];
        
        // Добавляем основное изображение, если оно есть
        if (hasMainImage && content.image) {
          images.push(content.image);
        }
        
        // Добавляем дополнительные изображения, если они есть
        if (hasAdditionalImages && Array.isArray(content.additional_images)) {
          // Добавляем проверку типов
          content.additional_images.forEach((img: any) => {
            if (typeof img === 'string' && img.trim()) {
              images.push(img);
            } else if (img && typeof img === 'object' && img.url && typeof img.url === 'string') {
              images.push(img.url);
            }
          });
        }
        
        // Если есть текст, используем его как подпись к первому изображению
        if (formattedText) {
          // Отправляем первое изображение с подписью
          if (images.length > 0) {
            const firstImage = images[0];
            
            try {
              const response = await axios.post(`${baseUrl}/sendPhoto`, {
                chat_id: formattedChatId,
                photo: firstImage,
                caption: formattedText,
                parse_mode: 'HTML'
              }, {
                validateStatus: () => true
              });
              
              if (response.status === 200 && response.data.ok) {
                log(`Изображение с подписью успешно отправлено в Telegram`, 'social-publishing');
                
                // Получаем ID сообщения для формирования URL
                const messageId = response.data.result.message_id;
                
                // Формируем URL публикации
                const postUrl = this.formatTelegramUrl(chatId, formattedChatId, messageId, chatUsername);
                
                publication.platformPostUrl = postUrl;
                publication.status = 'published';
                publication.publishedAt = new Date().toISOString();
                
                // Если есть дополнительные изображения, отправляем их без текста
                if (images.length > 1) {
                  const remainingImages = images.slice(1);
                  
                  // Вызываем отдельный метод для отправки группы изображений
                  const additionalResult = await this.sendImagesToTelegram(formattedChatId, token, remainingImages);
                  
                  if (!additionalResult.success) {
                    log(`Предупреждение: основное изображение с текстом отправлено, но дополнительные изображения не удалось отправить: ${additionalResult.error}`, 'social-publishing');
                  } else {
                    log(`Все дополнительные изображения успешно отправлены`, 'social-publishing');
                  }
                }
                
                return publication;
              } else {
                throw new Error(`Ошибка при отправке изображения с подписью: ${response.data?.description || JSON.stringify(response.data)}`);
              }
            } catch (error: any) {
              if (error.response) {
                log(`Данные ответа API при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
              }
              throw new Error(`Ошибка при отправке изображения с подписью: ${error.message}`);
            }
          }
        } else {
          // Только изображения без текста
          log(`Отправка только изображений без текста, количество: ${images.length}`, 'social-publishing');
          
          // Вызываем отдельный метод для отправки группы изображений
          const result = await this.sendImagesToTelegram(formattedChatId, token, images);
          
          if (result.success) {
            log(`Изображения успешно отправлены в Telegram, идентификаторы: ${result.messageIds?.join(', ')}`, 'social-publishing');
            
            // Формируем URL публикации
            const messageId = result.messageIds?.[0];
            const postUrl = messageId ? this.formatTelegramUrl(chatId, formattedChatId, messageId, chatUsername) : undefined;
            
            publication.platformPostUrl = postUrl || result.messageUrl;
            publication.status = 'published';
            publication.publishedAt = new Date().toISOString();
            
            return publication;
          } else {
            throw new Error(`Ошибка при отправке изображений: ${result.error}`);
          }
        }
      } else {
        // Только текст без изображений
        log(`Отправка только текста без изображений, длина: ${formattedText.length} символов`, 'social-publishing');
        
        try {
          // Используем метод sendMessage для отправки только текста
          const response = await axios.post(`${baseUrl}/sendMessage`, {
            chat_id: formattedChatId,
            text: formattedText,
            parse_mode: 'HTML',
            disable_web_page_preview: true // Отключаем превью для URL, если они есть в тексте
          }, {
            validateStatus: () => true
          });
          
          if (response.status === 200 && response.data.ok) {
            log(`Текстовое сообщение успешно отправлено в Telegram`, 'social-publishing');
            
            // Получаем ID сообщения для формирования URL
            const messageId = response.data.result.message_id;
            
            // Формируем URL публикации
            const postUrl = this.formatTelegramUrl(chatId, formattedChatId, messageId, chatUsername);
            
            publication.platformPostUrl = postUrl;
            publication.status = 'published';
            publication.publishedAt = new Date().toISOString();
            
            return publication;
          } else {
            throw new Error(`Ошибка при отправке текстового сообщения: ${response.data?.description || JSON.stringify(response.data)}`);
          }
        } catch (error: any) {
          if (error.response) {
            log(`Данные ответа API при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
          }
          throw new Error(`Ошибка при отправке текстового сообщения: ${error.message}`);
        }
      }
      
      // Если мы дошли до этой точки, значит, условия выше не сработали
      throw new Error('Не удалось определить тип контента для публикации в Telegram');
      
    } catch (error: any) {
      // Обработка ошибок
      log(`Ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
      publication.status = 'failed';
      publication.error = error.message;
      return publication;
    }
  }
  
  /**
   * Отправляет изображения в Telegram
   * @param chatId ID чата Telegram
   * @param token Токен бота Telegram
   * @param images Массив URL изображений
   * @returns Результат отправки (успех/ошибка)
   */
  private async sendImagesToTelegram(
    chatId: string,
    token: string,
    images: string[]
  ): Promise<{success: boolean, error?: string, messageIds?: number[]}> {
    if (!images || images.length === 0) {
      return {success: true, messageIds: []}; // Нет изображений - нет проблем
    }
    
    // Форматируем базовый URL для API Telegram
    const baseUrl = `https://api.telegram.org/bot${token}`;
    
    try {
      // Если одно изображение - отправляем как отдельное фото
      if (images.length === 1) {
        const response = await axios.post(`${baseUrl}/sendPhoto`, {
          chat_id: chatId,
          photo: images[0],
          parse_mode: 'HTML'
        }, {
          validateStatus: () => true
        });
        
        if (response.status === 200 && response.data.ok) {
          log(`Изображение успешно отправлено в Telegram`, 'social-publishing');
          return {
            success: true,
            messageIds: [response.data.result.message_id]
          };
        } else {
          log(`Ошибка при отправке изображения в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
          return {
            success: false,
            error: `Ошибка API Telegram: ${response.data?.description || 'Неизвестная ошибка'}`
          };
        }
      }
      
      // Если несколько изображений - отправляем как медиагруппу
      // Формируем массив медиа (с ограничением в 10 изображений за раз)
      const messageIds: number[] = [];
      
      // Разбиваем на группы по 10 (лимит Telegram API)
      for (let i = 0; i < images.length; i += 10) {
        const batch = images.slice(i, i + 10);
        
        const mediaGroup = batch.map(img => ({
          type: 'photo',
          media: img
        }));
        
        const mediaResponse = await axios.post(`${baseUrl}/sendMediaGroup`, {
          chat_id: chatId,
          media: mediaGroup
        }, {
          validateStatus: () => true
        });
        
        if (mediaResponse.status === 200 && mediaResponse.data.ok) {
          log(`Группа из ${mediaGroup.length} изображений успешно отправлена в Telegram`, 'social-publishing');
          
          // Добавляем ID сообщений
          if (mediaResponse.data.result && Array.isArray(mediaResponse.data.result)) {
            mediaResponse.data.result.forEach((msg: any) => {
              if (msg.message_id) {
                messageIds.push(msg.message_id);
              }
            });
          }
        } else {
          log(`Ошибка при отправке группы изображений в Telegram: ${JSON.stringify(mediaResponse.data)}`, 'social-publishing');
          return {
            success: false,
            error: `Ошибка API Telegram при отправке медиагруппы: ${mediaResponse.data?.description || 'Неизвестная ошибка'}`
          };
        }
      }
      
      return {
        success: true,
        messageIds
      };
    } catch (error: any) {
      log(`Исключение при отправке изображений в Telegram: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      return {
        success: false,
        error: `Исключение при отправке изображений: ${error.message}`
      };
    }
  }
  
  /**
   * Получает информацию о чате в Telegram
   * @param chatId ID чата
   * @param token Токен бота
   * @returns Информация о чате или null в случае ошибки
   */
  public async getChatInfo(chatId: string, token: string): Promise<any> {
    try {
      // Предварительно форматируем chatId, если это числовой ID канала
      let formattedChatId = chatId;
      
      // Если это числовой ID без префикса, добавляем префикс -100
      if (!chatId.startsWith('@') && !chatId.startsWith('-') && !isNaN(Number(chatId))) {
        formattedChatId = `-100${chatId}`;
      }
      
      const response = await axios.get(`https://api.telegram.org/bot${token}/getChat`, {
        params: {
          chat_id: formattedChatId
        },
        validateStatus: () => true
      });
      
      if (response.status === 200 && response.data.ok) {
        return response.data.result;
      } else {
        log(`Ошибка при получении информации о чате: ${JSON.stringify(response.data)}`, 'social-publishing');
        return null;
      }
    } catch (error) {
      log(`Исключение при получении информации о чате: ${error}`, 'social-publishing');
      return null;
    }
  }
  
  /**
   * Генерирует URL для поста в Telegram
   * @param chatId ID чата
   * @param messageId ID сообщения
   * @returns URL поста
   */
  public generatePostUrl(chatId: string, messageId: number | string): string {
    // Если сохранен username канала, используем его
    if (this.currentChatUsername) {
      return `https://t.me/${this.currentChatUsername}/${messageId}`;
    }
    
    // Если это username (начинается с @), используем его
    if (chatId.startsWith('@')) {
      return `https://t.me/${chatId.substring(1)}/${messageId}`;
    }
    
    // Для каналов и супергрупп (начинаются с -100)
    if (chatId.startsWith('-100')) {
      const channelId = chatId.substring(4);
      return `https://t.me/c/${channelId}/${messageId}`;
    }
    
    // Для обычных групп (начинаются с -)
    if (chatId.startsWith('-')) {
      const groupId = chatId.substring(1);
      return `https://t.me/c/${groupId}/${messageId}`;
    }
    
    // Для личных чатов или ботов (числовой ID)
    return `https://t.me/c/${chatId}/${messageId}`;
  }
}