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
      <div className="flex justify-center p-8">
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
        </div>
      </div>

      <Accordion type="single" defaultValue="social-media" className="space-y-4">
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
    </div>
  );
}