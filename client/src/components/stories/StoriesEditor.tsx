import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Eye, Type, Image, Square, Trash2 } from 'lucide-react';
import { StoryData, StorySlide, StoryElement } from '@/types';

interface StoriesEditorProps {
  value: StoryData;
  onChange: (data: StoryData) => void;
}

const createEmptySlide = (order: number): StorySlide => ({
  id: `slide-${Date.now()}-${order}`,
  order,
  duration: 5,
  background: {
    type: 'color',
    value: '#6366f1',
    color: '#6366f1'
  },
  elements: []
});

const createInitialStoryData = (): StoryData => ({
  slides: [createEmptySlide(0)],
  aspectRatio: '9:16',
  totalDuration: 5
});

export function StoriesEditor({ value, onChange }: StoriesEditorProps) {
  const [storyData, setStoryData] = useState<StoryData>(value || createInitialStoryData());
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [selectedElement, setSelectedElement] = useState<string>('');
  const [isPreview, setIsPreview] = useState(false);

  const currentSlide = storyData.slides[selectedSlideIndex];

  const handleAddSlide = useCallback(() => {
    const newSlide = createEmptySlide(storyData.slides.length);
    const updatedSlides = [...storyData.slides, newSlide];
    
    setStoryData(prev => ({
      ...prev,
      slides: updatedSlides,
      totalDuration: updatedSlides.reduce((sum, slide) => sum + slide.duration, 0)
    }));
  }, [storyData.slides]);

  const handleDeleteSlide = useCallback((slideIndex: number) => {
    if (storyData.slides.length <= 1) return;
    
    const updatedSlides = storyData.slides.filter((_, index) => index !== slideIndex);
    
    setStoryData(prev => ({
      ...prev,
      slides: updatedSlides,
      totalDuration: updatedSlides.reduce((sum, slide) => sum + slide.duration, 0)
    }));
    
    if (selectedSlideIndex >= updatedSlides.length) {
      setSelectedSlideIndex(updatedSlides.length - 1);
    }
  }, [storyData.slides, selectedSlideIndex]);

  const handleDurationChange = useCallback((duration: number) => {
    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex ? { ...slide, duration } : slide
    );
    
    setStoryData(prev => ({
      ...prev,
      slides: updatedSlides,
      totalDuration: updatedSlides.reduce((sum, slide) => sum + slide.duration, 0)
    }));
  }, [storyData.slides, selectedSlideIndex]);

  const handleBackgroundChange = useCallback((background: StorySlide['background']) => {
    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex ? { ...slide, background } : slide
    );
    
    setStoryData(prev => ({
      ...prev,
      slides: updatedSlides
    }));
  }, [storyData.slides, selectedSlideIndex]);

  const handleAddElement = useCallback((type: StoryElement['type']) => {
    const newElement: StoryElement = {
      id: `element-${Date.now()}`,
      type,
      position: { x: 50, y: 50 },
      size: { width: 200, height: type === 'text' ? 50 : 100 },
      rotation: 0,
      content: type === 'text' ? 'Новый текст' : type === 'image' ? 'https://placehold.co/200x100?text=Img' : '',
      style: type === 'text' ? {
        fontSize: 16,
        color: '#000000',
        backgroundColor: 'transparent',
        borderRadius: 0
      } : type === 'shape' ? {
        backgroundColor: '#6366f1',
        borderRadius: 8
      } : undefined
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
  }, [storyData.slides, selectedSlideIndex]);

  const handleUpdateElement = useCallback((elementId: string, updates: Partial<StoryElement>) => {
    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex 
        ? {
            ...slide,
            elements: slide.elements.map(element => 
              element.id === elementId ? { ...element, ...updates } : element
            )
          }
        : slide
    );
    
    setStoryData(prev => ({
      ...prev,
      slides: updatedSlides
    }));
  }, [storyData.slides, selectedSlideIndex]);

  const handleDeleteElement = useCallback((elementId: string) => {
    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex 
        ? {
            ...slide,
            elements: slide.elements.filter(element => element.id !== elementId)
          }
        : slide
    );
    
    setStoryData(prev => ({
      ...prev,
      slides: updatedSlides
    }));
    
    if (selectedElement === elementId) {
      setSelectedElement('');
    }
  }, [storyData.slides, selectedSlideIndex, selectedElement]);

  useEffect(() => {
    onChange({
      ...storyData,
      slides: storyData.slides.map((slide, index) => ({ ...slide, order: index })),
      totalDuration: storyData.slides.reduce((sum, slide) => sum + slide.duration, 0)
    });
  }, [storyData, onChange]);

  return (
    <div className="w-full h-[450px] border rounded-lg bg-gray-50 p-3 stories-editor overflow-hidden">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium">Редактор Stories</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPreview(!isPreview)}
            className="h-8"
          >
            <Eye className="h-4 w-4 mr-1" />
            Предпросмотр
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 h-full">
        {/* Slides list */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">Слайды ({storyData.slides.length})</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddSlide}
              className="h-6 w-6 p-0"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {storyData.slides.map((slide, index) => (
              <Card 
                key={slide.id}
                className={`cursor-pointer transition-colors ${
                  selectedSlideIndex === index ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedSlideIndex(index)}
              >
                <div className="p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium">Слайд {index + 1}</span>
                    {storyData.slides.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSlide(index);
                        }}
                        className="h-4 w-4 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    {slide.elements.length > 0 && (
                      <div className="text-xs bg-blue-100 text-blue-700 rounded px-1">
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
              width: '135px',
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
                    alt="Element"
                    style={{
                      width: element.size.width,
                      height: element.size.height,
                      objectFit: 'cover',
                      borderRadius: `${element.style?.borderRadius || 0}px`
                    }}
                  />
                )}
                {element.type === 'shape' && (
                  <div
                    style={{
                      width: element.size.width,
                      height: element.size.height,
                      backgroundColor: element.style?.backgroundColor || '#6366f1',
                      borderRadius: `${element.style?.borderRadius || 8}px`
                    }}
                  />
                )}
              </div>
            ))}
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
        <div className="col-span-2 space-y-3 max-h-[380px] overflow-y-auto">
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
                  className="h-7 text-xs"
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
                  className="h-7"
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
                    <div className="space-y-2">
                      {element.type === 'text' && (
                        <div>
                          <Label className="text-xs">Текст</Label>
                          <Input
                            value={element.content}
                            onChange={(e) => handleUpdateElement(element.id, { content: e.target.value })}
                            className="h-7 text-xs"
                          />
                        </div>
                      )}
                      {element.type === 'image' && (
                        <div>
                          <Label className="text-xs">URL изображения</Label>
                          <Input
                            value={element.content}
                            onChange={(e) => handleUpdateElement(element.id, { content: e.target.value })}
                            className="h-7 text-xs"
                          />
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteElement(element.id)}
                        className="w-full h-7 text-xs"
                      >
                        Удалить элемент
                      </Button>
                    </div>
                  );
                })()}
              </div>
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