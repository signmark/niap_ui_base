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
      const response = await api.post('/api/generate-image', {
        prompt,
        negativePrompt,
        width: 1024,
        height: 1024,
        numImages: 1
      }, {
        timeout: 300000 // 5 минут таймаут
      });
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Ответ от API генерации изображений:', data);
      
      if (data.success && data.data) {
        setGeneratedImages(Array.isArray(data.data) ? data.data : [data.data]);
        
        toast({
          title: 'Генерация успешна',
          description: 'Изображение было успешно сгенерировано',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.error || 'Неизвестная ошибка при генерации изображения',
        });
      }
    },
    onError: (error: any) => {
      console.error('Ошибка при генерации изображения:', error);
      
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: error.response?.data?.error || error.message || 'Ошибка при генерации изображения',
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