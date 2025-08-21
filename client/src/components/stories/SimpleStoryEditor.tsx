import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Type, Move, Save, ArrowLeft, Download, Palette, AlertCircle, Smartphone, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import Draggable from 'react-draggable';
import axios from 'axios';
import { z } from 'zod';

// Типы согласно ТЗ
type StoryState = 'idle' | 'loading' | 'saving' | 'error';

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right';
  backgroundColor: string;
  padding: number;
  borderRadius: number;
}

interface AdditionalImage {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SimpleStoryData {
  // Фоновое изображение - отдельное поле
  backgroundImageUrl: string | null; // из поля image_url
  
  // Данные Stories - хранится в metadata
  textOverlays: TextOverlay[];
  additionalImages: AdditionalImage[];
  
  // Метаданные
  title: string;
  campaignId: string;
  storyId?: string;
  
  // Улучшенное управление состоянием
  state: StoryState;
  hasUnsavedChanges: boolean;
  error: string | null;
  validationErrors: Record<string, string>;
}

// Zod схемы для валидации согласно ТЗ
const TextOverlaySchema = z.object({
  id: z.string(),
  text: z.string().min(1, "Текст не может быть пустым"),
  x: z.number().min(0).max(1080),
  y: z.number().min(0).max(1920),
  fontSize: z.number().min(8).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Неверный формат цвета"),
  fontFamily: z.string(),
  fontWeight: z.string(),
  textAlign: z.enum(['left', 'center', 'right']),
  backgroundColor: z.string(),
  padding: z.number().min(0).max(50),
  borderRadius: z.number().min(0).max(50),
});

const StoryMetadataSchema = z.object({
  textOverlays: z.array(TextOverlaySchema),
  additionalImages: z.array(z.object({
    id: z.string(),
    url: z.string().url("Неверный URL изображения"),
    x: z.number().min(0).max(1080),
    y: z.number().min(0).max(1920),
    width: z.number().min(10).max(500),
    height: z.number().min(10).max(500),
  })),
  storyType: z.enum(['instagram', 'facebook', 'vk']),
  format: z.string(),
  version: z.string(),
});

// Утилиты согласно ТЗ
const isValidImageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
};

