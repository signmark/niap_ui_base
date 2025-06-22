import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Форматирует дату с правильным учетом часового пояса
 * @param dateString строка с датой или объект даты
 * @param formatStr формат вывода даты (по умолчанию 'dd MMMM yyyy, HH:mm')
 * @param needsTimezoneOffset нужно ли добавлять 3 часа для московского времени (для времени создания/планирования)
 * @returns отформатированная дата
 */
export function formatDateWithTimezone(
  dateString: string | Date | null | undefined,
  formatStr: string = 'dd MMMM yyyy, HH:mm',
  needsTimezoneOffset: boolean = false
): string {
  if (!dateString) return 'Дата не указана';
  
  try {
    // Конвертируем строку в объект Date если нужно
    let date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    // Проверяем, что дата валидна
    if (isNaN(date.getTime())) {
      console.warn('Невалидная дата:', dateString);
      return 'Некорректная дата';
    }
    
    // Добавляем 3 часа если нужно (для времени создания/планирования)
    if (needsTimezoneOffset) {
      date = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    }
    
    // Форматируем дату с использованием locale ru для русских названий месяцев
    return format(date, formatStr, { locale: ru });
  } catch (error) {
    console.error('Ошибка при форматировании даты:', error);
    return 'Ошибка форматирования даты';
  }
}

/**
 * Форматирует время в формате HH:MM из даты в локальном часовом поясе пользователя
 * @param dateString строка с датой или объект даты
 * @returns отформатированное время
 */
export function formatTimeWithTimezone(
  dateString: string | Date | null | undefined
): string {
  return formatDateWithTimezone(dateString, 'HH:mm');
}