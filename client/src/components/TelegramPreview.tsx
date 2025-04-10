import { cn } from '@/lib/utils'
import { cleanHtmlForTelegram } from '@/utils/telegram-html-cleaner'

interface TelegramPreviewProps {
  html: string
  className?: string
}

/**
 * Компонент для предпросмотра текста в стиле Telegram
 * Отображает форматированный HTML-текст в интерфейсе, напоминающем Telegram
 * Использует тот же алгоритм очистки, что и на сервере
 */
export function TelegramPreview({ html, className }: TelegramPreviewProps) {
  // Используем общую функцию очистки, чтобы обеспечить 100% соответствие серверной обработке
  const processTelegramHtml = (content: string): string => {
    if (!content) return '';
    
    // Используем ту же функцию, что и при отправке на сервер
    return cleanHtmlForTelegram(content);
  };

  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      <div className="bg-[#212f40] text-white p-2 text-sm font-medium">
        Предпросмотр в Telegram
      </div>
      <div className="bg-[#17212b] p-4 text-white min-h-[200px]">
        <div 
          className="bg-[#242f3d] p-3 rounded-md shadow text-[#f5f5f5] max-w-[400px] whitespace-pre-wrap"
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