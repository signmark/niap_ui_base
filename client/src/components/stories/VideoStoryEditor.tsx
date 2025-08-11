import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Type, Move, Save, ArrowLeft, Play, Pause } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import Draggable from 'react-draggable';

interface TextOverlay {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right';
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
  startTime: number; // Время появления текста (в секундах)
  endTime: number;   // Время исчезновения текста (в секундах)
}

interface VideoStoryData {
  videoFile: File | null;
  videoUrl: string | null;
  textOverlays: TextOverlay[];
  campaignId: string;
  title: string;
  duration: number;
}

interface VideoStoryEditorProps {
  campaignId: string;
  onBack: () => void;
}

export default function VideoStoryEditor({ campaignId, onBack }: VideoStoryEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [storyData, setStoryData] = useState<VideoStoryData>({
    videoFile: null,
    videoUrl: null,
    textOverlays: [],
    campaignId,
    title: 'Новая видео Stories',
    duration: 0
  });

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedOverlay, setSelectedOverlay] = useState<number>(-1);

  // Загрузка видео
  const handleVideoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверяем размер (максимум 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: 'Ошибка',
        description: 'Размер видео не должен превышать 100MB',
        variant: 'destructive'
      });
      return;
    }

    const videoUrl = URL.createObjectURL(file);
    setStoryData(prev => ({
      ...prev,
      videoFile: file,
      videoUrl
    }));
  }, [toast]);

  // Обработка метаданных видео
  const handleVideoLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const duration = Math.min(video.duration, 30); // Максимум 30 секунд для Stories
    setStoryData(prev => ({ ...prev, duration }));

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
      text: 'Новый текст',
      x: 50,
      y: 50,
      fontSize: 32,
      color: '#ffffff',
      fontFamily: 'Arial',
      fontWeight: 'bold',
      textAlign: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: 10,
      borderRadius: 8,
      startTime: currentTime,
      endTime: Math.min(currentTime + 3, storyData.duration) // 3 секунды по умолчанию
    };

    setStoryData(prev => ({
      ...prev,
      textOverlays: [...prev.textOverlays, newOverlay]
    }));
    setSelectedOverlay(storyData.textOverlays.length);
  }, [currentTime, storyData.duration, storyData.textOverlays.length]);

  // Обновление наложения
  const updateTextOverlay = useCallback((index: number, updates: Partial<TextOverlay>) => {
    setStoryData(prev => ({
      ...prev,
      textOverlays: prev.textOverlays.map((overlay, i) => 
        i === index ? { ...overlay, ...updates } : overlay
      )
    }));
  }, []);

  // Удаление наложения
  const removeTextOverlay = useCallback((index: number) => {
    setStoryData(prev => ({
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

  // Сохранение Stories
  const saveStoryMutation = useMutation({
    mutationFn: async () => {
      if (!storyData.videoFile) {
        throw new Error('Не выбрано видео');
      }

      // Подготавливаем данные для сохранения
      const storyContent = {
        mode: 'video',
        videoFile: storyData.videoFile.name,
        textOverlays: storyData.textOverlays,
        duration: storyData.duration
      };

      // TODO: Здесь нужно будет загрузить видео на сервер/облако
      // и получить URL для сохранения

      return apiRequest('/api/stories', {
        method: 'POST'
      }, {
        campaignId: storyData.campaignId,
        title: storyData.title,
        content: JSON.stringify(storyContent),
        type: 'video_story',
        status: 'draft'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Успешно!',
        description: 'Видео Stories сохранена'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-content'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить видео Stories',
        variant: 'destructive'
      });
    }
  });

  const selectedOverlayData = selectedOverlay >= 0 ? storyData.textOverlays[selectedOverlay] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* Заголовок */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Редактор видео Stories</h1>
              <p className="text-gray-600">Создание Stories с видео и текстовыми наложениями</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => saveStoryMutation.mutate()}
              disabled={saveStoryMutation.isPending || !storyData.videoFile}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveStoryMutation.isPending ? 'Сохранение...' : 'Сохранить'}
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
                  onChange={handleVideoUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Выбрать видео
                </Button>
                {storyData.videoFile && (
                  <p className="text-sm text-gray-600 mt-2">
                    {storyData.videoFile.name} ({Math.round(storyData.duration)}с)
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
                    value={storyData.title}
                    onChange={(e) => setStoryData(prev => ({ ...prev, title: e.target.value }))}
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
                  disabled={!storyData.videoUrl}
                  className="w-full"
                >
                  Добавить текст
                </Button>

                {/* Список наложений */}
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {storyData.textOverlays.map((overlay, index) => (
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
                      max={storyData.duration}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <Label>Время исчезновения: {selectedOverlayData.endTime.toFixed(1)}с</Label>
                    <Slider
                      value={[selectedOverlayData.endTime]}
                      onValueChange={([value]) => updateTextOverlay(selectedOverlay, { endTime: value })}
                      min={selectedOverlayData.startTime}
                      max={storyData.duration}
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
                        value={selectedOverlayData.color}
                        onChange={(e) => updateTextOverlay(selectedOverlay, { color: e.target.value })}
                        className="w-12 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={selectedOverlayData.color}
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
                  {storyData.videoUrl && (
                    <video
                      ref={videoRef}
                      src={storyData.videoUrl}
                      className="absolute inset-0 w-full h-full object-cover"
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                    />
                  )}

                  {/* Текстовые наложения */}
                  {storyData.textOverlays.map((overlay, index) => {
                    if (!isOverlayVisible(overlay)) return null;

                    return (
                      <Draggable
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
                      </Draggable>
                    );
                  })}

                  {/* Кнопка воспроизведения */}
                  {storyData.videoUrl && (
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
                            style={{ width: `${(currentTime / storyData.duration) * 100}%` }}
                          />
                        </div>
                        
                        <span className="text-white text-sm">
                          {currentTime.toFixed(1)}s / {storyData.duration.toFixed(1)}s
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Сообщение об отсутствии видео */}
                  {!storyData.videoUrl && (
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