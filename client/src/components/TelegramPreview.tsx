import { cn } from '@/lib/utils'

interface TelegramPreviewProps {
  html: string
  className?: string
}

/**
 * Компонент для предпросмотра текста в стиле Telegram
 * Отображает форматированный HTML-текст в интерфейсе, напоминающем Telegram
 */
export function TelegramPreview({ html, className }: TelegramPreviewProps) {
  // Функция для преобразования HTML в Telegram-совместимый формат
  const processTelegramHtml = (content: string): string => {
    if (!content) return '';
    
    // Замена стандартных HTML-тегов на Telegram-совместимые
    let processedHtml = content
      // Преобразования стилистических тегов
      .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
      .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
      .replace(/<del>(.*?)<\/del>/g, '<s>$1</s>')
      .replace(/<strike>(.*?)<\/strike>/g, '<s>$1</s>')
      
      // Обработка параграфов
      .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
      
      // Удаление всех оставшиеся неподдерживаемые теги, но сохранение их содержимого
      .replace(/<(?!b|\/b|i|\/i|u|\/u|s|\/s|code|\/code|pre|\/pre|a|\/a)[^>]+>/g, '')
      
      // Заменяем множественные переносы строк на не более двух
      .replace(/\n{3,}/g, '\n\n')
      
      // Очищаем пробелы в начале и конце
      .trim();
    
    return processedHtml;
  };

  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      <div className="bg-[#212f40] text-white p-2 text-sm font-medium">
        Предпросмотр в Telegram
      </div>
      <div className="bg-[#17212b] p-4 text-white min-h-[200px]">
        <div 
          className="bg-[#242f3d] p-3 rounded-md shadow text-[#f5f5f5] max-w-[400px]"
          dangerouslySetInnerHTML={{ 
            __html: processTelegramHtml(html)
              // Дополнительное форматирование для предпросмотра
              .replace(/\n/g, '<br />') 
          }} 
        />
      </div>
    </div>
  )
}