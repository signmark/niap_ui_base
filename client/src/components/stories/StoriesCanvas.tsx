import React from 'react';
import { StorySlide, StoryElement } from '@/types';
import StoriesElement from './StoriesElement';
import { Button } from '@/components/ui/button';
import { Type, Image, Square, Plus } from 'lucide-react';

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
  const canvasStyle = {
    width: '270px', // 9:16 aspect ratio (270x480)
    height: '480px',
    backgroundColor: slide.background?.color || '#ffffff',
    backgroundImage: slide.background?.image ? `url(${slide.background.image})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    position: 'relative' as const,
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    margin: '0 auto'
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onElementSelect('');
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Canvas */}
      <div 
        style={canvasStyle}
        onClick={handleCanvasClick}
        className="cursor-default"
      >
        {slide.elements.map((element) => (
          <StoriesElement
            key={element.id}
            element={element}
            isSelected={selectedElement === element.id}
            isPreview={isPreview}
            onClick={() => onElementSelect(element.id)}
            onUpdate={onElementUpdate}
            onDelete={onElementDelete}
          />
        ))}
        
        {/* Empty state */}
        {slide.elements.length === 0 && !isPreview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 space-y-4">
            <div className="text-center">
              <p className="text-sm mb-4">Добавьте элементы в ваш Stories</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onElementAdd('text')}
                  className="flex items-center gap-1"
                >
                  <Type className="h-4 w-4" />
                  Текст
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onElementAdd('image')}
                  className="flex items-center gap-1"
                >
                  <Image className="h-4 w-4" />
                  Изображение
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onElementAdd('shape')}
                  className="flex items-center gap-1"
                >
                  <Square className="h-4 w-4" />
                  Фигура
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add elements toolbar (when not in preview) */}
      {!isPreview && (
        <div className="flex gap-2 p-2 bg-gray-50 rounded-lg">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onElementAdd('text')}
            className="flex items-center gap-1"
          >
            <Type className="h-4 w-4" />
            Добавить текст
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onElementAdd('image')}
            className="flex items-center gap-1"
          >
            <Image className="h-4 w-4" />
            Добавить изображение
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onElementAdd('shape')}
            className="flex items-center gap-1"
          >
            <Square className="h-4 w-4" />
            Добавить фигуру
          </Button>
        </div>
      )}
    </div>
  );
}