import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, Save, ArrowLeft, Play, Pause, Plus, Trash2, Move, Type } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import DraggableWrapper from './DraggableWrapper';
import { apiRequest } from '@/lib/queryClient';

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  startTime: number;
  endTime: number;
}

interface VideoStoryData {
  id?: string;
  title: string;
  backgroundVideoUrl: string | null;
  textOverlays: TextOverlay[];
  duration: number;
}

interface VideoStoryEditorProps {
  storyId: string;
}

export default function VideoStoryEditor({ storyId }: VideoStoryEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [story, setStory] = useState<VideoStoryData>({
    id: storyId,
    title: '',
    backgroundVideoUrl: null,
    textOverlays: [],
    duration: 0
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedOverlay, setSelectedOverlay] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Загрузка видео
  const handleVideoUpload = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast({
        title: "Ошибка",
        description: "Только видео файлы",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Токен авторизации не найден');
      }

      const formData = new FormData();
      formData.append('video', file);

      const response = await fetch('/api/beget-s3-video/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ошибка ответа сервера:', errorText);
        throw new Error('Ошибка загрузки видео');
      }

      const result = await response.json();
      
      if (result.success && result.videoUrl) {
        setStory(prev => ({ ...prev, backgroundVideoUrl: result.videoUrl }));
        toast({
          title: "Успех",
          description: "Видео загружено",
        });
      } else {
        throw new Error(result.error || 'Ошибка загрузки видео');
      }
    } catch (error) {
      console.error('Ошибка загрузки видео:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить видео",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  // Обработка метаданных видео
  const handleVideoLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const duration = Math.min(video.duration, 30); // Максимум 30 секунд для Stories
    setStory(prev => ({ ...prev, duration }));

    // Если видео длиннее 30 секунд, предупреждаем пользователя
    if (video.duration > 30) {
      toast({
        title: 'Внимание',
        description: 'Видео будет обрезано до 30 секунд для соответствия требованиям Stories',
        variant: 'default'
      });
    }
  }, [toast]);

  // Управление воспроизведением
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Обновление текущего времени
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  }, []);

  // Добавление нового текстового наложения
  const addTextOverlay = useCallback(() => {
    const newOverlay: TextOverlay = {
      id: `overlay_${Date.now()}`,
      text: 'Новый текст',
      x: 50,
      y: 50,
      fontSize: 32,
      color: '#ffffff',
      startTime: currentTime,
      endTime: Math.min(currentTime + 3, story.duration) // 3 секунды по умолчанию
    };

    setStory(prev => ({
      ...prev,
      textOverlays: [...prev.textOverlays, newOverlay]
    }));
    setSelectedOverlay(story.textOverlays.length);
  }, [currentTime, story.duration, story.textOverlays.length]);

  // Обновление наложения
  const updateTextOverlay = useCallback((index: number, updates: Partial<TextOverlay>) => {
    setStory(prev => ({
      ...prev,
      textOverlays: prev.textOverlays.map((overlay, i) => 
        i === index ? { ...overlay, ...updates } : overlay
      )
    }));
  }, []);

  // Удаление наложения
  const removeTextOverlay = useCallback((index: number) => {
    setStory(prev => ({
      ...prev,
      textOverlays: prev.textOverlays.filter((_, i) => i !== index)
    }));
    setSelectedOverlay(-1);
  }, []);

  // Перетаскивание текста
  const handleTextDrag = useCallback((index: number) => (e: any, data: any) => {
    updateTextOverlay(index, { x: data.x, y: data.y });
  }, [updateTextOverlay]);

  // Проверка, должен ли текст отображаться в данный момент времени
  const isOverlayVisible = useCallback((overlay: TextOverlay) => {
    return currentTime >= overlay.startTime && currentTime <= overlay.endTime;
  }, [currentTime]);

  // Загрузка Stories при инициализации
  useEffect(() => {
    const loadStory = async () => {
      if (!storyId) return;
      
      try {
        const response = await apiRequest(`/api/stories/simple/${storyId}`);
        if (response.success && response.data) {
          const data = response.data;
          
          let textOverlays: TextOverlay[] = [];
          try {
            const metadata = typeof data.metadata === 'string' 
              ? JSON.parse(data.metadata) 
              : data.metadata;
            textOverlays = metadata.textOverlays || [];
          } catch (e) {
            console.error('Ошибка парсинга метаданных:', e);
          }

          console.log('Загруженные данные Stories:', {
            id: storyId,
            title: data.title || '',
            video_url: data.video_url,
            backgroundVideoUrl: data.video_url || null,
            hasVideoUrl: !!data.video_url
          });
          
          setStory({
            id: storyId,
            title: data.title || '',
            backgroundVideoUrl: data.video_url || null,
            textOverlays,
            duration: 0
          });
        }
      } catch (error) {
        console.error('Ошибка загрузки Stories:', error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить данные Stories",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadStory();
  }, [storyId]);

  // Сохранение Stories
  const handleSave = async () => {
    setSaving(true);
    try {
      const metadata = {
        textOverlays: story.textOverlays,
        version: '1.0'
      };

      // Сохраняем Stories
      console.log('Сохранение Stories:', {
        title: story.title,
        video_url: story.backgroundVideoUrl,
        metadata: JSON.stringify(metadata)
      });
      
      await apiRequest(`/api/stories/simple/${storyId}`, {
        method: 'PUT',
        data: {
          title: story.title,
          video_url: story.backgroundVideoUrl,
          metadata: JSON.stringify(metadata)
        }
      });

      // Также обновляем video_url в контенте
      console.log('Сохранение video_url в контент:', {
        storyId,
        backgroundVideoUrl: story.backgroundVideoUrl,
        hasVideoUrl: !!story.backgroundVideoUrl
      });
      
      if (story.backgroundVideoUrl) {
        try {
          const contentUpdateResponse = await apiRequest(`/api/campaign-content/${storyId}`, {
            method: 'PUT',
            data: {
              video_url: story.backgroundVideoUrl
            }
          });
          console.log('Контент успешно обновлен с video_url:', contentUpdateResponse);
        } catch (contentError) {
          console.error('Ошибка обновления video_url в контенте:', contentError);
          toast({
            title: "Предупреждение",
            description: "Stories сохранена, но video_url не обновлен в контенте",
            variant: "destructive"
          });
        }
      } else {
        console.warn('Нет video_url для сохранения в контент');
      }

      toast({
        title: "Сохранено",
        description: "Видео Stories сохранена",
      });
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить Stories",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedOverlayData = selectedOverlay >= 0 ? story.textOverlays[selectedOverlay] : null;
  
  const getCampaignId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('campaignId') || "46868c44-c6a4-4bed-accf-9ad07bba790e";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка видео редактора...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* Заголовок */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/content')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Редактор видео Stories</h1>
              <p className="text-gray-600">Создание Stories с видео и текстовыми наложениями</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Панель настроек */}
          <div className="lg:col-span-1 space-y-6">
            {/* Загрузка видео */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Видео файл
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file);
                  }}
                  ref={fileInputRef}
                  className="hidden"
                  disabled={uploading}
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full"
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Выбрать видео
                    </>
                  )}
                </Button>
                {story.backgroundVideoUrl && (
                  <p className="text-sm text-gray-600 mt-2">
                    Видео загружено ({Math.round(story.duration)}с)
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Название Stories */}
            <Card>
              <CardHeader>
                <CardTitle>Настройки Stories</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="storyTitle">Название</Label>
                  <Input
                    id="storyTitle"
                    value={story.title}
                    onChange={(e) => setStory(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Введите название"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Управление текстовыми наложениями */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Текстовые наложения
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={addTextOverlay}
                  disabled={!story.backgroundVideoUrl}
                  className="w-full"
                >
                  Добавить текст
                </Button>

                {/* Список наложений */}
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {story.textOverlays.map((overlay, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        selectedOverlay === index ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedOverlay(index)}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium truncate">
                          {overlay.text}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTextOverlay(index);
                          }}
                        >
                          ×
                        </Button>
                      </div>
                      <div className="text-xs text-gray-500">
                        {overlay.startTime.toFixed(1)}s - {overlay.endTime.toFixed(1)}s
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Настройки выбранного наложения */}
            {selectedOverlayData && (
              <Card>
                <CardHeader>
                  <CardTitle>Редактирование текста</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Текст</Label>
                    <Textarea
                      value={selectedOverlayData.text}
                      onChange={(e) => updateTextOverlay(selectedOverlay, { text: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Время появления: {selectedOverlayData.startTime.toFixed(1)}с</Label>
                    <Slider
                      value={[selectedOverlayData.startTime]}
                      onValueChange={([value]) => updateTextOverlay(selectedOverlay, { startTime: value })}
                      min={0}
                      max={story.duration}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <Label>Время исчезновения: {selectedOverlayData.endTime.toFixed(1)}с</Label>
                    <Slider
                      value={[selectedOverlayData.endTime]}
                      onValueChange={([value]) => updateTextOverlay(selectedOverlay, { endTime: value })}
                      min={selectedOverlayData.startTime}
                      max={story.duration}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <Label>Размер шрифта: {selectedOverlayData.fontSize}px</Label>
                    <Slider
                      value={[selectedOverlayData.fontSize]}
                      onValueChange={([value]) => updateTextOverlay(selectedOverlay, { fontSize: value })}
                      min={16}
                      max={72}
                      step={2}
                    />
                  </div>

                  <div>
                    <Label>Цвет текста</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={selectedOverlayData.color || '#ffffff'}
                        onChange={(e) => updateTextOverlay(selectedOverlay, { color: e.target.value })}
                        className="w-12 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={selectedOverlayData.color || '#ffffff'}
                        onChange={(e) => updateTextOverlay(selectedOverlay, { color: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Видео превью */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Move className="h-4 w-4" />
                  Превью видео Stories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="relative mx-auto bg-gray-900 overflow-hidden"
                  style={{ width: '400px', height: '711px' }}
                >
                  {/* Видео */}
                  {story.backgroundVideoUrl && (
                    <video
                      ref={videoRef}
                      src={story.backgroundVideoUrl}
                      className="absolute inset-0 w-full h-full object-cover"
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      onError={(e) => {
                        console.error('Ошибка загрузки видео:', e);
                        console.error('Video URL:', story.backgroundVideoUrl);
                        console.error('Video element error:', e.target.error);
                      }}
                      onLoadStart={() => {
                        console.log('Начало загрузки видео:', story.backgroundVideoUrl);
                      }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                    />
                  )}

                  {/* Текстовые наложения */}
                  {story.textOverlays.map((overlay, index) => {
                    if (!isOverlayVisible(overlay)) return null;

                    return (
                      <DraggableWrapper
                        key={index}
                        position={{ x: overlay.x, y: overlay.y }}
                        onDrag={handleTextDrag(index)}
                        bounds="parent"
                      >
                        <div
                          className={`absolute cursor-move select-none ${
                            selectedOverlay === index ? 'ring-2 ring-blue-500' : ''
                          }`}
                          style={{
                            fontSize: `${overlay.fontSize}px`,
                            color: overlay.color,
                            fontFamily: overlay.fontFamily,
                            fontWeight: overlay.fontWeight,
                            textAlign: overlay.textAlign,
                            backgroundColor: overlay.backgroundColor,
                            padding: overlay.padding ? `${overlay.padding}px` : undefined,
                            borderRadius: overlay.borderRadius ? `${overlay.borderRadius}px` : undefined,
                            whiteSpace: 'pre-wrap',
                            maxWidth: '350px'
                          }}
                          onClick={() => setSelectedOverlay(index)}
                        >
                          {overlay.text}
                        </div>
                      </DraggableWrapper>
                    );
                  })}

                  {/* Кнопка воспроизведения */}
                  {story.backgroundVideoUrl && (
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-4 bg-black bg-opacity-50 rounded-lg p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={togglePlay}
                          className="text-white hover:bg-white hover:bg-opacity-20"
                        >
                          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        
                        {/* Прогресс бар */}
                        <div className="flex-1 h-2 bg-white bg-opacity-30 rounded">
                          <div
                            className="h-full bg-white rounded transition-all"
                            style={{ width: `${(currentTime / story.duration) * 100}%` }}
                          />
                        </div>
                        
                        <span className="text-white text-sm">
                          {currentTime.toFixed(1)}s / {story.duration.toFixed(1)}s
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Сообщение об отсутствии видео */}
                  {!story.backgroundVideoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center text-white text-center p-8">
                      <div>
                        <Upload className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <h3 className="text-xl font-semibold mb-2">Загрузите видео</h3>
                        <p className="text-gray-300">
                          Выберите видео файл для создания Stories
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}