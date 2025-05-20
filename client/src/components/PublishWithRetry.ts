import { apiRequest } from '@/lib/queryClient';
import { useAuthStore } from '@/lib/store';
import axios from 'axios';

// Максимальное число попыток публикации
const MAX_PUBLISH_ATTEMPTS = 3;

// Задержка между попытками (в миллисекундах)
const RETRY_DELAY_MS = 4000; // Увеличиваем задержку до 4 секунд

// Тип для параметров публикации
interface PublishParams {
  contentId: string;
  platforms: string[];
  userId: string;
  immediate?: boolean;
}

/**
 * Проверяет существование контента по ID, обращаясь напрямую к Directus
 * @param contentId ID контента для проверки
 * @param token Токен авторизации для запроса к Directus
 * @returns true, если контент существует
 */
export async function checkContentExists(contentId: string, token?: string): Promise<boolean> {
  try {
    console.log(`Проверка существования контента с ID: ${contentId}`);
    
    // Пробуем сначала через API приложения
    try {
      const response = await apiRequest(`/api/campaign-content/${contentId}`, {
        method: 'GET'
      });
      
      const exists = !!(response && (response.id || response.data?.id));
      console.log(`Результат проверки контента ${contentId} через API: ${exists ? 'существует' : 'не найден'}`);
      
      if (exists) return true;
    } catch (error) {
      console.log('Не удалось проверить контент через API, пробуем напрямую через Directus');
    }
    
    // Если через API не удалось, пробуем напрямую через Directus
    if (token) {
      try {
        const directusUrl = 'https://directus.nplanner.ru';
        const response = await axios.get(`${directusUrl}/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const exists = !!(response && response.data && (response.data.data));
        console.log(`Результат проверки контента ${contentId} через Directus: ${exists ? 'существует' : 'не найден'}`);
        return exists;
      } catch (directusError) {
        console.error('Ошибка при проверке существования контента через Directus:', directusError);
      }
    }
    
    return false;
  } catch (error) {
    console.error('Ошибка при проверке существования контента:', error);
    return false;
  }
}

/**
 * Публикует контент с несколькими попытками и проверками
 * @param params Параметры для публикации
 * @returns Результат публикации или выбрасывает ошибку
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
      
      // Перед каждой попыткой проверяем, существует ли контент (передаем токен для проверки через Directus)
      const contentExists = await checkContentExists(contentId, token);
      
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
      
      // Публикуем контент
      const result = await apiRequest(`/api/publish/${contentId}`, {
        method: 'POST',
        data: {
          platforms,
          immediate,
          userId,
          contentId,
          token // Дублируем токен в теле запроса для надежности
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-ID': userId || ''
        }
      });
      
      console.log('Публикация успешно выполнена:', result);
      return result;
      
    } catch (error: any) {
      console.error(`Попытка ${attempt}: Ошибка при публикации:`, error);
      lastError = error;
      
      // Если это не 404 ошибка, нет смысла повторять
      if (!error.message?.includes('404') && !error.message?.includes('Контент не найден')) {
        break;
      }
      
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