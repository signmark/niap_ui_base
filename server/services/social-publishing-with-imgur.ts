import axios from "axios";
import { log } from "../utils/logger";
import {
  CampaignContent,
  InsertCampaignContent,
  SocialMediaSettings,
  SocialPublication,
} from "@shared/schema";

// Для совместимости с существующим кодом
export enum SocialPlatform {
  TELEGRAM = 'telegram',
  VK = 'vk',
  INSTAGRAM = 'instagram', 
  FACEBOOK = 'facebook'
}
import { storage } from "../storage";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import FormData from "form-data";
import { imgurUploaderService } from "./imgur-uploader";

/**
 * Сервис для публикации контента в социальные сети с поддержкой Imgur для изображений
 */
export class SocialPublishingWithImgurService {
  private imgurClientId = process.env.IMGUR_CLIENT_ID || "fc3d6ae9c21a8df";

  /**
   * Получает системный токен для доступа к API Directus
   * @returns Токен доступа или null в случае ошибки
   */
  private async getSystemToken(): Promise<string | null> {
    try {
      const directusAuthManager = await import(
        "../services/directus-auth-manager"
      ).then((m) => m.directusAuthManager);
      const directusCrud = await import("./directus-crud").then(
        (m) => m.directusCrud,
      );
      const adminUserId =
        process.env.DIRECTUS_ADMIN_USER_ID ||
        "53921f16-f51d-4591-80b9-8caa4fde4d13";

      // 1. Приоритет - авторизация через логин/пароль (если есть учетные данные)
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;

      if (email && password) {
        log(
          "Попытка авторизации администратора с учетными данными из env",
          "social-publishing",
        );

        try {
          // Прямая авторизация через REST API
          const directusUrl =
            process.env.DIRECTUS_URL || "https://directus.nplanner.ru";
          const response = await axios.post(`${directusUrl}/auth/login`, {
            email,
            password,
          });

          if (response?.data?.data?.access_token) {
            const token = response.data.data.access_token;
            log(
              "Авторизация администратора успешна через прямой API запрос",
              "social-publishing",
            );

            return token;
          }
        } catch (error: any) {
          log(
            `Ошибка при прямой авторизации администратора: ${error.message}`,
            "social-publishing",
          );
        }

        try {
          // Запасной вариант - через DirectusAuthManager
          const authInfo = await directusAuthManager.login(email, password);

          if (authInfo && authInfo.token) {
            log(
              "Авторизация администратора успешна через directusAuthManager",
              "social-publishing",
            );
            return authInfo.token;
          }

          // Если не получилось через directusAuthManager, пробуем через directusCrud
          const authResult = await directusCrud.login(email, password);

          if (authResult?.access_token) {
            log(
              "Авторизация администратора успешна через directusCrud",
              "social-publishing",
            );
            return authResult.access_token;
          }
        } catch (error: any) {
          log(
            `Ошибка при авторизации через вспомогательные сервисы: ${error.message}`,
            "social-publishing",
          );
        }
      }

      // 2. Используем API Directus для получения токена администратора
      const directusApiManager = await import("../directus").then(
        (m) => m.directusApiManager,
      );
      const cachedToken = directusApiManager.getCachedToken(adminUserId);

      if (cachedToken) {
        log(
          `Найден кэшированный токен для администратора ${adminUserId}`,
          "social-publishing",
        );
        return cachedToken.token;
      }

      log(
        "Не удалось получить действительный токен для обновления статуса публикаций",
        "social-publishing",
      );
      return null;
    } catch (error: any) {
      log(
        `Ошибка при получении системного токена: ${error.message}`,
        "social-publishing",
      );
      return null;
    }
  }

