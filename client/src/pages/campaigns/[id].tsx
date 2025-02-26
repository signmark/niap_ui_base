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
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

interface SuggestedKeyword {
  keyword: string;
  isSelected: boolean;
}

export default function CampaignDetails() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSearchingKeywords, setIsSearchingKeywords] = useState(false);
  const [suggestedKeywords, setSuggestedKeywords] = useState<SuggestedKeyword[]>([]);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["/api/campaigns", id],
    queryFn: async () => {
      try {
        const response = await directusApi.get(`/items/user_campaigns/${id}`);
        return response.data?.data;
      } catch (err) {
        console.error("Error fetching campaign:", err);
        throw new Error("Кампания не найдена или у вас нет прав доступа к ней");
      }
    },
    retry: false,
    onError: (err) => {
      toast({
        title: "Ошибка",
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
      const requestBody = {
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: "Return a JSON array of suggested keywords, each should be relevant for social media promotion. Example format: [\"keyword 1\", \"keyword 2\"]"
          },
          {
            role: "user",
            content: `${url}\n\nПредложи список ключевых слов для продвижения сайта в соцсетях. По ним будет искаться контент в соцсетях и потом генериться контент для особо пополулярных запросов.`
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
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
        throw new Error('Failed to fetch keywords');
      }

      const data = await response.json();
      try {
        const keywords = JSON.parse(data.choices[0].message.content);
        return keywords;
      } catch (e) {
        console.error('Error parsing keywords:', e);
        throw new Error('Invalid response format');
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
        title: "Успешно",
        description: "Найдены ключевые слова для сайта"
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message
      });
    }
  });

  const { mutate: addKeywords } = useMutation({
    mutationFn: async (keywords: string[]) => {
      const promises = keywords.map(keyword => 
        directusApi.post('/items/user_keywords', {
          campaign_id: id,
          keyword: keyword
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
            onBlur={(e) => {
              const newLink = e.target.value.trim();
              if (newLink !== campaign.link) {
                updateCampaign({ link: newLink });
              }
            }}
            className="max-w-md"
          />
          <Button
            variant="secondary"
            onClick={() => searchKeywords(campaign.link)}
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

        <AccordionItem value="keywords" className="border rounded-lg px-6">
          <AccordionTrigger className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Ключевые слова
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <KeywordSelector campaignId={id} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="trends" className="border rounded-lg px-6">
          <AccordionTrigger className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            Тренды и темы
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
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              {suggestedKeywords.map((kw, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox 
                    checked={kw.isSelected} 
                    onCheckedChange={() => toggleKeywordSelection(index)}
                  />
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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