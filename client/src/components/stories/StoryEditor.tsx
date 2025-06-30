import React, { useEffect, useCallback, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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
import { useStoryStore } from '@/lib/storyStore';
import { useCampaignStore } from '@/lib/campaignStore';
import { useLocation, useParams } from 'wouter';

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

export default function StoryEditor({ campaignId: propCampaignId, storyId: propStoryId }: StoryEditorProps) {
  // Уменьшен уровень логирования для снижения спама в консоли
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { storyId } = useParams();
  const [location, setLocation] = useLocation();
  
  // Функция navigate для wouter
  const navigate = (path: string) => setLocation(path);
  const selectedCampaign = useCampaignStore(state => state.selectedCampaign);
  const campaignIdFromStore = selectedCampaign?.id;
  
  // Используем параметры из пропсов или из URL/store
  const finalCampaignId = propCampaignId || campaignIdFromStore || "46868c44-c6a4-4bed-accf-9ad07bba790e";
  const finalStoryId = propStoryId || storyId;
  
  // Проверяем, является ли это созданием новой Stories
  const isNewStory = location.includes('/new') || location === '/stories';
  
  // Используем глобальный store вместо локального состояния
  const {
    slides,
    currentSlideIndex,
    storyTitle,
    selectedElement,
    initializeSlides,
    resetStore,
    setSlides,
    setCurrentSlideIndex,
    setStoryTitle,
    setSelectedElement,
    addElement: storeAddElement,
    updateElement,
    deleteElement,
    addSlide: storeAddSlide,
    deleteSlide: storeDeleteSlide,
    updateSlide
  } = useStoryStore();
  
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [showElementDialog, setShowElementDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Убираем проверку параметра clear - просто очищаем localStorage для новых Stories
  
  // Флаг для предотвращения повторных загрузок - используем useRef для стабильности
  const isLoadedRef = useRef(false);
  // Используем useRef для стабильного хранения currentStoryId ИЗ URL
  const currentStoryIdRef = useRef<string | null>(null);
  
  // Ключ для localStorage
  const localStorageKey = finalStoryId ? `story-${finalStoryId}` : 'new-story';

  // Инициализация и очистка для Stories - исправлена логика
  useEffect(() => {
    console.log('StoryEditor useEffect triggered:', { 
      storyId: finalStoryId, 
      isNewStory,
      slidesLength: slides.length,
      hasSlides: slides.length > 0 
    });
    
    // КРИТИЧЕСКИ ВАЖНО: очищаем store ТОЛЬКО для новых Stories (без ID)
    if (isNewStory && !finalStoryId && !storyId) {
      console.log('Creating NEW story - ПОЛНАЯ ОЧИСТКА И ИНИЦИАЛИЗАЦИЯ');
      
      // 1. Полная очистка всех данных Stories из store
      resetStore();
      
      // 2. Дополнительная очистка всех localStorage ключей
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('story-') || key.includes('story') || key === 'new-story') {
          localStorage.removeItem(key);
          console.log('Removed localStorage key:', key);
        }
      });
      
      // 3. Принудительная очистка persist storage
      localStorage.removeItem('story-store');
      
      // 4. Проверяем, что у нас есть слайды после resetStore
      setTimeout(() => {
        console.log('Проверка слайдов после resetStore:', slides.length);
        if (slides.length === 0) {
          console.log('Принудительно создаем начальный слайд');
          initializeSlides();
        }
      }, 100);
      
      console.log('✅ Новая Stories полностью очищена и инициализирована');
      return;
    }
    
    // Создаем глобальный ключ для отслеживания загрузки по всем инстансам компонента
    const globalLoadKey = `storyLoaded_${finalStoryId}`;
    let isGloballyLoaded = localStorage.getItem(globalLoadKey) === 'true';
    
    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: если данные помечены как загруженные, но слайдов нет - сбрасываем флаги
    if (isGloballyLoaded && slides.length === 0 && finalStoryId) {
      console.log('🚨 ИСПРАВЛЕНИЕ: данные помечены как загруженные, но слайдов нет - сбрасываем флаги');
      localStorage.removeItem(globalLoadKey);
      isGloballyLoaded = false;
    }
    
    // Проверка переключения Stories через localStorage (для случаев размонтирования компонента)
    const lastStoryId = localStorage.getItem('lastStoryId');
    
    // Инициализация currentStoryIdRef при первом запуске
    if (finalStoryId && currentStoryIdRef.current === null) {
      // Проверяем, это действительно первая инициализация или переключение Stories
      if (lastStoryId && lastStoryId !== finalStoryId) {
        console.log('🔄 ПЕРЕКЛЮЧЕНИЕ Stories после размонтирования:', lastStoryId, '->', finalStoryId);
        // Это переключение Stories - нужно сбросить данные для новой Stories
        const newGlobalLoadKey = `storyLoaded_${finalStoryId}`;
        let newIsGloballyLoaded = localStorage.getItem(newGlobalLoadKey) === 'true';
        
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: проверяем валидность флага для новой Stories
        if (newIsGloballyLoaded && slides.length === 0) {
          console.log('🚨 ИСПРАВЛЕНИЕ при переключении Stories: данные помечены как загруженные, но слайдов нет - сбрасываем флаги');
          localStorage.removeItem(newGlobalLoadKey);
          newIsGloballyLoaded = false;
        }
        
        currentStoryIdRef.current = finalStoryId;
        localStorage.setItem('lastStoryId', finalStoryId);
        isLoadedRef.current = newIsGloballyLoaded;
        if (!newIsGloballyLoaded) {
          resetStore(); // Очищаем Store для новой Stories
        }
      } else {
        console.log('🔧 Первая инициализация currentStoryIdRef для Stories:', finalStoryId);
        currentStoryIdRef.current = finalStoryId;
        localStorage.setItem('lastStoryId', finalStoryId);
        isLoadedRef.current = isGloballyLoaded; // Устанавливаем флаг исходя из исправленного глобального состояния
      }
    }
    
    // Проверка на РЕАЛЬНОЕ изменение Stories ID в URL
    if (finalStoryId && currentStoryIdRef.current !== null && currentStoryIdRef.current !== finalStoryId) {
      console.log('🔄 РЕАЛЬНОЕ изменение Stories ID:', currentStoryIdRef.current, '->', finalStoryId);
      currentStoryIdRef.current = finalStoryId;
      const newGlobalLoadKey = `storyLoaded_${finalStoryId}`;
      let newIsGloballyLoaded = localStorage.getItem(newGlobalLoadKey) === 'true';
      
      // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: проверяем валидность флага для новой Stories тоже
      if (newIsGloballyLoaded && slides.length === 0) {
        console.log('🚨 ИСПРАВЛЕНИЕ для новой Stories: данные помечены как загруженные, но слайдов нет - сбрасываем флаги');
        localStorage.removeItem(newGlobalLoadKey);
        newIsGloballyLoaded = false;
      }
      
      isLoadedRef.current = newIsGloballyLoaded; // Устанавливаем исправленный флаг для новой Stories
      if (!newIsGloballyLoaded) {
        resetStore(); // Очищаем Store только если данные для новой Stories не загружены
      }
    }

    // Загрузка данных ТОЛЬКО если НЕ загружено глобально
    console.log('🔍 Проверка загрузки для Stories:', { 
      finalStoryId, 
      isLoadedRefCurrent: isLoadedRef.current, 
      isGloballyLoaded, 
      globalLoadKey,
      shouldLoad: finalStoryId && !isLoadedRef.current && !isGloballyLoaded 
    });
    
    if (finalStoryId && !isLoadedRef.current && !isGloballyLoaded) {
      console.log('🔄 Загрузка данных для Stories ID:', finalStoryId, 'isLoadedRef.current:', isLoadedRef.current, 'currentStoryIdRef.current:', currentStoryIdRef.current);
      
      apiRequest(`/api/campaign-content/${finalStoryId}`)
      .then(data => {
        if (data && data.data) {
          const content = data.data;
          console.log('📥 Загружены данные контента:', content);
          setStoryTitle(content.title || 'Новая история');
          
          // Загружаем слайды из базы данных только при первой загрузке
          if (content.metadata && content.metadata.slides && content.metadata.slides.length > 0) {
            console.log('📋 Найдены слайды в метаданных:', content.metadata.slides.length, 'загружаем в Store...');
            
            const storySlides = content.metadata.slides.map((slide: any, index: number) => ({
              id: slide.id || `slide-${index}`,
              order: slide.order || index,
              duration: slide.duration || 5,
              background: slide.background || { type: 'color', value: '#6366f1' },
              elements: slide.elements || []
            }));
            
            // Загружаем данные в Store
            setSlides(storySlides);
            setCurrentSlideIndex(0);
            console.log('✅ Загружены слайды:', storySlides.length, 'Элементов в первом слайде:', storySlides[0]?.elements?.length || 0);
          } else {
            console.log('📝 Слайды не найдены в метаданных, создаем дефолтный слайд');
            initializeSlides();
          }
          isLoadedRef.current = true;
          localStorage.setItem(globalLoadKey, 'true'); // Устанавливаем глобальный флаг загрузки
        }
      })
      .catch(error => {
        console.error('❌ Ошибка загрузки Stories:', error);
        toast({
          title: 'Ошибка загрузки',
          description: 'Не удалось загрузить историю',
          variant: 'destructive'
        });
      });
    } else {
      // Новая Stories - инициализируем пустые слайды
      console.log('📝 Новая Stories - инициализация дефолтного слайда');
      initializeSlides();
    }

    // Фолбэк: если через 1 секунду слайдов все еще нет, создаем один по умолчанию
    // ТОЛЬКО для новых Stories, НЕ для существующих 
    const fallbackTimer = setTimeout(() => {
      if (slides.length === 0 && !isNewStory && !finalStoryId) {
        console.log('⚠️ FALLBACK: No slides found after timeout, creating default slide');
        initializeSlides();
      }
    }, 1000);

    return () => clearTimeout(fallbackTimer);
  }, [finalStoryId, isNewStory, localStorageKey, resetStore, setSlides, setCurrentSlideIndex, setStoryTitle, toast, initializeSlides]);

  // НЕ очищаем состояние при размонтировании - только сохраняем в localStorage
  useEffect(() => {
    return () => {
      console.log('🧹 StoryEditor unmounting - БЕЗ очистки состояния');
      // НЕ сбрасываем флаги - пусть остаются для следующего монтирования
      // localStorage уже сохранен, этого достаточно
    };
  }, []);

  // Отслеживание изменений slides из store и обновление selectedElement  
  useEffect(() => {
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;
    
    const elementsCount = currentSlide.elements?.length || 0;
    console.log(`Slide ${currentSlideIndex} has ${elementsCount} elements`);
    
    // Обновляем selectedElement если он изменился в store
    if (selectedElement) {
      const updatedElement = currentSlide.elements?.find(el => el.id === selectedElement.id);
      if (updatedElement && JSON.stringify(updatedElement) !== JSON.stringify(selectedElement)) {
        setSelectedElement(updatedElement);
      } else if (!updatedElement) {
        // Если выбранный элемент исчез из слайда, сбрасываем выделение
        console.log(`Selected element ${selectedElement.id} not found in current slide, clearing selection`);
        setSelectedElement(null);
      }
    }
  }, [slides, currentSlideIndex, selectedElement, setSelectedElement]);

  // Функция сохранения истории
  const saveStory = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          title: storyTitle,
          slides: slides,
          campaignId: null
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Обновляем ref - store не содержит storyId
        currentStoryIdRef.current = result.data.id;
        toast({
          title: "История сохранена!",
          description: `История "${storyTitle}" успешно сохранена в базу данных.`,
        });
      } else {
        throw new Error(result.error || 'Ошибка сохранения');
      }
    } catch (error) {
      console.error('Ошибка сохранения истории:', error);
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить историю. Попробуйте еще раз.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Функция обновления истории
  const updateStory = async () => {
    if (!storyId) return saveStory();
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/stories/story/${storyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          title: storyTitle,
          slides: slides
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "История обновлена!",
          description: `Изменения в истории "${storyTitle}" сохранены.`,
        });
      } else {
        throw new Error(result.error || 'Ошибка обновления');
      }
    } catch (error) {
      console.error('Ошибка обновления истории:', error);
      toast({
        title: "Ошибка обновления",
        description: "Не удалось обновить историю. Попробуйте еще раз.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };



  // Обертки для store actions
  const addSlide = storeAddSlide;
  const deleteSlide = storeDeleteSlide;

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

  const addElement = useCallback((elementType: StoryElement['type']) => {
    console.log('🔧 Adding element type:', elementType, 'to slide:', currentSlideIndex);
    console.log('Current slides count:', slides.length);
    console.log('Current slide exists:', !!slides[currentSlideIndex]);
    
    if (!slides[currentSlideIndex]) {
      console.error('No slide available at index:', currentSlideIndex);
      toast({
        title: 'Ошибка',
        description: 'Слайд не найден. Попробуйте обновить страницу.',
        variant: 'destructive'
      });
      return;
    }
    
    const newElement = storeAddElement(elementType);
    
    if (newElement) {
      // Принудительно обновляем локальное состояние
      const updatedStoreSlides = useStoryStore.getState().slides;
      console.log('🔄 Force updating slides after element add:', updatedStoreSlides.length);
      setSlides([...updatedStoreSlides]);
      
      // Сохраняем в localStorage
      const dataToSave = { slides: updatedStoreSlides, title: storyTitle };
      localStorage.setItem(localStorageKey, JSON.stringify(dataToSave));
      
      toast({
        title: 'Элемент добавлен',
        description: `${getElementTypeName(elementType)} добавлен на слайд ${currentSlideIndex + 1}`
      });
    } else {
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить элемент',
        variant: 'destructive'
      });
    }
  }, [currentSlideIndex, slides, storeAddElement, toast]);

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

  const handleDeleteElement = (elementId: string) => {
    deleteElement(elementId);
    
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
        campaign_id: finalCampaignId, // ПЕРВЫМ ПОЛЕМ - обязательно!
        title: storyTitle || 'Новая история',
        content_type: 'story',
        status: 'draft',
        content: storyTitle || 'Instagram Stories',
        metadata: {
          title: storyTitle || 'Новая история',
          slides: slides.map(slide => ({
            id: slide.id,
            order: slide.order,
            duration: slide.duration,
            background: slide.background,
            elements: slide.elements.map(element => ({
              id: element.id,
              type: element.type,
              content: element.content,
              position: element.position,
              rotation: element.rotation,
              zIndex: element.zIndex,
              style: element.style
            }))
          }))
        }
      };

      // Определяем метод и URL в зависимости от того, редактируем или создаем
      const isEdit = !!storyId;
      const url = isEdit ? `/api/campaign-content/${storyId}` : '/api/campaign-content';
      const method = isEdit ? 'PATCH' : 'POST';

      console.log(`${isEdit ? 'Обновление' : 'Создание'} Stories с ${slides.length} слайдами`);
      console.log('🌐 Отправляем запрос:', { url, method, storyData });

      // Используем apiRequest для автоматического обновления токена
      const result = await apiRequest(url, {
        method: method,
        data: storyData  // ИСПРАВЛЕНО: используем data вместо body
      });
      
      console.log('✅ Ответ от сервера:', result);
      
      const actualSlidesCount = slides?.length || 0;
      toast({
        title: isEdit ? 'Обновлено' : 'Создано',
        description: `История "${storyTitle}" ${isEdit ? 'обновлена' : 'создана'} с ${actualSlidesCount} слайдами`
      });
      
      console.log('Stories успешно сохранена');
      
      // Инвалидируем кэш для обновления списка контента
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-content'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-content'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaign-content/${storyId}`] });
      
      // Принудительно перезагружаем все данные контента
      await queryClient.refetchQueries({ queryKey: ['/api/campaign-content'] });
      
      // После успешного сохранения, если это было создание, переходим в режим редактирования
      if (!isEdit && result.data && result.data.id) {
        navigate(`/stories/${result.data.id}/edit`);
      }
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
    // Плавная навигация без перезагрузки страницы - всегда возвращаемся на /content
    navigate('/content');
  };

  // Current slide data - СИНХРОНИЗИРУЕМ с storyStore
  const storeSlides = useStoryStore(state => state.slides);
  const currentSlide = storeSlides[currentSlideIndex] || slides[currentSlideIndex];
  
  // Принудительно отслеживаем элементы
  const elementsCount = currentSlide?.elements?.length || 0;
  
  // Синхронизация локального состояния со store и сохранение в localStorage
  useEffect(() => {
    if (storeSlides.length > 0 && storeSlides !== slides) {
      console.log('🔄 Syncing slides from store:', storeSlides.length, 'slides');
      setSlides(storeSlides);
      
      // Сохраняем в localStorage
      const dataToSave = { slides: storeSlides, title: storyTitle };
      localStorage.setItem(localStorageKey, JSON.stringify(dataToSave));
    }
  }, [storeSlides, slides, storyTitle, localStorageKey, setSlides]);
  
  // Сохранение в localStorage при изменении slides
  useEffect(() => {
    if (slides.length > 0) {
      const dataToSave = { slides, title: storyTitle };
      localStorage.setItem(localStorageKey, JSON.stringify(dataToSave));
      console.log('💾 Saved to localStorage:', slides.length, 'slides');
    }
  }, [slides, storyTitle, localStorageKey]);

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
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Сохранение...' : (storyId ? 'Обновить' : 'Сохранить')}
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
                          className="px-2 py-1 border-2 border-transparent group-hover:border-white/50 rounded cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('🔤 Text element clicked, selecting:', element.id);
                            setSelectedElement(element);
                          }}
                          title="Кликните для выбора и редактирования в панели"
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
                          handleDeleteElement(element.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </Draggable>
                ))}
                
                {/* Debug info */}
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
                  Elements: {elementsCount}
                </div>
                
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
                        onChange={(e) => {
                          console.log('🔤 Text changing to:', e.target.value);
                          const newContent = { ...selectedElement.content, text: e.target.value };
                          
                          // Сначала обновляем локальный selectedElement
                          setSelectedElement({
                            ...selectedElement,
                            content: newContent
                          });
                          
                          // Затем обновляем в store
                          updateElement(selectedElement.id, {
                            content: newContent
                          });
                        }}
                        onFocus={(e) => {
                          // Выделяем весь текст при фокусе, если это дефолтный текст
                          if (e.target.value === 'Новый текст') {
                            e.target.select();
                          }
                        }}
                        className="mt-1"
                        rows={3}
                        placeholder="Введите текст..."
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
                        onValueChange={(value) => {
                          console.log('📏 Font size changing to:', value[0]);
                          const newContent = { ...selectedElement.content, fontSize: value[0] };
                          
                          setSelectedElement({
                            ...selectedElement,
                            content: newContent
                          });
                          
                          updateElement(selectedElement.id, {
                            content: newContent
                          });
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="text-color" className="text-sm">Цвет текста</Label>
                      <Input
                        id="text-color"
                        type="color"
                        value={selectedElement.content.color || '#ffffff'}
                        onChange={(e) => {
                          console.log('🎨 Color changing to:', e.target.value);
                          const newContent = { ...selectedElement.content, color: e.target.value };
                          
                          setSelectedElement({
                            ...selectedElement,
                            content: newContent
                          });
                          
                          updateElement(selectedElement.id, {
                            content: newContent
                          });
                        }}
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
                        onFocus={(e) => {
                          // Выделяем весь текст при фокусе, если это дефолтный вопрос
                          if (e.target.value === 'Ваш вопрос?' || e.target.value === 'Вопрос викторины?') {
                            e.target.select();
                          }
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm">Варианты ответов</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const currentOptions = selectedElement.content.options || ['Вариант 1', 'Вариант 2'];
                            const newOptions = [...currentOptions, `Вариант ${currentOptions.length + 1}`];
                            updateElement(selectedElement.id, {
                              content: { ...selectedElement.content, options: newOptions }
                            });
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Добавить
                        </Button>
                      </div>
                      {(selectedElement.content.options || ['Вариант 1', 'Вариант 2']).map((option: string, index: number) => (
                        <div key={index} className="flex gap-2 mt-1">
                          <Input
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...(selectedElement.content.options || [])];
                              newOptions[index] = e.target.value;
                              updateElement(selectedElement.id, {
                                content: { ...selectedElement.content, options: newOptions }
                              });
                            }}
                            onFocus={(e) => {
                              // Выделяем весь текст при фокусе, если это дефолтный вариант
                              if (option.startsWith('Вариант ')) {
                                e.target.select();
                              }
                            }}
                            placeholder={`Вариант ${index + 1}`}
                            className="flex-1"
                          />
                          {(selectedElement.content.options || []).length > 2 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const newOptions = (selectedElement.content.options || []).filter((_, i) => i !== index);
                                updateElement(selectedElement.id, {
                                  content: { ...selectedElement.content, options: newOptions }
                                });
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
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