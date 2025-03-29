import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Loader2, 
  Image as ImageIcon, 
  Video, 
  Droplets, 
  ShapesIcon, 
  PencilIcon, 
  LayoutIcon, 
  SmileIcon, 
  GaugeIcon 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface MediaAnalysisResult {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  objects?: string[];
  textContent?: string[];
  colors?: string[];
  composition?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  engagement?: number;
  resolution?: { width: number; height: number };
  aspectRatio?: string;
  dominant_colors?: string[];
  duration?: number;
  keyScenes?: Array<{ timestamp: number; description: string }>;
  audio?: {
    hasMusic: boolean;
    hasSpeech: boolean;
    speechText?: string;
  };
  timestamp: string | Date;
}

interface MediaAnalysisPanelProps {
  trendId: string;
  mediaUrl?: string;
  isVisible?: boolean;
}

export function MediaAnalysisPanel({ trendId, mediaUrl, isVisible = true }: MediaAnalysisPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("overview");
  
  // Получаем результаты анализа медиа
  const { data: analysisResult, isLoading, isError, error } = useQuery({
    queryKey: ["media-analysis", trendId, mediaUrl],
    queryFn: async () => {
      try {
        // Получаем токен авторизации из localStorage
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
          throw new Error("Требуется авторизация");
        }
        
        // Если нет URL медиа, возвращаем null
        if (!mediaUrl) {
          return null;
        }
        
        // Запрос к API для анализа медиа
        const response = await fetch(`/api/media-analysis?trendId=${trendId}&mediaUrl=${encodeURIComponent(mediaUrl)}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Не удалось получить анализ медиа");
        }
        
        const data = await response.json();
        return data.result as MediaAnalysisResult;
      } catch (error) {
        console.error("Error fetching media analysis:", error);
        throw error;
      }
    },
    enabled: !!trendId && !!mediaUrl && isVisible
  });
  
  // Обработка ошибок
  useEffect(() => {
    if (isError) {
      toast({
        variant: "destructive",
        title: "Ошибка анализа медиа",
        description: error instanceof Error ? error.message : "Не удалось проанализировать медиаконтент"
      });
    }
  }, [isError, error, toast]);
  
  // Если нет URL медиа или компонент скрыт
  if (!mediaUrl || !isVisible) {
    return null;
  }
  
  // Пока идет загрузка
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Анализ медиаконтента</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center p-6">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Анализируем медиаконтент...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Если нет результатов анализа
  if (!analysisResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Анализ медиаконтента</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            Нет данных для анализа или медиаконтент не поддерживается.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Получаем иконку и название типа медиа
  const mediaTypeIcon = analysisResult.mediaType === 'image' ? <ImageIcon className="h-4 w-4" /> : <Video className="h-4 w-4" />;
  const mediaTypeName = analysisResult.mediaType === 'image' ? 'Изображение' : 'Видео';
  
  // Генерируем цветовые блоки для отображения
  const renderColorBlocks = () => {
    if (!analysisResult.colors || analysisResult.colors.length === 0) {
      return <p className="text-sm text-muted-foreground">Данные о цветах отсутствуют.</p>;
    }
    
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {analysisResult.colors.map((color, index) => (
          <div 
            key={index} 
            className="flex flex-col items-center"
          >
            <div 
              className="h-8 w-8 rounded-md border"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs mt-1">{color}</span>
          </div>
        ))}
      </div>
    );
  };
  
  // Рендерим компонент с результатами анализа
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/50">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Анализ медиаконтента</CardTitle>
          <Badge variant="outline" className="flex gap-1 items-center">
            {mediaTypeIcon}
            <span>{mediaTypeName}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            {analysisResult.mediaType === 'image' && (
              <TabsTrigger value="image">Изображение</TabsTrigger>
            )}
            {analysisResult.mediaType === 'video' && (
              <TabsTrigger value="video">Видео</TabsTrigger>
            )}
            <TabsTrigger value="engagement">Вовлеченность</TabsTrigger>
          </TabsList>
          
          {/* Вкладка общего обзора */}
          <TabsContent value="overview" className="p-4">
            <div className="space-y-4">
              <div className="mb-2">
                <img 
                  src={mediaUrl} 
                  alt="Контент тренда" 
                  className="w-full h-auto rounded-md object-cover max-h-[200px]"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-image.jpg';
                  }}
                />
              </div>

              <Accordion type="single" collapsible className="w-full">
                {/* Объекты на медиа */}
                {analysisResult.objects && analysisResult.objects.length > 0 && (
                  <AccordionItem value="objects">
                    <AccordionTrigger className="flex gap-2">
                      <ShapesIcon className="h-4 w-4" />
                      <span>Объекты</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {analysisResult.objects.map((object, index) => (
                          <Badge key={index} variant="secondary">{object}</Badge>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
                
                {/* Цвета */}
                {analysisResult.colors && analysisResult.colors.length > 0 && (
                  <AccordionItem value="colors">
                    <AccordionTrigger className="flex gap-2">
                      <Droplets className="h-4 w-4" />
                      <span>Цветовая схема</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {renderColorBlocks()}
                    </AccordionContent>
                  </AccordionItem>
                )}
                
                {/* Текст (если есть) */}
                {analysisResult.textContent && analysisResult.textContent.length > 0 && (
                  <AccordionItem value="text">
                    <AccordionTrigger className="flex gap-2">
                      <PencilIcon className="h-4 w-4" />
                      <span>Текст</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc pl-5 space-y-1">
                        {analysisResult.textContent.map((text, index) => (
                          <li key={index} className="text-sm">{text}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}
                
                {/* Композиция */}
                {analysisResult.composition && (
                  <AccordionItem value="composition">
                    <AccordionTrigger className="flex gap-2">
                      <LayoutIcon className="h-4 w-4" />
                      <span>Композиция</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm">{analysisResult.composition}</p>
                    </AccordionContent>
                  </AccordionItem>
                )}
                
                {/* Эмоциональный тон */}
                {analysisResult.sentiment && (
                  <AccordionItem value="sentiment">
                    <AccordionTrigger className="flex gap-2">
                      <SmileIcon className="h-4 w-4" />
                      <span>Эмоциональный тон</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Badge variant={
                        analysisResult.sentiment === 'positive' ? 'success' :
                        analysisResult.sentiment === 'negative' ? 'destructive' : 
                        'outline'
                      }>
                        {analysisResult.sentiment === 'positive' ? 'Позитивный' :
                         analysisResult.sentiment === 'negative' ? 'Негативный' : 
                         'Нейтральный'}
                      </Badge>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </div>
          </TabsContent>
          
          {/* Вкладка для изображений */}
          {analysisResult.mediaType === 'image' && (
            <TabsContent value="image" className="p-4">
              <div className="space-y-4">
                {analysisResult.resolution && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Разрешение</span>
                    <p className="text-sm text-muted-foreground">
                      {`${analysisResult.resolution.width} × ${analysisResult.resolution.height}`}
                    </p>
                  </div>
                )}
                
                {analysisResult.aspectRatio && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Соотношение сторон</span>
                    <p className="text-sm text-muted-foreground">{analysisResult.aspectRatio}</p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
          
          {/* Вкладка для видео */}
          {analysisResult.mediaType === 'video' && (
            <TabsContent value="video" className="p-4">
              <div className="space-y-4">
                {analysisResult.duration !== undefined && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Длительность</span>
                    <p className="text-sm text-muted-foreground">
                      {`${Math.floor(analysisResult.duration / 60)}:${String(Math.floor(analysisResult.duration % 60)).padStart(2, '0')}`}
                    </p>
                  </div>
                )}
                
                {analysisResult.audio && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Аудио</span>
                    <div className="flex gap-2">
                      {analysisResult.audio.hasMusic && (
                        <Badge variant="outline">Музыка</Badge>
                      )}
                      {analysisResult.audio.hasSpeech && (
                        <Badge variant="outline">Речь</Badge>
                      )}
                    </div>
                    {analysisResult.audio.hasSpeech && analysisResult.audio.speechText && (
                      <div className="mt-2">
                        <span className="text-xs font-medium">Распознанная речь:</span>
                        <p className="text-xs text-muted-foreground mt-1">{analysisResult.audio.speechText}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {analysisResult.keyScenes && analysisResult.keyScenes.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Ключевые сцены</span>
                    <div className="space-y-2 mt-1">
                      {analysisResult.keyScenes.map((scene, index) => (
                        <div key={index} className="flex gap-2 items-start">
                          <Badge variant="outline" className="whitespace-nowrap">
                            {`${Math.floor(scene.timestamp / 60)}:${String(Math.floor(scene.timestamp % 60)).padStart(2, '0')}`}
                          </Badge>
                          <p className="text-xs">{scene.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
          
          {/* Вкладка с показателями вовлеченности */}
          <TabsContent value="engagement" className="p-4">
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Уровень вовлеченности</span>
                  <span className="text-sm font-medium">
                    {analysisResult.engagement ? `${Math.round(analysisResult.engagement)}%` : 'Н/Д'}
                  </span>
                </div>
                {analysisResult.engagement && (
                  <Progress value={analysisResult.engagement} className="h-2" />
                )}
              </div>
              
              <div className="bg-muted/40 p-3 rounded-md mt-4">
                <p className="text-xs text-muted-foreground">
                  Показатели вовлеченности рассчитываются на основе сравнения этого медиаконтента с другими трендовыми публикациями. Учитываются цвета, композиция, количество объектов и другие факторы.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}