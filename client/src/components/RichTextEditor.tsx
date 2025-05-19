import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useState, useRef, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { TextEnhancementDialog } from './TextEnhancementDialog'
import { EmojiPicker } from './EmojiPicker'
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
  Wand2,
  Quote, // Иконка для цитаты
  Code, // Иконка для кода
  FileCode, // Иконка для блока кода
  CornerRightDown // Иконка для индикатора ресайза
} from 'lucide-react'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  editorId?: string // Уникальный идентификатор для сохранения размеров в localStorage
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Введите текст...',
  className,
  minHeight = '200px',
  editorId = 'default-editor' // Идентификатор по умолчанию
}: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState('')
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [isImagePopoverOpen, setIsImagePopoverOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [isTextEnhancementOpen, setIsTextEnhancementOpen] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [editorSize, setEditorSize] = useState({ height: parseInt(minHeight) || 200 })
  const resizeStartPosition = useRef({ y: 0 })
  const editorContainerRef = useRef<HTMLDivElement>(null)
  
  // Загрузка сохраненных размеров из localStorage при первом рендере
  useEffect(() => {
    const savedSize = localStorage.getItem(`editor-size-${editorId}`);
    if (savedSize) {
      try {
        const parsedSize = JSON.parse(savedSize);
        setEditorSize(parsedSize);
      } catch (e) {
        console.error('Ошибка при загрузке сохраненных размеров редактора:', e);
      }
    }
  }, [editorId]);
  
  // Обработчик начала ресайза
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartPosition.current = { y: e.clientY };
    
    // Добавляем обработчики событий для отслеживания движения мыши и отпускания кнопки
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };
  
  // Обработчик движения мыши при ресайзе
  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const deltaY = e.clientY - resizeStartPosition.current.y;
    const newHeight = Math.max(parseInt(minHeight) || 200, editorSize.height + deltaY);
    
    setEditorSize(prev => ({ ...prev, height: newHeight }));
    resizeStartPosition.current = { y: e.clientY };
  };
  
  // Обработчик завершения ресайза
  const handleResizeEnd = () => {
    setIsResizing(false);
    
    // Сохраняем размеры в localStorage
    localStorage.setItem(`editor-size-${editorId}`, JSON.stringify(editorSize));
    
    // Удаляем обработчики событий
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        linkOnPaste: true,
      }),
      Image,
      TextStyle,
      Color,
      Underline,
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
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

  // Функция для добавления нового параграфа после блочных элементов
  const ensureNewParagraphAfterBlock = () => {
    if (editor.isActive('blockquote') || editor.isActive('codeBlock')) {
      // Сначала деактивируем текущий блок
      if (editor.isActive('blockquote')) {
        editor.chain().focus().toggleBlockquote().run();
      } else if (editor.isActive('codeBlock')) {
        editor.chain().focus().toggleCodeBlock().run();
      }
      
      // Добавляем новый параграф
      editor.commands.createParagraphNear();
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

          <ToggleGroup type="single" variant="outline" className="flex flex-wrap gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="left" 
                  size="sm"
                  aria-label="По левому краю" 
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  data-state={editor.isActive({ textAlign: 'left' }) ? 'on' : 'off'}
                >
                  <AlignLeft className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>По левому краю</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="center" 
                  size="sm"
                  aria-label="По центру" 
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  data-state={editor.isActive({ textAlign: 'center' }) ? 'on' : 'off'}
                >
                  <AlignCenter className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>По центру</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="right" 
                  size="sm"
                  aria-label="По правому краю" 
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  data-state={editor.isActive({ textAlign: 'right' }) ? 'on' : 'off'}
                >
                  <AlignRight className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>По правому краю</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="justify" 
                  size="sm"
                  aria-label="По ширине" 
                  onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                  data-state={editor.isActive({ textAlign: 'justify' }) ? 'on' : 'off'}
                >
                  <AlignJustify className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>По ширине</TooltipContent>
            </Tooltip>
          </ToggleGroup>

          <div className="mx-1 h-full w-px bg-border" />

          <ToggleGroup type="multiple" variant="outline" className="flex flex-wrap gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="h1" 
                  size="sm"
                  aria-label="Заголовок 1" 
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  data-state={editor.isActive('heading', { level: 1 }) ? 'on' : 'off'}
                >
                  <Heading1 className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Заголовок 1</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="h2" 
                  size="sm"
                  aria-label="Заголовок 2" 
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  data-state={editor.isActive('heading', { level: 2 }) ? 'on' : 'off'}
                >
                  <Heading2 className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Заголовок 2</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="h3" 
                  size="sm"
                  aria-label="Заголовок 3" 
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  data-state={editor.isActive('heading', { level: 3 }) ? 'on' : 'off'}
                >
                  <Heading3 className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Заголовок 3</TooltipContent>
            </Tooltip>
          </ToggleGroup>
        
          <div className="mx-1 h-full w-px bg-border" />

          <ToggleGroup type="multiple" variant="outline" className="flex flex-wrap gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="bulletList" 
                  size="sm"
                  aria-label="Маркированный список" 
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  data-state={editor.isActive('bulletList') ? 'on' : 'off'}
                >
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Маркированный список</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="orderedList" 
                  size="sm"
                  aria-label="Нумерованный список" 
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  data-state={editor.isActive('orderedList') ? 'on' : 'off'}
                >
                  <ListOrdered className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Нумерованный список</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="blockquote" 
                  size="sm"
                  aria-label="Цитата" 
                  onClick={() => {
                    // Если активны другие блоки, сначала отключим их
                    if (editor.isActive('codeBlock')) {
                      editor.chain().focus().toggleCodeBlock().run();
                    }
                    // Затем включим цитату
                    editor.chain().focus().toggleBlockquote().run();
                    
                    // Добавляем новый параграф после блока при необходимости
                    if (!editor.isActive('blockquote')) {
                      ensureNewParagraphAfterBlock();
                    }
                  }}
                  data-state={editor.isActive('blockquote') ? 'on' : 'off'}
                >
                  <Quote className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Цитата</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="code" 
                  size="sm"
                  aria-label="Форматированный код" 
                  onClick={() => {
                    // Включаем/выключаем инлайн код
                    editor.chain().focus().toggleCode().run();
                    // Добавляем новый параграф после блока при необходимости
                    if (!editor.isActive('code')) {
                      ensureNewParagraphAfterBlock();
                    }
                  }}
                  data-state={editor.isActive('code') ? 'on' : 'off'}
                >
                  <Code className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Форматированный код</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem 
                  value="codeBlock" 
                  size="sm"
                  aria-label="Блок кода" 
                  onClick={() => {
                    // Если активна цитата, сначала отключим её
                    if (editor.isActive('blockquote')) {
                      editor.chain().focus().toggleBlockquote().run();
                    }
                    // Затем включим блок кода
                    editor.chain().focus().toggleCodeBlock().run();
                    
                    // Добавляем новый параграф после блока при необходимости
                    if (!editor.isActive('codeBlock')) {
                      ensureNewParagraphAfterBlock();
                    }
                  }}
                  data-state={editor.isActive('codeBlock') ? 'on' : 'off'}
                >
                  <FileCode className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Блок кода</TooltipContent>
            </Tooltip>
          </ToggleGroup>

          <div className="mx-1 h-full w-px bg-border" />

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

          {/* Emoji Picker */}
          <div className="mx-1 h-full w-px bg-border" />
          
          <EmojiPicker 
            onEmojiSelect={(emoji) => {
              editor.chain().focus().insertContent(emoji).run();
            }} 
          />
          
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
      
      <div 
        ref={editorContainerRef} 
        className={cn("relative border border-input rounded-md overflow-hidden", className)}
        style={{ cursor: isResizing ? 'ns-resize' : 'auto' }}
      >
        <EditorContent 
          editor={editor} 
          className={cn("prose max-w-none p-4", className)}
          style={{ 
            minHeight, 
            height: `${editorSize.height}px`,
            transition: isResizing ? 'none' : 'height 0.1s ease-out',
            resize: 'vertical',
            overflow: 'auto'
          }}
        />
        
        {/* Индикатор возможности ресайза в стиле текстового поля */}
        <div 
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-300/70 hover:bg-gray-400/90 z-10"
          onMouseDown={handleResizeStart}
          title="Потяните, чтобы изменить размер"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, transparent 50%, #94a3b8 50%)',
            pointerEvents: 'all'
          }}
        />
      </div>

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