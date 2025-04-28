import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Calendar, CheckCircle2, Clock, FileText, Image, Video, CheckSquare, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuthStore } from "@/lib/store";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface CampaignTrendTopic {
  id: string;
  title: string;
  sourceName?: string;
  sourceUrl?: string;
  reactions: number;
  comments: number;
  views: number;
  createdAt: string;
  isBookmarked: boolean;
  campaignId: string;
  mediaLinks?: string;
  description?: string;
}

interface BusinessQuestionnaire {
  id: string;
  campaignId: string;
  companyName: string;
  businessDescription: string;
  targetAudience: string;
  productsServices: string;
  brandStyle: string;
  competitors: string;
  goals: string;
  communicationChannels: string;
  contentPreferences: string;
  additionalInfo: string;
}

interface ContentPlanGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  onPlanGenerated?: (contentItems: any[], closeDialog?: boolean) => void;
}

export function ContentPlanGenerator({
  isOpen,
  onClose,
  campaignId,
  onPlanGenerated
}: ContentPlanGeneratorProps) {
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [contentCount, setContentCount] = useState(5);
  const [selectedType, setSelectedType] = useState<string>("mixed");
  const [includeBusiness, setIncludeBusiness] = useState(true);
  const [includeGeneratedImage, setIncludeGeneratedImage] = useState(true);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("trends");
  const [generatedContentPlan, setGeneratedContentPlan] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedContentItems, setSelectedContentItems] = useState<Set<number>>(new Set());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Загружаем тренды кампании
  const { data: trendTopics = [], isLoading: isLoadingTrends } = useQuery({
    queryKey: ["campaign-trends", campaignId],
    queryFn: async ({ queryKey }) => {
      if (!campaignId) return [];
      
      try {
        const response = await apiRequest(`/api/campaign-trends?campaignId=${campaignId}`);
        return response.data || [];
      } catch (error) {
        console.error("Ошибка при загрузке трендов:", error);
        throw error;
      }
    },
    enabled: !!campaignId && isOpen
  });

  // Обработчик ошибок для трендов
  useEffect(() => {
    const handleError = (error: any) => {
      if (error) {
        toast({
          title: "Ошибка загрузки",
          description: `Не удалось загрузить тренды: ${error.message}`,
          variant: "destructive"
        });
      }
    };
    
    // Placeholder for error handling
    handleError(null);
  }, [toast]);

  // Загружаем ключевые слова кампании
  const { data: keywords = [], isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["/api/keywords", campaignId],
    queryFn: async ({ queryKey }) => {
      if (!campaignId) return [];
      
      try {
        const response = await apiRequest(`/api/keywords?campaignId=${campaignId}`);
        return response.data || [];
      } catch (error) {
        console.error("Ошибка при загрузке ключевых слов:", error);
        throw error;
      }
    },
    enabled: !!campaignId && isOpen
  });

  // Обработчик ошибок для ключевых слов
  useEffect(() => {
    const handleError = (error: any) => {
      if (error) {
        toast({
          title: "Ошибка загрузки",
          description: `Не удалось загрузить ключевые слова: ${error.message}`,
          variant: "destructive"
        });
      }
    };
    
    // Placeholder for error handling
    handleError(null);
  }, [toast]);

  // Загружаем данные бизнес-анкеты
  const { data: businessData, isLoading: isLoadingBusiness } = useQuery({
    queryKey: ["/api/business-questionnaire", campaignId],
    queryFn: async ({ queryKey }) => {
      if (!campaignId) return null;
      
      try {
        const response = await apiRequest(`/api/business-questionnaire?campaignId=${campaignId}`);
        return response.data || null;
      } catch (error: any) {
        // Если ошибка 404, значит анкеты нет, это не ошибка
        if (error.response && error.response.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!campaignId && isOpen && includeBusiness
  });

  // Обработчик ошибок для бизнес-анкеты
  useEffect(() => {
    const handleError = (error: any) => {
      if (error) {
        toast({
          title: "Ошибка загрузки",
          description: `Не удалось загрузить данные бизнеса: ${error.message}`,
          variant: "destructive"
        });
      }
    };
    
    // Placeholder for error handling
    handleError(null);
  }, [toast]);

  // Мутация для генерации контент-плана через n8n
  const generateContentPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Отправляем запрос на генерацию контент-плана:', data);
      
      // Основной запрос через API бэкенда (без прямого вызова n8n webhook)
      return await apiRequest('/api/content-plan/generate', {
        method: 'POST',
        data
      });
    },
    onSuccess: (response) => {
      setIsGenerating(false);
      console.log('Успешный ответ от API генерации контент-плана:', response);
      
      try {
        // Подробное логирование для отладки структуры ответа
        console.log('Тип ответа:', typeof response);
        console.log('Ответ является массивом?', Array.isArray(response));
        
        // Обрабатываем различные форматы ответа
        let contentPlanData = null;
        
        // Формат 1: { success: true, data: { contentPlan: [...] } }
        if (response.success && response.data && response.data.contentPlan) {
          contentPlanData = response.data.contentPlan;
          console.log('Обнаружен формат 1: success->data->contentPlan');
          console.log('Содержимое contentPlan:', JSON.stringify(response.data.contentPlan).substring(0, 300) + '...');
        } 
        // Формат 2: [{ success: true, data: { contentPlan: [...] } }]
        else if (Array.isArray(response) && response.length > 0 && response[0].data?.contentPlan) {
          contentPlanData = response[0].data.contentPlan;
          console.log('Обнаружен формат 2: [0]->data->contentPlan');
        }
        // Формат 3: [{ success: true, contentPlan: [...] }]
        else if (Array.isArray(response) && response.length > 0 && response[0].contentPlan) {
          contentPlanData = response[0].contentPlan;
          console.log('Обнаружен формат 3: [0]->contentPlan');
        }
        // Формат 4: { data: { contentPlan: [...] } }
        else if (response.data?.contentPlan) {
          contentPlanData = response.data.contentPlan;
          console.log('Обнаружен формат 4: data->contentPlan');
        }
        // Формат 5: { contentPlan: [...] }
        else if (response.contentPlan) {
          contentPlanData = response.contentPlan;
          console.log('Обнаружен формат 5: contentPlan');
        }
        // Формат 6: просто массив элементов контент-плана
        else if (Array.isArray(response) && response.length > 0 && response[0].title) {
          contentPlanData = response;
          console.log('Обнаружен формат 6: массив элементов контента');
        }
        
        // Проверяем, что получили валидные данные
        if (contentPlanData && Array.isArray(contentPlanData) && contentPlanData.length > 0) {
          console.log(`Успешно извлечен контент-план (${contentPlanData.length} элементов)`);
          toast({
            description: `Контент-план успешно сгенерирован (${contentPlanData.length} постов)`,
          });
          
          // Проверяем структуру контент-плана перед сохранением
          console.log("Структура первого элемента контент-плана:", contentPlanData[0]);
          console.log("Поля в первом элементе:", Object.keys(contentPlanData[0]));
          
          // Нормализуем структуру данных для предварительного просмотра
          const normalizedContentPlan = contentPlanData.map((item: any) => {
            // Проверяем наличие поля prompt в оригинальных данных
            console.log("Проверка наличия prompt в элементе:", item.prompt ? "Есть prompt" : "Нет prompt");
            
            // Создаем стандартизированный объект с ожидаемыми полями
            return {
              title: item.title || "Без названия",
              content: item.content || item.text || "",
              contentType: item.contentType || item.type || "text",
              scheduledAt: item.scheduledAt || item.scheduled_at || null,
              hashtags: item.hashtags || [],
              keywords: item.keywords || [],
              imageUrl: item.imageUrl || item.image_url || null,
              videoUrl: item.videoUrl || item.video_url || null,
              // Сохраняем prompt из оригинальных данных
              prompt: item.prompt || null, 
              // Также добавляем поле для сохранения исходного контента как промпта
              originalPrompt: item.prompt || null
            };
          });
          
          console.log("Нормализованный контент-план:", normalizedContentPlan[0]);
          
          // Сохраняем нормализованный контент-план для предварительного просмотра
          setGeneratedContentPlan(normalizedContentPlan);
          setShowPreview(true);
          
          // По умолчанию выбираем все элементы контент-плана
          const initialSelectedItems = new Set<number>();
          contentPlanData.forEach((_: any, index: number) => initialSelectedItems.add(index));
          setSelectedContentItems(initialSelectedItems);
          
          // Переключаемся на вкладку предпросмотра
          setActiveTab("preview");
          
          // Больше не вызываем onPlanGenerated здесь автоматически,
          // только показываем уведомление о готовности к просмотру
          toast({
            title: "Готово!",
            description: "Контент-план сгенерирован и готов к просмотру. Выберите посты для сохранения.",
          });
        } else {
          // Данные не найдены
          console.error('Не удалось извлечь контент-план из ответа:', response);
          toast({
            title: "Ошибка формата данных",
            description: "Не удалось извлечь контент-план из ответа сервера",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Ошибка при обработке ответа:', error);
        toast({
          title: "Ошибка",
          description: "При обработке контент-плана произошла ошибка: " + 
            (error instanceof Error ? error.message : "непредвиденная ошибка"),
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      setIsGenerating(false);
      console.error('Ошибка генерации контент-плана:', error);
      
      // Проверяем, является ли ошибка ошибкой авторизации
      const errorMessage = error.message || "";
      if (
        error.status === 401 ||
        errorMessage.includes("401") ||
        errorMessage.includes("авториз") ||
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("не авторизован")
      ) {
        console.log("Обнаружена ошибка авторизации, перенаправляем на страницу входа");
        toast({
          title: "Ошибка авторизации",
          description: "Ваша сессия истекла. Пожалуйста, войдите в систему заново.",
          variant: "destructive"
        });
        
        // Перенаправляем на страницу входа
        setTimeout(() => {
          useAuthStore.getState().clearAuth(); // Используем метод clearAuth из хранилища
          window.location.href = '/auth/login';
        }, 2000);
      } else {
        toast({
          title: "Ошибка генерации",
          description: error.message || "Не удалось сгенерировать контент-план",
          variant: "destructive"
        });
      }
    }
  });

  // Обработчик генерации контент-плана через n8n
  const handleGenerateContentPlan = async () => {
    // Получаем токен авторизации из Zustand store
    const authToken = useAuthStore.getState().token;
    if (!authToken) {
      console.log("Ошибка авторизации: токен не найден в store");
      toast({
        title: "Ошибка авторизации",
        description: "Вы не авторизованы в системе",
        variant: "destructive"
      });
      return;
    }
    
    console.log("Токен авторизации найден в store, продолжаем генерацию");

    // Проверяем обязательные параметры
    if (selectedTopicIds.size === 0 && activeTab === "trends") {
      toast({
        description: "Выберите хотя бы один тренд для генерации",
        variant: "destructive"
      });
      return;
    }

    if (!campaignId) {
      toast({
        title: "Ошибка",
        description: "Не указан ID кампании",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    console.log("Начало генерации контент-плана для кампании:", campaignId);
    console.log("Токен авторизации:", authToken ? "установлен" : "отсутствует");

    // Собираем выбранные тренды
    const selectedTrends = Array.from(selectedTopicIds).map(id => 
      trendTopics.find((topic: CampaignTrendTopic) => topic.id === id)
    ).filter(Boolean);

    // Формируем данные для запроса к n8n
    const requestData = {
      campaignId,
      settings: {
        postsCount: contentCount,
        contentType: selectedType,
        period: 14, // 2 недели по умолчанию
        includeImages: includeGeneratedImage && selectedType !== "text",
        includeVideos: selectedType === "video" || selectedType === "mixed",
        customInstructions: customInstructions || null
      },
      selectedTrendTopics: Array.from(selectedTopicIds),
      // Отфильтруем ключевые слова с нулевым трендом и пустыми значениями
      keywords: keywords
        .filter((kw: any) => kw.keyword && kw.keyword.trim() !== '' 
          && ((kw.trend_score && kw.trend_score > 0) || (kw.trendScore && kw.trendScore > 0)))
        .map((kw: any) => ({ 
          keyword: kw.keyword, 
          trendScore: kw.trend_score || kw.trendScore || 0 
        })),
      businessData: includeBusiness && businessData ? {
        companyName: businessData.companyName,
        businessDescription: businessData.businessDescription,
        targetAudience: businessData.targetAudience,
        productsServices: businessData.productsServices,
        brandStyle: businessData.brandStyle,
        businessValues: businessData.goals,
        competitiveAdvantages: businessData.competitors
      } : null
    };

    console.log("Данные запроса:", requestData);

    // Отправляем запрос на генерацию через n8n
    generateContentPlanMutation.mutate(requestData);
  };

  // Обработчик выбора/отмены тренда
  const toggleTopic = (topicId: string) => {
    const newSelectedTopics = new Set(selectedTopicIds);
    
    if (newSelectedTopics.has(topicId)) {
      newSelectedTopics.delete(topicId);
    } else {
      newSelectedTopics.add(topicId);
    }
    
    setSelectedTopicIds(newSelectedTopics);
  };

  // Обработчик выбора всех трендов
  const selectAllTopics = () => {
    const allTopicIds = trendTopics.map((topic: CampaignTrendTopic) => topic.id);
    setSelectedTopicIds(new Set(allTopicIds));
  };

  // Обработчик отмены выбора всех трендов
  const deselectAllTopics = () => {
    setSelectedTopicIds(new Set());
  };

  // Форматирование числа с добавлением сокращения для больших значений
  const formatNumber = (num: number): string => {
    if (num === null || num === undefined) return '0';
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    } else {
      return num.toString();
    }
  };

  // Объединяем состояния загрузки
  const isLoading = isLoadingTrends || isLoadingKeywords || (includeBusiness && isLoadingBusiness);

  // Добавляем эффект для сброса выбранных трендов при закрытии
  useEffect(() => {
    if (!isOpen) {
      setSelectedTopicIds(new Set());
    }
  }, [isOpen]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Генерация контент-плана</DialogTitle>
      </DialogHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="trends">Выбор трендов</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
          <TabsTrigger value="preview" disabled={!showPreview}>Предпросмотр</TabsTrigger>
        </TabsList>
        
        <TabsContent value="trends" className="space-y-4 mt-4">
          {isLoadingTrends ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Загрузка трендов...</span>
            </div>
          ) : trendTopics.length === 0 ? (
            <div className="text-center py-8">
              <p>Тренды не найдены для данной кампании.</p>
              <p className="text-muted-foreground mt-2">Сначала добавьте источники контента и дождитесь сбора трендов.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-sm text-muted-foreground">
                    Выбрано {selectedTopicIds.size} из {trendTopics.length} трендов
                  </span>
                </div>
                <div className="space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAllTopics}
                    disabled={trendTopics.length === 0}
                  >
                    Выбрать все
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={deselectAllTopics}
                    disabled={selectedTopicIds.size === 0}
                  >
                    Снять выбор
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 max-h-[50vh] overflow-y-auto pr-2">
                {trendTopics.map((topic: CampaignTrendTopic) => (
                  <Card 
                    key={topic.id} 
                    className={`cursor-pointer transition-colors ${
                      selectedTopicIds.has(topic.id) ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => toggleTopic(topic.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{topic.title}</CardTitle>
                        <Checkbox 
                          checked={selectedTopicIds.has(topic.id)} 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTopic(topic.id);
                          }}
                        />
                      </div>
                      <CardDescription className="flex items-center gap-2 text-xs">
                        {topic.sourceName && (
                          <span className="inline-flex items-center">
                            Источник: {topic.sourceName}
                          </span>
                        )}
                        {topic.createdAt && (
                          <span className="inline-flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {format(new Date(topic.createdAt), 'dd MMMM yyyy', {locale: ru})}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      {topic.description && (
                        <p className="text-sm line-clamp-2 mb-2">{topic.description}</p>
                      )}
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>👁 {formatNumber(topic.views || 0)}</span>
                        <span>❤️ {formatNumber(topic.reactions || 0)}</span>
                        <span>💬 {formatNumber(topic.comments || 0)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4 mt-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="content-count">Количество элементов контента</Label>
              <Input
                id="content-count"
                type="number"
                min={1}
                max={20}
                value={contentCount}
                onChange={(e) => setContentCount(parseInt(e.target.value))}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="content-type">Тип контента</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger id="content-type">
                  <SelectValue placeholder="Выберите тип контента" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">Смешанный (текст, изображения, видео)</SelectItem>
                  <SelectItem value="text">Только текст</SelectItem>
                  <SelectItem value="text-image">Текст с изображениями</SelectItem>
                  <SelectItem value="video">С видео</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="include-business" 
                checked={includeBusiness} 
                onCheckedChange={(checked) => setIncludeBusiness(checked === true)}
              />
              <Label htmlFor="include-business" className="cursor-pointer">
                Использовать данные о бизнесе
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="include-image" 
                checked={includeGeneratedImage} 
                onCheckedChange={(checked) => setIncludeGeneratedImage(checked === true)}
                disabled={selectedType === "text"}
              />
              <Label 
                htmlFor="include-image" 
                className={`cursor-pointer ${selectedType === "text" ? "text-muted-foreground" : ""}`}
              >
                Генерировать изображения для контента
              </Label>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="custom-instructions">Дополнительные инструкции</Label>
              <Textarea
                id="custom-instructions"
                placeholder="Укажите особые требования к генерируемому контенту..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          
          {isLoadingBusiness && includeBusiness && (
            <div className="flex items-center text-muted-foreground text-sm mt-4">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Загрузка данных о бизнесе...
            </div>
          )}
          
          {includeBusiness && !businessData && !isLoadingBusiness && (
            <div className="text-amber-500 text-sm mt-4">
              ⚠️ Данные о бизнесе не найдены. Заполните бизнес-анкету для лучших результатов.
            </div>
          )}
          
          {isLoadingKeywords && (
            <div className="flex items-center text-muted-foreground text-sm mt-2">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Загрузка ключевых слов...
            </div>
          )}
          
          {!isLoadingKeywords && keywords.length === 0 && (
            <div className="text-amber-500 text-sm">
              ⚠️ Ключевые слова не найдены. Добавьте ключевые слова для лучших результатов.
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="preview" className="space-y-4 mt-4">
          {generatedContentPlan.length === 0 ? (
            <div className="text-center py-8">
              <p>Сначала сгенерируйте контент-план.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-sm text-muted-foreground">
                    Выбрано {selectedContentItems.size} из {generatedContentPlan.length} элементов
                  </span>
                </div>
                <div className="space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const allItems = new Set<number>();
                      generatedContentPlan.forEach((_: any, index: number) => allItems.add(index));
                      setSelectedContentItems(allItems);
                    }}
                    disabled={generatedContentPlan.length === 0}
                  >
                    Выбрать все
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedContentItems(new Set())}
                    disabled={selectedContentItems.size === 0}
                  >
                    Снять выбор
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 max-h-[50vh] overflow-y-auto pr-2">
                {generatedContentPlan.map((item: any, index: number) => (
                  <Card 
                    key={index} 
                    className={`cursor-pointer transition-colors ${
                      selectedContentItems.has(index) ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => {
                      const newSelected = new Set(selectedContentItems);
                      if (newSelected.has(index)) {
                        newSelected.delete(index);
                      } else {
                        newSelected.add(index);
                      }
                      setSelectedContentItems(newSelected);
                    }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{item.title}</CardTitle>
                        <Checkbox 
                          checked={selectedContentItems.has(index)} 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newSelected = new Set(selectedContentItems);
                            if (newSelected.has(index)) {
                              newSelected.delete(index);
                            } else {
                              newSelected.add(index);
                            }
                            setSelectedContentItems(newSelected);
                          }}
                        />
                      </div>
                      <CardDescription className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {item.scheduledAt ? format(new Date(item.scheduledAt), 'dd MMMM yyyy, HH:mm', {locale: ru}) : 'Не запланировано'}
                        </span>
                        <span className="inline-flex items-center">
                          {item.contentType === 'text' && <FileText className="h-3 w-3 mr-1" />}
                          {item.contentType === 'text-image' && <Image className="h-3 w-3 mr-1" />}
                          {item.contentType === 'video' && <Video className="h-3 w-3 mr-1" />}
                          {item.contentType}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-sm line-clamp-3 mb-2">{item.content}</p>
                      {item.hashtags && item.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {item.hashtags.map((tag: string, tagIndex: number) => (
                            <span key={tagIndex} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.keywords && item.keywords.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-2">
                          <span className="block font-medium">Ключевые слова:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.keywords.map((kw: any, kwIndex: number) => {
                              // Проверяем, является ли ключевое слово объектом или строкой
                              const keywordText = typeof kw === 'string' ? kw : (kw.keyword || kw);
                              const trendScore = typeof kw === 'object' ? (kw.trendScore || kw.trend_score || 0) : 0;
                              
                              // Если тренд отрицательный или нулевой, не отображаем его значение
                              
                              return (
                                <span key={kwIndex} className="bg-muted px-2 py-0.5 rounded-md">
                                  {keywordText}{trendScore > 0 ? ` (${trendScore})` : ''}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
      
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        
        {activeTab === "preview" && showPreview ? (
          <Button 
            onClick={() => {
              // Выбираем только те элементы контент-плана, которые были отмечены пользователем
              const selectedContent = Array.from(selectedContentItems).map(index => {
                const item = generatedContentPlan[index];
                
                // Подробное логирование для отладки
                console.log(`Передача элемента ${index} в родительский компонент:`, item);
                console.log(`Промпт в элементе: ${item.prompt || 'не указан'}`);
                
                // Сохраняем как оригинальный текст контента, так и промпт (если есть)
                // для использования при генерации изображений
                return {
                  ...item,
                  originalContent: item.content, // Сохраняем оригинальный текст как запасной вариант
                  // Используем промпт (если он есть) или контент в качестве промпта для изображений
                  imagePrompt: item.prompt || item.content 
                };
              });
              
              if (selectedContent.length === 0) {
                toast({
                  title: "Внимание",
                  description: "Выберите хотя бы один элемент контент-плана",
                  variant: "destructive"
                });
                return;
              }
              
              console.log("Сохраняем выбранный контент с оригинальным текстом для промптов:", selectedContent);
              
              if (onPlanGenerated) {
                // Вызываем с параметром true для закрытия диалога
                // Родительский компонент сам позаботится о закрытии диалога
                onPlanGenerated(selectedContent, true);
              } else {
                // Если onPlanGenerated не определен, просто закрываем диалог напрямую
                toast({
                  description: "Контент-план сохранен",
                });
                
                onClose();
              }
            }}
            disabled={selectedContentItems.size === 0}
          >
            Сохранить выбранное
          </Button>
        ) : (
          <Button 
            onClick={handleGenerateContentPlan} 
            disabled={isLoading || isGenerating || (activeTab === "trends" && selectedTopicIds.size === 0)}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Генерация...
              </>
            ) : (
              "Сгенерировать контент-план"
            )}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}