const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Логгер согласно ТЗ
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] [Stories] ${message}`, data),
  error: (message: string, error?: any) => console.error(`[ERROR] [Stories] ${message}`, error),
  debug: (message: string, data?: any) => console.debug(`[DEBUG] [Stories] ${message}`, data)
};

interface SimpleStoryEditorProps {
  campaignId: string;
  storyId?: string;
  onBack: () => void;
}

// Создание новой Story
const createNewStory = async (campaignId: string, title: string = 'Новая Stories') => {
  return apiRequest('/api/stories/simple', {
    method: 'POST',
    data: { campaignId, title }
  });
};

export default function SimpleStoryEditor({ campaignId, storyId, onBack }: SimpleStoryEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const [actualStoryId, setActualStoryId] = useState<string | undefined>(storyId);

  // Функция для правильного возврата назад
  const handleBackNavigation = useCallback(() => {
    // Если есть storyId (редактирование) или actualStoryId (новая Stories уже создана), 
    // возвращаемся к списку контента
    if (storyId || actualStoryId) {
      setLocation(`/content?campaignId=${campaignId}`);
    } else {
      // Если нет никакого ID, возвращаемся к селектору режимов
      onBack();
    }
  }, [storyId, actualStoryId, campaignId, setLocation, onBack]);

  // Инициализация состояния согласно ТЗ
  const [storyData, setStoryData] = useState<SimpleStoryData>({
    backgroundImageUrl: null,
    textOverlays: [{
      id: 'text1',
      text: 'Добавьте ваш текст',
      x: 100,
      y: 200,
      fontSize: 32,
      color: '#ffffff',
      fontFamily: 'Arial',
      fontWeight: 'bold',
      textAlign: 'center',
      backgroundColor: '#000000',
      padding: 10,
      borderRadius: 8
    }],
    additionalImages: [],
    title: 'Новая Stories',
    campaignId,
    storyId: actualStoryId,
    state: 'idle',
    hasUnsavedChanges: false,
    error: null,
    validationErrors: {}
  });

  // Создание новой Story если storyId не передан
  useEffect(() => {
    if (!storyId && !actualStoryId) {
      const createStory = async () => {
        try {
          setStoryData(prev => ({ ...prev, state: 'loading' }));
          logger.info('Creating new story for campaign', { campaignId });
          
          const response = await createNewStory(campaignId, 'Новая Stories');
          const newStory = response.data;
          
          setActualStoryId(newStory.id);
          setStoryData(prev => ({
            ...prev,
            storyId: newStory.id,
            title: newStory.title,
            state: 'idle'
          }));
          
          logger.info('New story created', { storyId: newStory.id });
          
        } catch (error: any) {
          logger.error('Failed to create new story', error);
          setStoryData(prev => ({
            ...prev,
            state: 'error',
            error: error?.message || 'Ошибка создания истории'
          }));
        }
      };
      
      createStory();
    }
  }, [campaignId, storyId, actualStoryId]);

  // Загрузка существующей Story согласно ТЗ
  const { data: existingStory } = useQuery({
    queryKey: ['story', actualStoryId],
    queryFn: () => actualStoryId ? apiRequest(`/api/stories/simple/${actualStoryId}`) : null,
    enabled: !!actualStoryId,
  });

  useEffect(() => {
    if (existingStory?.data) {
      const story = existingStory.data;
      let metadata = {};
      try {
        if (story.metadata) {
          // Если metadata уже объект, используем как есть
          if (typeof story.metadata === 'object') {
            metadata = story.metadata;
          } else if (typeof story.metadata === 'string') {
            metadata = JSON.parse(story.metadata);
          }
        }
      } catch (e) {
        console.error('[ERROR] [Stories] Failed to parse metadata:', e);
        metadata = {};
      }
      
      logger.info('Loading story', { storyId: actualStoryId, title: story.title });
      logger.debug('Background image from image_url', story.image_url);
      
      setStoryData(prev => ({
        ...prev,
        title: story.title || 'Без названия',
        backgroundImageUrl: story.image_url || null, // из отдельного поля
        textOverlays: (metadata as any)?.textOverlays || prev.textOverlays,
        additionalImages: (metadata as any)?.additionalImages || [],
        hasUnsavedChanges: false
      }));
    }
  }, [existingStory?.data?.id, actualStoryId]);

  // Восстановление из localStorage при загрузке согласно ТЗ
  useEffect(() => {
    if (actualStoryId) {
      const saved = localStorage.getItem(`story-draft-${actualStoryId}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          // Проверяем что данные не старше 24 часов и автоматически восстанавливаем
          if (data.timestamp && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
            setStoryData(prev => ({
              ...prev,
              backgroundImageUrl: data.backgroundImageUrl || prev.backgroundImageUrl,
              textOverlays: Array.isArray(data.textOverlays) ? data.textOverlays : prev.textOverlays,
              additionalImages: Array.isArray(data.additionalImages) ? data.additionalImages : [],
              title: data.title || prev.title,
              hasUnsavedChanges: true
            }));
            logger.debug('Auto-restored data from localStorage');
          } else {
            localStorage.removeItem(`story-draft-${actualStoryId}`);
          }
        } catch (e) {
          console.error('[ERROR] [Stories] Failed to parse localStorage data:', e);
          localStorage.removeItem(`story-draft-${actualStoryId}`);
        }
      }
    }
  }, [actualStoryId]);

  // Автосохранение в localStorage согласно ТЗ
  const saveToLocalStorage = useMemo(
    () => debounce(() => {
      if (storyData.hasUnsavedChanges && actualStoryId) {
        logger.debug('Saving to localStorage', { storyId: actualStoryId });
        localStorage.setItem(`story-draft-${actualStoryId}`, JSON.stringify({
          backgroundImageUrl: storyData.backgroundImageUrl,
          textOverlays: storyData.textOverlays,
          additionalImages: storyData.additionalImages,
          title: storyData.title,
          timestamp: Date.now()
        }));
      }
    }, 2000),
    [storyData.hasUnsavedChanges, storyData.backgroundImageUrl, storyData.textOverlays, storyData.additionalImages, storyData.title, actualStoryId]
  );

  // Автосохранение при изменениях
  useEffect(() => {
    saveToLocalStorage();
  }, [saveToLocalStorage]);

  // Debounced URL validation согласно ТЗ
  const debouncedUrlValidation = useMemo(
    () => debounce((url: string) => {
      if (url && !isValidImageUrl(url)) {
        setStoryData(prev => ({
          ...prev,
          validationErrors: { ...prev.validationErrors, backgroundImageUrl: 'Неверный URL изображения' }
        }));
      } else {
        setStoryData(prev => {
          const { backgroundImageUrl, ...otherErrors } = prev.validationErrors;
          return {
            ...prev,
            validationErrors: otherErrors
          };
        });
      }
    }, 500),
    []
  );

  // Обработка изменения URL вручную согласно ТЗ
  const handleUrlChange = (url: string) => {
    setStoryData(prev => ({ 
      ...prev, 
      backgroundImageUrl: url,
      hasUnsavedChanges: true 
    }));
    debouncedUrlValidation(url);
  };

  // Загрузка изображения с оптимизацией согласно ТЗ
  const handleImageUpload = async (file: File) => {
    // Валидация файла
    if (!file.type.startsWith('image/')) {
      setStoryData(prev => ({ 
        ...prev, 
        error: 'Можно загружать только изображения' 
      }));
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
      setStoryData(prev => ({ 
        ...prev, 
        error: 'Размер файла не должен превышать 10MB' 
      }));
      return;
    }
    
    setStoryData(prev => ({ ...prev, state: 'loading', error: null }));
    
    try {
      // 1. Загрузить на Imgbb (без optimistic update)
      const formData = new FormData();
      formData.append('image', file);
      
      logger.info('Uploading image to Imgbb', { fileSize: file.size });
      const response = await axios.post('/api/imgur/upload-file', formData);
      
      if (!response.data?.url) {
        throw new Error('Не получен URL от Imgbb');
      }
      
      const imgbbUrl = response.data.url;
      logger.info('Image uploaded to Imgbb', { imgbbUrl, fileSize: file.size });
      
      // 2. Обновить состояние с реальным URL
      setStoryData(prev => ({ 
        ...prev, 
        backgroundImageUrl: imgbbUrl,
        hasUnsavedChanges: true,
        state: 'idle',
        error: null
      }));
      
      // 3. Автоматически сохранить фоновое изображение в базу данных
      if (actualStoryId) {
        try {
          await apiRequest(`/api/stories/simple/${actualStoryId}`, {
            method: 'PUT',
            data: { 
              image_url: imgbbUrl // Обновляем только фоновое изображение
            }
          });
          
          // Инвалидировать кэш для обновления данных
          queryClient.invalidateQueries({ queryKey: ['story', actualStoryId] });
        } catch (saveError) {
          logger.error('Failed to auto-save background image', saveError);
        }
      }
      
      toast({
        title: "Изображение загружено",
        description: "Изображение успешно загружено и сохранено"
      });
      
    } catch (error: any) {
      logger.error('Failed to upload image', error);
      setStoryData(prev => ({ 
        ...prev, 
        state: 'error',
        error: error?.message || 'Ошибка загрузки изображения'
      }));
      
      toast({
        title: "Ошибка загрузки",
        description: error?.message || 'Не удалось загрузить изображение',
        variant: "destructive"
      });
    }
  };

  // Обновление текстового наложения согласно ТЗ
  const addTextOverlay = useCallback(() => {
    const newOverlay: TextOverlay = {
      id: `text-${Date.now()}`,
      text: 'Новый текст',
      x: 50,
      y: 50,
      fontSize: 24,
      color: '#ffffff',
      fontFamily: 'Arial',
      fontWeight: '500',
      textAlign: 'center',
      backgroundColor: '#000000',
      padding: 8,
      borderRadius: 4
    };

    console.log('[DEBUG] Adding text overlay:', newOverlay);
    
    setStoryData(prev => {
      const updated = {
        ...prev,
        textOverlays: [...prev.textOverlays, newOverlay],
        hasUnsavedChanges: true
      };
      console.log('[DEBUG] Updated textOverlays count:', updated.textOverlays.length);
      return updated;
    });
  }, []);

  const updateTextOverlay = useCallback((index: number, updates: Partial<TextOverlay>) => {
    setStoryData(prev => ({
      ...prev,
      textOverlays: prev.textOverlays.map((overlay, i) => 
        i === index ? { ...overlay, ...updates } : overlay
      ),
      hasUnsavedChanges: true
    }));
  }, []);

  // Обновление позиции текста при перетаскивании
  const handleTextDrag = useCallback((index: number, e: any, data: any) => {
    updateTextOverlay(index, { x: data.x, y: data.y });
  }, [updateTextOverlay]);

  // Сохранение Stories с валидацией согласно ТЗ
  const handleSaveStory = async () => {
    try {
      // Валидация данных перед сохранением
      const metadata = {
        textOverlays: storyData.textOverlays,
        additionalImages: storyData.additionalImages,
        storyType: 'instagram' as const,
        format: '9:16',
        version: '1.0'
      };
      
      const validationResult = StoryMetadataSchema.safeParse(metadata);
      if (!validationResult.success) {
        const errors = validationResult.error.errors.reduce((acc, err) => {
          acc[err.path.join('.')] = err.message;
          return acc;
        }, {} as Record<string, string>);
        
        setStoryData(prev => ({ 
          ...prev, 
          validationErrors: errors,
          error: 'Исправьте ошибки валидации'
        }));
        return;
      }
      
      if (!actualStoryId) {
        throw new Error('No story ID available for saving');
      }

      setStoryData(prev => ({ ...prev, state: 'saving', error: null }));
      logger.info('Saving story', { storyId: actualStoryId, title: storyData.title });
      
      // Используем пользовательский токен из headers
      const response = await apiRequest(`/api/stories/simple/${actualStoryId}`, {
        method: 'PUT',
        data: { 
          title: storyData.title,
          image_url: storyData.backgroundImageUrl,
          metadata: JSON.stringify(metadata)
        }
      });
      
      setStoryData(prev => ({ 
        ...prev, 
        hasUnsavedChanges: false,
        state: 'idle',
        validationErrors: {}
      }));
      
      // Очистить localStorage после успешного сохранения
      if (actualStoryId) {
        localStorage.removeItem(`story-draft-${actualStoryId}`);
      }
      
      // Инвалидировать кэш
      queryClient.invalidateQueries({ queryKey: ['story', actualStoryId] });
      
      toast({
        title: "История сохранена",
        description: "Все изменения успешно сохранены"
      });
      
      logger.info('Story saved successfully', { storyId: actualStoryId });
      
    } catch (error: any) {
      logger.error('Failed to save story', error);
      setStoryData(prev => ({ 
        ...prev, 
        state: 'error',
        error: error?.message || 'Ошибка сохранения'
      }));
      
      toast({
        title: "Ошибка сохранения",
        description: error?.message || 'Не удалось сохранить историю',
        variant: "destructive"
      });
    }
  };

  // Обработчик загрузки файла
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 min-h-screen max-w-7xl mx-auto">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*"
        className="hidden"
      />
      
      {/* Левая панель - Настройки */}
      <div className="lg:w-1/2 space-y-3 overflow-y-auto pr-2">
        {/* Основные настройки */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Основные настройки</CardTitle>
              <Button variant="outline" size="sm" onClick={handleBackNavigation}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="title">Название истории</Label>
              <Input
                id="title"
                value={storyData.title}
                onChange={(e) => setStoryData(prev => ({ 
                  ...prev, 
                  title: e.target.value,
                  hasUnsavedChanges: true 
                }))}
                placeholder="Введите название"
              />
            </div>

            <div>
              <Label htmlFor="backgroundUrl">URL фонового изображения</Label>
              <div className="flex gap-2">
                <Input
                  id="backgroundUrl"
                  value={storyData.backgroundImageUrl || ''}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://i.ibb.co/xxx/image.jpg"
                  className={storyData.validationErrors.backgroundImageUrl ? 'border-red-500' : ''}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={storyData.state === 'loading'}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              {storyData.validationErrors.backgroundImageUrl && (
                <p className="text-sm text-red-600 mt-1">{storyData.validationErrors.backgroundImageUrl}</p>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Настройки текста */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Настройки текста</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={addTextOverlay}
              >
                <Type className="h-4 w-4 mr-2" />
                Добавить текст
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {storyData.textOverlays.map((overlay, index) => (
              <div key={overlay.id} className="p-3 border rounded-lg space-y-2">
                <div>
                  <Label>Текст</Label>
                  <Textarea
                    value={overlay.text}
                    onChange={(e) => updateTextOverlay(index, { text: e.target.value })}
                    placeholder="Введите текст"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Размер шрифта: {overlay.fontSize}px</Label>
                    <Slider
                      value={[overlay.fontSize]}
                      onValueChange={([value]) => updateTextOverlay(index, { fontSize: value })}
                      min={12}
                      max={72}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label>Цвет текста</Label>
                    <Input
                      type="color"
                      value={overlay.color}
                      onChange={(e) => updateTextOverlay(index, { color: e.target.value })}
                      className="h-10 mt-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Шрифт</Label>
                    <Select
                      value={overlay.fontFamily}
                      onValueChange={(value) => updateTextOverlay(index, { fontFamily: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arial">Arial</SelectItem>
                        <SelectItem value="Helvetica">Helvetica</SelectItem>
                        <SelectItem value="Georgia">Georgia</SelectItem>
                        <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Выравнивание</Label>
                    <Select
                      value={overlay.textAlign}
                      onValueChange={(value: 'left' | 'center' | 'right') => updateTextOverlay(index, { textAlign: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Слева</SelectItem>
                        <SelectItem value="center">По центру</SelectItem>
                        <SelectItem value="right">Справа</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Цвет фона</Label>
                    <Input
                      type="color"
                      value={overlay.backgroundColor.startsWith('#') ? overlay.backgroundColor : '#000000'}
                      onChange={(e) => updateTextOverlay(index, { backgroundColor: e.target.value })}
                      className="h-10 mt-2"
                    />
                  </div>
                  <div>
                    <Label>Действие</Label>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setStoryData(prev => ({
                          ...prev,
                          textOverlays: prev.textOverlays.filter((_, i) => i !== index),
                          hasUnsavedChanges: true
                        }));
                      }}
                      className="mt-2 w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Удалить
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Кнопки действий */}
        <div className="flex gap-4">
          <Button
            onClick={handleSaveStory}
            disabled={!storyData.hasUnsavedChanges || storyData.state === 'saving'}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {storyData.state === 'saving' ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>

      {/* Правая панель - Превью */}
      <div className="lg:w-1/2 lg:sticky lg:top-4 lg:self-start">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="h-5 w-5" />
              Превью Stories
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div 
              className="relative bg-gray-100 rounded-lg overflow-hidden shadow-lg"
              style={{ width: '350px', height: '620px' }}
            >
              {/* Фоновое изображение */}
              {storyData.backgroundImageUrl && (
                <img
                  src={storyData.backgroundImageUrl}
                  alt="Background"
                  className="w-full h-full object-cover"
                  onLoad={() => logger.debug('Background image loaded successfully', storyData.backgroundImageUrl)}
                  onError={(e) => logger.error('Background image failed to load', storyData.backgroundImageUrl)}
                />
              )}
              
              {/* Текстовые наложения */}
              {storyData.textOverlays.map((overlay, index) => {
                console.log('[DEBUG] Rendering overlay:', overlay.id, overlay.text, 'at position:', overlay.x, overlay.y);
                return (
                  <div
                    key={overlay.id}
                    style={{
                      position: 'absolute',
                      left: overlay.x,
                      top: overlay.y,
                      fontSize: overlay.fontSize,
                      color: overlay.color,
                      fontFamily: overlay.fontFamily,
                      fontWeight: overlay.fontWeight,
                      textAlign: overlay.textAlign,
                      backgroundColor: overlay.backgroundColor.startsWith('#') ? overlay.backgroundColor : '#000000',
                      padding: overlay.padding,
                      borderRadius: overlay.borderRadius,
                      cursor: 'move',
                      userSelect: 'none',
                      zIndex: 10,
                      minWidth: '50px',
                      maxWidth: '250px',
                      wordWrap: 'break-word'
                    }}
                    onMouseDown={(e) => {
                      // Простое перетаскивание без библиотеки
                      const startX = e.clientX - overlay.x;
                      const startY = e.clientY - overlay.y;
                      
                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        const newX = Math.max(0, Math.min(300, moveEvent.clientX - startX));
                        const newY = Math.max(0, Math.min(570, moveEvent.clientY - startY));
                        updateTextOverlay(index, { x: newX, y: newY });
                      };
                      
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                      };
                      
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                  >
                    {overlay.text}
                  </div>
                );
              })}
              
              {/* Заглушка если нет фонового изображения */}
              {!storyData.backgroundImageUrl && (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Upload className="h-12 w-12 mx-auto mb-2" />
                    <p>Загрузите фоновое изображение</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}