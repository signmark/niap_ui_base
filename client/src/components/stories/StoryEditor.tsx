import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Save, Play, ArrowLeft, Plus } from 'lucide-react';
import SlidePanel from './SlidePanel';
import StoryCanvas from './StoryCanvas';
import ToolsPanel from './ToolsPanel';
import { StoryContent, StorySlide } from '../../../shared/stories-schema';

interface StoryEditorProps {
  campaignId?: string;
  storyId?: string;
}

export default function StoryEditor({ campaignId, storyId }: StoryEditorProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [storyTitle, setStoryTitle] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Fetch existing story if editing
  const { data: story, isLoading, error } = useQuery({
    queryKey: ['story', storyId],
    queryFn: () => storyId ? apiRequest(`/api/stories/${storyId}`) : null,
    enabled: !!storyId
  });

  // Create new story mutation
  const createStoryMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/stories', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: (newStory) => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      toast({
        title: 'История создана',
        description: 'Новая история успешно создана'
      });
      // Navigate to edit the new story
      setLocation(`/stories/${newStory.data.id}/edit`);
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать историю',
        variant: 'destructive'
      });
    }
  });

  // Update story mutation
  const updateStoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest(`/api/stories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      setIsAutoSaving(false);
    },
    onError: (error: any) => {
      setIsAutoSaving(false);
      toast({
        title: 'Ошибка сохранения',
        description: error.message || 'Не удалось сохранить изменения',
        variant: 'destructive'
      });
    }
  });

  // Initialize story data
  useEffect(() => {
    if (story?.data) {
      setStoryTitle(story.data.title);
    }
  }, [story]);

  // Auto-save functionality
  useEffect(() => {
    if (!storyId || !storyTitle) return;

    const autoSaveTimer = setTimeout(() => {
      setIsAutoSaving(true);
      updateStoryMutation.mutate({
        id: storyId,
        data: { title: storyTitle }
      });
    }, 2000); // Auto-save after 2 seconds of no changes

    return () => clearTimeout(autoSaveTimer);
  }, [storyTitle, storyId]);

  const handleCreateStory = () => {
    if (!campaignId) {
      toast({
        title: 'Ошибка',
        description: 'Не указана кампания для создания истории',
        variant: 'destructive'
      });
      return;
    }

    createStoryMutation.mutate({
      campaignId,
      title: 'Новая история',
      type: 'story',
      status: 'draft'
    });
  };

  const handleSave = () => {
    if (!storyId) return;
    
    updateStoryMutation.mutate({
      id: storyId,
      data: { title: storyTitle }
    });
  };

  const handlePublish = () => {
    toast({
      title: 'Публикация',
      description: 'Функция публикации будет реализована в следующих этапах'
    });
  };

  const handleGoBack = () => {
    setLocation(campaignId ? `/campaigns/${campaignId}` : '/campaigns');
  };

  const currentSlide = story?.data?.slides?.[currentSlideIndex];
  const slides = story?.data?.slides || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Загрузка редактора историй...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Ошибка загрузки</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">Не удалось загрузить редактор историй</p>
            <Button onClick={handleGoBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no story ID provided and no campaign ID, show creation prompt
  if (!storyId && !campaignId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Создание истории</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Для создания истории необходимо выбрать кампанию
            </p>
            <Button onClick={handleGoBack} className="w-full">
              Выбрать кампанию
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If new story creation for campaign
  if (!storyId && campaignId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Новая история</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Создать новую историю для этой кампании?
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={handleCreateStory}
                disabled={createStoryMutation.isPending}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                Создать историю
              </Button>
              <Button variant="outline" onClick={handleGoBack}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Input
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                className="font-semibold text-lg border-none shadow-none p-0 h-auto focus-visible:ring-0"
                placeholder="Название истории"
              />
              {isAutoSaving && (
                <span className="text-xs text-gray-500">Сохранение...</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={updateStoryMutation.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              Сохранить
            </Button>
            <Button onClick={handlePublish}>
              <Play className="w-4 h-4 mr-2" />
              Опубликовать
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Slides Panel */}
        <div className="w-64 bg-white border-r border-gray-200">
          <SlidePanel
            slides={slides}
            currentSlideIndex={currentSlideIndex}
            onSlideSelect={setCurrentSlideIndex}
            storyId={storyId}
          />
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center bg-gray-100 p-8">
          <StoryCanvas
            slide={currentSlide}
            storyId={storyId}
            onSlideUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ['story', storyId] });
            }}
          />
        </div>

        {/* Tools Panel */}
        <div className="w-64 bg-white border-l border-gray-200">
          <ToolsPanel
            currentSlide={currentSlide}
            storyId={storyId}
            onElementAdd={() => {
              queryClient.invalidateQueries({ queryKey: ['story', storyId] });
            }}
          />
        </div>
      </div>

      {/* Timeline/Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
              disabled={currentSlideIndex === 0}
            >
              ◀
            </Button>
            <span className="text-sm text-gray-600">
              Слайд {currentSlideIndex + 1} из {slides.length || 1}
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
    </div>
  );
}