import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VideoUploader } from "./VideoUploader";
import { Plus, Trash2, ImageIcon, Wand2, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ImageGenerationDialog } from "./ImageGenerationDialog";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Интерфейс для элемента медиа
export interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

// Интерфейс для данных контента
interface ContentItem {
  id: string;
  prompt?: string;
  content?: string;
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
  
  // Состояния для диалога генерации изображений
  const [isImageGenerationDialogOpen, setIsImageGenerationDialogOpen] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  // Состояние для хранения промпта
  const [prompt, setPrompt] = useState("");
  // Состояние для хранения данных контента
  const [contentData, setContentData] = useState<ContentItem | null>(null);
  
  // Запрашиваем данные контента, если у нас есть contentId
  const { data: fetchedContentData, isLoading: isLoadingContent } = useQuery({
    queryKey: ['content', contentId],
    queryFn: async () => {
      if (!contentId) return null;
      try {
        console.log(`Запрашиваем данные контента для ID: ${contentId}`);
        const response = await api.get(`/api/content/${contentId}`);
        return response.data?.data || null;
      } catch (error) {
        console.error("Ошибка при получении данных контента:", error);
        return null;
      }
    },
    enabled: !!contentId // Запрос активен только если у нас есть contentId
  });
  
  // Обновляем contentData, когда данные будут загружены
  useEffect(() => {
    if (fetchedContentData) {
      console.log("Получены данные контента:", fetchedContentData);
      // Преобразуем данные в правильный формат ContentItem
      const formattedData: ContentItem = {
        id: fetchedContentData.id,
        prompt: fetchedContentData.prompt || "",
        content: fetchedContentData.content || ""
      };
      setContentData(formattedData);
    }
  }, [fetchedContentData]);
  
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
  
  // Простой диалог для ввода промпта был удален по требованию пользователя
  
  // Функция для открытия полноценного диалога генерации изображений
  const openGenerateImageDialog = (index: number) => {
    setGeneratingIndex(index);
    
    // Очищаем prompt для примера, так как мы отправляем contentText напрямую в диалог
    setPrompt("");
    
    // Проверяем загрузку данных контента
    if (contentId && !isLoadingContent && !contentData) {
      console.log("⚠️ Данные контента еще не загружены при ID:", contentId);
      
      // Делаем прямой запрос к API, чтобы гарантировать наличие данных
      api.get(`/api/content/${contentId}`)
        .then(response => {
          const loadedData = response.data?.data || null;
          if (loadedData) {
            console.log("✅ Загружены данные контента:", loadedData);
            
            // Обновляем состояние
            const formattedData: ContentItem = {
              id: loadedData.id,
              prompt: loadedData.prompt || "",
              content: loadedData.content || ""
            };
            setContentData(formattedData);
            
            console.log("📝 Использую промпт из загруженных данных:", loadedData.prompt || "(пусто)");
            
            // Открываем диалог с небольшой задержкой
            setTimeout(() => {
              setIsImageGenerationDialogOpen(true);
            }, 100);
          } else {
            console.log("❌ Не удалось загрузить данные контента");
            setIsImageGenerationDialogOpen(true); // Открываем диалог в любом случае
          }
        })
        .catch(error => {
          console.error("❌ Ошибка при получении данных контента:", error);
          setIsImageGenerationDialogOpen(true); // Открываем диалог в любом случае
        });
    } else {
      // Логируем информацию о наличии текста контента для отладки
      if (contentText) {
        console.log("Передаем текст контента в диалог:", contentText.substring(0, 50) + "...");
      } else {
        console.log("Текст контента отсутствует при открытии диалога");
      }
      
      if (contentData?.prompt) {
        console.log("Передаем промпт в диалог:", contentData.prompt.substring(0, 50) + "...");
      } else {
        console.log("Промпт отсутствует при открытии диалога");
      }
      
      setIsImageGenerationDialogOpen(true);
    }
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
                        onClick={() => openGenerateImageDialog(index)}
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

      {/* Простой диалог для ввода промпта удален по требованию пользователя */}
      
      {/* Полноценный диалог генерации изображений */}
      {isImageGenerationDialogOpen && (
        <ImageGenerationDialog
          contentId={contentId}
          campaignId={campaignId}
          initialContent={contentText || ""}
          initialPrompt=""
          // Явно передаем параметры contentText и promptText для исправления проблемы
          contentText={contentText || ""}
          promptText={contentData?.prompt || ""}
          onImageGenerated={handleImageGenerated}
          onClose={() => setIsImageGenerationDialogOpen(false)}
        />
      )}
      
      {/* Кнопка "Создать изображение из текста контента" удалена по требованию пользователя */}
    </>
  );
}