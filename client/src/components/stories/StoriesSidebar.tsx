import React from 'react';
import { StorySlide } from '@/types';
import { Button } from '@/components/ui/button';
import { Plus, Copy, Trash2, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface StoriesSidebarProps {
  slides: StorySlide[];
  currentSlide: number;
  onSlideSelect: (index: number) => void;
  onSlideAdd: () => void;
  onSlideDuplicate: (index: number) => void;
  onSlideDelete: (index: number) => void;
  onPreview: () => void;
}

export function StoriesSidebar({
  slides,
  currentSlide,
  onSlideSelect,
  onSlideAdd,
  onSlideDuplicate,
  onSlideDelete,
  onPreview
}: StoriesSidebarProps) {
  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-900">Слайды</h3>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={onPreview}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={onSlideAdd}
            className="h-8 w-8 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Slides list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {slides.map((slide, index) => (
          <Card
            key={index}
            className={`p-3 cursor-pointer transition-colors ${
              currentSlide === index
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : 'hover:bg-gray-100'
            }`}
            onClick={() => onSlideSelect(index)}
          >
            <div className="space-y-2">
              {/* Slide preview */}
              <div
                className="w-full h-20 rounded border bg-white relative overflow-hidden"
                style={{
                  backgroundColor: slide.background?.color || '#ffffff',
                  backgroundImage: slide.background?.image ? `url(${slide.background.image})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {/* Mini preview of elements */}
                {slide.elements.slice(0, 3).map((element, elemIndex) => (
                  <div
                    key={element.id}
                    className="absolute text-xs"
                    style={{
                      left: `${(element.position.x / 270) * 100}%`,
                      top: `${(element.position.y / 480) * 100}%`,
                      transform: 'scale(0.3)',
                      transformOrigin: 'top left'
                    }}
                  >
                    {element.type === 'text' && (
                      <div className="bg-gray-800 text-white px-1 rounded text-xs">
                        {element.content?.substring(0, 10) || 'Текст'}
                      </div>
                    )}
                    {element.type === 'image' && (
                      <div className="w-6 h-6 bg-gray-300 rounded flex items-center justify-center">
                        <div className="w-3 h-3 bg-gray-600 rounded"></div>
                      </div>
                    )}
                    {element.type === 'shape' && (
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: element.style?.backgroundColor || '#000' }}
                      ></div>
                    )}
                  </div>
                ))}
                
                {slide.elements.length > 3 && (
                  <div className="absolute bottom-1 right-1 text-xs bg-gray-800 text-white px-1 rounded">
                    +{slide.elements.length - 3}
                  </div>
                )}
              </div>

              {/* Slide info */}
              <div className="flex justify-between items-center text-xs text-gray-600">
                <span>Слайд {index + 1}</span>
                <span>{slide.duration}с</span>
              </div>

              {/* Actions */}
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSlideDuplicate(index);
                  }}
                  className="h-6 px-2 text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Копировать
                </Button>
                {slides.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlideDelete(index);
                    }}
                    className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Удалить
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Total duration */}
      <div className="pt-2 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Общая длительность: {slides.reduce((total, slide) => total + slide.duration, 0)}с
        </div>
      </div>
    </div>
  );
}