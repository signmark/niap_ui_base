import { useEffect, useRef, useState } from 'react';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link as LinkIcon,
  Image as ImageIcon
} from 'lucide-react';
import { Smile } from 'lucide-react';
import { Check, ChevronRight, Wand2 } from 'lucide-react';
import { UnderlineIcon } from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from '@/components/ui/tooltip';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import EmojiPicker from './EmojiPicker';
import TextEnhancementDialog from './TextEnhancementDialog';

// Добавляем стили прямо в компонент
const editorStyles = `
  .resizable-editor {
    resize: both;
    overflow: hidden;
    min-height: 200px;
    border: 1px solid hsl(var(--input));
    border-radius: 0.375rem;
  }
  
  .resizable-editor .ProseMirror {
    min-height: 150px;
    height: 100%;
    outline: none;
  }
  
  .resizable-editor .editor-content {
    height: calc(100% - 50px);
    overflow: auto;
    padding: 1rem;
  }
`;

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Начните вводить текст...',
  minHeight = 150,
  className,
}: RichTextEditorProps) {
  const [selectedColor, setSelectedColor] = useState<string>('#000000');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [isTextEnhancementOpen, setIsTextEnhancementOpen] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Добавляем стили в DOM при монтировании компонента
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = editorStyles;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
      }),
      Image,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      // Только если значение действительно изменилось
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  // Функция для вставки изображения
  const addImage = () => {
    const url = window.prompt('URL изображения');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  // Добавление/редактирование ссылки
  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    // Отменить при пустом URL
    if (url === null) {
      return;
    }

    // Удалить ссылку при пустой строке
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }

    // Если ничего не выбрано, но есть ссылка под курсором
    if (editor.view.state.selection.empty && previousUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      
      if (url) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      }
      return;
    }

    // Если текст не выбран, спросить текст ссылки
    if (editor.view.state.selection.empty) {
      const text = window.prompt('Текст ссылки');
      if (text) {
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${url}">${text}</a>`)
          .run();
      }
      return;
    }

    // Если текст выбран, просто добавить ссылку
    editor.chain().focus().setLink({ href: url }).run();
  };

  // Функция для обработки нажатия Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
    <div className={cn("resizable-editor", className)} ref={editorContainerRef}
         style={{ minHeight: `${minHeight + 50}px` }}>
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

          {/* Image Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 px-2"
                onClick={addImage}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Вставить изображение</TooltipContent>
          </Tooltip>

          {/* Link Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 px-2"
                onClick={setLink}
                data-state={editor.isActive('link') ? 'on' : 'off'}
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Вставить ссылку</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-full w-px bg-border" />

          {/* Color Picker */}
          <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 flex items-center gap-1"
              >
                <div
                  className="h-4 w-4 rounded-sm border border-input"
                  style={{ backgroundColor: selectedColor }}
                />
                <ChevronRight className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-2">
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
      
      <div className="editor-content">
        <EditorContent 
          editor={editor} 
          className={cn("prose max-w-none", className)}
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