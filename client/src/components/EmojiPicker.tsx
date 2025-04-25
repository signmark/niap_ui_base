import React, { useState } from 'react';
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
      
      <PopoverContent className="w-auto p-0" side="bottom" align="start">
        <div className="emoji-picker-container">
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