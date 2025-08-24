import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InstagramStoriesPreview } from '../InstagramStoriesPreview';
import { StoriesImageGenerator } from './StoriesImageGenerator';
import { StoryPublishButton } from './StoryPublishButton';
import { apiRequest } from '@/lib/queryClient';
import axios from 'axios';
import Draggable from 'react-draggable';


interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  textAlign: string;
  backgroundColor: string;
  rotation?: number;
}

interface StoryData {
  id?: string; // ID story из базы данных
  title: string;
  backgroundImageUrl: string | null;
  textOverlays: TextOverlay[];
  loading: boolean;
  error: string | null;
}

interface SimpleStoryEditorProps {
  storyId: string;
  campaignId: string;
}

const SimpleStoryEditor: React.FC<SimpleStoryEditorProps> = ({ 
  storyId, 
  campaignId 
}) => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();


  // Простое состояние без сложностей
  const [story, setStory] = useState<StoryData>({
    id: storyId, // Устанавливаем ID сразу
    title: '',
    backgroundImageUrl: null,
    textOverlays: [],
    loading: true,
    error: null
  });

  const [isLoaded, setIsLoaded] = useState(false);

  // Загрузка данных ОДИН РАЗ при инициализации
  useEffect(() => {
    if (!storyId || isLoaded) return;

    const loadStory = async () => {
      try {
        setStory(prev => ({ ...prev, loading: true }));
        
        const response = await apiRequest(`/api/stories/simple/${storyId}`);
        const storyData = response.data || response;
        
        let textOverlays = [];
        if (storyData.metadata) {
          try {
            const metadata = typeof storyData.metadata === 'string' 
              ? JSON.parse(storyData.metadata) 
              : storyData.metadata;
            // Убеждаемся что у всех элементов есть поле rotation
            textOverlays = (metadata.textOverlays || []).map((overlay: any) => ({
              ...overlay,
              rotation: overlay.rotation !== undefined ? overlay.rotation : 0
            }));
          } catch (e) {
            console.error('Ошибка парсинга метаданных:', e);
          }
        }

        setStory({
          id: storyData.id, // ВАЖНО: сохраняем ID из базы
          title: storyData.title || '',
          backgroundImageUrl: storyData.image_url || null,
          textOverlays,
          loading: false,
          error: null
        });

        setIsLoaded(true);
        
      } catch (error) {
        console.error('Ошибка загрузки Story:', error);
        setStory(prev => ({
          ...prev,
          loading: false,
          error: 'Ошибка загрузки Story'
        }));
      }
    };

    loadStory();
  }, [storyId]);

  // Загрузка изображения
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Ошибка",
        description: "Можно загружать только изображения",
        variant: "destructive"
      });
      return;
    }

    setStory(prev => ({ ...prev, loading: true }));

    try {
      const formData = new FormData();
      formData.append('image', file);

      console.log('Загружаем изображение на Imgbb...');
      const response = await axios.post('/api/imgur/upload-file', formData);

      if (response.data?.url) {
        // Обновляем состояние И сохраняем в БД
        setStory(prev => ({
          ...prev,
          backgroundImageUrl: response.data.url,
          loading: false
        }));

        // Сохраняем в БД
        await apiRequest(`/api/stories/simple/${storyId}`, {
          method: 'PUT',
          data: { image_url: response.data.url }
        });

        toast({
          title: "Изображение загружено",
          description: "Изображение успешно сохранено"
        });

        console.log('Изображение загружено и сохранено:', response.data.url);
      }
    } catch (error) {
      console.error('Ошибка загрузки изображения:', error);
      setStory(prev => ({
        ...prev,
        loading: false,
        error: 'Ошибка загрузки изображения'
      }));
      
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить изображение",
        variant: "destructive"
      });
    }
  };

  // Добавление текста
  const addTextOverlay = () => {
    const newOverlay: TextOverlay = {
      id: `text_${Date.now()}`,
      text: 'Новый текст',
      x: 50,
      y: 50,
      fontSize: 24,
      color: '#ffffff',
      fontFamily: 'Arial',
      fontWeight: 'bold',
      textAlign: 'center',
      backgroundColor: 'transparent',
      rotation: 0
    };

    setStory(prev => ({
      ...prev,
      textOverlays: [...prev.textOverlays, newOverlay]
    }));
  };

  // Обновление текста
  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setStory(prev => ({
      ...prev,
      textOverlays: prev.textOverlays.map(overlay =>
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    }));
  };

  // Удаление текста
  const removeTextOverlay = (id: string) => {
    setStory(prev => ({
      ...prev,
      textOverlays: prev.textOverlays.filter(overlay => overlay.id !== id)
    }));
  };

  // Сохранение Story
  const [saveInProgress, setSaveInProgress] = useState(false);
  
  const handleSave = async () => {
    if (saveInProgress) return; // Предотвращаем множественные вызовы
    
    try {
      setSaveInProgress(true);

      const metadata = {
        textOverlays: story.textOverlays,
        type: 'instagram',
        format: '9:16',
        version: '1.0'
      };

      await apiRequest(`/api/stories/simple/${storyId}`, {
        method: 'PUT',
        data: {
          title: story.title,
          image_url: story.backgroundImageUrl,
          metadata: JSON.stringify(metadata)
        }
      });

      toast({
        title: "Сохранено",
        description: "Story успешно сохранена"
      });


    } catch (error) {
      console.error('Ошибка сохранения:', error);

      toast({
        title: "Ошибка",
        description: "Не удалось сохранить Story",
        variant: "destructive"
      });
    }
    
    // Задержка перед разблокировкой для предотвращения спама
    setTimeout(() => {
      setSaveInProgress(false);
    }, 1000);
  };

  // Возврат к списку
  const goBack = () => {
    setLocation(`/content`);
  };

  if (story.loading && !isLoaded) {
    return (
      <div className="p-6">
        <div className="text-center">Загрузка Story...</div>
      </div>
    );
  }

  // Обработчик перетаскивания текста в превью
  const handleDrag = (overlayId: string, e: any, data: any) => {
    updateTextOverlay(overlayId, {
      x: Math.max(-50, Math.min(350, data.x / 0.8)), // Максимально расширяем границы
      y: Math.max(-50, Math.min(600, data.y / 0.8))  // Позволяем перетаскивать за пределы
    });
  };

  if (story.error) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">{story.error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          <h1 className="text-2xl font-bold">Редактор Stories</h1>
        </div>
        <Button onClick={handleSave} disabled={saveInProgress}>
          <Save className="w-4 h-4 mr-2" />
          Сохранить
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Редактор */}
        <div className="space-y-6">
          {/* Название */}
          <Card>
            <CardHeader>
              <CardTitle>Основные настройки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Название Story
                </label>
                <Input
                  value={story.title}
                  onChange={(e) => setStory(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Введите название"
                />
              </div>

              {/* URL изображения как редактируемое поле */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  URL изображения
                </label>
                <Input
                  type="url"
                  value={story.backgroundImageUrl || ''}
                  onChange={(e) => setStory(prev => ({ ...prev, backgroundImageUrl: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                  className="text-sm"
                />
              </div>

              {/* Загрузка изображения */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Загрузить изображение
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Нажмите для загрузки изображения
                    </p>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Текстовые слои */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Текстовые слои
                <Button size="sm" onClick={addTextOverlay}>
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить текст
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {story.textOverlays.map((overlay) => (
                <div key={overlay.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Текст {overlay.id}</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeTextOverlay(overlay.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <Textarea
                    value={overlay.text}
                    onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
                    placeholder="Введите текст"
                    rows={2}
                  />
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Размер шрифта</label>
                      <Input
                        type="range"
                        min="12"
                        max="72"
                        value={overlay.fontSize}
                        onChange={(e) => updateTextOverlay(overlay.id, { fontSize: Number(e.target.value) })}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-500 text-center">{overlay.fontSize}px</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Цвет текста</label>
                      <div className="flex items-center space-x-1">
                        <input
                          type="color"
                          value={overlay.color}
                          onChange={(e) => updateTextOverlay(overlay.id, { color: e.target.value })}
                          className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                        />
                        <div className="text-xs text-gray-500">{overlay.color}</div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Цвет фона</label>
                      <div className="flex items-center space-x-1">
                        <input
                          type="color"
                          value={overlay.backgroundColor === 'transparent' ? '#ffffff' : overlay.backgroundColor || '#ffffff'}
                          onChange={(e) => updateTextOverlay(overlay.id, { backgroundColor: e.target.value })}
                          className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                        />
                        <Button
                          size="sm"
                          variant={overlay.backgroundColor === 'transparent' ? 'default' : 'outline'}
                          onClick={() => updateTextOverlay(overlay.id, { backgroundColor: 'transparent' })}
                          className="text-xs px-2 py-1 h-6"
                        >
                          Прозрачный
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Шрифт</label>
                      <select 
                        value={overlay.fontFamily}
                        onChange={(e) => updateTextOverlay(overlay.id, { fontFamily: e.target.value })}
                        className="w-full p-1 text-xs border rounded"
                      >
                        <option value="Arial">Arial</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Open Sans">Open Sans</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Impact">Impact</option>
                        <option value="Comic Sans MS">Comic Sans MS</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Поворот: {overlay.rotation || 0}°</label>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={overlay.rotation || 0}
                        onChange={(e) => {
                          const newRotation = parseInt(e.target.value);
                          console.log('Устанавливаем поворот:', newRotation, 'для элемента:', overlay.id);
                          // Форсируем обновление
                          updateTextOverlay(overlay.id, { rotation: newRotation });
                          // Принудительное обновление стиля
                          setTimeout(() => {
                            const element = document.querySelector(`[data-overlay-id="${overlay.id}"]`);
                            if (element) {
                              (element as HTMLElement).style.transform = `rotate(${newRotation}deg)`;
                              (element as HTMLElement).style.transformOrigin = 'center center';
                            }
                          }, 10);
                        }}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              {story.textOverlays.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  Нет текстовых слоев. Нажмите "Добавить текст" для создания.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Превью */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Превью</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <div className="relative">
                {/* Фоновое изображение Stories */}
                <div 
                  className="w-[280px] h-[497px] rounded-lg overflow-hidden bg-gray-900 relative"
                  style={{
                    backgroundImage: story.backgroundImageUrl ? `url(${story.backgroundImageUrl})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  {/* Перетаскиваемые текстовые элементы */}
                  {story.textOverlays.map((overlay) => (
                    <Draggable
                      key={overlay.id}
                      position={{ x: overlay.x * 0.8, y: overlay.y * 0.8 }} // Масштабируем для превью
                      onDrag={(e, data) => handleDrag(overlay.id, e, data)}
                      bounds={{left: -50, top: -50, right: 320, bottom: 550}} // Максимально расширяем границы
                      enableUserSelectHack={false}
                    >
                      <div className="absolute">
                        <div
                          className="cursor-move border border-dashed border-blue-400 bg-blue-50 bg-opacity-20 p-1 rounded select-none"
                          data-overlay-id={overlay.id}
                          style={{
                            fontSize: (overlay.fontSize * 0.8) + 'px',
                            color: overlay.color,
                            fontFamily: overlay.fontFamily,
                            fontWeight: overlay.fontWeight,
                            textAlign: overlay.textAlign as any,
                            backgroundColor: overlay.backgroundColor === 'transparent' ? 'transparent' : overlay.backgroundColor,
                            minWidth: '40px',
                            minHeight: '16px',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                            transform: `rotate(${overlay.rotation || 0}deg)`,
                            transformOrigin: 'center center',
                            display: 'inline-block'
                          }}
                        >
                          {overlay.text || 'Текст'}
                        </div>
                      </div>
                    </Draggable>
                  ))}
                  

                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Генератор изображений */}
          <Card>
            <CardHeader>
              <CardTitle>Генератор изображений</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <StoriesImageGenerator story={story} />
                
                {/* Кнопка публикации с автоматической генерацией */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">Публикация:</h4>
                  <StoryPublishButton 
                    story={story} 
                    contentId={storyId}
                    platforms={['instagram']}
                    disabled={!story.textOverlays?.length}
                  />
                  {!story.textOverlays?.length && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Добавьте текст для публикации
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SimpleStoryEditor;