import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import EmojiPickerComponent from 'emoji-picker-react';
import { Theme } from 'emoji-picker-react';
import { useThemeStore } from '@/lib/themeStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

// Возвращаемся к простой версии с Popover - но исправляем ключевые проблемы
export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { colorMode } = useThemeStore();
  
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
      
      <PopoverContent 
        className="w-auto p-0 emoji-popover" 
        side="bottom" 
        align="start"
        onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие при клике на контейнер
      >
        <div 
          className="emoji-picker-container"
          onClick={(e) => e.stopPropagation()} // Дублируем для надежности
        >
          <EmojiPickerComponent
            onEmojiClick={(emojiObject) => {
              // Вставляем эмодзи
              onEmojiSelect(emojiObject.emoji);
              // Не закрываем пикер
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
            className="emoji-picker-react-component"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}