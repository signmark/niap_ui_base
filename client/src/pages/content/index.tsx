import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { directusApi } from "@/lib/directus";
import { useToast } from "@/hooks/use-toast";
import type { Campaign } from "@shared/schema";

interface ContentSource {
  id: string;
  name: string;
  url: string;
  type: string;
  is_active: boolean;
  campaign_id: string;
  created_at: string;
}

interface TrendTopic {
  id: string;
  title: string;
  source_id: string;
  reactions: number;
  comments: number;
  views: number;
  created_at: string;
  is_bookmarked: boolean;
  campaign_id: string;
}

const sourceSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  url: z.string().url("Введите корректный URL"),
  type: z.string().min(1, "Выберите тип источника")
});

type SourceForm = z.infer<typeof sourceSchema>;

export default function ContentPage() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>();
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<TrendTopic[]>([]);
  const { toast } = useToast();

  const form = useForm<SourceForm>({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      name: "",
      url: "",
      type: ""
    }
  });

  // Получаем список кампаний
  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      return await response.json();
    }
  });

  // Получаем источники контента для выбранной кампании через Directus
  const { data: sources = [], isLoading: isLoadingSources } = useQuery<ContentSource[]>({
    queryKey: ["campaign_content_sources", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];

      try {
        const response = await directusApi.get('/items/campaign_content_sources', {
          params: {
            filter: {
              campaign_id: {
                _eq: selectedCampaignId
              },
              is_active: {
                _eq: true
              }
            },
            fields: ['id', 'name', 'url', 'type', 'is_active', 'campaign_id', 'created_at']
          }
        });
        return response.data?.data || [];
      } catch (error) {
        throw error;
      }
    },
    enabled: !!selectedCampaignId
  });

  // Получаем тренды для выбранной кампании через Directus
  const { data: trends = [], isLoading: isLoadingTrends } = useQuery<TrendTopic[]>({
    queryKey: ["campaign_trend_topics", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];

      try {
        const response = await directusApi.get('/items/campaign_trend_topics', {
          params: {
            filter: {
              campaign_id: {
                _eq: selectedCampaignId
              }
            },
            fields: ['id', 'title', 'source_id', 'reactions', 'comments', 'views', 'created_at', 'is_bookmarked', 'campaign_id'],
            sort: ['-created_at']
          }
        });
        return response.data?.data || [];
      } catch (error) {
        throw error;
      }
    },
    enabled: !!selectedCampaignId
  });

  const onSubmit = async (data: SourceForm) => {
    if (!selectedCampaignId) return;

    try {
      const response = await directusApi.post('/items/campaign_content_sources', {
        name: data.name,
        url: data.url,
        type: data.type,
        campaign_id: selectedCampaignId,
        is_active: true
      });

      toast({
        title: "Источник добавлен",
        description: "Новый источник успешно добавлен в кампанию"
      });

      setIsAddingSource(false);
      form.reset();
    } catch (error) {
      console.error("Error creating source:", error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось добавить источник"
      });
    }
  };

  if (isLoadingCampaigns) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Управление контентом</h1>
        {selectedCampaignId && (
          <Dialog open={isAddingSource} onOpenChange={setIsAddingSource}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Добавить источник
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить источник для анализа</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Название</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип источника</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rss">RSS лента</SelectItem>
                            <SelectItem value="telegram">Telegram канал</SelectItem>
                            <SelectItem value="website">Веб-сайт</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddingSource(false)}
                    >
                      Отмена
                    </Button>
                    <Button type="submit">Добавить</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Выберите кампанию</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedCampaignId}
            onValueChange={(value) => {
              setSelectedCampaignId(value);
              setSelectedTopics([]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите кампанию" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCampaignId && (
        <Tabs defaultValue="sources">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sources">Источники</TabsTrigger>
            <TabsTrigger value="trends">Тренды</TabsTrigger>
            <TabsTrigger value="generation">Генерация</TabsTrigger>
          </TabsList>

          <TabsContent value="sources">
            <Card>
              <CardHeader>
                <CardTitle>Источники данных</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingSources ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : !sources.length ? (
                  <p className="text-center text-muted-foreground">
                    Нет добавленных источников
                  </p>
                ) : (
                  <div className="space-y-4">
                    {sources.map((source) => (
                      <Card key={source.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium">{source.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {source.url}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Тип: {source.type}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle>Тренды и темы</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingTrends ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : !trends.length ? (
                  <p className="text-center text-muted-foreground">
                    Нет актуальных трендов для этой кампании
                  </p>
                ) : (
                  <div className="space-y-4">
                    {trends.map((trend) => (
                      <Card key={trend.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium">{trend.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                Источник: {sources.find(s => s.id === trend.source_id)?.name}
                              </p>
                              <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                                <span>👍 {trend.reactions}</span>
                                <span>💬 {trend.comments}</span>
                                <span>👀 {trend.views}</span>
                              </div>
                            </div>
                            <button
                              className={`px-3 py-1 rounded-full text-sm ${
                                selectedTopics.some(t => t.id === trend.id)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-secondary-foreground"
                              }`}
                              onClick={() => {
                                setSelectedTopics(prev =>
                                  prev.some(t => t.id === trend.id)
                                    ? prev.filter(t => t.id !== trend.id)
                                    : [...prev, trend]
                                );
                              }}
                            >
                              {selectedTopics.some(t => t.id === trend.id)
                                ? "Выбрано"
                                : "Выбрать"}
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="generation">
            {selectedTopics.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Генерация контента</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <h3>Выбранные темы:</h3>
                    <ul className="list-disc pl-6">
                      {selectedTopics.map(topic => (
                        <li key={topic.id}>{topic.title}</li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => {
                        // TODO: Implement content generation
                        toast({
                          title: "Генерация контента",
                          description: "Функция будет добавлена позже"
                        });
                      }}
                    >
                      Сгенерировать контент
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Выберите темы для генерации контента на вкладке "Тренды"
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}