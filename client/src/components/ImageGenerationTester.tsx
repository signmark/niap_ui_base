import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Компонент для тестирования генерации изображений через FAL.AI API
 */
export function ImageGenerationTester() {
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const { toast } = useToast();

  const { mutate: generateImage, isPending } = useMutation({
    mutationFn: async () => {
      // Получаем API ключ из системных настроек
      // Сначала запрашиваем ключ с сервера
      const apiResponse = await api.get('/api/settings/fal_ai');
      
      if (!apiResponse.data?.success || !apiResponse.data?.data?.api_key) {
        throw new Error('API ключ FAL.AI не найден в настройках системы');
      }
      
      const falApiKey = apiResponse.data.data.api_key;
      
      // Прямой запрос к FAL.AI API с полученным ключом
      const response = await fetch('https://queue.fal.ai/fal-ai/fast-sdxl/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${falApiKey}`,
        },
        body: JSON.stringify({
          prompt: prompt,
          negative_prompt: negativePrompt || "",
          width: 1024,
          height: 1024,
          num_images: 1
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.message || 'Ошибка при генерации изображения');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      console.log('Ответ от FAL.AI API:', data);
      
      // Проверяем, есть ли URL изображения в ответе
      if (data && data.status === "IN_QUEUE") {
        toast({
          title: 'Запрос в очереди',
          description: 'Запрос на генерацию изображения поставлен в очередь. Подождите немного.',
        });
        
        return;
      }
      
      // Получаем URL изображений из ответа
      const imageUrls: string[] = [];
      
      if (data.resources && Array.isArray(data.resources)) {
        // Формат через resources
        imageUrls.push(...data.resources.map((r: any) => r.url).filter(Boolean));
      } else if (data.output && Array.isArray(data.output)) {
        // Формат через output - массив
        imageUrls.push(...data.output.filter(Boolean));
      } else if (data.output) {
        // Формат через output - строка
        imageUrls.push(data.output);
      } else if (data.images && Array.isArray(data.images)) {
        // Формат через images
        imageUrls.push(...data.images.map((img: any) => {
          if (typeof img === 'string') return img;
          return img.url || img.image || '';
        }).filter(Boolean));
      }
      
      if (imageUrls.length > 0) {
        setGeneratedImages(imageUrls);
        
        toast({
          title: 'Генерация успешна',
          description: `Успешно сгенерировано изображений: ${imageUrls.length}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка формата',
          description: 'Не удалось получить URL изображений из ответа API',
        });
      }
    },
    onError: (error: any) => {
      console.error('Ошибка при генерации изображения:', error);
      
      toast({
        variant: 'destructive',
        title: 'Ошибка генерации',
        description: error.message || 'Ошибка при генерации изображения',
      });
    }
  });

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Тестирование генерации изображений</CardTitle>
        <CardDescription>
          Используйте эту форму для проверки работы API генерации изображений через FAL.AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt">Промпт для генерации</Label>
          <Textarea
            id="prompt"
            placeholder="Опишите изображение, которое хотите сгенерировать..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="negative-prompt">Негативный промпт (необязательно)</Label>
          <Input
            id="negative-prompt"
            placeholder="То, что не должно быть на изображении..."
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
          />
        </div>
        
        {generatedImages.length > 0 && (
          <div className="space-y-4 mt-6">
            <h3 className="text-lg font-medium">Сгенерированные изображения:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedImages.map((imageUrl, index) => (
                <div key={index} className="relative rounded-md overflow-hidden border">
                  <img 
                    src={imageUrl} 
                    alt={`Сгенерированное изображение ${index + 1}`} 
                    className="w-full h-auto"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-image.jpg';
                      console.error(`Ошибка загрузки изображения: ${imageUrl}`);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={() => generateImage()} 
          disabled={isPending || !prompt}
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
      </CardFooter>
    </Card>
  );
}