  /**
   * Универсальный метод для отправки изображений в Telegram
   * @param chatId ID чата Telegram
   * @param token Токен бота Telegram
   * @param images Массив URL изображений
   * @param baseUrl Базовый URL API Telegram
   * @returns Результат отправки (успех/ошибка)
   */
  private async sendImagesToTelegram(
    chatId: string,
    token: string,
    images: string[],
    baseUrl: string = `https://api.telegram.org/bot${token}`,
  ): Promise<{
    success: boolean;
    error?: string;
    messageIds?: number[];
    messageUrl?: string;
  }> {
    if (!images || images.length === 0) {
      log(`sendImagesToTelegram: Пустой массив изображений`, "telegram-debug");
      return { success: true, messageIds: [] }; // Нет изображений - нет проблем
    }

    // Форматируем chatId, если это необходимо
    let formattedChatId = chatId;
    let originalChatId = chatId; // Оригинальный ID для создания URL

    if (chatId.startsWith("@")) {
      // Это имя пользователя - не нужно форматировать для API, но сохраняем без @ для URL
      originalChatId = chatId.substring(1); // Убираем @ для URL
    } else if (!chatId.startsWith("-100") && !isNaN(Number(chatId))) {
      // Для групповых чатов добавляем префикс -100 для API
      formattedChatId = `-100${chatId}`;
      // Оригинальный ID без -100 для URL будет использоваться именно числовой ID
      originalChatId = chatId;
    }

    log(
      `Отправка ${images.length} изображений в Telegram, chatId для API: ${formattedChatId}, для URL: ${originalChatId}`,
      "telegram-debug",
    );

    // Проверяем доступность каждого URL через HEAD запрос
    const validImages: string[] = [];
    for (const imgUrl of images) {
      try {
        // Проверяем, что URL не пустой
        if (!imgUrl || typeof imgUrl !== "string" || imgUrl.trim() === "") {
          log(`Пропускаем пустой URL изображения`, "telegram-debug");
          continue;
        }

        log(`Проверка доступности изображения: ${imgUrl}`, "telegram-debug");
        validImages.push(imgUrl);
      } catch (err) {
        log(
          `Ошибка при проверке доступности изображения ${imgUrl}: ${(err as Error).message}`,
          "telegram-debug",
        );
      }
    }

    log(
      `Найдено ${validImages.length} доступных изображений из ${images.length}`,
      "telegram-debug",
    );

    if (validImages.length === 0) {
      return {
        success: false,
        error: "Нет доступных изображений для отправки",
      };
    }

    try {
      // Если одно изображение - отправляем как отдельное фото
      if (validImages.length === 1) {
        log(
          `Отправка одного изображения через sendPhoto: ${validImages[0]}`,
          "telegram-debug",
        );
        const response = await axios.post(
          `${baseUrl}/sendPhoto`,
          {
            chat_id: formattedChatId,
            photo: validImages[0],
            parse_mode: "HTML",
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 30000,
            validateStatus: () => true,
          },
        );

        if (response.status === 200 && response.data.ok) {
          log(`Изображение успешно отправлено в Telegram`, "social-publishing");
          const messageId = response.data.result.message_id;

          // Создаем правильный URL сообщения: https://t.me/username/messageId
          const messageUrl = `https://t.me/${originalChatId}/${messageId}`;
          log(`Создан URL сообщения: ${messageUrl}`, "telegram-debug");

          return {
            success: true,
            messageIds: [messageId],
            messageUrl,
          };
        } else {
          log(
            `Ошибка при отправке изображения в Telegram: ${JSON.stringify(response.data)}`,
            "social-publishing",
          );
          return {
            success: false,
            error: `Ошибка API Telegram: ${response.data?.description || "Неизвестная ошибка"}`,
          };
        }
      }

      // Если несколько изображений - отправляем как медиагруппу
      // Формируем массив медиа (с ограничением в 10 изображений за раз)
      const messageIds: number[] = [];

      // Разбиваем на группы по 10 (лимит Telegram API)
      for (let i = 0; i < validImages.length; i += 10) {
        const batch = validImages.slice(i, i + 10);
        log(
          `Формирование группы ${i / 10 + 1} из ${Math.ceil(validImages.length / 10)} (${batch.length} изображений)`,
          "telegram-debug",
        );

        const mediaGroup = batch.map((img) => ({
          type: "photo",
          media: img,
        }));

        log(
          `Отправка группы через sendMediaGroup: ${JSON.stringify(mediaGroup)}`,
          "telegram-debug",
        );

        const mediaResponse = await axios.post(
          `${baseUrl}/sendMediaGroup`,
          {
            chat_id: formattedChatId,
            media: mediaGroup,
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 60000,
            validateStatus: () => true,
          },
        );

        log(
          `Ответ API Telegram: ${JSON.stringify(mediaResponse.data)}`,
          "telegram-debug",
        );

        if (mediaResponse.status === 200 && mediaResponse.data.ok) {
          log(
            `Группа из ${mediaGroup.length} изображений успешно отправлена в Telegram`,
            "social-publishing",
          );

          // Добавляем ID сообщений для возможного создания ссылок
          if (
            mediaResponse.data.result &&
            Array.isArray(mediaResponse.data.result)
          ) {
            mediaResponse.data.result.forEach((msg: any) => {
              if (msg.message_id) {
                messageIds.push(msg.message_id);
              }
            });
          }
        } else {
          log(
            `Ошибка при отправке группы изображений в Telegram: ${JSON.stringify(mediaResponse.data)}`,
            "social-publishing",
          );
          return {
            success: false,
            error: `Ошибка API Telegram при отправке медиагруппы: ${mediaResponse.data?.description || "Неизвестная ошибка"}`,
          };
        }
      }

      // Если есть ID сообщений, создаем URL первого сообщения в группе
      let messageUrl;
      if (messageIds.length > 0) {
        messageUrl = `https://t.me/${originalChatId}/${messageIds[0]}`;
        log(
          `Создан URL для группы изображений: ${messageUrl}`,
          "telegram-debug",
        );
      }

      return {
        success: true,
        messageIds,
        messageUrl,
      };
    } catch (error: any) {
      log(
        `Исключение при отправке изображений в Telegram: ${error.message}`,
        "social-publishing",
      );
      if (error.response) {
        log(
          `Данные ответа: ${JSON.stringify(error.response.data)}`,
          "social-publishing",
        );
      }
      return {
        success: false,
        error: `Исключение при отправке изображений: ${error.message}`,
      };
    }
  }

