import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordSelector } from "@/components/KeywordSelector";  
import { PostCalendar } from "@/components/PostCalendar";
import { directusApi } from "@/lib/directus";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { TrendsList } from "@/components/TrendsList";
import { SocialMediaSettings } from "@/components/SocialMediaSettings";
import { TrendAnalysisSettings } from "@/components/TrendAnalysisSettings";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import { BusinessQuestionnaireForm } from "@/components/BusinessQuestionnaireForm";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSearchingKeywords, setIsSearchingKeywords] = useState(false);
  const [suggestedKeywords, setSuggestedKeywords] = useState<SuggestedKeyword[]>([]);

  // Запрос для получения списка ключевых слов
  const { data: keywordList } = useQuery({
    queryKey: ["/api/keywords", id],
    queryFn: async () => {
      const response = await directusApi.get('/items/campaign_keywords', {
        params: {
          filter: {
            campaign_id: { _eq: id }
          }
        }
      });
      return response.data?.data || [];
    }
  });

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["/api/campaigns", id],
    queryFn: async () => {
      try {
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
    retry: false,
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
      const promises = keywords.map(keyword => 
        directusApi.post('/items/campaign_keywords', {
          campaign_id: id,
          keyword: keyword,
          trend_score: 0, // Default trend score
          mentions_count: 0, // Default mentions count
          last_checked: new Date().toISOString() // Current timestamp
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", id] });
      setIsSearchingKeywords(false);
      setSuggestedKeywords([]);
      toast({
        title: "Успешно",
        description: "Ключевые слова добавлены в кампанию"
      });
    },
    onError: () => {
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
      } else {
        throw new Error(`Ключевое слово "${keyword}" не найдено`);
      }
    },
    onSuccess: (_, keyword) => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", id] });
      // Удаляем дубликат уведомления, так как оно уже показывается в KeywordSelector
    },
    onError: (error, keyword) => {
      console.error("Ошибка при удалении ключевого слова:", error);
      toast({
        variant: "destructive",
        description: `Не удалось удалить ключевое слово "${keyword}"`
      });
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
    <div className="space-y-6 p-6">
      <div className="sticky top-0 bg-background z-10 pb-6">
        <h1 className="text-2xl font-bold mb-4">{campaign.name}</h1>
        <div className="flex gap-4 items-center">
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
      </div>

      <Accordion type="single" defaultValue="keywords" className="space-y-4">
        <AccordionItem value="keywords" className="border rounded-lg px-6">
          <AccordionTrigger className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Ключевые слова
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <div>
              {/* Запрос на получение ключевых слов */}
              <KeywordSelector 
                campaignId={id} 
                onSelect={(keywords) => {
                  if (keywords.length === 1) {
                    // Проверяем контекст: если это с бейджа (удаление), вызываем removeKeyword
                    const existingKeywords = keywordList?.map(k => k.keyword) || [];
                    if (existingKeywords.includes(keywords[0])) {
                      // Это существующее ключевое слово, значит его нужно удалить
                      removeKeyword(keywords[0]);
                    } else {
                      // Это новое ключевое слово, его нужно добавить
                      addKeywords(keywords);
                    }
                  } else if (keywords.length > 1) {
                    // Пакетное добавление нескольких ключевых слов
                    addKeywords(keywords);
                  }
                }}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="business-questionnaire" className="border rounded-lg px-6">
          <AccordionTrigger className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Бизнес-анкета
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <BusinessQuestionnaireForm 
              campaignId={id}
              onQuestionnaireUpdated={() => {
                queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${id}/questionnaire`] });
              }}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="trend-analysis" className="border rounded-lg px-6">
          <AccordionTrigger className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Настройки анализа трендов
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <TrendAnalysisSettings 
              campaignId={id} 
              initialSettings={campaign.trend_analysis_settings}
              onSettingsUpdated={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
              }}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="trends" className="border rounded-lg px-6">
          <AccordionTrigger className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Тренды
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <TrendsList campaignId={id} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="content" className="border rounded-lg px-6">
          <AccordionTrigger className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Генерация контента
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <ContentGenerationPanel 
              selectedTopics={[]} 
              onGenerated={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/posts', id] });
              }}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="social-media" className="border rounded-lg px-6">
          <AccordionTrigger className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Настройки публикации
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <SocialMediaSettings 
              campaignId={id} 
              initialSettings={campaign.social_media_settings}
              onSettingsUpdated={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
              }}
            />
          </AccordionContent>
        </AccordionItem>
            
        <AccordionItem value="schedule" className="border rounded-lg px-6">
          <AccordionTrigger className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Календарь публикаций
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <PostCalendar campaignId={id} />
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