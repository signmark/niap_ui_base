import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VideoUploader } from "./VideoUploader";
import { Plus, Trash2, ImageIcon, Wand2, FileText } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ImageGenerationDialog } from "./ImageGenerationDialog";

// Интерфейс для элемента медиа
export interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface AdditionalMediaUploaderProps {
  media?: MediaItem[];
  value?: MediaItem[];
  onChange: (media: MediaItem[] | string[]) => void;
  label?: string;
  title?: string;
  hideTitle?: boolean;
  contentText?: string; // Текст контента для генерации изображений
  contentId?: string; // ID контента для сохранения промпта
  campaignId?: string; // ID кампании для контекста
}

export function AdditionalMediaUploader({ 
  media = [],
  value,
  onChange, 
  label = "Медиа-файлы",
  title,
  hideTitle = false,
  contentText,
  contentId,
  campaignId
}: AdditionalMediaUploaderProps) {
  const { toast } = useToast();
  
  // Состояния для диалогов генерации изображений
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [isImageGenerationDialogOpen, setIsImageGenerationDialogOpen] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  
  // Используем либо value, либо media (для совместимости)
  let mediaItems: MediaItem[] = [];
  
  // Преобразование входных данных в нужный формат
  if (value) {
    if (value.length > 0 && typeof value[0] === 'string') {
      // Если передан массив строк, преобразуем его в массив MediaItem
      mediaItems = (value as unknown as string[]).map(url => ({
        url,
        type: (url.toLowerCase().endsWith('.mp4') || url.toLowerCase().includes('video')) ? 'video' : 'image'
      }));
    } else {
      // Если передан массив MediaItem, используем его
      mediaItems = value as MediaItem[];
    }
  } else if (media) {
    mediaItems = media;
  }

  // Проверка, был ли изначально передан массив строк
  const wasStringArray = Array.isArray(value) && value.length > 0 && typeof value[0] === 'string';
  
  // Функция для отправки данных обратно с учетом исходного формата
  const sendChanges = (updatedMedia: MediaItem[]) => {
    if (wasStringArray) {
      // Если исходные данные были массивом строк, возвращаем массив URL
      const stringUrls = updatedMedia.map(item => item.url);
      onChange(stringUrls);
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
  
  // Функция для открытия простого диалога ввода промпта
  const openPromptDialog = (index: number) => {
    setGeneratingIndex(index);
    setPrompt("");
    setIsPromptDialogOpen(true);
  };
  
  // Функция для открытия полноценного диалога генерации изображений
  const openGenerateImageDialog = (index: number) => {
    setGeneratingIndex(index);
    setIsImageGenerationDialogOpen(true);
  };
  
  // Обработчик успешной генерации изображения из ImageGenerationDialog
  const handleImageGenerated = (imageUrl: string) => {
    if (generatingIndex === null) return;
    
    // Обновляем URL изображения в массиве
    const updatedMedia = [...mediaItems];
    updatedMedia[generatingIndex] = { 
      ...updatedMedia[generatingIndex], 
      url: imageUrl,
      type: 'image'
    };
    sendChanges(updatedMedia);
    
    // Закрываем диалог
    setIsImageGenerationDialogOpen(false);
    toast({
      title: "Изображение сгенерировано",
      description: "Изображение успешно создано и добавлено в медиа",
    });
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
                        onClick={() => openPromptDialog(index)}
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
                                const imgElement = e.target as HTMLImageElement;
                                imgElement.style.display = 'none';
                                if (imgElement.nextElementSibling) {
                                  (imgElement.nextElementSibling as HTMLElement).style.display = 'flex';
                                }
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

      {/* Простой диалог для ввода промпта */}
      <Dialog open={isPromptDialogOpen} onOpenChange={setIsPromptDialogOpen}>
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
              onClick={() => setIsPromptDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              onClick={() => {
                if (contentId && generatingIndex !== null) {
                  setIsPromptDialogOpen(false);
                  openGenerateImageDialog(generatingIndex);
                } else {
                  toast({
                    title: "Ошибка",
                    description: "Не удалось открыть диалог генерации изображений",
                    variant: "destructive",
                  });
                }
              }}
              disabled={!prompt || !contentId}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Использовать редактор изображений
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Полноценный диалог генерации изображений */}
      {isImageGenerationDialogOpen && contentId && (
        <ImageGenerationDialog
          contentId={contentId}
          campaignId={campaignId}
          initialContent={contentText || prompt}
          onImageGenerated={handleImageGenerated}
          onClose={() => setIsImageGenerationDialogOpen(false)}
        />
      )}
      
      {/* Кнопка для генерации изображений на основе текста контента */}
      {(contentText && contentId) && (
        <div className="mt-4 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700"
            onClick={() => {
              // Если есть хотя бы один элемент изображения, используем его
              const imageIndex = mediaItems.findIndex(item => item.type === 'image');
              if (imageIndex >= 0) {
                openGenerateImageDialog(imageIndex);
              } else if (mediaItems.length > 0) {
                // Иначе используем первый элемент и меняем его тип на изображение
                const updatedMedia = [...mediaItems];
                updatedMedia[0] = { ...updatedMedia[0], type: 'image' };
                sendChanges(updatedMedia);
                openGenerateImageDialog(0);
              } else {
                // Если нет элементов, добавляем новый
                handleAddMedia('image');
                setTimeout(() => openGenerateImageDialog(0), 100);
              }
            }}
          >
            <FileText className="h-4 w-4 mr-2" />
            Создать изображение из текста контента
          </Button>
        </div>
      )}
    </>
  );
}