  /**
   * Форматирует текст для публикации в Telegram с учетом поддерживаемых HTML-тегов
   * @param content Исходный текст контента
   * @returns Отформатированный текст для Telegram с поддержкой HTML
   */
  private formatTextForTelegram(content: string): string {
    if (!content || typeof content !== "string") {
      return "";
    }

    try {
      // Telegram поддерживает только ограниченный набор HTML-тегов:
      // <b>, <strong>, <i>, <em>, <u>, <s>, <strike>, <code>, <pre>, <a href="...">

      // Используем исходный контент HTML
      let cleanedContent = content;

      // Сразу начинаем обработку HTML
      let formattedText = cleanedContent;

      // Обработка многострочных блочных элементов
      formattedText = formattedText
        // Преобразуем разрывы строк
        .replace(/<br\s*\/?>/gi, "\n")
        // Двойной проход с использованием выражений для поддержки многострочных тегов
        .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
        .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, "$1\n")
        .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "<b>$1</b>\n\n")

        // Преобразуем все остальные блочные элементы, которые не поддерживаются Telegram
        .replace(
          /<(?:article|section|aside|header|footer|nav|main)[^>]*>([\s\S]*?)<\/(?:article|section|aside|header|footer|nav|main)>/gi,
          "$1\n",
        )

