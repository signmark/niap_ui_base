import React, { useState, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import EmojiPickerComponent from 'emoji-picker-react';
import { Theme } from 'emoji-picker-react';
import { useThemeStore } from '@/lib/themeStore';
import PerfectScrollbar from 'react-perfect-scrollbar';
import 'react-perfect-scrollbar/dist/css/styles.css';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { colorMode } = useThemeStore();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Блокируем скролл на основной странице при открытии пикера
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('emoji-picker-open');
    } else {
      document.body.classList.remove('emoji-picker-open');
    }
    
    return () => {
      document.body.classList.remove('emoji-picker-open');
    };
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
      
      <PopoverContent className="w-auto p-0 emoji-popover" side="bottom" align="start">
        <div ref={containerRef} className="emoji-picker-container">
          <div className="emoji-wrapper">
            <PerfectScrollbar
              options={{ 
                wheelPropagation: false,
                suppressScrollX: true
              }}
              className="ps-emoji-container"
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
            </PerfectScrollbar>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}