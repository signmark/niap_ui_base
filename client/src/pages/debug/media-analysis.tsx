import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from '@/lib/queryClient';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

export default function MediaAnalysisDebugPage() {
  const [mediaUrl, setMediaUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const sampleImages = [
    'https://images.unsplash.com/photo-1682687982501-1e58ab814714',
    'https://images.unsplash.com/photo-1682695797873-aa4a7ab40343',
    'https://images.pexels.com/photos/19060818/pexels-photo-19060818/free-photo-of-woman-in-knitted-sweater-sitting-on-chair.jpeg',
  ];

  // Функция для анализа медиаконтента
  const analyzeMedia = async () => {
    if (!mediaUrl) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, введите URL изображения или видео",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await apiRequest('/api/analyze-media', {
        method: 'POST',
        data: { mediaUrl }
      });

      if (response.success) {
        setResult(response.results);
        toast({
          title: "Анализ завершен",
          description: "Медиаконтент успешно проанализирован с помощью Qwen-VL",
        });
      } else {
        toast({
          title: "Ошибка",
          description: response.error || "Не удалось проанализировать медиаконтент",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Ошибка при анализе медиаконтента:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось проанализировать медиаконтент",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setSampleImage = (url: string) => {
    setMediaUrl(url);
  };

  return (
    <div className="container py-8 mx-auto">
      <h1 className="text-3xl font-bold mb-6">Тестирование анализа медиаконтента</h1>
      <p className="mb-6 text-gray-600">На этой странице вы можете протестировать функции анализа изображений и видео с помощью Qwen-VL.</p>
      
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Анализ медиаконтента</CardTitle>
            <CardDescription>
              Введите URL изображения или видео для анализа с помощью Qwen-VL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Input
                  placeholder="Введите URL изображения или видео"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="mb-2"
                />
                <div className="text-sm text-gray-500 mb-4">
                  Примечание: для доступа к контенту из социальных сетей может потребоваться авторизация
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium mb-2">Примеры изображений:</p>
                <div className="flex flex-wrap gap-2">
                  {sampleImages.map((url, index) => (
                    <Button 
                      key={index} 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSampleImage(url)}
                    >
                      Пример {index + 1}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={analyzeMedia} 
              disabled={isLoading || !mediaUrl}
              className="w-full"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Анализ...' : 'Проанализировать медиаконтент'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Результаты анализа</CardTitle>
            <CardDescription>
              Здесь будут отображены результаты анализа медиаконтента
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Анализ медиаконтента...</span>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div className="rounded-lg overflow-hidden">
                  {result.mediaType === 'image' ? (
                    <img 
                      src={mediaUrl} 
                      alt="Анализируемое изображение" 
                      className="w-full h-auto rounded border"
                      style={{ maxHeight: '300px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="bg-gray-100 p-4 rounded text-center">
                      <p>Превью видео недоступно</p>
                      <p className="text-xs text-gray-500 mt-1">{mediaUrl}</p>
                    </div>
                  )}
                </div>
                
                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-2">Общее описание</h3>
                  <p>{result.description || 'Описание недоступно'}</p>
                </div>

                {result.objects && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Распознанные объекты</h3>
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(result.objects) 
                        ? result.objects.map((obj: string, i: number) => (
                            <span key={i} className="bg-gray-100 px-2 py-1 rounded text-sm">
                              {obj}
                            </span>
                          ))
                        : typeof result.objects === 'string' 
                          ? result.objects 
                          : 'Нет данных'
                      }
                    </div>
                  </div>
                )}

                {result.colors && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Основные цвета</h3>
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(result.colors) 
                        ? result.colors.map((color: string, i: number) => (
                            <span key={i} className="bg-gray-100 px-2 py-1 rounded text-sm">
                              {color}
                            </span>
                          ))
                        : typeof result.colors === 'string'
                          ? result.colors
                          : 'Нет данных'
                      }
                    </div>
                  </div>
                )}

                {result.mood && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Настроение</h3>
                    <p>{result.mood}</p>
                  </div>
                )}

                {result.engagement_factors && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Факторы вовлечения</h3>
                    <p>{result.engagement_factors}</p>
                  </div>
                )}

                {result.recommendations && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Рекомендации</h3>
                    <p>{result.recommendations}</p>
                  </div>
                )}

                {result.text && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Распознанный текст</h3>
                    <p className="bg-gray-50 p-2 rounded">{result.text}</p>
                  </div>
                )}

                {result.isPreviewOnly && (
                  <div className="bg-yellow-50 p-2 rounded mt-4">
                    <p className="text-yellow-600 text-sm">
                      Примечание: Анализ основан только на превью видео, а не на полном содержимом.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>Здесь появятся результаты анализа медиаконтента</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            {result && (
              <Button variant="outline" onClick={() => setResult(null)}>
                Очистить
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Полные данные анализа (для отладки) */}
      {result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Полные данные анализа (JSON)</CardTitle>
            <CardDescription>
              Полная структура данных, полученная от API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[400px] text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}