import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Eye, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { CampaignContent, StoryData, StorySlide, StoryElement } from '@/types';
import { StoriesCanvas } from './StoriesCanvas';
import { StoriesSidebar } from './StoriesSidebar';
import { StoriesToolbar } from './StoriesToolbar';

interface StoriesEditorProps {
  content: CampaignContent;
  campaignId: string;
  onChange: (content: CampaignContent) => void;
  onSave: () => void;
}

// Генерация ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Функция для создания пустого слайда
const createEmptySlide = (order: number): StorySlide => ({
  id: generateId(),
  order,
  background: {
    type: 'color',
    value: '#4f46e5'
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

export function StoriesEditor({ content, campaignId, onChange, onSave }: StoriesEditorProps) {
  const { toast } = useToast();
  
  // Инициализируем данные Stories
  const [storyData, setStoryData] = useState<StoryData>(() => {
    return content.storyData || createInitialStoryData();
  });
  
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);

  // Обновляем родительский компонент при изменении данных Stories
  useEffect(() => {
    const updatedContent: CampaignContent = {
      ...content,
      storyData,
      storyPreview: storyData.slides[0]?.background?.value || '',
      content: storyData.slides.map((slide, index) => 
        `Слайд ${index + 1}: ${slide.elements.filter(el => el.type === 'text').map(el => el.content).join(' ')}`
      ).join('\n')
    };
    onChange(updatedContent);
  }, [storyData, content, onChange]);

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
      title: 'Слайд добавлен',
      description: `Создан слайд ${updatedSlides.length}`
    });
  }, [storyData.slides, toast]);

  const handleDeleteSlide = useCallback((slideIndex: number) => {
    if (storyData.slides.length <= 1) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Нельзя удалить последний слайд'
      });
      return;
    }

    const updatedSlides = storyData.slides.filter((_, index) => index !== slideIndex);
    const reorderedSlides = updatedSlides.map((slide, index) => ({
      ...slide,
      order: index + 1
    }));

    setStoryData(prev => ({
      ...prev,
      slides: reorderedSlides,
      totalDuration: reorderedSlides.reduce((sum, slide) => sum + slide.duration, 0)
    }));

    if (selectedSlideIndex >= reorderedSlides.length) {
      setSelectedSlideIndex(reorderedSlides.length - 1);
    }

    toast({
      title: 'Слайд удален',
      description: `Удален слайд ${slideIndex + 1}`
    });
  }, [storyData.slides, selectedSlideIndex, toast]);

  // Обработчики для элементов
  const handleElementAdd = useCallback((elementType: StoryElement['type']) => {
    const newElement: StoryElement = {
      id: generateId(),
      type: elementType,
      position: { x: 50, y: 100 },
      size: { width: 200, height: 60 },
      rotation: 0,
      content: elementType === 'text' ? 'Новый текст' : '',
      style: elementType === 'text' ? {
        fontSize: 24,
        color: '#ffffff',
        textAlign: 'center',
        fontWeight: 'bold'
      } : {}
    };

    const updatedSlides = storyData.slides.map((slide, index) =>
      index === selectedSlideIndex
        ? { ...slide, elements: [...slide.elements, newElement] }
        : slide
    );

    setStoryData(prev => ({ ...prev, slides: updatedSlides }));
    setSelectedElement(newElement.id);

    toast({
      title: 'Элемент добавлен',
      description: `Добавлен элемент "${elementType}"`
    });
  }, [storyData.slides, selectedSlideIndex, toast]);

  const handleElementUpdate = useCallback((elementId: string, updates: Partial<StoryElement>) => {
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

    setStoryData(prev => ({ ...prev, slides: updatedSlides }));
  }, [storyData.slides, selectedSlideIndex]);

  const handleElementDelete = useCallback((elementId: string) => {
    const updatedSlides = storyData.slides.map((slide, index) =>
      index === selectedSlideIndex
        ? {
            ...slide,
            elements: slide.elements.filter(element => element.id !== elementId)
          }
        : slide
    );

    setStoryData(prev => ({ ...prev, slides: updatedSlides }));
    
    if (selectedElement === elementId) {
      setSelectedElement(null);
    }

    toast({
      title: 'Элемент удален',
      description: 'Элемент удален со слайда'
    });
  }, [storyData.slides, selectedSlideIndex, selectedElement, toast]);

  // Обработчик изменения фона слайда
  const handleBackgroundChange = useCallback((background: StorySlide['background']) => {
    const updatedSlides = storyData.slides.map((slide, index) =>
      index === selectedSlideIndex ? { ...slide, background } : slide
    );

    setStoryData(prev => ({ ...prev, slides: updatedSlides }));
  }, [storyData.slides, selectedSlideIndex]);

  // Обработчик изменения длительности слайда
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

  // Превью режим
  const handlePreviewToggle = useCallback(() => {
    setIsPreviewMode(!isPreviewMode);
    setPreviewSlideIndex(selectedSlideIndex);
  }, [isPreviewMode, selectedSlideIndex]);

  return (
    <div className="stories-editor h-full flex flex-col">
      {/* Заголовок */}
      <div className="p-4 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Редактор Instagram Stories</h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <Badge variant="outline">
                {storyData.slides.length} слайд{storyData.slides.length === 1 ? '' : storyData.slides.length > 4 ? 'ов' : 'а'}
              </Badge>
              <span>Общая длительность: {storyData.totalDuration}с</span>
              <span>9:16 формат</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviewToggle}
              className="flex items-center gap-2"
            >
              {isPreviewMode ? <Pause className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {isPreviewMode ? 'Редактор' : 'Превью'}
            </Button>
            <Button
              onClick={onSave}
              size="sm"
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Сохранить Stories
            </Button>
          </div>
        </div>
      </div>

      {/* Основной интерфейс */}
      <div className="flex-1 flex overflow-hidden">
        {!isPreviewMode ? (
          <>
            {/* Левая панель - список слайдов */}
            <StoriesSidebar
              slides={storyData.slides}
              selectedIndex={selectedSlideIndex}
              onSlideSelect={setSelectedSlideIndex}
              onAddSlide={handleAddSlide}
              onDeleteSlide={handleDeleteSlide}
            />

            {/* Центральная область - canvas */}
            <StoriesCanvas
              slide={currentSlide}
              selectedElement={selectedElement}
              onElementSelect={setSelectedElement}
              onElementUpdate={handleElementUpdate}
              onElementAdd={handleElementAdd}
              onElementDelete={handleElementDelete}
            />

            {/* Правая панель - инструменты */}
            <StoriesToolbar
              slide={currentSlide}
              selectedElement={selectedElement}
              onElementStyleChange={handleElementUpdate}
              onBackgroundChange={handleBackgroundChange}
              onDurationChange={handleDurationChange}
            />
          </>
        ) : (
          // Режим превью
          <div className="flex-1 flex items-center justify-center bg-gray-900 p-8">
            <div className="text-center">
              <div 
                className="stories-preview-frame relative bg-black shadow-2xl mx-auto"
                style={{ 
                  width: '270px', 
                  height: '480px',
                  borderRadius: '24px',
                  overflow: 'hidden'
                }}
              >
                <StoriesCanvas
                  slide={storyData.slides[previewSlideIndex]}
                  selectedElement={null}
                  onElementSelect={() => {}}
                  onElementUpdate={() => {}}
                  onElementAdd={() => {}}
                  onElementDelete={() => {}}
                  isPreview={true}
                />
                
                {/* Индикаторы прогресса */}
                <div className="absolute top-2 left-2 right-2 flex gap-1">
                  {storyData.slides.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1 rounded-full flex-1 ${
                        index === previewSlideIndex ? 'bg-white' : 'bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              {/* Навигация превью */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setPreviewSlideIndex(Math.max(0, previewSlideIndex - 1))}
                  disabled={previewSlideIndex === 0}
                >
                  Назад
                </Button>
                <span className="text-white">
                  {previewSlideIndex + 1} / {storyData.slides.length}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPreviewSlideIndex(Math.min(storyData.slides.length - 1, previewSlideIndex + 1))}
                  disabled={previewSlideIndex === storyData.slides.length - 1}
                >
                  Далее
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}