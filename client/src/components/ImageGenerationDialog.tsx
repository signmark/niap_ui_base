import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Image, RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

interface ImageGenerationDialogProps {
  campaignId?: string;
  businessData?: {
    companyName: string;
    businessDescription: string;
    brandImage: string;
    productsServices: string;
  };
  onImageGenerated?: (imageUrl: string) => void;
  onClose: () => void;
}

export function ImageGenerationDialog({
  campaignId,
  businessData,
  onImageGenerated,
  onClose
}: ImageGenerationDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("prompt");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [imageSize, setImageSize] = useState<string>("1024x1024");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState<"instagram" | "telegram" | "vk" | "facebook">("instagram");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  
  const { toast } = useToast();
  
  // Разбор размера изображения на ширину и высоту
  const getImageDimensions = () => {
    const [width, height] = imageSize.split("x").map(Number);
    return { width, height };
  };

  // Мутация для генерации изображения
  const { mutate: generateImage, isPending } = useMutation({
    mutationFn: async () => {
      let requestData = {};
      
      if (activeTab === "prompt") {
        // Прямая генерация по промпту
        const { width, height } = getImageDimensions();
        requestData = {
          prompt,
          negativePrompt,
          width,
          height,
          campaignId,
          numImages: 1 // Уменьшаем до 1 изображения для ускорения обработки
        };
      } else if (activeTab === "business") {
        // Генерация на основе данных бизнеса
        if (!businessData) {
          throw new Error("Необходимо заполнить данные о бизнесе в анкете");
        }
        requestData = {
          businessData,
          campaignId
        };
      } else if (activeTab === "social") {
        // Генерация для социальных сетей
        if (!content) {
          throw new Error("Необходимо ввести контент для генерации");
        }
        requestData = {
          content,
          platform,
          campaignId
        };
      }
      
      console.log("Отправка запроса на генерацию изображения:", JSON.stringify(requestData).substring(0, 100) + "...");
      
      // Устанавливаем увеличенный таймаут для запроса
      const response = await api.post("/generate-image", requestData, {
        timeout: 300000 // 5 минут таймаут
      });
      
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Ответ от API генерации изображений:', JSON.stringify(data).substring(0, 100) + '...');
      
      console.log('Структура ответа:', JSON.stringify(data, null, 2).substring(0, 200));
      
      if (data.success) {
        // Обработка разных форматов ответа от API
        let images: string[] = [];
        
        if (data.data?.images && Array.isArray(data.data.images)) {
          // Формат с вложенным массивом images
          images = data.data.images;
        }
        else if (Array.isArray(data.data)) {
          // Прямой массив URL-ов изображений
          images = data.data;
        }
        else if (typeof data.data === 'string') {
          // Один URL в виде строки
          images = [data.data];
        }
        
        if (images.length > 0) {
          setGeneratedImages(images);
          setSelectedImageIndex(-1); // Сбрасываем выбор изображения
          
          toast({
            title: "Успешно",
            description: `Сгенерировано ${images.length} ${images.length === 1 ? 'изображение' : 'изображений'}`
          });
        } else {
          console.error('Не удалось найти изображения в ответе:', data);
          toast({
            variant: "destructive",
            title: "Ошибка при обработке результата",
            description: "Не удалось найти URL изображений в ответе сервера"
          });
        }
      } else {
        console.error('Неожиданный формат ответа от API:', data);
        toast({
          variant: "destructive",
          title: "Ошибка при обработке результата",
          description: "Получен неожиданный формат данных от сервера"
        });
      }
    },
    onError: (error: Error) => {
      console.error('Ошибка при генерации изображения:', error);
      
      // Определяем тип ошибки для более понятного сообщения
      let errorMessage = error.message || "Произошла ошибка при генерации изображения";
      
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
        errorMessage = "Ошибка соединения с сервисом генерации изображений. Проверьте настройки сети.";
      } else if (errorMessage.includes('timeout')) {
        errorMessage = "Превышено время ожидания ответа от сервиса. Попробуйте позже.";
      } else if (errorMessage.includes('API ключ не настроен') || errorMessage.includes('API ключ для FAL.AI не настроен')) {
        errorMessage = "API ключ для FAL.AI не настроен. Перейдите в настройки для добавления ключа.";
      } else if (errorMessage.includes('unauthorized') || errorMessage.includes('Unauthorized') || errorMessage.includes('Неверный API ключ')) {
        errorMessage = "Отсутствует или неверный ключ API. Проверьте настройки в разделе API ключей.";
      } else if (errorMessage.includes('rejectUnauthorized') || errorMessage.includes('certificate')) {
        errorMessage = "Проблема с SSL-сертификатом при подключении к API. Идет работа через альтернативный метод.";
      } else if (errorMessage.includes('DNS')) {
        errorMessage = "Проблема с DNS-разрешением при подключении к API. Используется альтернативный способ доступа.";
      } else if (errorMessage.includes('прокси') || errorMessage.includes('proxy')) {
        errorMessage = "Ошибка при использовании прокси-сервера. Команда разработки уже работает над исправлением.";
      }
      
      toast({
        variant: "destructive",
        title: "Ошибка генерации",
        description: errorMessage
      });
    }
  });
  
  // Выбор изображения и закрытие диалога
  const handleSelectImage = (index: number) => {
    if (index >= 0 && index < generatedImages.length) {
      setSelectedImageIndex(index);
      
      if (onImageGenerated) {
        onImageGenerated(generatedImages[index]);
      }
    }
  };
  
  // Функция для подтверждения выбора
  const confirmSelection = () => {
    if (selectedImageIndex >= 0) {
      if (onImageGenerated) {
        onImageGenerated(generatedImages[selectedImageIndex]);
      }
      onClose();
    } else {
      toast({
        variant: "destructive",
        title: "Выберите изображение",
        description: "Пожалуйста, выберите одно из сгенерированных изображений"
      });
    }
  };

  return (
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Генерация изображений</DialogTitle>
      </DialogHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="prompt">Произвольный запрос</TabsTrigger>
          <TabsTrigger value="business" disabled={!businessData}>Для бизнеса</TabsTrigger>
          <TabsTrigger value="social">Для соцсетей</TabsTrigger>
        </TabsList>
        
        {/* Содержимое вкладки с промптом */}
        <TabsContent value="prompt" className="space-y-4">
          <div className="space-y-2">
            <Label>Запрос (промпт)</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Опишите, какое изображение вы хотите получить..."
              className="min-h-[100px]"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Негативный запрос (чего избегать)</Label>
            <Input
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="bad quality, blurry, distorted, etc."
            />
          </div>
          
          <div className="space-y-2">
            <Label>Размер изображения</Label>
            <RadioGroup value={imageSize} onValueChange={setImageSize} className="flex space-x-2">
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="1024x1024" id="r1" />
                <Label htmlFor="r1">1024x1024</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="1024x768" id="r2" />
                <Label htmlFor="r2">1024x768</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="768x1024" id="r3" />
                <Label htmlFor="r3">768x1024</Label>
              </div>
            </RadioGroup>
          </div>
        </TabsContent>
        
        {/* Содержимое вкладки для бизнеса */}
        <TabsContent value="business" className="space-y-4">
          {businessData ? (
            <div className="rounded-md border p-4 space-y-2">
              <div>
                <Label className="font-semibold">Название компании:</Label>
                <p>{businessData.companyName}</p>
              </div>
              <div>
                <Label className="font-semibold">Описание бизнеса:</Label>
                <p className="text-sm">{businessData.businessDescription}</p>
              </div>
              <div>
                <Label className="font-semibold">Образ бренда:</Label>
                <p className="text-sm">{businessData.brandImage}</p>
              </div>
              <p className="text-xs text-muted-foreground italic mt-2">
                Изображение будет сгенерировано автоматически на основе этих данных
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p>Необходимо заполнить бизнес-анкету для использования этой опции</p>
            </div>
          )}
        </TabsContent>
        
        {/* Содержимое вкладки для соцсетей */}
        <TabsContent value="social" className="space-y-4">
          <div className="space-y-2">
            <Label>Контент для социальных сетей</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Введите текст поста, для которого нужно сгенерировать изображение..."
              className="min-h-[100px]"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Платформа</Label>
            <RadioGroup value={platform} onValueChange={(value: any) => setPlatform(value)} className="flex space-x-2">
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="instagram" id="p1" />
                <Label htmlFor="p1">Instagram</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="telegram" id="p2" />
                <Label htmlFor="p2">Telegram</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="vk" id="p3" />
                <Label htmlFor="p3">VK</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="facebook" id="p4" />
                <Label htmlFor="p4">Facebook</Label>
              </div>
            </RadioGroup>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Кнопка генерации */}
      <Button 
        onClick={() => generateImage()} 
        disabled={
          isPending || 
          (activeTab === "prompt" && !prompt) || 
          (activeTab === "business" && !businessData) || 
          (activeTab === "social" && !content)
        }
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Генерация...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Сгенерировать изображение
          </>
        )}
      </Button>
      
      {/* Отображение сгенерированных изображений */}
      {generatedImages.length > 0 && (
        <div className="mt-4 space-y-4">
          <h3 className="text-lg font-semibold">Сгенерированные изображения</h3>
          <div className="grid grid-cols-2 gap-4">
            {generatedImages.map((imageUrl, index) => (
              <div 
                key={index}
                className={`relative rounded-md overflow-hidden border-2 cursor-pointer ${selectedImageIndex === index ? 'border-primary' : 'border-transparent'}`}
                onClick={() => handleSelectImage(index)}
              >
                <img 
                  src={imageUrl} 
                  alt={`Сгенерированное изображение ${index + 1}`} 
                  className="w-full h-auto object-cover aspect-square"
                />
              </div>
            ))}
          </div>
          
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => generateImage()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Сгенерировать еще
            </Button>
            <Button 
              onClick={confirmSelection}
              disabled={selectedImageIndex < 0}
            >
              <Image className="mr-2 h-4 w-4" />
              Использовать выбранное
            </Button>
          </div>
        </div>
      )}
    </DialogContent>
  );
}