import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Форматирует дату, правильно учитывая часовой пояс пользователя
 * @param dateString строка с датой или объект даты
 * @param formatStr формат вывода даты (по умолчанию 'dd MMMM yyyy, HH:mm')
 * @returns отформатированная дата в локальном часовом поясе пользователя
 */
export function formatDateWithTimezone(
  dateString: string | Date | null | undefined,
  formatStr: string = 'dd MMMM yyyy, HH:mm'
): string {
  if (!dateString) return 'Дата не указана';
  
  try {
    // Конвертируем строку в объект Date если нужно
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    // Проверяем, что дата валидна
    if (isNaN(date.getTime())) {
      console.warn('Невалидная дата:', dateString);
      return 'Некорректная дата';
    }
    
    // JavaScript автоматически преобразует UTC время в локальный часовой пояс пользователя
    // Не нужно добавлять часы вручную - браузер сам определит правильное время
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