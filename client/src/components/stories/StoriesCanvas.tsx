import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Type, Image, Sticker, BarChart3 } from 'lucide-react';
import type { StorySlide, StoryElement } from '@/types';
import { StoriesElement } from './StoriesElement';

interface StoriesCanvasProps {
  slide: StorySlide;
  selectedElement: string | null;
  onElementSelect: (elementId: string) => void;
  onElementUpdate: (elementId: string, updates: Partial<StoryElement>) => void;
  onElementAdd: (elementType: StoryElement['type']) => void;
  onElementDelete: (elementId: string) => void;
  isPreview?: boolean;
}

export function StoriesCanvas({
  slide,
  selectedElement,
  onElementSelect,
  onElementUpdate,
  onElementAdd,
  onElementDelete,
  isPreview = false
}: StoriesCanvasProps) {
  return (
    <div className="stories-canvas flex-1 flex items-center justify-center bg-gray-100 p-4">
      <div className="relative">
        {/* Основной холст */}
        <div 
          className="stories-frame relative bg-white shadow-lg"
          style={{ 
            width: '270px', 
            height: '480px',
            borderRadius: '24px',
            overflow: 'hidden'
          }}
        >
          {/* Фон слайда */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: slide.background.type === 'color' 
                ? slide.background.value 
                : undefined,
              backgroundImage: slide.background.type === 'image' 
                ? `url(${slide.background.value})` 
                : slide.background.type === 'gradient'
                ? slide.background.value
                : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          
          {/* Элементы слайда */}
          {slide.elements.map(element => (
            <StoriesElement
              key={element.id}
              element={element}
              isSelected={selectedElement === element.id}
              isPreview={isPreview}
              onClick={() => !isPreview && onElementSelect(element.id)}
              onUpdate={onElementUpdate}
              onDelete={onElementDelete}
            />
          ))}
          
          {/* Кнопки добавления элементов (только в режиме редактирования) */}
          {!isPreview && (
            <div className="absolute bottom-4 left-4 right-4">
              <Card className="p-2 bg-white/90 backdrop-blur-sm">
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onElementAdd('text')}
                    className="flex items-center gap-1"
                  >
                    <Type className="h-4 w-4" />
                    Текст
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onElementAdd('image')}
                    className="flex items-center gap-1"
                  >
                    <Image className="h-4 w-4" />
                    Фото
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onElementAdd('sticker')}
                    className="flex items-center gap-1"
                  >
                    <Sticker className="h-4 w-4" />
                    Стикер
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onElementAdd('poll')}
                    className="flex items-center gap-1"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Опрос
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Размеры холста (только в режиме редактирования) */}
        {!isPreview && (
          <div className="absolute -bottom-8 left-0 right-0 text-center text-xs text-muted-foreground">
            270 × 480px (9:16)
          </div>
        )}
      </div>
    </div>
  );
}