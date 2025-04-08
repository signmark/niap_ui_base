import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { TextEnhancementDialog } from './TextEnhancementDialog'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Palette,
  Wand2
} from 'lucide-react'

/**
 * Преобразует HTML-контент в совместимый с Telegram формат
 * Telegram поддерживает только ограниченный набор тегов: <b>, <i>, <u>, <s>, <a>, <code>, <pre>
 * Эта функция обеспечивает правильную обработку списков, заголовков и других HTML-элементов
 * 
 * @param {string} html HTML-текст для обработки
 * @returns {string} Обработанный HTML-текст, совместимый с Telegram
 */
function processLists(html: string): string {
  if (!html) return '';
  
  // Предварительная обработка - удаление нестандартных тегов
  let processedHtml = html;
  
  // Сначала заменяем заголовки на жирный текст 
  processedHtml = processedHtml
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/g, '<b>$1</b>\n\n')
    // Удаляем div, section и другие блочные элементы
    .replace(/<(div|section|article|header|footer|nav|aside)[^>]*>/g, '')
    .replace(/<\/(div|section|article|header|footer|nav|aside)>/g, '\n');
  
  // Перед началом обработки структурированных списков - сначала обрабатываем весь сложный HTML внутри элементов списка
  processedHtml = processedHtml.replace(/<li>(.*?)<\/li>/gs, (match, content) => {
    // Вложенные теги внутри <li> обрабатываем отдельно
    let processedContent = content
      // Обработка параграфов внутри <li>
      .replace(/<p>(.*?)<\/p>/g, '$1')
      // Преобразование <em> в <i>
      .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
      // Преобразование <strong> в <b>
      .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
      // Удаление других ненужных тегов
      .replace(/<\/?span[^>]*>/g, '')
      // Удаляем лишние пробелы
      .trim();
      
    return `<li>${processedContent}</li>`;
  });
  
  // Полная обработка вложенных списков - мы обрабатываем их рекурсивно
  // Сначала вложенные (дочерние) списки, затем родительские
  
  // Обрабатываем вложенные списки с помощью дополнительных отступов
  // Обрабатываем неупорядоченные списки внутри элементов списка
  processedHtml = processedHtml.replace(/<li>.*?<ul>(.*?)<\/ul>.*?<\/li>/gs, (match, nestedListContent) => {
    const nestedItems = nestedListContent.match(/<li>(.*?)<\/li>/gs);
    if (!nestedItems) return match;
    
    let formattedNestedList = '';
    nestedItems.forEach(item => {
      const content = item.replace(/<li>(.*?)<\/li>/, '$1').trim();
      formattedNestedList += `\n          • ${content}`;
    });
    
    // Заменяем вложенный список на обработанный текст с маркерами
    return match.replace(/<ul>.*?<\/ul>/s, formattedNestedList);
  });
  
  // Обрабатываем вложенные нумерованные списки
  processedHtml = processedHtml.replace(/<li>.*?<ol>(.*?)<\/ol>.*?<\/li>/gs, (match, nestedListContent) => {
    const nestedItems = nestedListContent.match(/<li>(.*?)<\/li>/gs);
    if (!nestedItems) return match;
    
    let formattedNestedList = '';
    nestedItems.forEach((item, index) => {
      const content = item.replace(/<li>(.*?)<\/li>/, '$1').trim();
      formattedNestedList += `\n          ${index + 1}. ${content}`;
    });
    
    // Заменяем вложенный список на обработанный текст с нумерацией
    return match.replace(/<ol>.*?<\/ol>/s, formattedNestedList);
  });
  
  // Теперь обрабатываем корневые списки
  
  // Обработка неупорядоченных списков (буллеты)
  processedHtml = processedHtml.replace(/<ul>(.*?)<\/ul>/gs, (match, listContent) => {
    // Заменяем каждый <li> на строку с маркером •
    const formattedList = listContent
      .replace(/<li>(.*?)<\/li>/gs, (liMatch, liContent) => {
        // Проверяем, есть ли внутри уже обработанные вложенные списки
        if (liContent.includes('•') || liContent.includes('1.')) {
          return `\n      • ${liContent.replace(/^\s+/, '')}`;
        }
        return `\n      • ${liContent}`;
      })
      .trim() + '\n\n';
    
    return formattedList;
  });
  
  // Обработка упорядоченных списков (с цифрами)
  processedHtml = processedHtml.replace(/<ol>(.*?)<\/ol>/gs, (match, listContent) => {
    const items = listContent.match(/<li>(.*?)<\/li>/gs);
    if (!items) return match;
    
    let numberedList = '';
    items.forEach((item, index) => {
      // Извлекаем содержимое между <li> и </li>
      const liContent = item.replace(/<li>(.*?)<\/li>/s, '$1');
      // Проверяем, есть ли внутри уже обработанные вложенные списки
      if (liContent.includes('•') || liContent.includes('1.')) {
        numberedList += `\n      ${index + 1}. ${liContent.replace(/^\s+/, '')}`;
      } else {
        numberedList += `\n      ${index + 1}. ${liContent}`;
      }
    });
    
    return numberedList.trim() + '\n\n';
  });
  
  // Удаляем все оставшиеся теги от списков, которые могли не обработаться
  processedHtml = processedHtml
    .replace(/<\/?[uo]l>|<\/?li>/g, '')
    
    // Преобразуем стандартные форматы текста в Telegram-совместимые
    .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
    .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
    .replace(/<del>(.*?)<\/del>/g, '<s>$1</s>')
    .replace(/<strike>(.*?)<\/strike>/g, '<s>$1</s>')
    
    // Обработка параграфов
    .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
    
    // Удаляем все оставшиеся неподдерживаемые теги, но сохраняем их содержимое
    .replace(/<(?!b|\/b|i|\/i|u|\/u|s|\/s|code|\/code|pre|\/pre|a|\/a)[^>]+>/g, '')
    
    // Заменяем множественные переносы строк на не более двух
    .replace(/\n{3,}/g, '\n\n')
    
    // Очищаем пробелы в начале и конце
    .trim();
  
  return processedHtml;
}

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Введите текст...',
  className,
  minHeight = '200px'
}: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState('')
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [isImagePopoverOpen, setIsImagePopoverOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [isTextEnhancementOpen, setIsTextEnhancementOpen] = useState(false)

  // Используем только базовые расширения, совместимые с форматированием Telegram
  // Примечание: не создаем кастомный Document, так как TipTap автоматически добавляет обертку

  const editor = useEditor({
    extensions: [
      // Используем только базовые расширения, совместимые с Telegram
      // Не включаем StarterKit полностью, а только части, которые поддерживаются в Telegram
      StarterKit.configure({
        // Отключаем все элементы, которые не поддерживаются Telegram, оставляем только текстовое форматирование
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
        dropcursor: false,
        gapcursor: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        linkOnPaste: true,
      }),
      Image,
      TextStyle,
      Color,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      // Получаем HTML из редактора
      let html = editor.getHTML();
      
      // Обработка списков (не поддерживаются в Telegram)
      // Сначала обрабатываем вложенные списки и элементы, до обработки родительских элементов
      html = processLists(html);
      
      // Первичная очистка - удаляем div и другие ненужные обертки
      html = html
        // Удаляем div-обертки, которые могут появиться
        .replace(/<div>(.*?)<\/div>/g, '$1')
        // Добавляем переносы строк для лучшей читаемости в Telegram
        .replace(/<br\s*\/?>/g, '\n')
        
        // Обработка параграфов - каждый параграф превращаем в простой текст с переносом строки
        .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
        .replace(/<p>/g, '')
        .replace(/<\/p>/g, '\n\n')
        
        // Заменяем множественные переносы строк на не более двух
        .replace(/\n{3,}/g, '\n\n')
        
        // Обработка нестандартных тегов, которые не поддерживаются в Telegram
        .replace(/<(span|div|section|article|header|footer|nav|aside).*?>(.*?)<\/(span|div|section|article|header|footer|nav|aside)>/g, '$2')
        
        // Обеспечиваем, что все теги закрыты в правильном порядке
        // Это важно для корректного отображения в Telegram
        .replace(/<\/(b|strong|i|em|u|s|strike|code|pre)><\/(b|strong|i|em|u|s|strike|code|pre)>/g, function(match, p1, p2) {
          // Правильный порядок закрытия тегов для вложенного форматирования
          return `</${p2}></${p1}>`;
        })
        
        // Удаляем лишние атрибуты из тегов (Telegram поддерживает только чистые теги)
        .replace(/<(b|i|u|s|code)(.*?)>/g, '<$1>')
        .replace(/<strong(.*?)>/g, '<b>')
        .replace(/<\/strong>/g, '</b>')
        .replace(/<em(.*?)>/g, '<i>')
        .replace(/<\/em>/g, '</i>')
        .replace(/<del(.*?)>/g, '<s>')
        .replace(/<\/del>/g, '</s>')
        .replace(/<strike(.*?)>/g, '<s>')
        .replace(/<\/strike>/g, '</s>')
        
        // Очищаем лишние пробелы, но сохраняем переносы строк
        .replace(/[ \t]+/g, ' ')
        .trim();
      
      onChange(html);
    },
  })

  if (!editor) {
    return null
  }

  const addLink = () => {
    if (linkUrl) {
      editor.chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: linkUrl })
        .run()
      setLinkUrl('')
      setIsLinkPopoverOpen(false)
    }
  }

  const addImage = () => {
    if (imageUrl) {
      editor.chain()
        .focus()
        .setImage({ src: imageUrl })
        .run()
      setImageUrl('')
      setIsImagePopoverOpen(false)
    }
  }

  const colors = [
    '#000000', '#D81B60', '#1E88E5', '#43A047', 
    '#6D4C41', '#546E7A', '#F4511E', '#FB8C00', 
    '#FFB300', '#C0CA33', '#7CB342', '#8E24AA'
  ]

  return (
    <div className={cn('border border-input rounded-md', className)}>
      <div className="border-b p-2 bg-muted/20 flex flex-wrap gap-1 justify-start items-center">
        <TooltipProvider>
          <ToggleGroup type="multiple" variant="outline" className="flex flex-wrap gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="bold" 
                  size="sm"
                  aria-label="Полужирный" 
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  data-state={editor.isActive('bold') ? 'on' : 'off'}
                >
                  <Bold className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Полужирный</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="italic" 
                  size="sm"
                  aria-label="Курсив" 
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  data-state={editor.isActive('italic') ? 'on' : 'off'}
                >
                  <Italic className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Курсив</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="underline" 
                  size="sm"
                  aria-label="Подчеркнутый" 
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  data-state={editor.isActive('underline') ? 'on' : 'off'}
                >
                  <UnderlineIcon className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Подчеркнутый</TooltipContent>
            </Tooltip>
          </ToggleGroup>
        
          <div className="mx-1 h-full w-px bg-border" />

          {/* Удалены элементы управления выравниванием текста, заголовками и списками,
              так как они не поддерживаются в Telegram */}

          {/* Link Button */}
          <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 px-2"
                    data-state={editor.isActive('link') ? 'on' : 'off'}
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Ссылка</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-80">
              <div className="flex flex-col gap-2">
                <Label htmlFor="link-url">URL ссылки</Label>
                <div className="flex gap-2">
                  <Input 
                    id="link-url"
                    value={linkUrl} 
                    onChange={(e) => setLinkUrl(e.target.value)} 
                    placeholder="https://example.com" 
                  />
                  <Button onClick={addLink} type="submit">Добавить</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Image Button */}
          <Popover open={isImagePopoverOpen} onOpenChange={setIsImagePopoverOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 px-2"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Изображение</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-80">
              <div className="flex flex-col gap-2">
                <Label htmlFor="image-url">URL изображения</Label>
                <div className="flex gap-2">
                  <Input 
                    id="image-url"
                    value={imageUrl} 
                    onChange={(e) => setImageUrl(e.target.value)} 
                    placeholder="https://example.com/image.jpg" 
                  />
                  <Button onClick={addImage} type="submit">Добавить</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Color Button */}
          <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 px-2"
                  >
                    <Palette className="h-4 w-4" style={{ color: selectedColor }} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Цвет текста</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64">
              <div className="flex flex-col gap-2">
                <Label>Выберите цвет</Label>
                <div className="grid grid-cols-6 gap-2">
                  {colors.map((color) => (
                    <Button
                      key={color}
                      type="button"
                      variant="outline"
                      className="h-8 w-8 p-0 rounded-md"
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        editor.chain().focus().setColor(color).run()
                        setSelectedColor(color)
                        setColorPickerOpen(false)
                      }}
                    />
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Magic Wand Button for AI Text Enhancement */}
          <div className="mx-1 h-full w-px bg-border" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 px-2"
                onClick={() => setIsTextEnhancementOpen(true)}
              >
                <Wand2 className="h-4 w-4 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Улучшить текст с помощью AI</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <EditorContent 
        editor={editor} 
        className={cn("prose max-w-none p-4", className)}
        style={{ minHeight }}
      />

      {/* Text Enhancement Dialog */}
      <TextEnhancementDialog
        open={isTextEnhancementOpen}
        onOpenChange={setIsTextEnhancementOpen}
        initialText={editor.getHTML()}
        onSave={(enhancedText) => {
          editor.commands.setContent(enhancedText);
          onChange(enhancedText);
        }}
      />
    </div>
  )
}