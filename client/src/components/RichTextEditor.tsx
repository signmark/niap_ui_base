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