import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Форматирует дату, учитывая часовой пояс пользователя
 * @param dateString строка с датой или объект даты
 * @param formatStr формат вывода даты (по умолчанию 'dd MMMM yyyy, HH:mm')
 * @param addHours добавить часы к дате (для коррекции часового пояса, по умолчанию +3 часа для МСК)
 * @returns отформатированная дата
 */
export function formatDateWithTimezone(
  dateString: string | Date | null | undefined,
  formatStr: string = 'dd MMMM yyyy, HH:mm',
  addHours: number = 3
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
    
    // Создаем новый объект Date с учетом смещения часового пояса
    const adjustedDate = new Date(date);
    adjustedDate.setHours(adjustedDate.getHours() + addHours);
    
    // Форматируем дату с использованием locale ru для русских названий месяцев
    return format(adjustedDate, formatStr, { locale: ru });
  } catch (error) {
    console.error('Ошибка при форматировании даты:', error);
    return 'Ошибка форматирования даты';
  }
}

/**
 * Форматирует время в формате HH:MM из даты
 * @param dateString строка с датой или объект даты
 * @param addHours добавить часы к дате (для коррекции часового пояса)
 * @returns отформатированное время
 */
export function formatTimeWithTimezone(
  dateString: string | Date | null | undefined,
  addHours: number = 3
): string {
  return formatDateWithTimezone(dateString, 'HH:mm', addHours);
}