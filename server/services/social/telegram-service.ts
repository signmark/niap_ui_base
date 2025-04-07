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
  private formatTextForTelegram(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }
    
    // Сохраняем исходный текст для логирования
    const originalLength = content.length;
    
    try {
      // Telegram поддерживает только ограниченный набор HTML-тегов:
      // <b>, <strong>, <i>, <em>, <u>, <s>, <strike>, <code>, <pre>, <a href="...">
      
      // Сначала преобразуем маркдаун в HTML для Telegram
      let formattedText = content
        // Обработка маркдаун-разметки (должна происходить ДО обработки HTML)
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // **жирный**
        .replace(/\*(.*?)\*/g, '<i>$1</i>') // *курсив*
        .replace(/__(.*?)__/g, '<u>$1</u>') // __подчеркнутый__
        .replace(/~~(.*?)~~/g, '<s>$1</s>') // ~~зачеркнутый~~
        .replace(/`([^`]+)`/g, '<code>$1</code>') // `код`
        
        // Преобразуем блочные элементы в понятный Telegram формат
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>([^]*?)<\/p>/g, '$1\n\n')
        .replace(/<div>([^]*?)<\/div>/g, '$1\n')
        .replace(/<h[1-6]>([^]*?)<\/h[1-6]>/g, '<b>$1</b>\n\n')
        
        // Приводим HTML-теги к поддерживаемым в Telegram форматам
        .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
        .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
        .replace(/<strike>(.*?)<\/strike>/g, '<s>$1</s>')
        .replace(/<del>(.*?)<\/del>/g, '<s>$1</s>')
        .replace(/<ins>(.*?)<\/ins>/g, '<u>$1</u>')
        
        // Улучшенная обработка списков
        .replace(/<ul>([^]*?)<\/ul>/g, function(match, p1) {
            return p1.replace(/<li>(.*?)<\/li>/g, '• $1\n');
        })
        .replace(/<ol>([^]*?)<\/ol>/g, function(match, p1) {
            let index = 1;
            return p1.replace(/<li>(.*?)<\/li>/g, function(m, li) {
                return (index++) + '. ' + li + '\n';
            });
        })
        .replace(/<li>(.*?)<\/li>/g, '• $1\n')
        
        // Обрабатываем ссылки по формату Telegram - важно для корректной работы с разными атрибутами в тегах ссылок
        .replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/g, '<a href="$1">$2</a>');
      
      // Telegram не поддерживает вложенные теги одного типа, исправляем это
      // Например: <b>жирный <b>вложенный</b> текст</b> -> <b>жирный вложенный текст</b>
      formattedText = formattedText
        .replace(/<(b|i|u|s|strike|code)>(.*?)<\/\1>.*?<\1>(.*?)<\/\1>/g, '<$1>$2 $3</$1>')
        .replace(/<(b|i|u|s|strike|code)>(.*?)<\1>(.*?)<\/\1>(.*?)<\/\1>/g, '<$1>$2$3$4</$1>');
        
      // Удаляем все неподдерживаемые HTML-теги, но сохраняем их содержимое
      formattedText = formattedText.replace(/<(\/?(?!b|strong|i|em|u|s|strike|code|pre|a\b)[^>]+)>/gi, '');
      
      // Проверяем правильность HTML (закрытые теги)
      const openTags = (formattedText.match(/<([a-z]+)[^>]*>/gi) || []).map(tag => 
        tag.replace(/<([a-z]+)[^>]*>/i, '$1').toLowerCase()
      );
      
      const closeTags = (formattedText.match(/<\/([a-z]+)>/gi) || []).map(tag => 
        tag.replace(/<\/([a-z]+)>/i, '$1').toLowerCase()
      );
      
      // Если количество открывающих и закрывающих тегов не совпадает,
      // может возникнуть ошибка при отправке. Логируем это.
      if (openTags.length !== closeTags.length) {
        log(`Предупреждение: несбалансированные HTML-теги в тексте для Telegram. Открывающих: ${openTags.length}, закрывающих: ${closeTags.length}`, 'social-publishing');
        
        // Анализируем, какие теги не сбалансированы
        const tagCounts = new Map<string, number>();
        openTags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
        closeTags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) - 1);
        });
        
        // Показываем несбалансированные теги
        let imbalancedTags = '';
        tagCounts.forEach((count, tag) => {
          if (count !== 0) {
            imbalancedTags += `${tag}(${count > 0 ? '+' : ''}${count}) `;
          }
        });
        
        if (imbalancedTags) {
          log(`Несбалансированные теги: ${imbalancedTags}`, 'social-publishing');
        }
      }
      
      // Удаление невидимых символов
      formattedText = formattedText
        .replace(/\u200B/g, '') // Zero-width space
        .replace(/\u200C/g, '') // Zero-width non-joiner
        .replace(/\u200D/g, '') // Zero-width joiner
        .replace(/\uFEFF/g, ''); // Zero-width no-break space
      
      // Проверка на длинные слова (Telegram может некорректно отображать слова длиннее 100 символов)
      // Это могло бы быть решено, но не является критичным для отправки
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
   * Подготавливает текст для отправки в Telegram: форматирует и обрезает при необходимости
   * @param content Исходный текст контента
   * @param maxLength Максимальная длина текста (по умолчанию 4000 для защиты от превышения лимита в 4096)
   * @returns Отформатированный и обрезанный текст для Telegram
   */
  private prepareTelegramText(content: string, maxLength: number = 4000): string {
    try {
      // Применяем HTML-форматирование для Telegram
      let formattedText = this.formatTextForTelegram(content);
      
      // Проверка длины и обрезка
      if (formattedText.length > maxLength) {
        log(`Текст для Telegram превышает ${maxLength} символов, обрезаем...`, 'social-publishing');
        
        // Находим ближайший конец предложения для более аккуратной обрезки
        const sentenceEndPos = formattedText.substring(0, maxLength - 3).lastIndexOf('.');
        const paragraphEndPos = formattedText.substring(0, maxLength - 3).lastIndexOf('\n');
        
        const cutPosition = Math.max(
          sentenceEndPos > maxLength - 200 ? sentenceEndPos + 1 : 0, 
          paragraphEndPos > maxLength - 200 ? paragraphEndPos + 1 : 0,
          maxLength - 3
        );
        
        formattedText = formattedText.substring(0, cutPosition) + '...';
        log(`Текст обрезан до ${formattedText.length} символов`, 'social-publishing');
      }
      
      return formattedText;
    } catch (error) {
      log(`Ошибка при подготовке текста для Telegram: ${error}`, 'social-publishing');
      
      // В случае ошибки возвращаем простой обрезанный текст
      if (content && content.length > maxLength) {
        return content.substring(0, maxLength - 3) + '...';
      }
      return content || '';
    }
  }

  /**
   * Создает и отправляет текстовое сообщение в Telegram
   * @param text Текст для отправки
   * @param chatId ID чата Telegram
   * @param token Токен бота Telegram
   * @returns Результат отправки сообщения
   */
  private async sendTextMessageToTelegram(text: string, chatId: string, token: string): Promise<any> {
    try {
      // Дополнительно проверяем длину текста
      if (!text || text.trim() === '') {
        log(`Пустой текст для отправки в Telegram`, 'social-publishing');
        return { success: false, error: 'Empty text' };
      }
      
      const finalText = text.length > 4096 ? text.substring(0, 4093) + '...' : text;
      
      // Преобразуем текст с HTML-тегами, если он есть
      if (finalText.includes('<') && finalText.includes('>')) {
        log(`Обнаружены HTML-теги в тексте для Telegram, длина: ${finalText.length}`, 'social-publishing');
      } else {
        // Для обычного текста без HTML-тегов дополнительные проверки не требуются
        log(`Обычный текст без HTML-тегов для Telegram, длина: ${finalText.length}`, 'social-publishing');
      }
      
      // Подготавливаем тело запроса для API Telegram
      const messageBody = {
        chat_id: chatId,
        text: finalText,
        parse_mode: 'HTML',
        protect_content: false, // Защита контента (можно настроить)
        disable_notification: false // Отключение уведомлений (можно настроить)
      };
      
      // Отправляем запрос в API Telegram
      const baseUrl = `https://api.telegram.org/bot${token}`;
      const response = await axios.post(`${baseUrl}/sendMessage`, messageBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000, // Увеличенный таймаут
        validateStatus: () => true // Всегда возвращаем ответ, даже если это ошибка
      });
      
      // Обрабатываем ответ
      if (response.status === 200 && response.data && response.data.ok) {
        log(`Сообщение успешно отправлено в Telegram, message_id: ${response.data?.result?.message_id}`, 'social-publishing');
        return { success: true, result: response.data?.result };
      } else {
        log(`Ошибка при отправке сообщения в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
        
        // Если текст содержит HTML и произошла ошибка, возможно, проблема с форматированием
        // Пробуем отправить как обычный текст
        if (finalText.includes('<') && finalText.includes('>')) {
          log(`Пробуем отправить как обычный текст без HTML...`, 'social-publishing');
          
          // Удаляем все HTML-теги и создаем новое тело запроса
          const plainText = text.replace(/<[^>]*>/g, '');
          const plainMessageBody = {
            chat_id: chatId,
            text: plainText.length > 4096 ? plainText.substring(0, 4093) + '...' : plainText,
            protect_content: false,
            disable_notification: false
          };
          
          // Отправляем повторный запрос без HTML
          const plainResponse = await axios.post(`${baseUrl}/sendMessage`, plainMessageBody, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
            validateStatus: () => true
          });
          
          if (plainResponse.status === 200 && plainResponse.data && plainResponse.data.ok) {
            log(`Сообщение успешно отправлено без HTML-форматирования, message_id: ${plainResponse.data?.result?.message_id}`, 'social-publishing');
            return { success: true, result: plainResponse.data?.result };
          } else {
            log(`Ошибка при отправке обычного текста: ${JSON.stringify(plainResponse.data)}`, 'social-publishing');
            return { success: false, error: plainResponse.data?.description || 'Failed to send plain text' };
          }
        }
        
        return { success: false, error: response.data?.description || 'Failed to send message' };
      }
    } catch (error) {
      log(`Исключение при отправке сообщения в Telegram: ${error}`, 'social-publishing');
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Универсальный метод для отправки изображений в Telegram
   * @param chatId ID чата Telegram 
   * @param token Токен бота Telegram
   * @param images Массив URL изображений
   * @param baseUrl Базовый URL API Telegram
   * @param caption Текстовая подпись к изображениям (опционально)
   * @returns Результат отправки (успех/ошибка)
   */
  private async sendImagesToTelegram(
    chatId: string,
    token: string,
    images: string[],
    baseUrl: string,
    caption?: string
  ): Promise<{ success: boolean; error?: string; messageId?: number; messageUrl?: string }> {
    try {
      if (!images || images.length === 0) {
        return { success: false, error: 'No images provided' };
      }
      
      let lastMessageId: number | undefined;
      
      // Если только одно изображение, отправляем его через sendPhoto
      if (images.length === 1) {
        log(`Отправка одного изображения через sendPhoto: ${images[0]}`, 'social-publishing');
        
        try {
          // Создаем объект запроса с дополнительными параметрами если есть подпись
          const requestBody: any = {
            chat_id: chatId,
            photo: images[0]
          };
          
          // Если есть текст подписи, добавляем его
          if (caption && caption.trim() !== '') {
            requestBody.caption = caption;
            requestBody.parse_mode = 'HTML';
            log(`Добавляем текстовую подпись к изображению (${caption.length} символов)`, 'social-publishing');
          }
          
          const response = await axios.post(`${baseUrl}/sendPhoto`, requestBody, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
            validateStatus: () => true
          });
          
          if (response.status === 200 && response.data && response.data.ok) {
            lastMessageId = response.data.result.message_id;
            log(`Изображение успешно отправлено, message_id: ${lastMessageId}`, 'social-publishing');
            return { 
              success: true, 
              messageId: lastMessageId,
              messageUrl: lastMessageId ? `https://t.me/c/${chatId.replace('-100', '')}/${lastMessageId}` : undefined
            };
          } else {
            log(`Ошибка при отправке изображения: ${JSON.stringify(response.data)}`, 'social-publishing');
            return { success: false, error: response.data?.description || 'Failed to send image' };
          }
        } catch (error) {
          log(`Исключение при отправке изображения: ${error}`, 'social-publishing');
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      }
      // Если несколько изображений, отправляем их через sendMediaGroup (до 10 штук)
      else {
        // Telegram ограничивает группы медиа до 10 элементов
        const chunks = [];
        for (let i = 0; i < images.length; i += 10) {
          chunks.push(images.slice(i, i + 10));
        }
        
        log(`Отправка ${images.length} изображений через sendMediaGroup (${chunks.length} групп)`, 'social-publishing');
        
        // Отправляем каждую группу изображений последовательно
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          try {
            // Создаем медиа-группу для API Telegram
            const media = chunk.map((img, index) => {
              // Проверяем, что изображение имеет URL
              const imageUrl = img && typeof img === 'string' ? img : '';
              if (!imageUrl) {
                log(`Предупреждение: пустой URL изображения в группе`, 'social-publishing');
              }
              
              // Добавляем подпись только к первому изображению в первой группе
              if (i === 0 && index === 0 && caption && caption.trim() !== '') {
                return {
                  type: 'photo',
                  media: imageUrl,
                  caption: caption,
                  parse_mode: 'HTML'
                };
              } else {
                return {
                  type: 'photo',
                  media: imageUrl
                };
              }
            });
            
            // Проверяем, что есть хотя бы одно корректное изображение
            if (media.length === 0 || !media.some(m => m.media)) {
              log(`Ошибка: нет корректных URL изображений для отправки в группе`, 'social-publishing');
              continue; // Пропускаем эту группу и переходим к следующей
            }
            
            const response = await axios.post(`${baseUrl}/sendMediaGroup`, {
              chat_id: chatId,
              media
            }, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 60000, // Увеличенный таймаут для группы
              validateStatus: () => true
            });
            
            if (response.status === 200 && response.data && response.data.ok) {
              // Сохраняем message_id последнего сообщения
              if (response.data.result && response.data.result.length > 0) {
                lastMessageId = response.data.result[0].message_id;
                log(`Группа изображений успешно отправлена, первый message_id: ${lastMessageId}`, 'social-publishing');
              }
            } else {
              log(`Ошибка при отправке группы изображений: ${JSON.stringify(response.data)}`, 'social-publishing');
              return { success: false, error: response.data?.description || 'Failed to send image group' };
            }
          } catch (error) {
            log(`Исключение при отправке группы изображений: ${error}`, 'social-publishing');
            return { success: false, error: error instanceof Error ? error.message : String(error) };
          }
        }
        
        // Если все группы успешно отправлены
        return { 
          success: true, 
          messageId: lastMessageId,
          messageUrl: lastMessageId ? `https://t.me/c/${chatId.replace('-100', '')}/${lastMessageId}` : undefined
        };
      }
    } catch (error) {
      log(`Ошибка при отправке изображений в Telegram: ${error}`, 'social-publishing');
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Получает информацию о чате в Telegram
   * @param chatId ID чата
   * @param token Токен бота
   * @returns Информация о чате или null в случае ошибки
   */
  private async getChatInfo(chatId: string, token: string): Promise<any | null> {
    try {
      log(`Запрос информации о чате: ${chatId}`, 'social-publishing');
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      const response = await axios.get(`${baseUrl}/getChat`, {
        params: { chat_id: chatId },
        timeout: 10000,
        validateStatus: () => true
      });
      
      if (response.status === 200 && response.data && response.data.ok) {
        log(`Получена информация о чате: ${JSON.stringify(response.data.result)}`, 'social-publishing');
        return response.data.result;
      } else {
        log(`Ошибка при получении информации о чате: ${JSON.stringify(response.data)}`, 'social-publishing');
        return null;
      }
    } catch (error) {
      log(`Исключение при запросе информации о чате: ${error instanceof Error ? error.message : String(error)}`, 'social-publishing');
      return null;
    }
  }

  /**
   * Вспомогательный метод для генерации URL сообщения в этом контексте публикации
   * Использует chatUsername из текущего контекста
   * @param chatId Исходный chat ID (может быть @username или числовым ID)
   * @param formattedChatId Форматированный chat ID для API запросов
   * @param messageId ID сообщения
   * @returns URL сообщения
   */
  private generatePostUrl(chatId: string, formattedChatId: string, messageId?: number | string): string {
    return this.generatePostUrl(chatId, formattedChatId, messageId, this.currentChatUsername);
  }
  
  /**
   * Вспомогательная функция для форматирования URL Telegram с учетом разных форматов chat ID
   * @param chatId Исходный chat ID (может быть @username или числовым ID)
   * @param formattedChatId Форматированный chat ID для API запросов
   * @param messageId Опциональный ID сообщения для создания прямой ссылки
   * @param chatUsername Опциональный username чата (если известен)
   * @returns Корректно форматированный URL
   */
  formatTelegramUrl(chatId: string, formattedChatId: string, messageId?: number | string | undefined, chatUsername?: string): string {
    // Сохраняем username для использования в generatePostUrl
    if (chatUsername) {
      this.currentChatUsername = chatUsername;
    }
    log(`Форматирование Telegram URL: chatId=${chatId}, formattedChatId=${formattedChatId}, messageId=${messageId || 'не указан'}, username=${chatUsername || 'не указан'}`, 'social-publishing');
    
    // Если ID сообщения не указан, вернем дефолтный URL Telegram
    if (!messageId) {
      log(`messageId не указан, возвращаем базовый URL для Telegram`, 'social-publishing');
      
      // Если известен username, используем его
      if (chatUsername) {
        return `https://t.me/${chatUsername}`;
      }
      
      // Если это username (начинается с @), можем вернуть URL на канал
      if (chatId.startsWith('@')) {
        return `https://t.me/${chatId.substring(1)}`;
      }
      
      // Для всех остальных случаев без messageId возвращаем базовый URL
      return 'https://t.me';
    }
    
    // Если известен username чата, используем его для URL
    if (chatUsername) {
      const url = `https://t.me/${chatUsername}/${messageId}`;
      log(`Сформирован URL для канала с известным username: ${url}`, 'social-publishing');
      return url;
    }
    
    // Стандартные случаи форматирования URL
    
    // Обработка случая с username (@channel)
    if (chatId.startsWith('@')) {
      const username = chatId.substring(1);
      const url = `https://t.me/${username}/${messageId}`;
      log(`Сформирован URL для канала с username: ${url}`, 'social-publishing');
      return url;
    }
    
    // Обработка случая с супергруппой/каналом (-100...)
    if (chatId.startsWith('-100')) {
      // Для публичных супергрупп/каналов удаляем префикс -100
      const channelId = chatId.substring(4);
      const url = `https://t.me/${channelId}/${messageId}`;
      log(`Сформирован URL для супергруппы/канала: ${url}`, 'social-publishing');
      return url;
    }
    
    // Обработка обычных групп (начинаются с -)
    if (chatId.startsWith('-')) {
      // Для обычной группы без username форматируем URL по стандарту
      const groupId = chatId.substring(1); // Убираем только минус
      const url = `https://t.me/c/${groupId}/${messageId}`;
      log(`Сформирован URL для обычной группы: ${url}`, 'social-publishing');
      return url;
    }
    
    // Личные чаты или боты (числовой ID без минуса)
    const url = `https://t.me/c/${chatId}/${messageId}`;
    log(`Сформирован URL для личного чата/бота: ${url}`, 'social-publishing');
    return url;
  }

  /**
   * Публикует контент в Telegram с использованием Imgur для изображений
   * @param content Контент для публикации
   * @param telegramSettings Настройки Telegram API
   * @returns Результат публикации
   */
  async publishToTelegram(
    content: CampaignContent,
    telegramSettings: { token: string | null; chatId: string | null }
  ): Promise<SocialPublication> {
    // ID последнего сообщения для формирования ссылки
    let lastMessageId: number | string | undefined;
    // Храним username канала, если его удастся получить
    let chatUsername: string | undefined;
    
    try {
      // Проверяем наличие необходимых параметров
      if (!telegramSettings.token || !telegramSettings.chatId) {
        log(`Ошибка публикации в Telegram: отсутствуют настройки. Token: ${telegramSettings.token ? 'задан' : 'отсутствует'}, ChatID: ${telegramSettings.chatId ? 'задан' : 'отсутствует'}`, 'social-publishing');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: 'Missing Telegram API settings (token or chatId)'
        };
      }
      
      // Извлекаем параметры
      const token = telegramSettings.token;
      const chatId = telegramSettings.chatId;
      
      // Форматируем ID чата для API Telegram (удаляем @ для username)
      const formattedChatId = chatId.startsWith('@') ? chatId : chatId;
      
      // Пытаемся получить информацию о чате для корректного формирования URL
      try {
        const chatInfo = await this.getChatInfo(formattedChatId, token);
        if (chatInfo && chatInfo.username) {
          chatUsername = chatInfo.username;
          // Сохраняем username чата в свойстве класса для дальнейшего использования
          this.currentChatUsername = chatUsername;
          log(`Получен username чата: ${chatUsername}`, 'social-publishing');
        } else {
          log(`Не удалось получить username чата или у чата нет публичного username`, 'social-publishing');
        }
      } catch (error) {
        log(`Ошибка при запросе информации о чате: ${error instanceof Error ? error.message : String(error)}`, 'social-publishing');
      }
      
      // Обрабатываем контент
      const processedContent = this.processAdditionalImages(content, 'telegram');
      
      // Загружаем локальные изображения на Imgur
      const imgurContent = await this.uploadImagesToImgur(processedContent);
      
      // Подготавливаем текст для отправки
      let text = '';
      
      // Если есть заголовок, добавляем его в начало сообщения
      if (imgurContent.title) {
        text += `<b>${imgurContent.title}</b>\n\n`;
      }
      
      // Добавляем основной контент
      const originalContent = imgurContent.content || '';
      const contentText = this.prepareTelegramText(originalContent);
      
      // Логирование обработанного текста для отладки
      log(`Обработка HTML для Telegram: исходный текст ${originalContent.length} символов, обработанный ${contentText.length} символов`, 'social-publishing');
      log(`Первые 100 символов обработанного текста: ${contentText.substring(0, 100)}`, 'social-publishing');
      
      text += contentText;
      
      // Если есть хэштеги, добавляем их в конец сообщения
      if (processedContent.hashtags && Array.isArray(processedContent.hashtags) && processedContent.hashtags.length > 0) {
        const hashtags = processedContent.hashtags
          .filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
          .map(tag => tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`);
        
        if (hashtags.length > 0) {
          text += '\n\n' + hashtags.join(' ');
        }
      }
      
      // Создаем URL API Telegram
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      // Проверяем наличие изображений
      const hasImages = processedContent.imageUrl || 
        (processedContent.additionalImages && processedContent.additionalImages.length > 0);
      
      // Проверяем необходимость принудительного разделения текста и изображений
      // Флаг устанавливается в методе publishToPlatform для всех Telegram публикаций
      const forceImageTextSeparation = processedContent.metadata && 
        (processedContent.metadata as any).forceImageTextSeparation === true;
      
      log(`Telegram: наличие изображений: ${hasImages}, принудительное разделение: ${forceImageTextSeparation}`, 'social-publishing');
      
      // Определяем стратегию публикации в зависимости от длины текста и наличия изображений
      
      // 1. Если есть изображения и включен флаг принудительного разделения,
      // отправляем сначала изображения без подписи, затем текст отдельным сообщением
      if (hasImages && forceImageTextSeparation) {
        log(`Telegram: публикация с изображением. Отправляем изображение и текст раздельно.`, 'social-publishing');
        
        // Подготавливаем краткую подпись для изображения (только заголовок)
        const imageCaption = processedContent.title ? 
          (processedContent.title.length > 200 ? 
            processedContent.title.substring(0, 197) + '...' : 
            processedContent.title) : 
          '';
        
        log(`Используем краткую подпись для изображения: "${imageCaption}"`, 'social-publishing');
        
        // Собираем все изображения для отправки через универсальный метод
        const images: string[] = [];
        
        // Добавляем основное изображение, если оно есть
        if (processedContent.imageUrl) {
          const isUrl = processedContent.imageUrl.startsWith('http://') || processedContent.imageUrl.startsWith('https://');
          log(`Основное изображение для Telegram - тип: ${isUrl ? 'URL' : 'локальный путь'}, значение: ${processedContent.imageUrl}`, 'social-publishing');
          images.push(processedContent.imageUrl);
        }
        
        // Добавляем дополнительные изображения в общий список
        if (processedContent.additionalImages && processedContent.additionalImages.length > 0) {
          log(`Добавляем ${processedContent.additionalImages.length} дополнительных изображений в общий список`, 'social-publishing');
          images.push(...processedContent.additionalImages);
        }
        
        // Отправляем все изображения через универсальный метод
        let imagesSentResult = { success: false, error: 'Изображения не отправлены' };
        
        if (images.length > 0) {
          log(`Отправка всех ${images.length} изображений через универсальный метод`, 'social-publishing');
          
          // Передаем текст как caption при отправке изображений
          imagesSentResult = await this.sendImagesToTelegram(
            formattedChatId,
            token,
            images,
            baseUrl,
            text // Передаем текст как caption
          );
          
          if (!imagesSentResult.success) {
            log(`Ошибка при отправке изображений в Telegram: ${imagesSentResult.error}`, 'social-publishing');
          } else {
            log(`Все изображения успешно отправлены в Telegram`, 'social-publishing');
            log(`URL сообщения с изображениями: ${imagesSentResult.messageUrl || 'не создан'}`, 'social-publishing');
          }
        }
        
        // Текст теперь отправляется вместе с изображениями как подпись, 
        // поэтому отдельная отправка текста не требуется
        
        // Используем результат предыдущей отправки изображений
        if (imagesSentResult && imagesSentResult.success) {
          // Если изображения успешно отправлены с текстом, возвращаем успешный результат
          log(`Публикация в Telegram завершена успешно (изображения с подписью)`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            postUrl: imagesSentResult.messageUrl || this.generatePostUrl(chatId, formattedChatId, imagesSentResult.messageId || '')
          };
        } else {
          // Если возникла проблема с отправкой изображений, попробуем отправить только текст
          try {
            log(`Отправка изображений с подписью не удалась, пробуем отправить только текст: ${text.length} символов`, 'social-publishing');
              
            // Если текст превышает максимальную длину для Telegram (4096 символов),
            // он будет автоматически обрезан в методе sendTextMessageToTelegram
            const textResponse = await this.sendTextMessageToTelegram(text, formattedChatId, token);
            log(`Текст успешно отправлен в Telegram: ${JSON.stringify(textResponse)}`, 'social-publishing');
            
            // Обновляем lastMessageId если есть message_id
            if (textResponse.result && textResponse.result.message_id) {
              lastMessageId = textResponse.result.message_id;
            }
              
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              postUrl: this.generatePostUrl(chatId, formattedChatId, lastMessageId || '')
            };
          } catch (error: any) {
            log(`Ошибка при отправке текста в Telegram: ${error.message}`, 'social-publishing');
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: `Ошибка при отправке текста в Telegram: ${error.message}`
            };
          }
        }
      }
      // 2. Если есть только одно основное изображение и текст умещается в лимит,
      // отправляем изображение с текстом в подписи
      else if (processedContent.imageUrl && (!processedContent.additionalImages || processedContent.additionalImages.length === 0) && text.length <= 1024) {
        log(`Telegram: отправка одного изображения с подписью. Длина текста: ${text.length} символов.`, 'social-publishing');
        
        try {
          // Проверяем валидность URL изображения и убеждаемся, что он действительно указывает на изображение
          let imageUrl = processedContent.imageUrl;
          if (!imageUrl.startsWith('http')) {
            const baseAppUrl = this.getAppBaseUrl();
            imageUrl = `${baseAppUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
            log(`Исправлен URL для основного изображения: ${imageUrl}`, 'social-publishing');
          }
          
          log(`Отправка фото в Telegram: ${imageUrl}`, 'social-publishing');
          
          // Используем validateStatus чтобы получить полный ответ даже в случае ошибки
          const response = await axios.post(`${baseUrl}/sendPhoto`, {
            chat_id: formattedChatId,
            photo: imageUrl,
            caption: text,
            parse_mode: 'HTML',
            protect_content: false, // Дополнительный параметр, который может быть полезен
            disable_notification: false // Дополнительный параметр, который может быть полезен
          }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000, // Увеличенный таймаут
            validateStatus: () => true // Всегда возвращаем ответ, даже если это ошибка
          });
          
          // Расширенное логирование ответа
          log(`Ответ от Telegram API (sendPhoto): код ${response.status}, body: ${JSON.stringify(response.data)}`, 'social-publishing');
          
          if (response.status === 200 && response.data && response.data.ok) {
            log(`Изображение с текстом успешно отправлено в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              postUrl: this.generatePostUrl(chatId, formattedChatId, response.data?.result?.message_id)
            };
          } else {
            log(`Ошибка при отправке изображения с текстом в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
            
            // Попробуем отправить как URL, если не получилось отправить как файл
            const errorDescription = response.data?.description || '';
            
            if (errorDescription.includes('Bad Request') || errorDescription.includes('URL') || errorDescription.includes('photo')) {
              log(`Пробуем альтернативный метод отправки изображения через медиагруппу...`, 'social-publishing');
              
              try {
                // Отправляем изображение и текст как медиагруппу
                const mediaResponse = await axios.post(`${baseUrl}/sendMediaGroup`, {
                  chat_id: formattedChatId,
                  media: [
                    {
                      type: 'photo',
                      media: imageUrl,
                      caption: text,
                      parse_mode: 'HTML'
                    }
                  ]
                }, {
                  headers: { 'Content-Type': 'application/json' },
                  timeout: 30000,
                  validateStatus: () => true
                });
                
                if (mediaResponse.status === 200 && mediaResponse.data && mediaResponse.data.ok) {
                  log(`Успешно отправлена медиагруппа: ${JSON.stringify(mediaResponse.data)}`, 'social-publishing');
                  // Сохраняем ID сообщения для формирования корректной ссылки
                  if (mediaResponse.data?.result?.[0]?.message_id) {
                    lastMessageId = mediaResponse.data.result[0].message_id;
                  }
                  
                  return {
                    platform: 'telegram',
                    status: 'published',
                    publishedAt: new Date(),
                    postUrl: this.generatePostUrl(chatId, formattedChatId, lastMessageId || '')
                  };
                } else {
                  // Если оба метода не работают, отправляем изображение и текст по отдельности
                  log(`Альтернативный метод тоже не сработал. Пробуем отправить изображение и текст отдельно...`, 'social-publishing');
                  
                  // Отправляем сначала изображение без подписи
                  const imageOnlyResponse = await axios.post(`${baseUrl}/sendPhoto`, {
                    chat_id: formattedChatId,
                    photo: imageUrl
                  }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000,
                    validateStatus: () => true
                  });
                  
                  // Затем отправляем текст отдельно
                  const textResponse = await this.sendTextMessageToTelegram(text, formattedChatId, token);
                  
                  if (imageOnlyResponse.data?.ok || textResponse.success) {
                    log(`Удалось отправить изображение и текст по отдельности`, 'social-publishing');
                    // Сохраняем ID сообщения для формирования корректной ссылки
                    if (imageOnlyResponse.data?.result?.message_id) {
                      lastMessageId = imageOnlyResponse.data.result.message_id;
                    } else if (textResponse.success && textResponse.result?.message_id) {
                      lastMessageId = textResponse.result.message_id;
                    }
                    
                    return {
                      platform: 'telegram',
                      status: 'published',
                      publishedAt: new Date(),
                      postUrl: this.generatePostUrl(chatId, formattedChatId, lastMessageId || '')
                    };
                  }
                }
              } catch (mediaError: any) {
                log(`Ошибка при альтернативной отправке: ${mediaError.message}`, 'social-publishing');
              }
            }
            
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: `Ошибка при отправке изображения с текстом: ${response.data?.description || JSON.stringify(response.data)}`
            };
          }
        } catch (error: any) {
          log(`Исключение при отправке изображения с текстом в Telegram: ${error.message}`, 'social-publishing');
          
          // Детальное логирование для диагностики
          if (error.response) {
            log(`Данные ответа API: ${JSON.stringify(error.response.data)}`, 'social-publishing');
          }
          
          // Попробуем отправить текст и изображение отдельно как запасной вариант
          try {
            log(`Пробуем отправить текст и изображение отдельно после сбоя...`, 'social-publishing');
            
            // Отправляем сначала изображение без подписи
            await axios.post(`${baseUrl}/sendPhoto`, {
              chat_id: formattedChatId,
              photo: processedContent.imageUrl
            }, {
              validateStatus: () => true,
              timeout: 30000
            });
            
            // Затем отправляем текст отдельно
            const textResponse = await this.sendTextMessageToTelegram(text, formattedChatId, token);
            
            if (textResponse.success) {
              log(`Резервный план сработал: изображение и текст отправлены отдельно`, 'social-publishing');
              // Сохраняем ID сообщения для формирования корректной ссылки
              if (textResponse.result?.message_id) {
                lastMessageId = textResponse.result.message_id;
              }
              
              return {
                platform: 'telegram',
                status: 'published',
                publishedAt: new Date(),
                postUrl: this.generatePostUrl(chatId, formattedChatId, lastMessageId || '')
              };
            }
          } catch (backupError: any) {
            log(`Резервный план также не сработал: ${backupError.message}`, 'social-publishing');
          }
          
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: `Ошибка при отправке изображения с текстом: ${error.message}`
          };
        }
      }
      // 3. В остальных случаях (нет изображений или несколько изображений)
      else {
        // Если есть изображения, отправляем их
        if (processedContent.imageUrl || (processedContent.additionalImages && processedContent.additionalImages.length > 0)) {
          // Подготавливаем подпись для изображения
          const imageCaption = text.length <= 1024 ? 
            text : 
            (processedContent.title ? 
              (processedContent.title.length > 200 ? 
                processedContent.title.substring(0, 197) + '...' : 
                processedContent.title) : 
              '');
              
          log(`Telegram: подготовлена подпись для изображения, длина: ${imageCaption.length} символов`, 'social-publishing');
          
          // Отправляем основное изображение
          if (processedContent.imageUrl) {
            try {
              log(`Отправка основного изображения: ${processedContent.imageUrl}`, 'social-publishing');
              
              // Формируем полный URL, если это локальный путь
              let imageUrl = processedContent.imageUrl;
              if (!imageUrl.startsWith('http')) {
                const baseAppUrl = this.getAppBaseUrl();
                imageUrl = `${baseAppUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
                log(`Исправлен URL для основного изображения: ${imageUrl}`, 'social-publishing');
              }
              
              // Отправляем изображение с подписью
              const photoResponse = await axios.post(`${baseUrl}/sendPhoto`, {
                chat_id: formattedChatId,
                photo: imageUrl,
                caption: imageCaption,
                parse_mode: 'HTML'
              }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000,
                validateStatus: () => true
              });
              
              if (photoResponse.status === 200 && photoResponse.data && photoResponse.data.ok) {
                log(`Основное изображение успешно отправлено: ${JSON.stringify(photoResponse.data)}`, 'social-publishing');
                
                // Сохраняем ID сообщения
                if (photoResponse.data.result && photoResponse.data.result.message_id) {
                  lastMessageId = photoResponse.data.result.message_id;
                }
              } else {
                log(`Ошибка при отправке основного изображения: ${JSON.stringify(photoResponse.data)}`, 'social-publishing');
              }
            } catch (photoError: any) {
              log(`Исключение при отправке основного изображения: ${photoError.message}`, 'social-publishing');
            }
          }
          
          // Отправляем дополнительные изображения, если они есть
          if (processedContent.additionalImages && processedContent.additionalImages.length > 0) {
            try {
              // Ограничение в 10 изображений для Telegram API
              const mediaItems = processedContent.additionalImages.slice(0, 10).map(img => ({
                type: 'photo',
                media: img
              }));
              
              if (mediaItems.length > 0) {
                log(`Отправка ${mediaItems.length} дополнительных изображений через sendMediaGroup`, 'social-publishing');
                
                const mediaResponse = await axios.post(`${baseUrl}/sendMediaGroup`, {
                  chat_id: formattedChatId,
                  media: mediaItems
                }, {
                  headers: { 'Content-Type': 'application/json' },
                  timeout: 60000, // Увеличенный таймаут для группы изображений
                  validateStatus: () => true
                });
                
                if (mediaResponse.status === 200 && mediaResponse.data && mediaResponse.data.ok) {
                  log(`Группа изображений успешно отправлена: ${JSON.stringify(mediaResponse.data)}`, 'social-publishing');
                  
                  // Обновляем lastMessageId при необходимости
                  if (mediaResponse.data.result && mediaResponse.data.result.length > 0) {
                    lastMessageId = mediaResponse.data.result[0].message_id;
                  }
                } else {
                  log(`Ошибка при отправке группы изображений: ${JSON.stringify(mediaResponse.data)}`, 'social-publishing');
                }
              }
            } catch (mediaError: any) {
              log(`Исключение при отправке группы изображений: ${mediaError.message}`, 'social-publishing');
            }
          }
          
          // Если у нас длинный текст, который не поместился в подпись изображения,
          // отправляем его отдельным сообщением
          if (text.length > 1024) {
            try {
              log(`Отправка длинного текста отдельным сообщением (${text.length} символов)`, 'social-publishing');
              
              const textResponse = await this.sendTextMessageToTelegram(text, formattedChatId, token);
              
              if (textResponse.success) {
                log(`Текст успешно отправлен отдельно: ${JSON.stringify(textResponse.result)}`, 'social-publishing');
                
                // Если нет lastMessageId от изображений, используем ID сообщения с текстом
                if (!lastMessageId && textResponse.result && textResponse.result.message_id) {
                  lastMessageId = textResponse.result.message_id;
                }
              } else {
                log(`Ошибка при отправке текста отдельно: ${textResponse.error}`, 'social-publishing');
              }
            } catch (textError: any) {
              log(`Исключение при отправке текста отдельно: ${textError.message}`, 'social-publishing');
            }
          }
          
          // Если удалось отправить хотя бы что-то (есть lastMessageId), считаем публикацию успешной
          if (lastMessageId) {
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              postUrl: this.generatePostUrl(chatId, formattedChatId, lastMessageId)
            };
          } else {
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: 'Failed to send media content'
            };
          }
        }
        // Если нет изображений, просто отправляем текст
        else {
          try {
            log(`Отправка только текста, длина: ${text.length} символов`, 'social-publishing');
            
            const textResponse = await this.sendTextMessageToTelegram(text, formattedChatId, token);
            
            if (textResponse.success) {
              log(`Текст успешно отправлен: ${JSON.stringify(textResponse.result)}`, 'social-publishing');
              
              // Сохраняем ID сообщения для формирования ссылки
              if (textResponse.result && textResponse.result.message_id) {
                lastMessageId = textResponse.result.message_id;
              }
              
              return {
                platform: 'telegram',
                status: 'published',
                publishedAt: new Date(),
                postUrl: this.generatePostUrl(chatId, formattedChatId, lastMessageId || '')
              };
            } else {
              log(`Ошибка при отправке текста: ${textResponse.error}`, 'social-publishing');
              return {
                platform: 'telegram',
                status: 'failed',
                publishedAt: null,
                error: `Failed to send text: ${textResponse.error}`
              };
            }
          } catch (textError: any) {
            log(`Исключение при отправке текста: ${textError.message}`, 'social-publishing');
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: `Exception while sending text: ${textError.message}`
            };
          }
        }
      }
    } catch (error: any) {
      log(`Ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Publication error: ${error.message}`
      };
    }
  }

  /**
   * Публикует контент в выбранную социальную платформу
   * @param content Контент для публикации
   * @param platform Социальная платформа
   * @param settings Настройки социальных сетей
   * @returns Результат публикации
   */
  public async publishToPlatform(
    content: CampaignContent,
    platform: SocialPlatform,
    settings: SocialMediaSettings
  ): Promise<SocialPublication> {
    if (platform !== 'telegram') {
      return {
        platform: platform, 
        status: 'failed',
        publishedAt: null,
        error: 'Unsupported platform for TelegramService'
      };
    }

    // Проверяем наличие настроек и логируем их для дебага
    const telegramSettings = settings.telegram || { token: null, chatId: null };
    const hasToken = Boolean(telegramSettings.token);
    const hasChatId = Boolean(telegramSettings.chatId);
    
    log(`TelegramService.publishToPlatform: Настройки: hasToken=${hasToken}, hasChatId=${hasChatId}`, 'social-publishing');

    if (!hasToken || !hasChatId) {
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для Telegram (токен или ID чата). Убедитесь, что настройки заданы в кампании.'
      };
    }

    // Для Telegram НЕ добавляем флаг принудительного разделения,
    // чтобы короткий текст без форматирования отправлялся как подпись к изображениям
    const contentWithMetadata = {
      ...content,
      metadata: {
        ...(content.metadata || {})
        // Убираем forceImageTextSeparation: true, чтобы текст отправлялся как подпись
      }
    };

    return this.publishToTelegram(contentWithMetadata, telegramSettings);
  }
}

// Экспортируем экземпляр сервиса для использования в приложении
export const telegramService = new TelegramService();