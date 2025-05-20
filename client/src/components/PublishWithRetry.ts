import { apiRequest } from '@/lib/queryClient';
import { useAuthStore } from '@/lib/store';
import axios from 'axios';

// Максимальное число попыток публикации
const MAX_PUBLISH_ATTEMPTS = 3;

// Задержка между попытками (в миллисекундах)
const RETRY_DELAY_MS = 5000; // Увеличиваем задержку до 5 секунд

// Тип для параметров публикации
interface PublishParams {
  contentId: string;
  platforms: string[];
  userId: string;
  immediate?: boolean;
}

/**
 * Проверяет существование контента по ID путем повторного запроса
 * @param contentId ID контента для проверки
 * @returns Promise<boolean> true, если контент существует
 */
export async function checkContentExists(contentId: string): Promise<boolean> {
  try {
    console.log(`Проверка существования контента с ID: ${contentId}`);
    
    // Проверяем существование контента через API
    const response = await apiRequest(`/api/campaign-content/${contentId}`, {
      method: 'GET'
    });
    
    const exists = !!(response && (response.id || response.data?.id));
    console.log(`Результат проверки контента ${contentId}: ${exists ? 'существует' : 'не найден'}`);
    return exists;
  } catch (error) {
    console.error('Ошибка при проверке существования контента:', error);
    return false;
  }
}

/**
 * Публикует контент с несколькими попытками и проверками
 * @param params Параметры для публикации
 * @returns Promise<any> Результат публикации или ошибка
 */
export async function publishWithRetry(params: PublishParams): Promise<any> {
  const { contentId, platforms, userId, immediate = true } = params;
  
  // Счетчик попыток
  let attempt = 0;
  let lastError = null;
  
  // Получаем токен авторизации
  const getAuthToken = useAuthStore.getState().getAuthToken;
  const token = getAuthToken() || '';
  
  while (attempt < MAX_PUBLISH_ATTEMPTS) {
    attempt++;
    
    try {
      // Выводим информацию о попытке в консоль
      console.log(`Попытка публикации ${attempt}/${MAX_PUBLISH_ATTEMPTS}...`);
      
      // Проверяем существование контента
      const contentExists = await checkContentExists(contentId);
      
      if (!contentExists) {
        console.warn(`Попытка ${attempt}: Контент ${contentId} не найден, ожидаем ${RETRY_DELAY_MS}мс...`);
        
        // Если это последняя попытка - сообщаем об ошибке
        if (attempt === MAX_PUBLISH_ATTEMPTS) {
          throw new Error(`Контент с ID ${contentId} не найден после ${MAX_PUBLISH_ATTEMPTS} попыток`);
        }
        
        // Иначе ждем и продолжаем
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      
      console.log(`Попытка ${attempt}: Отправка запроса на публикацию контента ${contentId}...`);
      
      // Используем простой метод публикации с обработкой ошибок
      try {
        // Сначала проверяем существование контента еще раз для надежности
        const result = await apiRequest(`/api/publish-simple/${contentId}`, {
          method: 'POST',
          data: {
            platforms,
            immediate,
            userId,
            contentId
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-ID': userId || ''
          }
        });
        
        console.log('Публикация успешно выполнена:', result);
        return result;
      } catch (publishError: any) {
        console.error(`Ошибка при публикации через простой API:`, publishError);
        throw publishError;
      }
      
    } catch (error: any) {
      console.error(`Попытка ${attempt}: Ошибка при публикации:`, error);
      lastError = error;
      
      // Если это последняя попытка, выбрасываем ошибку
      if (attempt === MAX_PUBLISH_ATTEMPTS) {
        console.error(`Все ${MAX_PUBLISH_ATTEMPTS} попытки публикации не удались`);
        throw error;
      }
      
      // Иначе ждем и повторяем попытку
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  
  // Если все попытки не удались, выбрасываем последнюю ошибку
  throw lastError || new Error(`Не удалось опубликовать контент после ${MAX_PUBLISH_ATTEMPTS} попыток`);
}