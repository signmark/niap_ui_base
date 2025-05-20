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
      
      // Проверяем существование контента с более глубокой проверкой
      console.log(`Проверка существования контента ${contentId} перед публикацией...`);
      
      try {
        // Непосредственная проверка через API запрос
        const contentCheckResponse = await apiRequest(`/api/campaign-content/${contentId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!contentCheckResponse || !contentCheckResponse.data) {
          console.warn(`Попытка ${attempt}: Контент ${contentId} не найден через прямой запрос API`);
          
          // Дополнительная проверка через стандартную функцию
          const contentExists = await checkContentExists(contentId);
          
          if (!contentExists) {
            console.warn(`Попытка ${attempt}: Контент ${contentId} не найден также через проверку существования`);
            
            // Если это последняя попытка - сообщаем об ошибке
            if (attempt === MAX_PUBLISH_ATTEMPTS) {
              throw new Error(`Контент с ID ${contentId} не найден после ${MAX_PUBLISH_ATTEMPTS} попыток. Возможно, он был удален или не был полностью создан.`);
            }
            
            // Увеличиваем задержку для каждой последующей попытки
            const adjustedDelay = RETRY_DELAY_MS * attempt;
            console.log(`Ожидание ${adjustedDelay}мс перед следующей попыткой...`);
            await new Promise(resolve => setTimeout(resolve, adjustedDelay));
            continue;
          }
        } else {
          console.log(`Контент ${contentId} найден и доступен для публикации:`, contentCheckResponse.data);
        }
      } catch (checkError) {
        console.error(`Ошибка при проверке контента ${contentId}:`, checkError);
        
        // Если это последняя попытка и до сих пор были ошибки
        if (attempt === MAX_PUBLISH_ATTEMPTS) {
          throw new Error(`Не удалось проверить существование контента ${contentId} после ${MAX_PUBLISH_ATTEMPTS} попыток`);
        }
        
        // Ждем и продолжаем
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      
      console.log(`Попытка ${attempt}: Отправка запроса на публикацию контента ${contentId}...`);
      
      try {
        console.log(`Отправляем запрос на публикацию контента ${contentId} на платформы:`, platforms);
        
        // Используем стандартный маршрут API, который уже работает
        const result = await apiRequest(`/api/publish/${contentId}`, {
          method: 'POST',
          data: {
            platforms: platforms.reduce((obj, platform) => ({ ...obj, [platform]: true }), {}),
            immediate,
            userId,
            contentId
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-ID': userId || '',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        // Проверяем ответ на наличие ошибок
        if (result?.error) {
          console.error(`Ошибка API публикации: ${result.error}`);
          throw new Error(result.error);
        }
        
        console.log('Публикация успешно выполнена:', result);
        return result;
      } catch (publishError: any) {
        console.error(`Ошибка при публикации через API:`, publishError);
        
        // Более подробная обработка ошибок
        if (publishError.message?.includes('JSON') || publishError.message?.includes('Unexpected token')) {
          console.error('Получен невалидный ответ от сервера. Возможно, проблема с авторизацией или сервер не готов.');
          
          // Создаем временный элемент для отображения HTML
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = publishError.response?.data || '';
          const errorText = tempDiv.textContent || publishError.message;
          
          throw new Error(`Ошибка при публикации: сервер вернул неверный формат. ${errorText.substring(0, 100)}`);
        }
        
        if (publishError.response?.status === 401) {
          throw new Error('Ошибка авторизации: проверьте, что вы вошли в систему');
        }
        
        if (publishError.response?.status === 404 || publishError.message?.includes('404') || publishError.message?.includes('не найден')) {
          console.error(`Ошибка 404 при публикации контента ${contentId}. Возможно, контент был удален или не завершил процесс создания.`);
          
          // Пробуем получить дополнительную информацию
          try {
            const checkResponse = await apiRequest(`/api/campaign-content/${contentId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (!checkResponse) {
              throw new Error(`Контент с ID ${contentId} не найден на сервере. Возможно, он был удален или не успел быть создан.`);
            }
          } catch (checkError) {
            // Если при проверке тоже возникла ошибка 404, то контент действительно не существует
            throw new Error(`Контент с ID ${contentId} не найден. Пожалуйста, создайте новый контент или попробуйте снова.`);
          }
        }
        
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