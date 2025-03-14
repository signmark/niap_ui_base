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
import { Loader2, Calendar, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  onPlanGenerated?: (contentItems: any[]) => void;
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
      
      // Прямой запрос к n8n webhook для отладки (опционально)
      try {
        // Получаем API ключ из локального хранилища или из окружения
        const n8nApiKey = localStorage.getItem('n8nApiKey') || '';
        
        const directResponse = await fetch('https://n8n.nplanner.ru/webhook/ae581e17-651d-4b14-8fb1-ca16898bca1b', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-N8N-API-KEY': n8nApiKey
          },
          body: JSON.stringify({ 
            data: {
              ...data, 
              directusToken: localStorage.getItem('authToken') || ''
            } 
          })
        });
        
        console.log('Прямой ответ от n8n webhook:', await directResponse.text());
      } catch (directError) {
        console.warn('Ошибка прямого запроса к n8n webhook:', directError);
      }
      
      // Основной запрос через API бэкенда
      return await apiRequest('/api/content-plan/generate', {
        method: 'POST',
        data
      });
    },
    onSuccess: (response) => {
      setIsGenerating(false);
      console.log('Успешный ответ от API генерации контент-плана:', response);
      
      if (response.success && response.data && response.data.contentPlan) {
        toast({
          description: "Контент-план успешно сгенерирован с использованием n8n",
        });
        
        if (onPlanGenerated) {
          onPlanGenerated(response.data.contentPlan);
        }
      } else {
        console.error('Ответ не содержит contentPlan:', response);
        toast({
          title: "Ошибка",
          description: "При генерации контент-плана произошла ошибка: " + (response.error || response.message || "структура данных некорректна"),
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      setIsGenerating(false);
      console.error('Ошибка генерации контент-плана:', error);
      toast({
        title: "Ошибка генерации",
        description: error.message || "Не удалось сгенерировать контент-план",
        variant: "destructive"
      });
    }
  });

  // Обработчик генерации контент-плана через n8n
  const handleGenerateContentPlan = async () => {
    if (selectedTopicIds.size === 0 && activeTab === "trends") {
      toast({
        description: "Выберите хотя бы один тренд для генерации",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

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
      keywords: keywords.map((kw: any) => ({ 
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
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="trends">Выбор трендов</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
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
                            {format(new Date(topic.createdAt), 'dd MMM yyyy', {locale: ru})}
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
      </Tabs>
      
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
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
      </DialogFooter>
    </>
  );
}