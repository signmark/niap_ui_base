# План адаптации текстового редактора для Telegram

## Анализ текущего состояния

Изучив файл `client/src/components/RichTextEditor.tsx`, можно отметить, что:

1. Редактор уже использует TipTap с необходимыми расширениями
2. В конфигурации StarterKit уже отключены неподдерживаемые Telegram элементы (заголовки, списки, кодовые блоки и т.д.)
3. Существует функция `processLists` для преобразования HTML-списков в текстовый формат
4. Имеется обширная пост-обработка HTML для Telegram-совместимости
5. Все необходимые компоненты для Telegram-совместимого форматирования уже присутствуют

## Предлагаемые изменения

### 1. Добавление переключателя режима Telegram-совместимого редактирования

В файл `RichTextEditor.tsx` добавить:

```tsx
interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  telegramMode?: boolean // Новый параметр
}
```

И обновить объявление функции:

```tsx
export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Введите текст...',
  className,
  minHeight = '200px',
  telegramMode = false // По умолчанию выключен
}: RichTextEditorProps) {
  // ...
}
```

### 2. Добавление визуальной индикации режима Telegram

Добавить индикатор в панель инструментов:

```tsx
{telegramMode && (
  <div className="ml-auto flex items-center gap-2">
    <span className="text-xs text-muted-foreground rounded-md bg-primary/10 px-2 py-1 flex items-center">
      <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.2647 2.79687C21.9572 2.5359 21.5419 2.42921 21.1519 2.50359L2.68369 6.52421C2.27082 6.60398 1.92887 6.87234 1.75124 7.2539C1.57361 7.63546 1.58558 8.07773 1.78451 8.44851L6.21236 16.6047C6.38275 16.9225 6.68164 17.1438 7.03007 17.2133L7.12816 17.2326L6.9623 20.5761C6.9588 20.6688 6.98068 20.7601 7.02508 20.8393C7.11512 20.997 7.27265 21.1028 7.45298 21.1249C7.47333 21.1278 7.49368 21.1293 7.51351 21.1293C7.67602 21.1293 7.83327 21.0658 7.94537 20.9488L10.4533 18.3488C10.4838 18.3175 10.51 18.2835 10.5323 18.2466L13.911 21.7394C14.0216 21.8536 14.1718 21.917 14.3343 21.917C14.3541 21.917 14.3745 21.9155 14.3948 21.9126C14.5751 21.8904 14.7325 21.7846 14.8226 21.627L22.4667 8.11929C22.6624 7.77326 22.6569 7.34546 22.4529 7.00515C22.3491 6.83101 22.1969 6.69296 22.0182 6.60398L22.2647 2.79687Z" fill="currentColor"/>
      </svg>
      Telegram
    </span>
  </div>
)}
```

### 3. Адаптация панели инструментов в зависимости от режима

Изменить отображение панели инструментов, скрывая неподдерживаемые элементы:

```tsx
{/* Отображаем цвет текста только если не в режиме Telegram */}
{!telegramMode && (
  <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
    {/* ... существующий код выбора цвета ... */}
  </Popover>
)}

{/* Отображаем подсказку о совместимости с Telegram */}
{telegramMode && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button 
        variant="ghost" 
        size="sm"
        className="h-8 px-2"
      >
        <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/>
        </svg>
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p className="max-w-xs">Режим совместимости с Telegram: доступны только жирный, курсив, подчеркнутый текст и ссылки.</p>
    </TooltipContent>
  </Tooltip>
)}
```

### 4. Модификация функции обработки контента

Модифицировать функцию `onUpdate` для учета режима Telegram:

```tsx
onUpdate: ({ editor }) => {
  // Получаем HTML из редактора
  let html = editor.getHTML();
  
  // Применяем Telegram-форматирование только в режиме Telegram или если в тексте есть HTML-теги
  if (telegramMode || /<[a-z][^>]*>/i.test(html)) {
    // Обработка списков и адаптация для Telegram
    html = processLists(html);
    
    // Существующая очистка HTML для Telegram
    html = html
      // ... существующий код очистки ...
      .trim();
  }
  
  onChange(html);
}
```

### 5. Добавление компонента предпросмотра в стиле Telegram

Создать компонент `TelegramPreview.tsx`:

```tsx
import { cn } from '@/lib/utils'

interface TelegramPreviewProps {
  html: string
  className?: string
}

export function TelegramPreview({ html, className }: TelegramPreviewProps) {
  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      <div className="bg-[#212f40] text-white p-2 text-sm font-medium">
        Предпросмотр в Telegram
      </div>
      <div className="bg-[#17212b] p-4 text-white">
        <div 
          className="bg-[#242f3d] p-3 rounded-md shadow text-[#f5f5f5] max-w-[400px]"
          dangerouslySetInnerHTML={{ 
            __html: html
              // Дополнительное форматирование для предпросмотра
              .replace(/\n/g, '<br />')
          }} 
        />
      </div>
    </div>
  )
}
```

