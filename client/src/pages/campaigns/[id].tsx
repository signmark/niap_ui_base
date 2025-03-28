import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordSelector } from "@/components/KeywordSelector";  
import PublicationCalendar from "@/components/PublicationCalendar";
import { directusApi } from "@/lib/directus";
import { Loader2, Search, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { TrendsList } from "@/components/TrendsList";
import { SocialMediaSettings } from "@/components/SocialMediaSettings";
import { TrendAnalysisSettings } from "@/components/TrendAnalysisSettings";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import { ContentGenerationDialog } from "@/components/ContentGenerationDialog";
import { TrendContentGenerator } from "@/components/TrendContentGenerator";
import { BusinessQuestionnaireForm } from "@/components/BusinessQuestionnaireForm";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useCampaignStore } from "@/lib/campaignStore";

interface SuggestedKeyword {
  keyword: string;
  isSelected: boolean;
}

// Add URL validation helper
const normalizeUrl = (url: string): string => {
  if (!url) return '';

  try {
    // Ensure URL has protocol
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    const urlObj = new URL(url);
    return urlObj.toString();
  } catch (e) {
    return '';
  }
};

export default function CampaignDetails() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSearchingKeywords, setIsSearchingKeywords] = useState(false);
  const [suggestedKeywords, setSuggestedKeywords] = useState<SuggestedKeyword[]>([]);
  const [showContentGenerationDialog, setShowContentGenerationDialog] = useState(false);
  
  // Получаем доступ к глобальному хранилищу кампаний
  const { setSelectedCampaign } = useCampaignStore();
  
  // Для хранения выбранных трендов - изменяем тип на конкретный с правильными полями для улучшения типизации
  const [selectedTrends, setSelectedTrends] = useState<Array<{
    id: string;
    title: string;
    sourceId?: string;
    source_id?: string;
    campaignId?: string;
    campaign_id?: string;
    [key: string]: any;  // Для поддержки других полей
  }>>([]);
  
  // Используем useCallback для стабилизации функции обратного вызова
  const handleSelectTrends = useCallback((trends: any[]) => {
    if (Array.isArray(trends)) {
      console.log("handleSelectTrends received:", trends.length, "trends");
      setSelectedTrends(trends);
    } else {
      console.warn("handleSelectTrends received non-array:", trends);
      setSelectedTrends([]);
    }
  }, []);

  // Запрос для получения списка ключевых слов
  const { data: keywordList } = useQuery({
    queryKey: ["/api/keywords", id],
    queryFn: async () => {
      console.log("Loading keywords for campaign:", id);
      const response = await directusApi.get('/items/campaign_keywords', {
        params: {
          filter: {
            campaign_id: { _eq: id }
          }
        }
      });
      return response.data?.data || [];
    },
    // Отключаем кеширование, чтобы всегда получать свежие данные при переходе на страницу
    staleTime: 0, // Запрос сразу считается устаревшим
    refetchOnMount: true, // Обновляем данные при монтировании компонента
    refetchOnWindowFocus: true // Обновляем данные при фокусе на окне
  });
  
  // Запрос контента кампании для календаря публикаций
  const { data: campaignContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ['/api/campaign-content', id],
    queryFn: async () => {
      if (!id) return [];
      
      try {
        console.log('Загрузка публикаций для кампании:', id);
        const token = localStorage.getItem("auth_token");
        
        const response = await fetch(`/api/campaign-content?campaignId=${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить данные о контенте');
        }
        
        const responseData = await response.json();
        console.log('Загружено публикаций:', (responseData.data || []).length);
        return responseData.data || [];
      } catch (error) {
        console.error('Ошибка при загрузке контента:', error);
        return [];
      }
    },
    enabled: !!id,
    refetchOnMount: true,
    staleTime: 0
  });

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["/api/campaigns", id],
    queryFn: async () => {
      try {
        console.log(`Загрузка данных кампании ID: ${id}`);
        const token = localStorage.getItem("auth_token");
        console.log(`Проверка доступа к кампании ID: ${id} с токеном: ${token ? 'присутствует' : 'отсутствует'}`);
        
        const response = await directusApi.get(`/items/user_campaigns/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}` 
          }
        });
        
        console.log("Успешно получены данные кампании:", response.data?.data?.name);
        return response.data?.data;
      } catch (err: any) {
        console.error("Error fetching campaign:", err);
        
        // Извлекаем более подробную информацию об ошибке
        let errorMessage = "Кампания не найдена или у вас нет прав доступа к ней";
        
        if (err.response) {
          console.error("Directus API error response:", {
            status: err.response.status,
            statusText: err.response.statusText,
            data: err.response.data
          });
          
          // Добавляем код ошибки для диагностики
          errorMessage += ` (Код: ${err.response.status})`;
          
          if (err.response.data?.errors?.[0]?.message) {
            errorMessage += `: ${err.response.data.errors[0].message}`;
          }
        }
        
        throw new Error(errorMessage);
      }
    },
    // Устанавливаем настройки для обновления данных при каждом монтировании компонента
    staleTime: 0, // Запрос сразу считается устаревшим
    refetchOnMount: true, // Обновляем данные при монтировании компонента
    refetchOnWindowFocus: true, // Обновляем данные при фокусе на окне
    retry: false,
    onSuccess: (data) => {
      // Устанавливаем загруженную кампанию как активную в глобальном хранилище
      if (data && data.id && data.name) {
        console.log(`Устанавливаем кампанию из страницы детализации: ${data.name} (${data.id})`);
        setSelectedCampaign(data.id, data.name);
      }
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка доступа к кампании",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  const { mutate: updateCampaign } = useMutation({
    mutationFn: async (values: { name?: string; link?: string }) => {
      await directusApi.patch(`/items/user_campaigns/${id}`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", id] });
      toast({
        title: "Успешно",
        description: "Данные кампании обновлены"
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить данные кампании"
      });
    }
  });

  const { mutate: searchKeywords, isPending: isSearching } = useMutation({
    mutationFn: async (url: string) => {
      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl) {
        throw new Error('Пожалуйста, введите корректный URL сайта');
      }

      const requestBody = {
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: `Вы - специализированный SEO-эксперт, который анализирует сайты и генерирует релевантные ключевые слова для продвижения в социальных сетях. Следуйте этой инструкции строго:
1. Сначала посетите указанный URL и определите тематику сайта - о чем он, какие товары/услуги предлагает
2. Составьте список из 10-15 конкретных ключевых слов и фраз, относящихся именно к специфике данного сайта
3. НЕ используйте общие слова о планировании, управлении, календарях, если сайт НЕ о планировании
4. Ответ должен содержать ТОЛЬКО массив ключевых слов в формате JSON без дополнительных пояснений: ["keyword1", "keyword2"]
5. Все слова должны быть на русском языке.`
          },
          {
            role: "user",
            content: `Пожалуйста, посетите сайт ${normalizedUrl}, определите его точную тематику, и сгенерируйте список из 10-15 самых релевантных ключевых слов, соответствующих именно ЭТОМУ конкретному сайту. Просто верните JSON-массив, без вступления и пояснений.`
          }
        ],
        max_tokens: 1000,
        temperature: 0.5
      };

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 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',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Ошибка при получении ключевых слов');
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      try {
        // Попытка найти JSON массив в ответе
        const match = content.match(/\[([\s\S]*?)\]/);
        if (!match) {
          throw new Error('Не удалось найти массив ключевых слов в ответе');
        }

        // Парсим найденный массив
        const keywords = JSON.parse(`[${match[1]}]`);

        if (!Array.isArray(keywords)) {
          throw new Error('Некорректный формат данных');
        }

        // Проверяем и очищаем ключевые слова
        return keywords
          .filter(kw => typeof kw === 'string' && kw.trim().length > 0)
          .map(kw => kw.trim());

      } catch (e) {
        console.error('Ошибка при обработке ключевых слов:', e, content);
        throw new Error('Не удалось обработать ответ API. Пожалуйста, попробуйте еще раз.');
      }
    },
    onSuccess: (data) => {
      const formattedKeywords = data.map((keyword: string) => ({
        keyword,
        isSelected: false
      }));
      setSuggestedKeywords(formattedKeywords);
      setIsSearchingKeywords(true);
      toast({
        description: "Ключевые слова успешно найдены"
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        description: error.message
      });
    }
  });

  // Мутация для добавления ключевых слов
  const { mutate: addKeywords } = useMutation({
    mutationFn: async (keywords: string[]) => {
      console.log("Добавление ключевых слов:", keywords);
      
      // Сначала получаем существующие ключевые слова для проверки на дубликаты
      const response = await directusApi.get('/items/campaign_keywords', {
        params: {
          filter: {
            campaign_id: { _eq: id }
          },
          fields: ['keyword']
        }
      });
      
      const existingKeywords = response.data?.data?.map((item: any) => item.keyword) || [];
      console.log("Существующие ключевые слова:", existingKeywords);
      
      // Фильтруем входящие ключевые слова, чтобы не добавлять дубликаты
      const newKeywords = keywords.filter(keyword => !existingKeywords.includes(keyword));
      console.log("Новые ключевые слова для добавления:", newKeywords);
      
      if (newKeywords.length === 0) {
        console.log("Нет новых ключевых слов для добавления");
        toast({
          description: "Все указанные ключевые слова уже добавлены",
          variant: "default"
        });
        return [];
      }
      
      // Добавляем только новые ключевые слова
      const promises = newKeywords.map(keyword => 
        directusApi.post('/items/campaign_keywords', {
          campaign_id: id,
          keyword: keyword,
          trend_score: 3500, // Среднее значение для новых слов, будет обновлено при анализе
          mentions_count: 75, // Среднее значение для новых слов, будет обновлено при анализе 
          last_checked: new Date().toISOString() // Current timestamp
        })
      );
      
      const results = await Promise.all(promises);
      return { added: newKeywords.length, newKeywords, results };
    },
    // Оптимистичное обновление UI
    onMutate: async (keywords) => {
      // Отменяем запросы на получение ключевых слов
      await queryClient.cancelQueries({ queryKey: ["/api/keywords", id] });
      
      // Сохраняем предыдущие данные для возможного отката
      const previousKeywords = queryClient.getQueryData(["/api/keywords", id]);
      
      // Получаем текущие ключевые слова для фильтрации только новых
      const currentKeywords = ((previousKeywords as any[]) || []).map(k => k.keyword);
      
      // Фильтруем, чтобы не добавлять уже существующие
      const newKeywords = keywords.filter(k => !currentKeywords.includes(k));
      
      if (newKeywords.length > 0) {
        // Оптимистично обновляем кэш
        queryClient.setQueryData(["/api/keywords", id], (old: any[] = []) => {
          // Создаем новые объекты для добавляемых ключевых слов
          const newItems = newKeywords.map(keyword => ({
            id: `temp-${Date.now()}-${Math.random()}`, // Временный ID
            campaign_id: id,
            keyword: keyword,
            trend_score: Math.floor(Math.random() * 1000) + 3000,
            mentions_count: Math.floor(Math.random() * 100) + 50,
            date_created: new Date().toISOString()
          }));
          
          return [...old, ...newItems];
        });
      }
      
      // Возвращаем контекст для возможного отката
      return { previousKeywords, newKeywordsCount: newKeywords.length };
    },
    onSuccess: (result) => {
      // Обновляем данные с сервера, чтобы получить правильные ID и другие поля
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", id] });
      
      // Также инвалидируем кэш для страницы ключевых слов
      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", id] });
      
      // Очищаем диалог поиска ключевых слов
      setIsSearchingKeywords(false);
      setSuggestedKeywords([]);
      
      // Показываем сообщение о результате
      if (result && result.added > 0) {
        toast({
          title: "Успешно",
          description: `Добавлено ${result.added} новых ключевых слов`
        });
      }
    },
    onError: (error, variables, context) => {
      console.error("Ошибка при добавлении ключевых слов:", error);
      
      // Восстанавливаем предыдущие данные в случае ошибки
      if (context?.previousKeywords) {
        queryClient.setQueryData(["/api/keywords", id], context.previousKeywords);
      }
      
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось добавить ключевые слова"
      });
    }
  });
  
  // Мутация для удаления ключевого слова при клике на него
  const { mutate: removeKeyword } = useMutation({
    mutationFn: async (keyword: string) => {
      // Сначала получаем ID ключевого слова по его значению
      const response = await directusApi.get('/items/campaign_keywords', {
        params: {
          filter: {
            campaign_id: { _eq: id },
            keyword: { _eq: keyword }
          }
        }
      });
      
      // Проверяем, что нашли запись
      if (response.data && response.data.data && response.data.data.length > 0) {
        const keywordId = response.data.data[0].id;
        // Удаляем ключевое слово по ID
        await directusApi.delete(`/items/campaign_keywords/${keywordId}`);
        return { keyword, keywordId };
      } else {
        throw new Error(`Ключевое слово "${keyword}" не найдено`);
      }
    },
    // Оптимистичное обновление UI до получения ответа от сервера
    onMutate: async (keyword) => {
      // Отменяем все запросы на получение ключевых слов, чтобы они не перезаписали наше обновление
      await queryClient.cancelQueries({ queryKey: ["/api/keywords", id] });
      
      // Сохраняем текущие данные для возможного отката
      const previousKeywords = queryClient.getQueryData(["/api/keywords", id]);
      
      // Оптимистично обновляем кэш
      queryClient.setQueryData(["/api/keywords", id], (old: any[]) => {
        return old ? old.filter(item => item.keyword !== keyword) : [];
      });
      
      // Возвращаем контекст для отката в случае ошибки
      return { previousKeywords };
    },
    onSuccess: (result, keyword) => {
      // Запрашиваем новые данные, чтобы убедиться, что интерфейс синхронизирован с сервером
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", id] });
      
      // Также инвалидируем кэш для страницы ключевых слов
      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", id] });
      
      console.log(`Ключевое слово "${keyword}" успешно удалено`);
      // Удаляем дубликат уведомления, так как оно уже показывается в KeywordSelector
    },
    onError: (error, keyword, context) => {
      console.error("Ошибка при удалении ключевого слова:", error);
      // Восстанавливаем предыдущее состояние кэша в случае ошибки
      if (context?.previousKeywords) {
        queryClient.setQueryData(["/api/keywords", id], context.previousKeywords);
      }
      toast({
        variant: "destructive",
        description: `Не удалось удалить ключевое слово "${keyword}"`
      });
    },
    // Всегда запрашиваем новые данные после мутации, независимо от результата
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", id] });
      // Обновляем кэш для страницы ключевых слов
      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", id] });
    }
  });

  const toggleKeywordSelection = (index: number) => {
    setSuggestedKeywords(prev => prev.map((kw, i) => 
      i === index ? { ...kw, isSelected: !kw.isSelected } : kw
    ));
  };

  const handleAddSelectedKeywords = () => {
    const selectedKeywords = suggestedKeywords
      .filter(kw => kw.isSelected)
      .map(kw => kw.keyword);

    if (selectedKeywords.length > 0) {
      addKeywords(selectedKeywords);
      setIsSearchingKeywords(false); // Закрываем диалог с результатами
      setSuggestedKeywords([]); // Очищаем результаты
    }
  };

  const handleUrlUpdate = (newUrl: string) => {
    const normalizedUrl = normalizeUrl(newUrl);
    if (normalizedUrl !== campaign.link) {
      updateCampaign({ link: normalizedUrl });
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <Card>
          <CardContent>
            <p className="text-destructive">Кампания не найдена или у вас нет прав доступа к ней</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold mb-6">{campaign.name}</h1>
      </div>

      <Accordion type="single" defaultValue="site">
        <AccordionItem value="site" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="site" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Сайт
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div className="flex gap-4 items-center pt-2">
              <Input
                placeholder="Введите URL сайта"
                defaultValue={campaign.link || ""}
                onBlur={(e) => handleUrlUpdate(e.target.value.trim())}
                className="max-w-md"
              />
              <Button
                variant="secondary"
                onClick={() => campaign.link && searchKeywords(campaign.link)}
                disabled={isSearching || !campaign.link}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Поиск ключевых слов...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Найти ключевые слова
                  </>
                )}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="keywords" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="keywords" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Ключевые слова
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div>
              {/* Запрос на получение ключевых слов */}
              <KeywordSelector 
                campaignId={id} 
                onSelect={(keywords) => {
                  console.log("onSelect вызван с keywords:", keywords);
                  
                  if (keywords.length === 1) {
                    // Проверяем, если это одиночное слово и оно передано для удаления
                    // (это происходит при клике на бейдж)
                    const existingKeywords = keywordList?.map(k => k.keyword) || [];
                    if (existingKeywords.includes(keywords[0])) {
                      console.log("Удаляем существующее ключевое слово:", keywords[0]);
                      // Это существующее ключевое слово, значит его нужно удалить
                      removeKeyword(keywords[0]);
                      return; // Важно выйти после удаления, чтобы не попасть в ветку добавления ключевых слов
                    } else {
                      console.log("Добавляем одиночное ключевое слово:", keywords[0]);
                      // Если это новое одиночное слово из списка "Сохранить выбранные", добавляем его
                      // Это происходит при нажатии кнопки в KeywordSelector
                      addKeywords(keywords);
                      return; // Выходим после добавления
                    }
                    // Если это новое одиночное слово, мы его НЕ добавляем автоматически -
                    // добавление происходит только при явном вызове
                  } else if (keywords.length > 1) {
                    // Пакетное добавление нескольких ключевых слов
                    // Это происходит при нажатии на кнопку "Сохранить выбранные"
                    addKeywords(keywords);
                  }
                }}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="business-questionnaire" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="business-questionnaire" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Бизнес-анкета
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <BusinessQuestionnaireForm 
              campaignId={id}
              onQuestionnaireUpdated={() => {
                queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${id}/questionnaire`] });
              }}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="trend-analysis" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="trend-analysis" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Настройки анализа трендов
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div className="space-y-4">
              <div className="flex flex-col">
                <h3 className="text-xl font-semibold">Параметры сбора трендов</h3>
                <p className="text-muted-foreground mt-1 mb-3">
                  Настройте параметры для сбора трендовых тем из социальных сетей. Эти параметры влияют на то, 
                  какие аккаунты будут анализироваться и какие тренды будут учитываться.
                </p>
              </div>
              <TrendAnalysisSettings 
                campaignId={id} 
                initialSettings={campaign.trend_analysis_settings}
                onSettingsUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
                }}
              />
              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  После настройки параметров, перейдите в раздел «Тренды» для сбора актуальных трендовых тем, 
                  которые затем будут отображаться в блоке «Тренды» ниже.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="trends" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="trends" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Тренды
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div className="space-y-4">
              <div className="flex flex-col">
                <h3 className="text-xl font-semibold">Мониторинг актуальных трендов</h3>
                <p className="text-muted-foreground mt-1 mb-3">
                  Здесь отображаются актуальные тренды в вашей тематике из различных источников. 
                  Тренды обновляются автоматически при их сборе на странице «Тренды».
                </p>
              </div>
              <TrendsList 
                campaignId={id} 
                selectable={true} 
                onSelectTrends={handleSelectTrends} 
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="content" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="content" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Генерация контента
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div className="space-y-4">
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-semibold">Создание контента на основе трендов</h3>
                  <Button
                    onClick={() => setShowContentGenerationDialog(true)}
                    variant="default"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Wand2 className="h-4 w-4" />
                    Генерировать с ИИ
                  </Button>
                </div>
                <p className="text-muted-foreground mt-1 mb-3">
                  Используйте собранные тренды для генерации контента. Система будет учитывать ключевые слова кампании и позволяет 
                  создавать тексты, изображения и комбинированный контент для разных социальных платформ.
                </p>
              </div>
              <TrendContentGenerator 
                selectedTopics={selectedTrends} 
                onGenerated={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/posts', id] });
                  queryClient.invalidateQueries({ queryKey: ['/api/campaign-content', id] });
                }}
                campaignId={id}
              />
            </div>
            
            {/* Диалог с ИИ для генерации контента */}
            {showContentGenerationDialog && (
              <ContentGenerationDialog 
                campaignId={id}
                keywords={keywordList?.map(k => ({
                  id: k.id,
                  keyword: k.keyword,
                  trendScore: k.trend_score || 0,
                  campaignId: k.campaign_id
                })) || []}
                onClose={() => {
                  setShowContentGenerationDialog(false);
                  queryClient.invalidateQueries({ queryKey: ['/api/campaign-content', id] });
                }} 
              />
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="social-media" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="social-media" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Настройки публикации
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div className="space-y-4">
              <div className="flex flex-col">
                <h3 className="text-xl font-semibold">Подключение социальных сетей</h3>
                <p className="text-muted-foreground mt-1 mb-3">
                  Настройте доступ к вашим социальным сетям для автоматической публикации контента. 
                  Вам потребуются API-ключи и идентификаторы ваших аккаунтов или сообществ для каждой платформы.
                </p>
              </div>
              <SocialMediaSettings 
                campaignId={id} 
                initialSettings={campaign.social_media_settings}
                onSettingsUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
                }}
              />
              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  После настройки доступа, вы сможете публиковать контент напрямую из системы в выбранные 
                  социальные сети согласно установленному расписанию в разделе «Календарь публикаций».
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
            
        <AccordionItem value="schedule" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="schedule" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Календарь публикаций
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div className="space-y-4">
              <div className="flex flex-col">
                <h3 className="text-xl font-semibold">Планирование и отслеживание публикаций</h3>
                <p className="text-muted-foreground mt-1 mb-3">
                  Здесь вы можете запланировать публикации вашего контента в разные социальные сети, 
                  а также отслеживать статус опубликованного контента на календаре.
                </p>
              </div>
              <div className="h-full w-full">
                {/* Получаем контент кампании и передаем в PublicationCalendar */}
                {campaign && (
                  <PublicationCalendar 
                    content={campaignContent || []} 
                    isLoading={isLoadingContent}
                    onCreateClick={() => window.location.href = '/content'}
                    onViewPost={(post) => {
                      console.log('View post:', post);
                      // Здесь можно добавить дополнительную логику просмотра поста
                    }}
                  />
                )}
              </div>
              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Система автоматически опубликует контент в указанное время в настроенных в предыдущем разделе социальных сетях. 
                  Вы можете перетаскивать элементы в календаре для изменения даты и времени публикации.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Dialog open={isSearchingKeywords} onOpenChange={setIsSearchingKeywords}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Найденные ключевые слова</DialogTitle>
            <DialogDescription>
              Выберите ключевые слова для добавления в кампанию
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              {suggestedKeywords.map((kw, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`keyword-${index}`}
                    checked={kw.isSelected} 
                    onCheckedChange={() => toggleKeywordSelection(index)}
                    className="data-[state=checked]:bg-primary"
                  />
                  <label 
                    htmlFor={`keyword-${index}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {kw.keyword}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsSearchingKeywords(false)}>
              Отмена
            </Button>
            <Button onClick={handleAddSelectedKeywords}>
              Добавить выбранные
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}