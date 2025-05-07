import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VideoUploader } from "./VideoUploader";
import { Plus, Trash2, ImageIcon, Wand2, Loader2 } from "lucide-react";
import { MediaUploader } from "./MediaUploader";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Интерфейс для элемента медиа
export interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface AdditionalMediaUploaderProps {
  media?: MediaItem[];
  value?: MediaItem[];
  onChange: (media: MediaItem[]) => void;
  label?: string;
  title?: string;
  hideTitle?: boolean;
}

export function AdditionalMediaUploader({ 
  media = [],
  value,
  onChange, 
  label = "Медиа-файлы",
  title,
  hideTitle = false
}: AdditionalMediaUploaderProps) {
  const { toast } = useToast();
  // Состояния для диалога генерации изображений
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Используем либо value, либо media (для совместимости)
  let mediaItems = value || media || [];
  
  // Адаптер для поддержки как строковых массивов, так и объектов MediaItem
  // Если передан массив строк, преобразуем его в массив MediaItem
  if (mediaItems.length > 0 && typeof mediaItems[0] === 'string') {
    mediaItems = (mediaItems as string[]).map(url => ({
      url,
      type: (url.toLowerCase().endsWith('.mp4') || url.toLowerCase().includes('video')) ? 'video' : 'image'
    }));
  }

  // Проверка, был ли изначально передан массив строк
  const wasStringArray = Array.isArray(value) && value.length > 0 && typeof value[0] === 'string';
  
  // Функция для отправки данных обратно с учетом исходного формата
  const sendChanges = (updatedMedia: MediaItem[]) => {
    if (wasStringArray) {
      // Если исходные данные были массивом строк, возвращаем массив URL
      const stringUrls = updatedMedia.map(item => item.url);
      onChange(stringUrls as any);
    } else {
      // Иначе возвращаем как есть
      onChange(updatedMedia);
    }
  };
  
  // Обработчик изменения URL медиа
  const handleMediaUrlChange = (index: number, url: string) => {
    const updatedMedia = [...mediaItems];
    updatedMedia[index] = { ...updatedMedia[index], url };
    sendChanges(updatedMedia);
  };

  // Обработчик изменения типа медиа
  const handleMediaTypeChange = (index: number, type: 'image' | 'video') => {
    const updatedMedia = [...mediaItems];
    updatedMedia[index] = { ...updatedMedia[index], type };
    sendChanges(updatedMedia);
  };

  // Обработчик удаления медиа
  const handleRemoveMedia = (index: number) => {
    const updatedMedia = [...mediaItems];
    updatedMedia.splice(index, 1);
    sendChanges(updatedMedia);
  };

  // Обработчик добавления нового медиа
  const handleAddMedia = (type: 'image' | 'video' = 'image') => {
    sendChanges([...mediaItems, { url: "", type }]);
  };
  
  // Функция для открытия диалога генерации изображения
  const openGenerateDialog = (index: number) => {
    setGeneratingIndex(index);
    setPrompt("");
    setIsGenerateDialogOpen(true);
  };

  // Функция для генерации изображения
  const generateImage = async () => {
    if (!prompt || generatingIndex === null) return;

    setIsGenerating(true);
    try {
      // Используем универсальный эндпоинт для генерации изображений
      const response = await apiRequest("POST", "/api/generate-image", {
        prompt,
        style: "base" // Базовый стиль по умолчанию
      });

      if (!response.ok) {
        throw new Error("Не удалось сгенерировать изображение");
      }

      const data = await response.json();
      if (data.success && data.imageUrl) {
        // Обновляем URL изображения в массиве
        const updatedMedia = [...mediaItems];
        updatedMedia[generatingIndex] = { 
          ...updatedMedia[generatingIndex], 
          url: data.imageUrl,
          type: 'image'
        };
        sendChanges(updatedMedia);
        
        // Закрываем диалог
        setIsGenerateDialogOpen(false);
        toast({
          title: "Изображение сгенерировано",
          description: "Изображение успешно создано и добавлено в медиа",
        });
      } else {
        throw new Error(data.message || "Не удалось получить URL изображения");
      }
    } catch (error) {
      console.error("Ошибка генерации изображения:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось сгенерировать изображение",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-2">
          {!hideTitle && <Label>{title || label}</Label>}
          <div className="flex gap-2 ml-auto">
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={() => handleAddMedia('image')}
            >
              <ImageIcon className="h-4 w-4 mr-1" />
              Добавить изображение
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={() => handleAddMedia('video')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Добавить видео
            </Button>
          </div>
        </div>

        {mediaItems.length > 0 ? (
          <div className="space-y-6">
            {mediaItems.map((mediaItem, index) => (
              <div key={index} className="border p-4 rounded-md bg-muted/20">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <Select
                      value={mediaItem.type}
                      onValueChange={(value) => handleMediaTypeChange(index, value as 'image' | 'video')}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Тип медиа" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Изображение</SelectItem>
                        <SelectItem value="video">Видео</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm font-medium">#{index + 1}</span>
                  </div>
                  <div className="flex gap-2">
                    {/* Кнопка генерации изображения для элементов типа "image" */}
                    {mediaItem.type === 'image' && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        onClick={() => openGenerateDialog(index)}
                        title="Сгенерировать изображение"
                      >
                        <Wand2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => handleRemoveMedia(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* URL поле с загрузчиком */}
                  {mediaItem.type === 'video' ? (
                    <div>
                      <Label htmlFor={`media-url-${index}`} className="mb-1 block">URL видео</Label>
                      <VideoUploader
                        id={`media-url-${index}`}
                        value={mediaItem.url || ""}
                        onChange={(url) => handleMediaUrlChange(index, url)}
                        placeholder="Введите URL видео или загрузите файл"
                        forcePreview={true}
                      />
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor={`media-url-${index}`} className="mb-1 block">URL изображения</Label>
                      <Input
                        id={`media-url-${index}`}
                        value={mediaItem.url || ""}
                        onChange={(e) => handleMediaUrlChange(index, e.target.value)}
                        placeholder="Введите URL изображения или сгенерируйте его"
                        className="w-full"
                      />
                      {mediaItem.url && (
                        <div className="mt-2 border rounded-md p-2 bg-muted/20">
                          <div className="text-xs text-muted-foreground mb-1">Предпросмотр изображения:</div>
                          <div className="w-full h-auto rounded-md overflow-hidden bg-muted">
                            <img 
                              src={mediaItem.url} 
                              alt="Preview" 
                              className="max-w-full h-auto max-h-60"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling!.style.display = 'flex';
                              }}
                            />
                            <div 
                              className="flex-col items-center justify-center text-muted-foreground py-10 hidden"
                              style={{ display: 'none' }}
                            >
                              <ImageIcon className="h-10 w-10 mb-2" />
                              <span>Не удалось загрузить изображение</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic p-4 border border-dashed rounded-md text-center">
            Нет медиа-файлов. Нажмите кнопку "Добавить изображение" или "Добавить видео", чтобы добавить медиа-контент.
          </div>
        )}
      </div>

      {/* Диалог для генерации изображения */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Генерация изображения</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="prompt" className="mb-2 block">Опишите, что должно быть на изображении</Label>
            <Input
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Например: профессиональный интерфейс приложения для планирования питания"
              className="mb-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Чем подробнее описание, тем лучше будет результат. Используйте детали, стили и цвета.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsGenerateDialogOpen(false)}
              disabled={isGenerating}
            >
              Отмена
            </Button>
            <Button
              onClick={generateImage}
              disabled={!prompt || isGenerating}
            >
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сгенерировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}