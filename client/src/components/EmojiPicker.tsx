import React, { useState, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import EmojiPickerComponent from 'emoji-picker-react';
import { Theme } from 'emoji-picker-react';
import { useThemeStore } from '@/lib/themeStore';
import { createPortal } from 'react-dom';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { colorMode } = useThemeStore();
  
  // Отдельный компонент для вставки через портал
  const EmojiPickerModal = () => {
    const emojiContainerRef = useRef<HTMLDivElement>(null);
    
    // Функция для обработки клика вне контейнера
    const handleOutsideClick = (e: MouseEvent) => {
      if (emojiContainerRef.current && !emojiContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    // Добавляем слушатели событий при монтировании
    useEffect(() => {
      document.addEventListener('mousedown', handleOutsideClick);
      
      // Удаляем слушатели при демонтировании
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
      };
    }, []);
    
    return (
      <div className="emoji-picker-overlay">
        <div 
          ref={emojiContainerRef} 
          className="emoji-picker-modal"
        >
          <EmojiPickerComponent
            onEmojiClick={(emojiObject) => {
              onEmojiSelect(emojiObject.emoji);
              setIsOpen(false);
            }}
            searchPlaceholder="Поиск эмодзи..."
            width={320}
            height={350}
            previewConfig={{
              showPreview: true,
              defaultCaption: 'Выберите эмодзи',
            }}
            theme={colorMode === 'dark' ? Theme.DARK : Theme.LIGHT}
            skinTonesDisabled={false}
            lazyLoadEmojis={true}
          />
        </div>
      </div>
    );
  };
  
  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              className="h-8 px-2"
              onClick={() => setIsOpen(!isOpen)}
            >
              <Smile className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Эмодзи</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {isOpen && createPortal(<EmojiPickerModal />, document.body)}
    </>
  );
}