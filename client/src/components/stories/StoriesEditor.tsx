import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { StoryData, StorySlide, StoryElement } from '@/types';
import { 
  Plus, Trash2, Type, Image, Square, Eye, Upload, Video
} from 'lucide-react';
import { ImageUploader } from '@/components/ImageUploader';
import { VideoUploader } from '@/components/VideoUploader';

interface StoriesEditorProps {
  value: StoryData;
  onChange: (data: StoryData) => void;
}

export function StoriesEditor({ value, onChange }: StoriesEditorProps) {
  const [storyData, setStoryData] = useState<StoryData>(value);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);

  const currentSlide = storyData.slides[selectedSlideIndex];

  useEffect(() => {
    setStoryData(value);
  }, [value]);

  useEffect(() => {
    onChange({
      ...storyData,
      totalDuration: storyData.slides.reduce((sum, slide) => sum + slide.duration, 0)
    });
  }, [storyData, onChange]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleAddSlide = () => {
    const newSlide: StorySlide = {
      id: generateId(),
      elements: [],
      duration: 5,
      background: { type: 'color', value: '#ffffff', color: '#ffffff' }
    };
    
    const newStoryData = {
      ...storyData,
      slides: [...storyData.slides, newSlide]
    };
    setStoryData(newStoryData);
    setSelectedSlideIndex(newStoryData.slides.length - 1);
  };

  const handleDeleteSlide = (index: number) => {
    if (storyData.slides.length === 1) return;
    
    const newSlides = storyData.slides.filter((_, i) => i !== index);
    const newStoryData = { ...storyData, slides: newSlides };
    setStoryData(newStoryData);
    
    if (selectedSlideIndex >= newSlides.length) {
      setSelectedSlideIndex(newSlides.length - 1);
    }
  };

  const handleAddElement = (type: StoryElement['type']) => {
    const newElement: StoryElement = {
      id: generateId(),
      type,
      position: { x: 50, y: 50 },
      content: type === 'text' ? 'Новый текст' : '',
      style: {
        fontSize: type === 'text' ? 16 : undefined,
        color: type === 'text' ? '#000000' : undefined,
        backgroundColor: type === 'shape' ? '#3b82f6' : undefined,
        width: type === 'image' || type === 'shape' ? 100 : undefined,
        height: type === 'image' || type === 'shape' ? 100 : undefined,
      }
    };

    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex 
        ? { ...slide, elements: [...slide.elements, newElement] }
        : slide
    );

    setStoryData({ ...storyData, slides: updatedSlides });
    setSelectedElement(newElement.id);
  };

  const handleElementUpdate = (elementId: string, updates: Partial<StoryElement>) => {
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

    setStoryData({ ...storyData, slides: updatedSlides });
  };

  const handleDeleteElement = (elementId: string) => {
    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex 
        ? {
            ...slide,
            elements: slide.elements.filter(el => el.id !== elementId)
          }
        : slide
    );

    setStoryData({ ...storyData, slides: updatedSlides });
    setSelectedElement(null);
  };

  const handleDurationChange = (duration: number) => {
    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex ? { ...slide, duration } : slide
    );
    setStoryData({ ...storyData, slides: updatedSlides });
  };

  const handleBackgroundChange = (background: { color: string }) => {
    const updatedSlides = storyData.slides.map((slide, index) => 
      index === selectedSlideIndex 
        ? { 
            ...slide, 
            background: { 
              type: 'color' as const, 
              value: background.color, 
              color: background.color 
            } 
          } 
        : slide
    );
    setStoryData({ ...storyData, slides: updatedSlides });
  };

  return (
    <div className="w-full h-[420px] border rounded-lg bg-white stories-editor overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b bg-gray-50">
        <h3 className="text-lg font-medium">Instagram Stories Editor</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPreview(!isPreview)}
            className="h-8"
          >
            <Eye className="h-4 w-4 mr-1" />
            {isPreview ? 'Редактор' : 'Предпросмотр'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Left Sidebar - Slides */}
        <div className="w-48 border-r bg-gray-50 p-3">
          <div className="flex justify-between items-center mb-3">
            <Label className="text-sm font-semibold">Слайды</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddSlide}
              className="h-6 w-6 p-0"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-72">
            {storyData.slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`p-2 rounded border cursor-pointer transition-all ${
                  selectedSlideIndex === index 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
                onClick={() => setSelectedSlideIndex(index)}
              >
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
                      className="h-4 w-4 p-0 hover:bg-red-100"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {slide.elements?.length || 0} элементов • {slide?.duration || 5}с
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center - Canvas Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 p-4">
          {/* Phone Frame */}
          <div className="relative">
            <div
              className="relative border-4 border-black rounded-[20px] overflow-hidden shadow-2xl"
              style={{
                width: '180px',
                height: '320px',
                backgroundColor: currentSlide?.background?.color || '#ffffff'
              }}
            >
              {/* Canvas Content */}
              {currentSlide?.elements?.map((element) => (
                <div
                  key={element.id}
                  className={`absolute cursor-pointer transition-all ${
                    selectedElement === element.id ? 'ring-2 ring-blue-400 z-30' : 'z-20'
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
                        padding: '4px 8px',
                        borderRadius: `${element.style?.borderRadius || 0}px`,
                        fontWeight: element.style?.fontWeight || 'normal',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {element.content || 'Нажмите для редактирования'}
                    </div>
                  )}
                  {element.type === 'image' && (
                    <img
                      src={element.content || 'https://placehold.co/100x100?text=Img'}
                      alt="Element"
                      style={{
                        width: `${element.style?.width || 100}px`,
                        height: `${element.style?.height || 100}px`,
                        objectFit: 'cover',
                        borderRadius: `${element.style?.borderRadius || 0}px`
                      }}
                    />
                  )}
                  {element.type === 'video' && (
                    <video
                      src={element.content || ''}
                      style={{
                        width: `${element.style?.width || 100}px`,
                        height: `${element.style?.height || 100}px`,
                        objectFit: 'cover',
                        borderRadius: `${element.style?.borderRadius || 0}px`
                      }}
                      muted
                      loop
                    />
                  )}
                  {element.type === 'shape' && (
                    <div
                      style={{
                        width: `${element.style?.width || 50}px`,
                        height: `${element.style?.height || 50}px`,
                        backgroundColor: element.style?.backgroundColor || '#3b82f6',
                        borderRadius: `${element.style?.borderRadius || 0}px`
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            
            {/* Phone Header */}
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
              Stories Preview
            </div>
          </div>

          {/* Tools */}
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddElement('text')}
              className="h-8 px-3"
            >
              <Type className="h-4 w-4 mr-1" />
              Текст
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddElement('image')}
              className="h-8 px-3"
            >
              <Image className="h-4 w-4 mr-1" />
              Фото
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddElement('video')}
              className="h-8 px-3"
            >
              <Video className="h-4 w-4 mr-1" />
              Видео
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddElement('shape')}
              className="h-8 px-3"
            >
              <Square className="h-4 w-4 mr-1" />
              Фигура
            </Button>
          </div>
        </div>

        {/* Right Sidebar - Properties */}
        <div className="w-64 border-l bg-white p-3 stories-properties overflow-y-auto">
          <Label className="text-sm font-semibold mb-3 block">Настройки</Label>
          
          {/* Slide Settings */}
          <div className="space-y-3 mb-4">
            <div className="p-3 border rounded">
              <Label className="text-xs font-medium mb-2 block">Длительность слайда</Label>
              <Input
                type="number"
                value={currentSlide?.duration || 5}
                onChange={(e) => handleDurationChange(Number(e.target.value))}
                min={1}
                max={15}
                className="h-8"
              />
            </div>
            
            <div className="p-3 border rounded">
              <Label className="text-xs font-medium mb-2 block">Фон слайда</Label>
              <Input
                type="color"
                value={currentSlide?.background?.color || '#ffffff'}
                onChange={(e) => handleBackgroundChange({ color: e.target.value })}
                className="h-8 w-full"
              />
            </div>
          </div>

          {/* Element Settings */}
          {selectedElement && currentSlide?.elements && (() => {
            const element = currentSlide.elements.find(el => el.id === selectedElement);
            if (!element) return null;
            
            return (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium">Выбранный элемент</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteElement(selectedElement)}
                    className="h-6 w-6 p-0 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                
                {element.type === 'text' && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Текст</Label>
                      <Textarea
                        value={element.content || ''}
                        onChange={(e) => handleElementUpdate(selectedElement, { content: e.target.value })}
                        className="h-16 text-sm"
                        placeholder="Введите текст..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Размер шрифта</Label>
                      <Input
                        type="number"
                        value={element.style?.fontSize || 16}
                        onChange={(e) => handleElementUpdate(selectedElement, {
                          style: { ...element.style, fontSize: Number(e.target.value) }
                        })}
                        min={8}
                        max={72}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Цвет текста</Label>
                      <Input
                        type="color"
                        value={element.style?.color || '#000000'}
                        onChange={(e) => handleElementUpdate(selectedElement, {
                          style: { ...element.style, color: e.target.value }
                        })}
                        className="h-8"
                      />
                    </div>
                  </div>
                )}
                
                {element.type === 'image' && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Изображение</Label>
                      <ImageUploader
                        value={element.content || ''}
                        onChange={(url) => handleElementUpdate(selectedElement, { content: url })}
                        placeholder="Загрузите изображение"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Ширина</Label>
                        <Input
                          type="number"
                          value={element.style?.width || 100}
                          onChange={(e) => handleElementUpdate(selectedElement, {
                            style: { ...element.style, width: Number(e.target.value) }
                          })}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Высота</Label>
                        <Input
                          type="number"
                          value={element.style?.height || 100}
                          onChange={(e) => handleElementUpdate(selectedElement, {
                            style: { ...element.style, height: Number(e.target.value) }
                          })}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {element.type === 'video' && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Видео</Label>
                      <VideoUploader
                        value={element.content || ''}
                        onChange={(url) => handleElementUpdate(selectedElement, { content: url })}
                        placeholder="Загрузите видео"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Ширина</Label>
                        <Input
                          type="number"
                          value={element.style?.width || 100}
                          onChange={(e) => handleElementUpdate(selectedElement, {
                            style: { ...element.style, width: Number(e.target.value) }
                          })}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Высота</Label>
                        <Input
                          type="number"
                          value={element.style?.height || 100}
                          onChange={(e) => handleElementUpdate(selectedElement, {
                            style: { ...element.style, height: Number(e.target.value) }
                          })}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {element.type === 'shape' && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Цвет фигуры</Label>
                      <Input
                        type="color"
                        value={element.style?.backgroundColor || '#3b82f6'}
                        onChange={(e) => handleElementUpdate(selectedElement, {
                          style: { ...element.style, backgroundColor: e.target.value }
                        })}
                        className="h-8"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Ширина</Label>
                        <Input
                          type="number"
                          value={element.style?.width || 50}
                          onChange={(e) => handleElementUpdate(selectedElement, {
                            style: { ...element.style, width: Number(e.target.value) }
                          })}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Высота</Label>
                        <Input
                          type="number"
                          value={element.style?.height || 50}
                          onChange={(e) => handleElementUpdate(selectedElement, {
                            style: { ...element.style, height: Number(e.target.value) }
                          })}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}