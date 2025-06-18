/**
 * Instagram Stories API интеграция
 * Поддерживает реальные интерактивные элементы через Instagram Graph API
 */

interface InstagramStoryElement {
  type: 'poll' | 'quiz' | 'slider' | 'sticker';
  position: {
    x: number; // 0-1
    y: number; // 0-1
  };
  data: any;
}

interface InstagramPoll {
  question: string;
  options: [string, string]; // Instagram поддерживает только 2 варианта
}

interface InstagramQuiz {
  question: string;
  options: string[]; // До 4 вариантов
  correct_option: number;
}

interface InstagramSlider {
  question: string;
  emoji: string; // Один эмодзи для слайдера
}

/**
 * Преобразует наши Stories элементы в формат Instagram API
 */
export function convertToInstagramStoryElements(storyData: any): InstagramStoryElement[] {
  const elements: InstagramStoryElement[] = [];
  
  if (!storyData?.slides?.[0]?.elements) {
    return elements;
  }

  storyData.slides[0].elements.forEach((element: any) => {
    try {
      const position = {
        x: element.position.x / 270, // Нормализуем к 0-1
        y: element.position.y / 480
      };

      switch (element.type) {
        case 'poll':
          const pollData = JSON.parse(element.content);
          if (pollData.options.length >= 2) {
            elements.push({
              type: 'poll',
              position,
              data: {
                question: pollData.question,
                options: [pollData.options[0], pollData.options[1]] // Instagram: только 2 варианта
              }
            });
          }
          break;

        case 'quiz':
          const quizData = JSON.parse(element.content);
          elements.push({
            type: 'quiz',
            position,
            data: {
              question: quizData.question,
              options: quizData.options.slice(0, 4), // Instagram: до 4 вариантов
              correct_option: quizData.correctAnswer
            }
          });
          break;

        case 'slider':
          const sliderData = JSON.parse(element.content);
          elements.push({
            type: 'slider',
            position,
            data: {
              question: sliderData.question,
              emoji: '🔥' // По умолчанию, можно настроить
            }
          });
          break;

        case 'sticker':
          const stickerData = JSON.parse(element.content);
          elements.push({
            type: 'sticker',
            position,
            data: {
              sticker_id: mapStickerTypeToInstagramId(stickerData.type)
            }
          });
          break;
      }
    } catch (error) {
      console.error('Ошибка обработки элемента Stories:', error);
    }
  });

  return elements;
}

/**
 * Публикует Stories в Instagram с интерактивными элементами
 */
export async function publishInstagramStory(
  accessToken: string,
  instagramAccountId: string,
  imageUrl: string,
  interactiveElements: InstagramStoryElement[]
) {
  const url = `https://graph.facebook.com/v18.0/${instagramAccountId}/media`;
  
  const mediaData: any = {
    image_url: imageUrl,
    media_type: 'STORIES',
    access_token: accessToken
  };

  // Добавляем интерактивные элементы
  interactiveElements.forEach((element, index) => {
    switch (element.type) {
      case 'poll':
        mediaData[`interactive_stickers[${index}]`] = JSON.stringify({
          sticker_type: 'poll',
          poll: {
            question: element.data.question,
            options: element.data.options
          },
          x: element.position.x,
          y: element.position.y
        });
        break;

      case 'quiz':
        mediaData[`interactive_stickers[${index}]`] = JSON.stringify({
          sticker_type: 'quiz',
          quiz: {
            question: element.data.question,
            options: element.data.options,
            correct_option: element.data.correct_option
          },
          x: element.position.x,
          y: element.position.y
        });
        break;

      case 'slider':
        mediaData[`interactive_stickers[${index}]`] = JSON.stringify({
          sticker_type: 'slider',
          slider: {
            question: element.data.question,
            emoji: element.data.emoji
          },
          x: element.position.x,
          y: element.position.y
        });
        break;
    }
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(mediaData)
    });

    const result = await response.json();
    
    if (result.id) {
      // Публикуем созданную Stories
      const publishUrl = `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`;
      const publishResponse = await fetch(publishUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          creation_id: result.id,
          access_token: accessToken
        })
      });

      return await publishResponse.json();
    }

    return result;
  } catch (error) {
    console.error('Ошибка публикации Instagram Stories:', error);
    throw error;
  }
}

function mapStickerTypeToInstagramId(type: string): string {
  const mapping: Record<string, string> = {
    'heart': '369239263222822',
    'fire': '369239899889425',
    'star': '369239976556084',
    'thumbs_up': '369240103222738',
    'clap': '369240153222733'
  };
  
  return mapping[type] || mapping['heart'];
}

/**
 * Гибридный подход: картинка + интерактивные элементы
 */
export async function publishHybridInstagramStory(
  accessToken: string,
  instagramAccountId: string,
  storyData: any
) {
  // 1. Генерируем базовое изображение (фон + статичные элементы)
  const baseImageResponse = await fetch('/api/stories/generate-base', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyData })
  });
  
  const { imageUrl } = await baseImageResponse.json();
  
  // 2. Конвертируем интерактивные элементы в Instagram формат
  const interactiveElements = convertToInstagramStoryElements(storyData);
  
  // 3. Публикуем с интерактивными элементами
  return publishInstagramStory(
    accessToken,
    instagramAccountId,
    imageUrl,
    interactiveElements
  );
}