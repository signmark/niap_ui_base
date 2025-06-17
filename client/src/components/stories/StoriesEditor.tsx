import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { StoryData, StorySlide, StoryElement } from '@/types';
import { Plus, Type, Image, Square, Play, Eye } from 'lucide-react';

interface StoriesEditorProps {
  value: StoryData;
  onChange: (data: StoryData) => void;
}

// Генерация ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Функция для создания пустого слайда
const createEmptySlide = (order: number): StorySlide => ({
  id: generateId(),
  order,
  background: {
    type: 'color',
    value: '#4f46e5',
    color: '#4f46e5'
  },
  elements: [],
  duration: 5
});

// Функция для создания начальных данных Stories
const createInitialStoryData = (): StoryData => ({
  slides: [createEmptySlide(1)],
  aspectRatio: '9:16',
  totalDuration: 5,
  preview: undefined
});

export function StoriesEditor({ value, onChange }: StoriesEditorProps) {
  const { toast } = useToast();
  
  // Инициализируем данные Stories
  const [storyData, setStoryData] = useState<StoryData>(() => {
    return value || createInitialStoryData();
  });
  
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  // Обновляем родительский компонент при изменении данных Stories
  useEffect(() => {
    onChange(storyData);
  }, [storyData, onChange]);

  // Получаем текущий слайд
  const currentSlide = storyData.slides[selectedSlideIndex] || storyData.slides[0];

  // Обработчики для слайдов
  const handleAddSlide = useCallback(() => {
    const newSlide = createEmptySlide(storyData.slides.length + 1);
    const updatedSlides = [...storyData.slides, newSlide];
    
    setStoryData(prev => ({
      ...prev,
      slides: updatedSlides,
      totalDuration: updatedSlides.reduce((sum, slide) => sum + slide.duration, 0)
    }));
    
    setSelectedSlideIndex(updatedSlides.length - 1);
    toast({
      title: "Слайд добавлен",
      description: "Новый слайд добавлен в Stories"
    });
  }, [storyData.slides, toast]);

  // Добавление элемента
  const handleAddElement = useCallback((type: StoryElement['type']) => {
    const newElement: StoryElement = {
      id: generateId(),
      type,
      position: { x: 50, y: 100 },
      size: { width: 200, height: 100 },
      rotation: 0,
      content: type === 'text' ? 'Новый текст' : type === 'image' ? 'https://placehold.co/200x200?text=Image' : '',
      style: {
        fontSize: 16,
        color: '#ffffff',
        backgroundColor: type === 'shape' ? '#000000' : 'transparent',
        borderRadius: 0,
        opacity: 1
      }
    };

    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex 
        ? { ...slide, elements: [...slide.elements, newElement] }
        : slide
    );

    setStoryData(prev => ({
      ...prev,
      slides: updatedSlides
    }));

    setSelectedElement(newElement.id);
    
    toast({
      title: "Элемент добавлен",
      description: `${type === 'text' ? 'Текст' : type === 'image' ? 'Изображение' : 'Фигура'} добавлен на слайд`
    });
  }, [storyData.slides, selectedSlideIndex, toast]);

  // Обновление элемента
  const handleUpdateElement = useCallback((elementId: string, updates: Partial<StoryElement>) => {
    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex 
        ? { 
            ...slide, 
            elements: slide.elements.map(el => 
              el.id === elementId ? { ...el, ...updates } : el
            )
          }
        : slide
    );

    setStoryData(prev => ({
      ...prev,
      slides: updatedSlides
    }));
  }, [storyData.slides, selectedSlideIndex]);

  // Удаление элемента
  const handleDeleteElement = useCallback((elementId: string) => {
    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex 
        ? { 
            ...slide, 
            elements: slide.elements.filter(el => el.id !== elementId)
          }
        : slide
    );

    setStoryData(prev => ({
      ...prev,
      slides: updatedSlides
    }));

    if (selectedElement === elementId) {
      setSelectedElement(null);
    }
  }, [storyData.slides, selectedSlideIndex, selectedElement]);

  // Обновление фона слайда
  const handleBackgroundChange = useCallback((background: StorySlide['background']) => {
    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex 
        ? { ...slide, background }
        : slide
    );

    setStoryData(prev => ({
      ...prev,
      slides: updatedSlides
    }));
  }, [storyData.slides, selectedSlideIndex]);

  // Обновление длительности слайда
  const handleDurationChange = useCallback((duration: number) => {
    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex 
        ? { ...slide, duration }
        : slide
    );

    setStoryData(prev => ({
      ...prev,
      slides: updatedSlides,
      totalDuration: updatedSlides.reduce((sum, slide) => sum + slide.duration, 0)
    }));
  }, [storyData.slides, selectedSlideIndex]);

  return (
    <div className="w-full h-[500px] border rounded-lg bg-gray-50 p-3 stories-editor overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Редактор Stories</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddSlide}
          >
            <Plus className="h-4 w-4 mr-1" />
            Добавить слайд
          </Button>
          <Button
            size="sm"
            variant="outline"
          >
            <Eye className="h-4 w-4 mr-1" />
            Предпросмотр
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 h-full">
        {/* Список слайдов */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Слайды ({storyData.slides.length})</Label>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {storyData.slides.map((slide, index) => (
              <Card
                key={slide.id}
                className={`p-2 cursor-pointer transition-colors ${
                  selectedSlideIndex === index
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => setSelectedSlideIndex(index)}
              >
                <div className="space-y-1">
                  <div className="text-xs font-medium">Слайд {index + 1}</div>
                  <div
                    className="w-full h-12 rounded border bg-white relative"
                    style={{
                      backgroundColor: slide?.background?.color || slide?.background?.value || '#ffffff'
                    }}
                  >
                    {slide?.elements && slide.elements.length > 0 && (
                      <div className="absolute bottom-0 right-0 text-xs bg-gray-800 text-white px-1 rounded">
                        {slide.elements.length}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{slide?.duration || 5}с</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex flex-col items-center space-y-4">
          <div
            className="relative border-2 border-gray-300 rounded-lg overflow-hidden"
            style={{
              width: '135px', // 9:16 aspect ratio (135x240)
              height: '240px',
              backgroundColor: currentSlide?.background?.color || currentSlide?.background?.value || '#ffffff'
            }}
          >
            {currentSlide?.elements?.map((element) => (
              <div
                key={element.id}
                className={`absolute cursor-pointer ${
                  selectedElement === element.id ? 'ring-1 ring-blue-500' : ''
                }`}
                style={{
                  left: `${(element.position.x / 270) * 100}%`,
                  top: `${(element.position.y / 480) * 100}%`,
                  transform: 'scale(0.5)',
                  transformOrigin: 'top left'
                }}
                onClick={() => setSelectedElement(element.id)}
              >
                {element.type === 'text' && (
                  <div
                    style={{
                      fontSize: `${element.style?.fontSize || 16}px`,
                      color: element.style?.color || '#000000',
                      backgroundColor: element.style?.backgroundColor || 'transparent',
                      padding: '4px',
                      borderRadius: `${element.style?.borderRadius || 0}px`
                    }}
                  >
                    {element.content || 'Текст'}
                  </div>
                )}
                {element.type === 'image' && (
                  <img
                    src={element.content || 'https://placehold.co/100x100?text=Img'}
                    alt="Story element"
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                {element.type === 'shape' && (
                  <div
                    className="w-16 h-16 rounded"
                    style={{
                      backgroundColor: element.style?.backgroundColor || '#000000'
                    }}
                  />
                )}
              </div>
            ))}
            
            {/* Empty state */}
            {(!currentSlide?.elements || currentSlide.elements.length === 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-xs">
                <p className="mb-2">Пустой слайд</p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddElement('text')}
                    className="h-6 px-2 text-xs"
                  >
                    <Type className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddElement('image')}
                    className="h-6 px-2 text-xs"
                  >
                    <Image className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddElement('shape')}
                    className="h-6 px-2 text-xs"
                  >
                    <Square className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Add elements toolbar */}
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddElement('text')}
              className="h-8 px-3 text-xs"
            >
              <Type className="h-3 w-3 mr-1" />
              Текст
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddElement('image')}
              className="h-8 px-3 text-xs"
            >
              <Image className="h-3 w-3 mr-1" />
              Изображение
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddElement('shape')}
              className="h-8 px-3 text-xs"
            >
              <Square className="h-3 w-3 mr-1" />
              Фигура
            </Button>
          </div>
        </div>

        {/* Properties panel */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          <Label className="text-sm font-medium">Настройки</Label>
          
          {/* Slide settings */}
          <Card className="p-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Слайд</Label>
              <div>
                <Label className="text-xs">Длительность (сек)</Label>
                <Input
                  type="number"
                  value={currentSlide?.duration || 5}
                  onChange={(e) => handleDurationChange(Number(e.target.value))}
                  min={1}
                  max={15}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Цвет фона</Label>
                <Input
                  type="color"
                  value={currentSlide?.background?.color || currentSlide?.background?.value || '#ffffff'}
                  onChange={(e) => handleBackgroundChange({
                    type: 'color',
                    value: e.target.value,
                    color: e.target.value
                  })}
                  className="h-8"
                />
              </div>
            </div>
          </Card>

          {/* Element settings */}
          {selectedElement && currentSlide?.elements?.find(el => el.id === selectedElement) && (
            <Card className="p-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Выбранный элемент</Label>
                {(() => {
                  const element = currentSlide?.elements?.find(el => el.id === selectedElement);
                  if (!element) return null;
                  
                  return (
                    <>
                      {element.type === 'text' && (
                        <div>
                          <Label className="text-xs">Текст</Label>
                          <Input
                            value={element.content}
                            onChange={(e) => handleUpdateElement(element.id, { content: e.target.value })}
                            className="h-8"
                          />
                        </div>
                      )}
                      {element.type === 'image' && (
                        <div>
                          <Label className="text-xs">URL изображения</Label>
                          <Input
                            value={element.content}
                            onChange={(e) => handleUpdateElement(element.id, { content: e.target.value })}
                            className="h-8"
                            placeholder="https://..."
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-xs">Цвет</Label>
                        <Input
                          type="color"
                          value={element.style?.color || '#000000'}
                          onChange={(e) => handleUpdateElement(element.id, {
                            style: { ...element.style, color: e.target.value }
                          })}
                          className="h-8"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteElement(element.id)}
                        className="w-full h-8"
                      >
                        Удалить элемент
                      </Button>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="text-xs text-gray-500 space-y-1">
            <div>Слайдов: {storyData.slides.length}</div>
            <div>Общая длительность: {storyData.totalDuration}с</div>
            <div>Элементов на слайде: {currentSlide?.elements?.length || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}