import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, ImageIcon, Sparkles } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { BegetS3Uploader } from '@/components/BegetS3Uploader';
import { ImageGenerationDialog } from '@/components/ImageGenerationDialog';
import { useCampaignStore } from '@/lib/campaignStore';
import { apiRequest } from '@/lib/queryClient';

export default function SimpleStoriesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const selectedCampaign = useCampaignStore(state => state.selectedCampaign);
  const campaignId = selectedCampaign?.id || "46868c44-c6a4-4bed-accf-9ad07bba790e";

  const [title, setTitle] = useState('');
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [showImageGeneration, setShowImageGeneration] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  const [, forceUpdate] = useState({});

  const createStoriesMutation = useMutation({
    mutationFn: async (data: { title: string; imageUrl: string }) => {
      return apiRequest('/api/stories', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          image_url: data.imageUrl,
          campaign_id: campaignId,
          type: 'simple'
        })
      });
    },
    onSuccess: () => {
      toast({
        title: 'Stories создана',
        description: 'Простая Stories успешно создана'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/stories'] });
      setLocation('/content');
    },
    onError: (error: any) => {
      console.error('Ошибка создания Stories:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать Stories',
        variant: 'destructive'
      });
    }
  });

  const handleCreate = () => {
    if (!title.trim()) {
      toast({
        title: 'Введите название',
        description: 'Название Stories обязательно для заполнения',
        variant: 'destructive'
      });
      return;
    }

    if (!currentImageUrl.trim()) {
      toast({
        title: 'Добавьте изображение',
        description: 'Загрузите или сгенерируйте изображение для Stories',
        variant: 'destructive'
      });
      return;
    }

    createStoriesMutation.mutate({ title, imageUrl: currentImageUrl });
  };

  const handleImageUpload = useCallback((url: string) => {
    console.log('📁 ПРОСТАЯ ЗАГРУЗКА:', url);
    const newKey = Date.now();
    console.log('📁 Устанавливаю URL:', url, 'Key:', newKey);
    
    // Используем функциональные обновления для избежания stale closure
    setCurrentImageUrl(() => {
      console.log('📁 Функциональное обновление URL:', url);
      return url;
    });
    setRenderKey(() => {
      console.log('📁 Функциональное обновление Key:', newKey);
      return newKey;
    });
    
    console.log('📁 State обновлен через functional updates');
  }, []);

  const handleImageGenerated = (url: string) => {
    console.log('🖼️ AI изображение сгенерировано:', url);
    setCurrentImageUrl(url);
    setRenderKey(Date.now());
    setShowImageGeneration(false);
    toast({
      title: 'Изображение сгенерировано',
      description: 'AI изображение успешно создано и добавлено в Stories'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Заголовок */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation('/content')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к контенту
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Создание простой Stories</h1>
            <p className="text-gray-600">Одно изображение для Instagram Stories</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Левая панель - настройки */}
          <div className="space-y-6">
            {/* Основная информация */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Основная информация
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Название Stories</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Введите название Stories"
                    className="w-full"
                  />
                </div>

                <div>
                  <Label>URL изображения</Label>
                  <Input
                    type="url"
                    placeholder="Введите URL изображения"
                    value={currentImageUrl}
                    onChange={(e) => setCurrentImageUrl(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <BegetS3Uploader onUpload={handleImageUpload} folder="stories">
                    <Button variant="outline" className="flex-1">
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Загрузить изображение
                    </Button>
                  </BegetS3Uploader>
                  
                  <Button
                    variant="outline"
                    onClick={() => setShowImageGeneration(true)}
                    className="flex-1"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Сгенерировать AI
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Кнопка создания */}
            <Button
              onClick={handleCreate}
              disabled={createStoriesMutation.isPending || !title || !currentImageUrl}
              className="w-full"
              size="lg"
            >
              <Send className="w-4 h-4 mr-2" />
              {createStoriesMutation.isPending ? 'Создание...' : 'Создать Stories'}
            </Button>
          </div>

          {/* Правая панель - превью */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Превью Stories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative w-full max-w-sm mx-auto">
                  {/* Instagram Stories размеры: 9:16 */}
                  <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden shadow-lg bg-gray-100">
                    <div className="w-full h-full">
                      {(() => {
                        console.log('🔄 РЕНДЕР ПРЕВЬЮ - URL:', currentImageUrl, 'Key:', renderKey);
                        if (currentImageUrl) {
                          return (
                            <div className="relative w-full h-full">
                              <img
                                key={`img-${renderKey}`}
                                src={currentImageUrl}
                                alt="Stories preview"
                                className="w-full h-full object-cover"
                                onLoad={() => console.log('✅ ПРЕВЬЮ ЗАГРУЖЕНО УСПЕШНО:', currentImageUrl)}
                                onError={(e) => {
                                  console.log('❌ Ошибка загрузки превью для URL:', currentImageUrl);
                                }}
                              />
                              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                                ✅ РАБОТАЕТ! #{renderKey}
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <div className="text-center">
                                <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                                <p>Загрузите изображение</p>
                                <p className="text-xs mt-2">URL: {currentImageUrl || 'ПУСТОЙ'}</p>
                                <p className="text-xs">Key: {renderKey}</p>
                              </div>
                            </div>
                          );
                        }
                      })()}
                    </div>
                    
                    {/* Наложение с названием */}
                    {title && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <div className="text-white">
                          <h3 className="font-semibold text-lg">{title}</h3>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Диалог генерации изображений */}
      <Dialog open={showImageGeneration} onOpenChange={setShowImageGeneration}>
        <ImageGenerationDialog
          campaignId={campaignId}
          onImageGenerated={handleImageGenerated}
          onClose={() => setShowImageGeneration(false)}
        />
      </Dialog>
    </div>
  );
}