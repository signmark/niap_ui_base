import React, { useState, useRef, useEffect } from 'react';
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Отдельный компонент для вставки через портал
  const EmojiPickerModal = () => {
    const emojiContainerRef = useRef<HTMLDivElement>(null);
    
    // Функция для обработки клика вне контейнера
    const handleOutsideClick = (e: MouseEvent) => {
      // Проверяем, был ли клик только за пределами пикера
      // Если клик был внутри пикера, ничего не делаем
      if (emojiContainerRef.current && !emojiContainerRef.current.contains(e.target as Node) && 
          buttonRef.current !== e.target && !buttonRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    // Обработчик события колеса мыши - КЛЮЧЕВОЙ КОМПОНЕНТ
    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      
      if (emojiContainerRef.current) {
        const emojiBody = emojiContainerRef.current.querySelector('.epr-body');
        
        if (emojiBody) {
          const scrollContainer = emojiBody as HTMLElement;
          
          // Прокручиваем содержимое эмодзи вместо страницы
          scrollContainer.scrollTop += e.deltaY;
          
          // Предотвращаем скроллинг страницы
          e.preventDefault();
        }
      }
    };
    
    // Функция для обработки нажатия клавиш
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    
    // Добавляем слушатели событий при монтировании
    useEffect(() => {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
      document.addEventListener('keydown', handleKeyDown);
      
      // Блокируем скролл на основной странице
      document.body.style.overflow = 'hidden';
      
      console.log('EmojiPicker mounted: adding event listeners');
      
      // Удаляем слушатели при демонтировании
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('wheel', handleWheel, { capture: true });
        document.removeEventListener('keydown', handleKeyDown);
        
        // Восстанавливаем скролл на основной странице
        document.body.style.overflow = '';
        
        console.log('EmojiPicker unmounted: removing event listeners');
      };
    }, []);
    
    // Позиционируем пикер на основе положения кнопки
    useEffect(() => {
      if (emojiContainerRef.current && buttonRef.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const modalElement = emojiContainerRef.current;
        
        // Используем абсолютное позиционирование для центрирования пикера
        modalElement.style.position = 'fixed';
        modalElement.style.left = '50%';
        modalElement.style.top = '50%';
        modalElement.style.transform = 'translate(-50%, -50%)';
      }
    }, []);
    
    return (
      <div className="emoji-picker-overlay">
        <div 
          ref={emojiContainerRef} 
          className="emoji-picker-modal"
          onWheel={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <div className="emoji-header">
            <span>Выберите эмодзи</span>
            <button 
              className="emoji-close-button"
              onClick={() => setIsOpen(false)}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          
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
              ref={buttonRef}
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