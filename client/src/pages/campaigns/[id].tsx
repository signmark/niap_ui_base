import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordSelector } from "@/components/KeywordSelector";  
import { PostCalendar } from "@/components/PostCalendar";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { TrendsList } from "@/components/TrendsList";
import { SocialMediaSettings } from "@/components/SocialMediaSettings";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";

export default function CampaignDetails() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading, error } = useQuery({
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !campaign) {
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
    <div className="space-y-6 p-6 overflow-y-auto">
      <div className="sticky top-0 bg-background z-10 pb-4">
        <h1 className="text-2xl font-bold mb-2">{campaign.name}</h1>
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
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["social-media", "keywords", "trends", "content", "schedule"]}>
        <AccordionItem value="social-media">
          <AccordionTrigger>Настройки публикации</AccordionTrigger>
          <AccordionContent>
            <SocialMediaSettings 
              campaignId={id} 
              initialSettings={campaign.social_media_settings}
              onSettingsUpdated={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
              }}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="keywords">
          <AccordionTrigger>Ключевые слова</AccordionTrigger>
          <AccordionContent>
            <KeywordSelector campaignId={id} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="trends">
          <AccordionTrigger>Тренды и темы</AccordionTrigger>
          <AccordionContent>
            <TrendsList campaignId={id} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="content">
          <AccordionTrigger>Генерация контента</AccordionTrigger>
          <AccordionContent>
            <ContentGenerationPanel 
              selectedTopics={[]} 
              onGenerated={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/posts', id] });
              }}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="schedule">
          <AccordionTrigger>Календарь публикаций</AccordionTrigger>
          <AccordionContent>
            <PostCalendar campaignId={id} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}