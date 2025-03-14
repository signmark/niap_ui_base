import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Calendar, Sparkles, FilePlus2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BusinessQuestionnaire, CampaignTrendTopic } from "@shared/schema";

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
  const [period, setPeriod] = useState<number>(28); // Период в днях
  const [postsCount, setPostsCount] = useState<number>(8); // Количество постов
  const [includeImages, setIncludeImages] = useState<boolean>(true);
  const [includeVideos, setIncludeVideos] = useState<boolean>(false);
  const [contentType, setContentType] = useState<string>("mixed"); // mixed, educational, promotional, entertaining
  const [selectedTrendTopics, setSelectedTrendTopics] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedPlan, setGeneratedPlan] = useState<any[]>([]);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Получение трендов для кампании
  const { data: trendTopics, isLoading: isLoadingTrends } = useQuery({
    queryKey: ['/api/trends', campaignId],
    queryFn: () => apiRequest(`/api/trends?campaignId=${campaignId}`),
    enabled: !!campaignId,
    onError: (error: Error) => {
      toast({
        title: "Ошибка загрузки трендов",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Получение ключевых слов для кампании
  const { data: keywords, isLoading: isLoadingKeywords } = useQuery({
    queryKey: ['/api/keywords', campaignId],
    queryFn: () => apiRequest(`/api/keywords?campaignId=${campaignId}`),
    enabled: !!campaignId,
    onError: (error: Error) => {
      toast({
        title: "Ошибка загрузки ключевых слов",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Получение бизнес-анкеты для кампании
  const { data: businessQuestionnaire, isLoading: isLoadingQuestionnaire } = useQuery({
    queryKey: ['/api/business-questionnaire', campaignId],
    queryFn: () => apiRequest(`/api/business-questionnaire/${campaignId}`),
    enabled: !!campaignId,
    onError: (error: Error) => {
      toast({
        title: "Ошибка загрузки бизнес-анкеты",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для генерации контент-плана
  const generatePlanMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/content/generate-plan', {
        method: 'POST',
        data
      });
    },
    onSuccess: (data) => {
      setGeneratedPlan(data.plan || []);
      toast({
        title: "Контент-план сгенерирован",
        description: `Создано ${data.plan?.length || 0} записей для вашего контент-плана`,
      });
      if (onPlanGenerated && data.plan) {
        onPlanGenerated(data.plan);
      }
      setIsGenerating(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка генерации плана",
        description: error.message,
        variant: "destructive"
      });
      setIsGenerating(false);
    }
  });

  // Функция генерации контент-плана
  const handleGeneratePlan = () => {
    if (!campaignId) {
      toast({
        title: "Ошибка",
        description: "Не выбрана кампания",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedPlan([]);

    // Подготовка данных для запроса
    const requestData = {
      campaignId,
      settings: {
        period,
        postsCount,
        includeImages,
        includeVideos,
        contentType
      },
      selectedTrendTopics: Array.from(selectedTrendTopics),
      keywords: keywords?.data || [],
      businessData: businessQuestionnaire?.data || null
    };

    generatePlanMutation.mutate(requestData);
  };

  // Функция сохранения контент-плана
  const savePlanMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/content/save-plan', {
        method: 'POST',
        data
      });
    },
    onSuccess: () => {
      toast({
        title: "План сохранен",
        description: "Контент-план успешно сохранен в вашей кампании"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/content'] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка сохранения плана",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSavePlan = () => {
    if (generatedPlan.length === 0) {
      toast({
        title: "Нет данных для сохранения",
        description: "Сначала сгенерируйте контент-план",
        variant: "destructive"
      });
      return;
    }

    savePlanMutation.mutate({
      campaignId,
      contentPlan: generatedPlan
    });
  };

  // Обработка выбора тренда
  const toggleTrendTopic = (topicId: string) => {
    const newSelectedTopics = new Set(selectedTrendTopics);
    if (newSelectedTopics.has(topicId)) {
      newSelectedTopics.delete(topicId);
    } else {
      newSelectedTopics.add(topicId);
    }
    setSelectedTrendTopics(newSelectedTopics);
  };

  const isLoading = isLoadingTrends || isLoadingKeywords || isLoadingQuestionnaire;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Генерация контент-плана</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="settings">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="settings">Настройки</TabsTrigger>
            <TabsTrigger value="trends">Тренды ({selectedTrendTopics.size})</TabsTrigger>
            <TabsTrigger value="preview" disabled={generatedPlan.length === 0}>
              Предпросмотр ({generatedPlan.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Основные параметры плана</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Загрузка данных кампании...</span>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="period">Период планирования (дней): {period}</Label>
                      <Slider 
                        id="period"
                        min={7} 
                        max={90} 
                        step={7} 
                        value={[period]} 
                        onValueChange={(value) => setPeriod(value[0])} 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="postsCount">Количество постов: {postsCount}</Label>
                      <Slider 
                        id="postsCount"
                        min={3} 
                        max={30} 
                        step={1} 
                        value={[postsCount]} 
                        onValueChange={(value) => setPostsCount(value[0])} 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Тип контента</Label>
                      <Select value={contentType} onValueChange={setContentType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите тип контента" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mixed">Смешанный</SelectItem>
                          <SelectItem value="educational">Обучающий</SelectItem>
                          <SelectItem value="promotional">Рекламный</SelectItem>
                          <SelectItem value="entertaining">Развлекательный</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox 
                        id="includeImages" 
                        checked={includeImages} 
                        onCheckedChange={(checked) => setIncludeImages(!!checked)} 
                      />
                      <Label htmlFor="includeImages">Включать изображения</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="includeVideos" 
                        checked={includeVideos} 
                        onCheckedChange={(checked) => setIncludeVideos(!!checked)} 
                      />
                      <Label htmlFor="includeVideos">Включать видео</Label>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Данные бизнес-анкеты</CardTitle>
              </CardHeader>
              <CardContent>
                {businessQuestionnaire?.data ? (
                  <div className="space-y-2 text-sm">
                    <p><strong>Компания:</strong> {businessQuestionnaire.data.companyName}</p>
                    <p><strong>Описание:</strong> {businessQuestionnaire.data.businessDescription}</p>
                    <p><strong>Аудитория:</strong> {businessQuestionnaire.data.targetAudience}</p>
                    <p><strong>Ценности:</strong> {businessQuestionnaire.data.businessValues}</p>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    {isLoadingQuestionnaire ? 
                      <span>Загрузка данных анкеты...</span> : 
                      <span>Бизнес-анкета не заполнена для этой кампании</span>
                    }
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Ключевые слова кампании</CardTitle>
              </CardHeader>
              <CardContent>
                {keywords?.data?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {keywords.data.slice(0, 10).map((kw: any) => (
                      <div key={kw.id} className="bg-muted px-2 py-1 rounded-md text-sm">
                        {kw.keyword}
                      </div>
                    ))}
                    {keywords.data.length > 10 && (
                      <div className="bg-muted px-2 py-1 rounded-md text-sm">
                        +{keywords.data.length - 10} еще
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    {isLoadingKeywords ? 
                      <span>Загрузка ключевых слов...</span> : 
                      <span>Для этой кампании не найдено ключевых слов</span>
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle>Выберите тренды для использования в контент-плане</CardTitle>
              </CardHeader>
              <CardContent>
                {trendTopics?.data?.length > 0 ? (
                  <div className="space-y-2">
                    {trendTopics.data.map((topic: CampaignTrendTopic) => (
                      <div 
                        key={topic.id}
                        className={`p-3 border rounded-md cursor-pointer ${
                          selectedTrendTopics.has(topic.id) ? 'border-primary bg-primary/10' : 'border-border'
                        }`}
                        onClick={() => toggleTrendTopic(topic.id)}
                      >
                        <div className="font-medium">{topic.title}</div>
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {topic.description || "Нет описания"}
                        </div>
                        <div className="flex items-center text-xs mt-2 text-muted-foreground">
                          <span>👍 {topic.reactions || 0}</span>
                          <span className="ml-2">💬 {topic.comments || 0}</span>
                          <span className="ml-2">👁️ {topic.views || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {isLoadingTrends ? 
                      <span>Загрузка трендов...</span> : 
                      <span>Для этой кампании не найдено трендов</span>
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <CardTitle>Предпросмотр контент-плана</CardTitle>
              </CardHeader>
              <CardContent>
                {generatedPlan.length > 0 ? (
                  <div className="space-y-4">
                    {generatedPlan.map((item, index) => (
                      <Card key={index} className="border border-border">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{item.title}</CardTitle>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3 mr-1" /> 
                            {new Date(item.scheduledAt).toLocaleDateString()}
                            <span className="ml-3 flex items-center">
                              {item.contentType === 'text' && <FileText className="h-3 w-3 mr-1" />}
                              {item.contentType === 'text-image' && <FilePlus2 className="h-3 w-3 mr-1" />}
                              {item.contentType}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-2 pt-0">
                          <div className="text-sm line-clamp-3">{item.content}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Нет сгенерированного контент-плана
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="flex gap-2 justify-between items-center mt-4">
          <div>
            {generatedPlan.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Сгенерировано {generatedPlan.length} записей для контент-плана
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            {generatedPlan.length === 0 ? (
              <Button 
                onClick={handleGeneratePlan} 
                disabled={isGenerating || isLoading}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Сгенерировать план
                  </>
                )}
              </Button>
            ) : (
              <Button 
                onClick={handleSavePlan} 
                disabled={savePlanMutation.isPending}
              >
                {savePlanMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Сохранить план
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}