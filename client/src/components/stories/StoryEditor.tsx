import React, { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { 
  Type, 
  Image, 
  Video, 
  BarChart3, 
  Sparkles,
  Move,
  Trash2,
  Upload,
  Link,
  ArrowLeft,
  Save,
  Play,
  Plus
} from 'lucide-react';
import Draggable from 'react-draggable';
import ElementDialog from './ElementDialog';

// Local interfaces for component
interface StorySlide {
  id: string;
  order: number;
  duration: number;
  background: {
    type: 'color' | 'image' | 'video';
    value: string;
  };
  elements: StoryElement[];
}

interface StoryElement {
  id: string;
  type: 'text' | 'image' | 'video' | 'poll' | 'quiz';
  position: { x: number; y: number };
  rotation: number;
  zIndex: number;
  content: any;
  style?: any;
}

interface StoryEditorProps {
  campaignId?: string;
  storyId?: string;
}

export default function StoryEditor({ campaignId }: StoryEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [storyTitle, setStoryTitle] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [showElementDialog, setShowElementDialog] = useState(false);
  const [selectedElement, setSelectedElement] = useState<StoryElement | null>(null);
  const [slides, setSlides] = useState<StorySlide[]>([
    {
      id: 'slide-1',
      order: 1,
      duration: 5,
      background: { type: 'color', value: '#6366f1' },
      elements: []
    }
  ]);

  // Обработчики для работы со слайдами
  const addSlide = () => {
    const newSlide: StorySlide = {
      id: `slide-${Date.now()}`,
      order: slides.length + 1,
      duration: 5,
      background: { type: 'color', value: '#6366f1' },
      elements: []
    };
    setSlides([...slides, newSlide]);
    setCurrentSlideIndex(slides.length);
  };

  const deleteSlide = (slideIndex: number) => {
    if (slides.length <= 1) return;
    const newSlides = slides.filter((_, index) => index !== slideIndex);
    setSlides(newSlides);
    setCurrentSlideIndex(Math.max(0, Math.min(slideIndex, newSlides.length - 1)));
  };

  const updateSlide = (updates: Partial<StorySlide>) => {
    setSlides(prevSlides => {
      const newSlides = [...prevSlides];
      newSlides[currentSlideIndex] = { ...newSlides[currentSlideIndex], ...updates };
      return newSlides;
    });
  };

  const getDefaultContent = (elementType: StoryElement['type']) => {
    switch (elementType) {
      case 'text':
        return { text: 'Новый текст' };
      case 'image':
        return { url: '', alt: 'Изображение' };
      case 'video':
        return { url: '', thumbnail: '' };
      case 'poll':
        return { 
          question: 'Ваш вопрос?', 
          options: ['Вариант 1', 'Вариант 2'] 
        };
      case 'quiz':
        return { 
          question: 'Вопрос викторины?', 
          options: ['Вариант 1', 'Вариант 2', 'Вариант 3'], 
          correctAnswer: 0 
        };
      default:
        return {};
    }
  };

  const getDefaultStyle = (elementType: StoryElement['type']) => {
    switch (elementType) {
      case 'text':
        return {
          fontSize: 16,
          fontFamily: 'Arial',
          color: '#000000',
          fontWeight: 'normal',
          textAlign: 'center'
        };
      case 'image':
      case 'video':
        return {
          borderRadius: 8
        };
      case 'poll':
      case 'quiz':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: 12,
          padding: 16
        };
      default:
        return {};
    }
  };

  const addElement = (elementType: StoryElement['type']) => {
    const newElement: StoryElement = {
      id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: elementType,
      position: { x: 50, y: 50 },
      rotation: 0,
      zIndex: (slides[currentSlideIndex]?.elements?.length || 0) + 1,
      content: getDefaultContent(elementType),
      style: getDefaultStyle(elementType)
    };

    setSlides(prevSlides => {
      const newSlides = [...prevSlides];
      const currentSlide = newSlides[currentSlideIndex];
      
      if (currentSlide) {
        const updatedSlide = {
          ...currentSlide,
          elements: [...(currentSlide.elements || []), newElement]
        };
        newSlides[currentSlideIndex] = updatedSlide;
        
        console.log('Added element:', newElement);
        console.log('Updated slide:', updatedSlide);
      }
      
      return newSlides;
    });

    setSelectedElement(newElement);
    
    toast({
      title: 'Элемент добавлен',
      description: `${getElementTypeName(elementType)} добавлен на слайд ${currentSlideIndex + 1}`
    });
  };

  const getElementTypeName = (type: StoryElement['type']) => {
    switch (type) {
      case 'text': return 'Текст';
      case 'image': return 'Изображение';
      case 'video': return 'Видео';
      case 'poll': return 'Опрос';
      case 'quiz': return 'Викторина';
      default: return 'Элемент';
    }
  };

  const updateElement = (elementId: string, updates: Partial<StoryElement>) => {
    setSlides(prevSlides => {
      const newSlides = [...prevSlides];
      const currentSlideData = newSlides[currentSlideIndex];
      
      if (currentSlideData) {
        newSlides[currentSlideIndex] = {
          ...currentSlideData,
          elements: currentSlideData.elements?.map(el => 
            el.id === elementId ? { ...el, ...updates } : el
          ) || []
        };
      }
      
      return newSlides;
    });
  };

  const deleteElement = (elementId: string) => {
    setSlides(prevSlides => {
      const newSlides = [...prevSlides];
      const currentSlideData = newSlides[currentSlideIndex];
      
      if (currentSlideData) {
        newSlides[currentSlideIndex] = {
          ...currentSlideData,
          elements: currentSlideData.elements?.filter(el => el.id !== elementId) || []
        };
      }
      
      return newSlides;
    });
    
    toast({
      title: 'Элемент удален',
      description: 'Элемент успешно удален со слайда'
    });
  };

  const handleSave = async () => {
    try {
      if (!storyTitle.trim()) {
        toast({
          title: 'Ошибка',
          description: 'Необходимо указать название истории',
          variant: 'destructive'
        });
        return;
      }

      const storyData = {
        title: storyTitle,
        campaignId: campaignId,
        type: 'story',
        status: 'draft',
        slides: slides.map(slide => ({
          order: slide.order,
          duration: slide.duration,
          background: slide.background,
          elements: slide.elements.map(element => ({
            type: element.type,
            position: { 
              x: element.position.x, 
              y: element.position.y,
              width: 100,
              height: 100
            },
            rotation: element.rotation,
            zIndex: element.zIndex,
            content: element.content,
            style: element.style
          }))
        }))
      };

      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(storyData)
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения истории');
      }

      const result = await response.json();
      
      toast({
        title: 'Сохранено',
        description: `История "${storyTitle}" сохранена с ${slides.length} слайдами`
      });
      
      console.log('Stories сохранена:', result);
    } catch (error) {
      console.error('Ошибка сохранения Stories:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить историю',
        variant: 'destructive'
      });
    }
  };

  const handlePublish = () => {
    toast({
      title: 'Предпросмотр',
      description: 'Функция предпросмотра будет реализована в следующих этапах'
    });
  };

  const handleGoBack = () => {
    window.location.href = campaignId ? `/campaigns/${campaignId}/content` : '/campaigns';
  };

  // Current slide data - мемоизируем для правильной синхронизации
  const currentSlide = useMemo(() => {
    console.log('Computing currentSlide, slides:', slides, 'index:', currentSlideIndex);
    return slides[currentSlideIndex];
  }, [slides, currentSlideIndex]);

  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleGoBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          <div>
            <Input
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              className="text-lg font-semibold bg-transparent border-none p-0 h-auto"
              placeholder="Название истории"
            />
            <div className="text-sm text-gray-500">
              {isAutoSaving ? 'Автосохранение...' : 'Готово к редактированию'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Сохранить
          </Button>
          <Button size="sm" onClick={handlePublish}>
            <Play className="w-4 h-4 mr-2" />
            Предпросмотр
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Left sidebar - Slides panel */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Слайды</h3>
              <Button size="sm" variant="outline" onClick={addSlide}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Slide thumbnails */}
            <div className="space-y-2">
              {slides.map((slide, index) => (
                <div
                  key={slide.id}
                  onClick={() => setCurrentSlideIndex(index)}
                  className={`relative border-2 rounded-lg p-2 cursor-pointer transition-colors group ${
                    currentSlideIndex === index 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div 
                    className="aspect-[9/16] rounded-md bg-gradient-to-br from-purple-400 to-blue-600 flex items-center justify-center text-white text-xs"
                    style={{
                      background: slide.background.type === 'color' 
                        ? slide.background.value 
                        : slide.background.type === 'image'
                        ? `url(${slide.background.value}) center/cover`
                        : '#6366f1'
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="text-xs text-center mt-1 text-gray-600">
                    {slide.duration}с
                  </div>
                  
                  {slides.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSlide(index);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
          <div className="relative">
            {/* Phone mockup */}
            <div className="w-80 h-[640px] bg-black rounded-[2.5rem] p-2 shadow-2xl">
              <div 
                className="w-full h-full rounded-[2rem] relative overflow-hidden"
                style={{
                  background: currentSlide?.background.type === 'color' 
                    ? currentSlide.background.value 
                    : currentSlide?.background.type === 'image'
                    ? `url(${currentSlide.background.value}) center/cover`
                    : '#6366f1'
                }}
              >
                {/* Story elements */}
                {console.log('Rendering elements:', currentSlide?.elements, 'Current slide:', currentSlide)}
                {currentSlide?.elements?.map((element) => (
                  <Draggable
                    key={element.id}
                    defaultPosition={element.position}
                    onStop={(e, data) => {
                      updateElement(element.id, {
                        position: { x: data.x, y: data.y }
                      });
                    }}
                  >
                    <div 
                      className="absolute cursor-move select-none group"
                      style={{ 
                        transform: `rotate(${element.rotation}deg)`,
                        zIndex: element.zIndex 
                      }}
                      onClick={() => setSelectedElement(element)}
                    >
                      {element.type === 'text' && (
                        <div 
                          style={{
                            fontSize: `${element.content.fontSize || 24}px`,
                            color: element.content.color || '#ffffff',
                            fontWeight: element.content.fontWeight || 'bold'
                          }}
                          className="px-2 py-1 border-2 border-transparent group-hover:border-white/50 rounded"
                        >
                          {element.content.text || 'Новый текст'}
                        </div>
                      )}
                      
                      {element.type === 'image' && (
                        <div className="relative border-2 border-transparent group-hover:border-white/50 rounded">
                          {element.content.url ? (
                            <img 
                              src={element.content.url} 
                              alt={element.content.alt || 'Изображение'}
                              className="max-w-32 max-h-32 object-cover rounded"
                            />
                          ) : (
                            <div className="w-32 h-32 bg-white/20 rounded flex items-center justify-center">
                              <Image className="w-8 h-8 text-white/60" />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {element.type === 'poll' && (
                        <div className="bg-white/90 rounded-lg p-3 text-black text-sm max-w-48 border-2 border-transparent group-hover:border-blue-400">
                          <div className="font-medium mb-2">{element.content.question || 'Вопрос?'}</div>
                          {(element.content.options || ['Вариант 1', 'Вариант 2']).map((option: string, i: number) => (
                            <div key={i} className="py-1 px-2 bg-gray-100 rounded mb-1 text-xs">
                              {option}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {element.type === 'quiz' && (
                        <div className="bg-white/90 rounded-lg p-3 text-black text-sm max-w-48 border-2 border-transparent group-hover:border-green-400">
                          <div className="font-medium mb-2">{element.content.question || 'Вопрос?'}</div>
                          {(element.content.options || ['Вариант 1', 'Вариант 2']).map((option: string, i: number) => (
                            <div key={i} className={`py-1 px-2 rounded mb-1 text-xs ${
                              i === element.content.correct ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              {option}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {element.type === 'video' && (
                        <div className="w-24 h-16 bg-black rounded flex items-center justify-center border-2 border-transparent group-hover:border-white/50">
                          <Video className="w-6 h-6 text-white" />
                        </div>
                      )}
                      
                      {element.type === 'ai-image' && (
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded flex items-center justify-center border-2 border-transparent group-hover:border-purple-300">
                          <Sparkles className="w-8 h-8 text-white" />
                        </div>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white border-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteElement(element.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </Draggable>
                ))}
                
                {/* Add element overlay when no elements */}
                {(!currentSlide?.elements || currentSlide.elements.length === 0) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white text-center opacity-50">
                      <Sparkles className="w-12 h-12 mx-auto mb-2" />
                      <p>Добавьте элементы</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar - Tools */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h3 className="font-medium mb-4">Инструменты</h3>
            
            {/* Add elements */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Добавить элементы</h4>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => addElement('text')}
                >
                  <Type className="w-4 h-4 mr-2" />
                  Текст
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => addElement('image')}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Фото
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => addElement('video')}
                >
                  <Video className="w-4 h-4 mr-2" />
                  Видео
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => addElement('poll')}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Опрос
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => addElement('ai-image')}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI фото
                </Button>
              </div>
            </div>

            {/* Element properties */}
            {selectedElement && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Свойства элемента</h4>
                
                {selectedElement.type === 'text' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="text-content" className="text-sm">Текст</Label>
                      <Textarea
                        id="text-content"
                        value={selectedElement.content.text || ''}
                        onChange={(e) => updateElement(selectedElement.id, {
                          content: { ...selectedElement.content, text: e.target.value }
                        })}
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="text-size" className="text-sm">Размер шрифта</Label>
                      <Slider
                        id="text-size"
                        min={12}
                        max={48}
                        step={2}
                        value={[selectedElement.content.fontSize || 24]}
                        onValueChange={(value) => updateElement(selectedElement.id, {
                          content: { ...selectedElement.content, fontSize: value[0] }
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="text-color" className="text-sm">Цвет текста</Label>
                      <Input
                        id="text-color"
                        type="color"
                        value={selectedElement.content.color || '#ffffff'}
                        onChange={(e) => updateElement(selectedElement.id, {
                          content: { ...selectedElement.content, color: e.target.value }
                        })}
                        className="mt-1 h-8"
                      />
                    </div>
                  </div>
                )}
                
                {selectedElement.type === 'image' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="image-url" className="text-sm">URL изображения</Label>
                      <Input
                        id="image-url"
                        value={selectedElement.content.url || ''}
                        onChange={(e) => updateElement(selectedElement.id, {
                          content: { ...selectedElement.content, url: e.target.value }
                        })}
                        placeholder="https://example.com/image.jpg"
                        className="mt-1"
                      />
                    </div>
                    <Button size="sm" variant="outline" className="w-full">
                      <Upload className="w-4 h-4 mr-2" />
                      Загрузить файл
                    </Button>
                  </div>
                )}
                
                {selectedElement.type === 'poll' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="poll-question" className="text-sm">Вопрос</Label>
                      <Input
                        id="poll-question"
                        value={selectedElement.content.question || ''}
                        onChange={(e) => updateElement(selectedElement.id, {
                          content: { ...selectedElement.content, question: e.target.value }
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Варианты ответов</Label>
                      {(selectedElement.content.options || []).map((option: string, index: number) => (
                        <Input
                          key={index}
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...(selectedElement.content.options || [])];
                            newOptions[index] = e.target.value;
                            updateElement(selectedElement.id, {
                              content: { ...selectedElement.content, options: newOptions }
                            });
                          }}
                          className="mt-1"
                          placeholder={`Вариант ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Slide settings */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Настройки слайда</h4>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="duration" className="text-sm">Длительность (сек)</Label>
                  <Slider
                    id="duration"
                    min={1}
                    max={15}
                    step={1}
                    value={[currentSlide?.duration || 5]}
                    onValueChange={(value) => updateSlide({ duration: value[0] })}
                    className="mt-1"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {currentSlide?.duration || 5} секунд
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="background-color" className="text-sm">Цвет фона</Label>
                  <Input
                    id="background-color"
                    type="color"
                    value={currentSlide?.background.value || '#6366f1'}
                    onChange={(e) => updateSlide({
                      background: { type: 'color', value: e.target.value }
                    })}
                    className="mt-1 h-10"
                  />
                </div>
                
                <div>
                  <Label htmlFor="background-image" className="text-sm">Фоновое изображение</Label>
                  <Input
                    id="background-image"
                    value={currentSlide?.background.type === 'image' ? currentSlide.background.value : ''}
                    onChange={(e) => updateSlide({
                      background: { type: 'image', value: e.target.value }
                    })}
                    placeholder="URL изображения"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
              disabled={currentSlideIndex <= 0}
            >
              ◀
            </Button>
            <span className="text-sm text-gray-600">
              Слайд {currentSlideIndex + 1} из {slides.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
              disabled={currentSlideIndex >= slides.length - 1}
            >
              ▶
            </Button>
          </div>
          
          <div className="text-sm text-gray-600">
            Длительность: {currentSlide?.duration || 5} сек
          </div>
        </div>
      </footer>

      {/* Element Dialog */}
      <ElementDialog
        isOpen={showElementDialog}
        onClose={() => {
          setShowElementDialog(false);
          setSelectedElement(null);
        }}
        element={selectedElement}
        onSave={(elementData) => {
          if (selectedElement) {
            updateElement(selectedElement.id, elementData);
          }
          setShowElementDialog(false);
          setSelectedElement(null);
        }}
      />
    </div>
  );
}