И добавить его использование в `RichTextEditor.tsx`:

```tsx
{telegramMode && (
  <div className="mt-4">
    <TelegramPreview html={content} />
  </div>
)}
```

### 6. Создание расширенного компонента редактора с выбором режима

Создать компонент-обертку `SocialMediaEditor.tsx`:

```tsx
import { useState } from 'react'
import RichTextEditor from './RichTextEditor'
import { TelegramPreview } from './TelegramPreview'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Telegram, 
  Instagram, 
  Facebook, 
  Twitter, 
  Clipboard
} from 'lucide-react'

interface SocialMediaEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

export function SocialMediaEditor({ 
  content, 
  onChange,
  placeholder,
  className
}: SocialMediaEditorProps) {
  const [activeTab, setActiveTab] = useState<string>('universal')
  
  return (
    <div className={className}>
      <Tabs 
        defaultValue="universal" 
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid grid-cols-5 mb-4">
          <TabsTrigger value="universal" className="flex items-center gap-2">
            <Clipboard className="h-4 w-4" />
            <span>Универсальный</span>
          </TabsTrigger>
          <TabsTrigger value="telegram" className="flex items-center gap-2">
            <Telegram className="h-4 w-4" />
            <span>Telegram</span>
          </TabsTrigger>
          <TabsTrigger value="instagram" className="flex items-center gap-2">
            <Instagram className="h-4 w-4" />
            <span>Instagram</span>
          </TabsTrigger>
          <TabsTrigger value="facebook" className="flex items-center gap-2">
            <Facebook className="h-4 w-4" />
            <span>Facebook</span>
          </TabsTrigger>
          <TabsTrigger value="twitter" className="flex items-center gap-2">
            <Twitter className="h-4 w-4" />
            <span>Twitter</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="universal">
          <RichTextEditor 
            content={content} 
            onChange={onChange}
            placeholder={placeholder}
            telegramMode={false}
          />
        </TabsContent>
        
        <TabsContent value="telegram">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RichTextEditor 
              content={content} 
              onChange={onChange}
              placeholder={placeholder}
              telegramMode={true}
            />
            <TelegramPreview html={content} />
          </div>
        </TabsContent>
        
        <TabsContent value="instagram">
          <RichTextEditor 
            content={content} 
            onChange={onChange}
            placeholder={placeholder}
            telegramMode={false}
          />
          <p className="text-sm text-muted-foreground mt-2">
            Instagram не поддерживает HTML-форматирование в подписях.
          </p>
        </TabsContent>
        
        <TabsContent value="facebook">
          <RichTextEditor 
            content={content} 
            onChange={onChange}
            placeholder={placeholder}
            telegramMode={false}
          />
        </TabsContent>
        
        <TabsContent value="twitter">
          <RichTextEditor 
            content={content} 
            onChange={onChange}
            placeholder={placeholder}
            telegramMode={false}
          />
          <p className="text-sm text-muted-foreground mt-2">
            Текст ограничен 280 символами.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

## План внедрения

### Шаг 1: Адаптация основного компонента редактора
1. Обновить интерфейс `RichTextEditorProps` для поддержки режима Telegram
2. Модифицировать `onUpdate` для правильной обработки HTML в зависимости от режима
3. Добавить визуальные индикаторы режима Telegram в панель инструментов
4. Скрыть неподдерживаемые элементы форматирования в режиме Telegram

### Шаг 2: Создание компонента предпросмотра
1. Создать `TelegramPreview.tsx` для отображения текста в стиле Telegram
2. Добавить стилизацию, соответствующую интерфейсу Telegram

### Шаг 3: Создание компонента-оболочки для выбора платформы
1. Создать `SocialMediaEditor.tsx` с поддержкой вкладок для разных платформ
2. Интегрировать `RichTextEditor` и `TelegramPreview` в этот компонент
3. Добавить логику для разных режимов форматирования в зависимости от платформы

### Шаг 4: Тестирование и отладка
1. Проверить корректность работы в режиме Telegram
2. Убедиться, что форматирование соответствует ожиданиям
3. Проверить корректность отображения контента в предпросмотре

### Шаг 5: Интеграция с формой создания контента
1. Обновить существующую форму создания контента для использования нового компонента
2. Добавить логику для сохранения выбранных платформ вместе с контентом

## Преимущества предложенного решения

1. **Гибкость**: Режим Telegram можно включать/выключать в зависимости от потребностей
2. **Предпросмотр**: Пользователь сразу видит, как контент будет отображаться в Telegram
3. **Расширяемость**: Решение легко расширить для поддержки других платформ
4. **Минимальные изменения**: Используется существующий код с минимальными модификациями
5. **Улучшенный UX**: Пользователь видит только те инструменты форматирования, которые действительно работают на выбранной платформе