import React, { useState, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import EmojiPickerComponent from 'emoji-picker-react';
import { Theme } from 'emoji-picker-react';
import { useThemeStore } from '@/lib/themeStore';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { colorMode } = useThemeStore();
  
  // Обработчик события колеса мыши
  const handleWheel = (e: WheelEvent) => {
    if (containerRef.current) {
      // Найти элемент с классом epr-body (содержащий эмодзи)
      const emojiBody = containerRef.current.querySelector('.epr-body');
      
      if (emojiBody) {
        e.preventDefault(); // Останавливаем стандартное поведение
        e.stopPropagation(); // Останавливаем распространение
        
        // Прокручиваем контейнер эмодзи вместо страницы
        (emojiBody as HTMLElement).scrollTop += e.deltaY;
      }
    }
  };
  
  // Обработчик нажатий клавиш (для предотвращения скролла с клавиатуры)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'Space', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
      if (containerRef.current?.contains(e.target as Node)) {
        e.stopPropagation();
        // Не вызываем preventDefault(), чтобы сохранить стандартное поведение внутри контейнера эмодзи
      }
    }
  };

  // Добавляем обработчики колеса мыши и клавиатуры при открытии попапа
  useEffect(() => {
    if (isOpen && containerRef.current) {
      // Добавляем обработчик колеса мыши
      containerRef.current.addEventListener('wheel', handleWheel, { passive: false });
      
      // Добавляем обработчик нажатий клавиш
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        containerRef.current?.removeEventListener('wheel', handleWheel);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 px-2"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Эмодзи</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <PopoverContent className="w-auto p-0" side="bottom" align="start">
        <div ref={containerRef} className="emoji-picker-container">
          <EmojiPickerComponent
            onEmojiClick={(emojiObject) => {
              onEmojiSelect(emojiObject.emoji);
              setIsOpen(false);
            }}
            searchPlaceholder="Поиск эмодзи..."
            width={320}
            height={400}
            previewConfig={{
              showPreview: true,
              defaultCaption: 'Выберите эмодзи',
            }}
            theme={colorMode === 'dark' ? Theme.DARK : Theme.LIGHT}
            skinTonesDisabled={false}
            lazyLoadEmojis={true}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}