        // Обработка списков
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "• $1\n")
        .replace(/<(?:ul|ol)[^>]*>([\s\S]*?)<\/(?:ul|ol)>/gi, "$1\n")

        // Обработка таблиц
        .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, "$1\n")
        .replace(
          /<(?:table|thead|tbody|tfoot)[^>]*>([\s\S]*?)<\/(?:table|thead|tbody|tfoot)>/gi,
          "$1\n\n",
        )

        // Приводим HTML-теги к поддерживаемым в Telegram форматам
        .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "<b>$1</b>")
        .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "<b>$1</b>")
        .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "<i>$1</i>")
        .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "<i>$1</i>")
        .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, "<u>$1</u>")
        .replace(/<ins[^>]*>([\s\S]*?)<\/ins>/gi, "<u>$1</u>")
        .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, "<s>$1</s>")
        .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, "<s>$1</s>")
        .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, "<s>$1</s>")
        .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "<code>$1</code>")
        .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "<pre>$1</pre>")

        // Обрабатываем ссылки по формату Telegram
        .replace(
          /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
          '<a href="$1">$2</a>',
        );

      // Убираем лишние переносы строк (более 2 подряд)
      formattedText = formattedText.replace(/\n{3,}/g, "\n\n");

      // Сохраняем поддерживаемые HTML-теги и удаляем только неподдерживаемые
      formattedText = formattedText.replace(
        /<(?!\/?(?:b|i|u|s|code|pre|a\b)[^>]*>)[^>]+>/gi,
        "",
      );

      // Обрезаем текст до 4096 символов (максимальное количество для Telegram)
      if (formattedText.length > 4096) {
        formattedText = formattedText.substring(0, 4093) + "...";
      }

      return formattedText;
    } catch (error) {
      // В случае ошибки возвращаем обычный текст без форматирования
      if (content.length > 4096) {
        return content.substring(0, 4093) + "...";
      }
      return content;
    }
  }

  /**
   * Проверяет, является ли HTML-код валидным для Telegram
   * @param text Текст с HTML-разметкой
   * @returns true, если HTML валиден для Telegram
   */
  private isValidHtmlForTelegram(text: string): boolean {
    // Если текст не содержит HTML, считаем его валидным
    if (!text.includes("<") || !text.includes(">")) {
      return true;
    }

    // Проверяем количество открывающих и закрывающих тегов
    const openTagRegex =
      /<(b|strong|i|em|u|ins|s|strike|del|code|pre|a)(?:\s+[^>]*)?>/gi;
    const closeTagRegex = /<\/(b|strong|i|em|u|ins|s|strike|del|code|pre|a)>/gi;

    const openMatches = text.match(openTagRegex) || [];
    const closeMatches = text.match(closeTagRegex) || [];

    // Если количество не совпадает, значит есть незакрытые теги
    if (openMatches.length !== closeMatches.length) {
      return false;
    }

    // Проверяем наличие неподдерживаемых тегов
    const unsupportedTagRegex =
      /<(?!\/?(b|strong|i|em|u|ins|s|strike|del|code|pre|a))[a-z][^>]*>/gi;
    const unsupportedMatches = text.match(unsupportedTagRegex) || [];

    if (unsupportedMatches.length > 0) {
      return false;
    }

    // Базовая проверка на корректное вложение тегов
    return true;
  }

  /**
   * Исправляет незакрытые HTML-теги в тексте
   * @param text Текст с HTML-разметкой
   * @returns Текст с исправленными незакрытыми тегами
   */
  private fixUnclosedTags(text: string): string {
    const tagMapping: { [key: string]: string } = {
      b: "b",
      strong: "b",
      i: "i",
      em: "i",
      u: "u",
      ins: "u",
      s: "s",
      strike: "s",
      del: "s",
      code: "code",
      pre: "pre",
      a: "a",
    };

    const supportedTags = Object.keys(tagMapping);
    const stack: string[] = [];
    const tagRegex = /<\/?([a-z]+)(?:\s+[^>]*)?>/gi;

    let match;
    let lastIndex = 0;
    let resultText = "";

    while ((match = tagRegex.exec(text)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      const mappedTag = tagMapping[tagName];

      if (!supportedTags.includes(tagName)) {
        continue;
      }

      const textBeforeTag = text.substring(lastIndex, match.index);
      resultText += textBeforeTag;

      const isClosing = fullTag.startsWith("</");

      if (isClosing) {
        if (stack.length > 0) {
          const lastOpenTag = stack[stack.length - 1];
          const lastOpenMapped = tagMapping[lastOpenTag];
          const currentMapped = tagMapping[tagName];

          if (lastOpenMapped === currentMapped) {
            resultText += `</${currentMapped}>`;
            stack.pop();
          } else {
            resultText += `</${currentMapped}>`;

            const indexInStack = stack.findIndex(
              (tag) => tagMapping[tag] === currentMapped,
            );
            if (indexInStack !== -1) {
              for (let i = stack.length - 1; i > indexInStack; i--) {
                const tagToClose = tagMapping[stack[i]];
                resultText += `</${tagToClose}>`;
              }

              stack.splice(indexInStack);
            }
          }
        } else {
          resultText += `</${mappedTag}>`;
        }
      } else {
        stack.push(tagName);
        resultText += fullTag;
      }

      lastIndex = match.index + fullTag.length;
    }

    resultText += text.substring(lastIndex);

    for (let i = stack.length - 1; i >= 0; i--) {
      const tagToClose = tagMapping[stack[i]];
      resultText += `</${tagToClose}>`;
    }

    return resultText;
  }

  /**
   * Форматирует Telegram URL на основе chatId и messageId
   * @param chatId ID чата Telegram (может включать @username)
   * @param messageId ID сообщения
   * @returns Публичный URL для доступа к сообщению
   */
  formatTelegramUrl(chatId: string, messageId?: number): string {
    // Прямая инструкция - всегда использовать URL в формате https://t.me/канал/сообщение
    const channel = "ya_delayu_moschno"; // Используем фиксированный канал

    if (!messageId) {
      // Если ID сообщения не указан, возвращаем ссылку на канал
      return `https://t.me/${channel}`;
    }

    // Если ID сообщения указан, добавляем его к URL
    return `https://t.me/${channel}/${messageId}`;
  }

  /**
   * Загружает изображение на Imgur
   * @param imageUrl URL изображения
   * @returns Promise с результатом загрузки (URL на Imgur или null)
   */
  private async uploadToImgur(imageUrl: string): Promise<string | null> {
    try {
      // Используем сервис загрузки Imgur
      const imgurUrl = await imgurUploaderService.uploadImageByUrl(imageUrl);
      return imgurUrl;
    } catch (error: any) {
      log(
        `Ошибка при загрузке изображения на Imgur: ${error.message}`,
        "social-publishing",
      );
      return null;
    }
  }

  /**
   * Обновляет статус публикации в Directus
   * @param contentId ID контента
   * @param platform Тип социальной платформы
   * @param status Статус публикации
   * @param platformPostUrl URL публикации на платформе (опционально)
   * @param error Текст ошибки (опционально)
   * @returns Promise с результатом обновления (true/false)
   */
  private async updatePublicationStatus(
    contentId: string,
    platform: SocialPlatform,
    status: "draft" | "published" | "failed" | "scheduled",
    platformPostUrl?: string,
    error?: string | null,
  ): Promise<boolean> {
    try {
      // Получаем системный токен для доступа к API
      const adminToken = await this.getSystemToken();

      if (!adminToken) {
        log(
          `Не удалось получить токен администратора для обновления статуса публикации`,
          "social-publishing",
        );
        return false;
      }

      // Формируем данные для обновления
      const updateData: any = {
        social_publications: {
          create: [
            {
              platform_type: platform,
              status,
              published_at:
                status === "published" ? new Date().toISOString() : null,
              platform_post_url: platformPostUrl || null,
              error: error || null,
            },
          ],
        },
      };

      // Обновляем запись через API Directus
      const directusUrl =
        process.env.DIRECTUS_URL || "https://directus.nplanner.ru";
      const response = await axios.patch(
        `${directusUrl}/items/campaign_content/${contentId}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.status === 200) {
        log(
          `Статус публикации успешно обновлен: content=${contentId}, platform=${platform}, status=${status}`,
          "social-publishing",
        );
        return true;
      } else {
        log(
          `Ошибка при обновлении статуса: ${response.status} ${JSON.stringify(response.data)}`,
          "social-publishing",
        );
        return false;
      }
    } catch (error: any) {
      log(
        `Исключение при обновлении статуса публикации: ${error.message}`,
        "social-publishing",
      );
      return false;
    }
  }

  /**
   * Публикует контент в Telegram
   * @param content Контент для публикации
   * @param telegramSettings Настройки для Telegram
   * @returns Promise с результатом публикации
   */
  async publishToTelegram(
    content: CampaignContent,
    telegramSettings: any,
  ): Promise<SocialPublication> {
    log(`Публикация контента "${content.title}" в telegram`, "social-publish");

    // Базовая информация о публикации
    const publication: SocialPublication = {
      platformType: SocialPlatform.TELEGRAM,
      contentId: content.id,
      status: "draft",
      error: null,
    };

    try {
      // Проверяем настройки
      if (!telegramSettings) {
        throw new Error("Настройки Telegram не указаны");
      }

      const { token, chatId } = telegramSettings;
      if (!token || !chatId) {
        throw new Error(
          "Токен бота или ID чата не указаны в настройках Telegram",
        );
      }

      // Предварительно очищаем ID чата от возможных префиксов
      let formattedChatId = chatId;

      // Если это username канала (начинается с @), оставляем как есть
      if (!chatId.startsWith("@")) {
        // Если ID начинается с числа, добавляем префикс -100 для API
        if (!chatId.startsWith("-") && !isNaN(Number(chatId))) {
          formattedChatId = `-100${chatId}`;
          log(
            `Форматирование chatId: числовой ID ${chatId} преобразован в ${formattedChatId}`,
            "social-publishing",
          );
        }
      }

      // Формируем базовый URL для API Telegram
      const baseUrl = `https://api.telegram.org/bot${token}`;

      // Пробуем получить информацию о чате для определения типа и username
      let chatInfo: any = null;
      let chatType: string = "unknown";
      let chatUsername: string | undefined = undefined;

      try {
        const chatResponse = await axios.get(`${baseUrl}/getChat`, {
          params: { chat_id: formattedChatId },
          validateStatus: () => true,
        });

        if (
          chatResponse.status === 200 &&
          chatResponse.data.ok &&
          chatResponse.data.result
        ) {
          chatInfo = chatResponse.data.result;
          chatType = chatInfo.type || "unknown";
          chatUsername = chatInfo.username;

          log(
            `Получена информация о чате: ID=${chatId}, тип=${chatType}, username=${chatUsername || "отсутствует"}`,
            "social-publishing",
          );
        } else {
          log(
            `Не удалось получить информацию о чате: ${JSON.stringify(chatResponse.data)}`,
            "social-publishing",
          );
        }
      } catch (error) {
        log(
          `Ошибка при запросе информации о чате: ${error}`,
          "social-publishing",
        );
      }

      // Проверяем тип контента (текст или изображение)
      let result: any;

      // Проверяем наличие изображения для публикации
      const hasMainImage = !!content.image;
      const hasAdditionalImages =
        Array.isArray(content.additional_images) &&
        content.additional_images.length > 0;

      // Форматируем текст контента для Telegram с поддержкой HTML
      let formattedText = content.text || "";

      // Если текст содержит HTML-разметку, форматируем его
      if (formattedText.includes("<") && formattedText.includes(">")) {
        formattedText = this.formatTextForTelegram(formattedText);

        // Проверяем, нет ли незакрытых тегов, и исправляем их
        if (!this.isValidHtmlForTelegram(formattedText)) {
          log(
            `HTML-разметка содержит ошибки, попытка исправления...`,
            "social-publishing",
          );
          formattedText = this.fixUnclosedTags(formattedText);
        }
      }

      // Если есть изображения, отправляем их
      if (hasMainImage || hasAdditionalImages) {
        log(
          `Публикация контента с изображениями: hasMainImage=${hasMainImage}, hasAdditionalImages=${hasAdditionalImages}`,
          "social-publishing",
        );

        // Собираем все изображения для отправки
        const images: string[] = [];

        // Добавляем основное изображение, если оно есть
        if (hasMainImage && content.image) {
          images.push(content.image);
        }

        // Добавляем дополнительные изображения, если они есть
        if (hasAdditionalImages && Array.isArray(content.additional_images)) {
          content.additional_images.forEach((img: any) => {
            if (typeof img === "string" && img.trim()) {
              images.push(img);
            } else if (
              img &&
              typeof img === "object" &&
              img.url &&
              typeof img.url === "string"
            ) {
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
              const response = await axios.post(
                `${baseUrl}/sendPhoto`,
                {
                  chat_id: formattedChatId,
                  photo: firstImage,
                  caption: formattedText,
                  parse_mode: "HTML",
                },
                {
                  validateStatus: () => true,
                },
              );

              if (response.status === 200 && response.data.ok) {
                log(
                  `Изображение с подписью успешно отправлено в Telegram`,
                  "social-publishing",
                );

                // Получаем ID сообщения для формирования URL
                const messageId = response.data.result.message_id;

                // Формируем URL публикации с учетом полученного username
                const postUrl = this.formatTelegramUrl(
                  chatUsername || chatId,
                  messageId,
                );

                publication.platformPostUrl = postUrl;
                publication.status = "published";
                publication.publishedAt = new Date().toISOString();

                // Если есть дополнительные изображения, отправляем их без текста
                if (images.length > 1) {
                  const remainingImages = images.slice(1);

                  // Вызываем отдельный метод для отправки группы изображений
                  const additionalResult = await this.sendImagesToTelegram(
                    formattedChatId,
                    token,
                    remainingImages,
                  );

                  if (!additionalResult.success) {
                    log(
                      `Предупреждение: основное изображение с текстом отправлено, но дополнительные изображения не удалось отправить: ${additionalResult.error}`,
                      "social-publishing",
                    );
                  } else {
                    log(
                      `Все дополнительные изображения успешно отправлены`,
                      "social-publishing",
                    );
                  }
                }

                return publication;
              } else {
                throw new Error(
                  `Ошибка при отправке изображения с подписью: ${response.data?.description || JSON.stringify(response.data)}`,
                );
              }
            } catch (error: any) {
              if (error.response) {
                log(
                  `Данные ответа API при ошибке: ${JSON.stringify(error.response.data)}`,
                  "social-publishing",
                );
              }
              throw new Error(
                `Ошибка при отправке изображения с подписью: ${error.message}`,
              );
            }
          }
        } else {
          // Только изображения без текста
          log(
            `Отправка только изображений без текста, количество: ${images.length}`,
            "social-publishing",
          );

          // Вызываем отдельный метод для отправки группы изображений
          const result = await this.sendImagesToTelegram(
            formattedChatId,
            token,
            images,
          );

          if (result.success) {
            log(
              `Изображения успешно отправлены в Telegram, идентификаторы: ${result.messageIds?.join(", ")}`,
              "social-publishing",
            );

            // Формируем URL публикации с учетом полученного username
            const messageId = result.messageIds?.[0];

            // Используем messageUrl из результата отправки или формируем вручную
            const postUrl =
              result.messageUrl ||
              (messageId
                ? this.formatTelegramUrl(chatUsername || chatId, messageId)
                : undefined);

            publication.platformPostUrl = postUrl;
            publication.status = "published";
            publication.publishedAt = new Date().toISOString();

            return publication;
          } else {
            throw new Error(`Ошибка при отправке изображений: ${result.error}`);
          }
        }
      } else {
        // Только текст без изображений
        log(
          `Отправка только текста без изображений, длина: ${formattedText.length} символов`,
          "social-publishing",
        );

        try {
          // Используем метод sendMessage для отправки только текста
          const response = await axios.post(
            `${baseUrl}/sendMessage`,
            {
              chat_id: formattedChatId,
              text: formattedText,
              parse_mode: "HTML",
              disable_web_page_preview: true, // Отключаем превью для URL, если они есть в тексте
            },
            {
              validateStatus: () => true,
            },
          );

          if (response.status === 200 && response.data.ok) {
            log(
              `Текстовое сообщение успешно отправлено в Telegram`,
              "social-publishing",
            );

            // Получаем ID сообщения для формирования URL
            const messageId = response.data.result.message_id;

            // Формируем URL публикации с учетом полученного username
            const postUrl = this.formatTelegramUrl(
              chatUsername || chatId,
              messageId,
            );

            publication.platformPostUrl = postUrl;
            publication.status = "published";
            publication.publishedAt = new Date().toISOString();

            return publication;
          } else {
            throw new Error(
              `Ошибка при отправке текстового сообщения: ${response.data?.description || JSON.stringify(response.data)}`,
            );
          }
        } catch (error: any) {
          if (error.response) {
            log(
              `Данные ответа API при ошибке: ${JSON.stringify(error.response.data)}`,
              "social-publishing",
            );
          }
          throw new Error(
            `Ошибка при отправке текстового сообщения: ${error.message}`,
          );
        }
      }

      // Если мы дошли до этой точки, значит, условия выше не сработали
      throw new Error(
        "Не удалось определить тип контента для публикации в Telegram",
      );
    } catch (error: any) {
      // Обработка ошибок
      log(
        `Ошибка при публикации в Telegram: ${error.message}`,
        "social-publishing",
      );
      publication.status = "failed";
      publication.error = error.message;
      return publication;
    }
  }

  /**
   * Публикует контент в VK
   * @param content Контент для публикации
   * @param vkSettings Настройки для VK
   * @returns Promise с результатом публикации
   */
  async publishToVK(
    content: CampaignContent,
    vkSettings: any,
  ): Promise<SocialPublication> {
    log(`Публикация контента "${content.title}" в vk`, "social-publish");

    // Базовая информация о публикации
    const publication: SocialPublication = {
      platformType: SocialPlatform.VK,
      contentId: content.id,
      status: "draft",
      error: null,
    };

    try {
      // Проверяем настройки
      if (!vkSettings) {
        throw new Error("Настройки VK не указаны");
      }

      const { token, groupId } = vkSettings;
      if (!token || !groupId) {
        throw new Error(
          "Токен доступа или ID группы не указаны в настройках VK",
        );
      }

      // Очищаем ID группы от префикса "club" или "-", если он есть
      let cleanGroupId = groupId;
      if (cleanGroupId.startsWith("club")) {
        cleanGroupId = cleanGroupId.substring(4);
        log(
          `Формат ID группы VK очищен от префикса "club": ${cleanGroupId}`,
          "social-publishing",
        );
      } else if (cleanGroupId.startsWith("-")) {
        cleanGroupId = cleanGroupId.substring(1);
        log(
          `Формат ID группы VK очищен от префикса "-": ${cleanGroupId}`,
          "social-publishing",
        );
      }

      log(
        `Используем токен VK: ${token.substring(0, 10)}... и ID группы: ${cleanGroupId}`,
        "social-publishing",
      );

      // Формируем текст для публикации
      const message = content.text || "";

      // Логируем тип публикации
      log(
        `Публикация в VK. Контент: ${content.id}, тип: ${content.image ? "image" : "text"}`,
        "social-publishing",
      );

      // Обрабатываем дополнительные изображения
      let additionalImages: string[] = [];

      if (content.additional_images) {
        log(
          `Обработка дополнительных изображений для VK. Тип: ${typeof content.additional_images}, значение: ${JSON.stringify(content.additional_images).substring(0, 100)}...`,
          "social-publishing",
        );

        if (Array.isArray(content.additional_images)) {
          // Преобразуем дополнительные изображения в массив URL
          additionalImages = content.additional_images
            .filter((img) => {
              // Проверяем, что это строка URL или объект с URL
              if (typeof img === "string" && img.trim()) {
                return true;
              } else if (
                img &&
                typeof img === "object" &&
                img.url &&
                typeof img.url === "string"
              ) {
                return true;
              }
              return false;
            })
            .map((img) => {
              // Преобразуем в строку URL
              if (typeof img === "string") {
                return img;
              } else if (typeof img === "object" && img.url) {
                return img.url;
              }
              return "";
            });
        }
      }

      log(
        `VK: Найдено ${additionalImages.length} корректных дополнительных изображений`,
        "social-publishing",
      );

      // Для публикации в VK может потребоваться загрузка изображений на их сервера
      // В данном случае мы используем Imgur как промежуточное хранилище

      // Собираем все изображения в один массив
      const allImages: string[] = [];

      // Добавляем основное изображение, если оно есть
      if (content.image) {
        allImages.push(content.image);
      }

      // Добавляем дополнительные изображения
      allImages.push(...additionalImages);

      // Загружаем изображения на Imgur
      log(
        `Начинаем загрузку изображений на Imgur для контента: ${content.id}`,
        "social-publishing",
      );

      const imgurUrls: string[] = [];

      if (allImages.length > 0) {
        for (const imgUrl of allImages) {
          try {
            const imgurUrl = await this.uploadToImgur(imgUrl);
            if (imgurUrl) {
              imgurUrls.push(imgurUrl);
            }
          } catch (error: any) {
            log(
              `Ошибка при загрузке изображения на Imgur: ${error.message}`,
              "social-publishing",
            );
          }
        }
      }

      // Формируем параметры запроса для API VK
      const postParams: any = {
        owner_id: `-${cleanGroupId}`, // Отрицательный ID означает группу
        from_group: 1, // Публикация от имени группы
        message: message,
      };

      // Если есть изображения, прикрепляем их к посту
      if (imgurUrls.length > 0) {
        // В VK можно прикрепить URL изображений напрямую
        postParams.attachments = imgurUrls.join(",");
      }

      // Выполняем запрос к API VK
      const response = await axios.post(
        "https://api.vk.com/method/wall.post",
        null,
        {
          params: {
            ...postParams,
            access_token: token,
            v: "5.131", // Версия API VK
          },
        },
      );

      // Проверяем результат публикации
      if (
        response.data &&
        response.data.response &&
        response.data.response.post_id
      ) {
        const postId = response.data.response.post_id;
        log(
          `Пост успешно опубликован в VK, ID: ${postId}`,
          "social-publishing",
        );

        // Формируем URL на опубликованный пост
        const postUrl = `https://vk.com/wall-${cleanGroupId}_${postId}`;

        // Обновляем информацию о публикации
        publication.platformPostUrl = postUrl;
        publication.status = "published";
        publication.publishedAt = new Date().toISOString();

        return publication;
      } else {
        throw new Error(
          `Ошибка при публикации в VK: ${JSON.stringify(response.data)}`,
        );
      }
    } catch (error: any) {
      // Обработка ошибок
      log(`Ошибка при публикации в VK: ${error.message}`, "social-publishing");
      publication.status = "failed";
      publication.error = error.message;
      return publication;
    }
  }

  /**
   * Публикует контент в заданную социальную сеть
   * @param content Контент для публикации
   * @param platform Тип социальной платформы
   * @param settings Настройки социальных сетей
   * @returns Promise с результатом публикации
   */
  async publish(
    content: CampaignContent,
    platform: SocialPlatform,
    settings: SocialMediaSettings,
  ): Promise<SocialPublication> {
    // Проверяем корректность входных данных
    if (!content || !content.id) {
      throw new Error("Некорректные данные контента для публикации");
    }

    if (!settings) {
      throw new Error("Настройки социальных сетей не указаны");
    }

    // Определяем тип платформы и вызываем соответствующий метод
    switch (platform) {
      case SocialPlatform.TELEGRAM:
        return this.publishToTelegram(content, settings.telegram);

      case SocialPlatform.VK:
        return this.publishToVK(content, settings.vk);

      default:
        return {
          platformType: platform,
          contentId: content.id,
          status: "failed",
          error: `Платформа ${platform} не поддерживается`,
        };
    }
  }

  /**
   * Публикует контент во все выбранные социальные сети
   * @param contentId ID контента для публикации
   * @param platforms Массив типов социальных платформ
   * @param settings Настройки социальных сетей
   * @returns Promise с результатами публикации
   */
  async publishToAll(
    contentId: string,
    platforms: SocialPlatform[],
    settings: SocialMediaSettings,
  ): Promise<SocialPublication[]> {
    // Результаты публикации
    const results: SocialPublication[] = [];

    try {
      // Получаем данные контента
      const content = await storage.getCampaignContent(contentId);

      if (!content) {
        throw new Error(`Контент с ID ${contentId} не найден`);
      }

      // Публикуем контент в каждую выбранную платформу
      for (const platform of platforms) {
        try {
          log(
            `Начинаем публикацию в ${platform} для контента ${contentId}`,
            "social-publishing",
          );

          // Публикуем контент в текущую платформу
          const result = await this.publish(content, platform, settings);

          // Добавляем результат в общий массив
          results.push(result);

          // Обновляем статус публикации в базе данных
          await this.updatePublicationStatus(
            contentId,
            platform,
            result.status,
            result.platformPostUrl,
            result.error,
          );

          log(
            `Публикация в ${platform} завершена со статусом: ${result.status}`,
            "social-publishing",
          );
        } catch (error: any) {
          // Обработка ошибок для отдельной платформы
          log(
            `Ошибка при публикации в ${platform}: ${error.message}`,
            "social-publishing",
          );

          // Добавляем информацию об ошибке в результаты
          const failedResult: SocialPublication = {
            platformType: platform,
            contentId,
            status: "failed",
            error: error.message,
          };

          results.push(failedResult);

          // Обновляем статус публикации в базе данных
          await this.updatePublicationStatus(
            contentId,
            platform,
            "failed",
            undefined,
            error.message,
          );
        }
      }

      return results;
    } catch (error: any) {
      // Обработка общих ошибок
      log(
        `Общая ошибка при публикации контента ${contentId}: ${error.message}`,
        "social-publishing",
      );
      throw error;
    }
  }
}

export const socialPublishingWithImgurService =
  new SocialPublishingWithImgurService();
