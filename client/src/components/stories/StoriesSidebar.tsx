import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Copy } from 'lucide-react';
import type { StorySlide } from '@/types';

interface StoriesSidebarProps {
  slides: StorySlide[];
  selectedIndex: number;
  onSlideSelect: (index: number) => void;
  onAddSlide: () => void;
  onDeleteSlide: (index: number) => void;
}

export function StoriesSidebar({
  slides,
  selectedIndex,
  onSlideSelect,
  onAddSlide,
  onDeleteSlide
}: StoriesSidebarProps) {
  return (
    <div className="w-64 border-r bg-muted/20 p-4 flex flex-col">
      {/* Заголовок */}
      <div className="mb-4">
        <h3 className="font-medium mb-3">Слайды Stories</h3>
        <Button
          onClick={onAddSlide}
          className="w-full flex items-center gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Добавить слайд
        </Button>
      </div>

      {/* Список слайдов */}
      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {slides.map((slide, index) => (
            <Card
              key={slide.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedIndex === index 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => onSlideSelect(index)}
            >
              <CardContent className="p-3">
                {/* Превью слайда */}
                <div 
                  className="w-full aspect-[9/16] rounded-lg mb-2 relative overflow-hidden border"
                  style={{ 
                    backgroundColor: slide.background.type === 'color' 
                      ? slide.background.value 
                      : '#f3f4f6',
                    backgroundImage: slide.background.type === 'image' 
                      ? `url(${slide.background.value})` 
                      : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  {/* Превью элементов */}
                  {slide.elements.slice(0, 3).map((element, elemIndex) => (
                    <div
                      key={element.id}
                      className="absolute text-xs text-white/80 bg-black/20 px-1 rounded"
                      style={{
                        left: `${Math.min(element.position.x / 4, 80)}%`,
                        top: `${Math.min(element.position.y / 8, 85)}%`,
                        fontSize: '8px'
                      }}
                    >
                      {element.type === 'text' 
                        ? element.content.slice(0, 15) + (element.content.length > 15 ? '...' : '')
                        : element.type
                      }
                    </div>
                  ))}
                  
                  {/* Индикатор количества элементов */}
                  {slide.elements.length > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="absolute top-1 right-1 text-xs h-5"
                    >
                      {slide.elements.length}
                    </Badge>
                  )}
                </div>

                {/* Информация о слайде */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Слайд {index + 1}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {slide.duration}с
                    </span>
                  </div>
                  
                  {slide.elements.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {slide.elements.length} элемент{slide.elements.length === 1 ? '' : slide.elements.length > 4 ? 'ов' : 'а'}
                    </div>
                  )}
                </div>

                {/* Кнопки управления */}
                <div className="flex gap-1 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Добавить функцию дублирования
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSlide(index);
                    }}
                    disabled={slides.length <= 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Информация */}
      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Всего слайдов: {slides.length}</div>
          <div>
            Общая длительность: {slides.reduce((sum, slide) => sum + slide.duration, 0)}с
          </div>
          <div className="text-xs text-muted-foreground/70 mt-2">
            Формат: 9:16 (Instagram Stories)
          </div>
        </div>
      </div>
    </div>
  );
}