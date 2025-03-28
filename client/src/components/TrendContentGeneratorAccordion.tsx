import { useState } from "react";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { TrendContentGenerator, Trend } from "./TrendContentGenerator";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TrendContentGeneratorAccordionProps {
  selectedTrends: Trend[];
  campaignId: string;
  keywords?: string[];
}

export function TrendContentGeneratorAccordion({
  selectedTrends,
  campaignId,
  keywords = []
}: TrendContentGeneratorAccordionProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  
  // Мутация для сохранения контента как поста
  const saveContentMutation = useMutation({
    mutationFn: async (content: any) => {
      return await apiRequest("/api/campaign-content", {
        method: "POST",
        data: {
          campaignId,
          title: content.title || "Пост на основе трендов",
          content: content.content,
          imageUrl: content.imageUrl,
          contentType: content.contentType || "text",
          socialPlatforms: content.platforms || [],
          status: "draft",
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Контент сохранен",
        description: "Пост успешно создан и сохранен в черновиках",
      });
    },
    onError: (error: Error) => {
      console.error("Error saving content:", error);
      toast({
        title: "Ошибка сохранения",
        description: `Не удалось сохранить пост: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Функция обработки сгенерированного контента
  const handleContentGenerated = (content: any) => {
    setGeneratedContent(content);
  };
  
  // Проверяем, есть ли выбранные тренды
  if (!selectedTrends.length) {
    return (
      <Accordion
        type="single"
        collapsible
        className="w-full"
        value={isOpen ? "generator" : undefined}
        onValueChange={(value) => setIsOpen(value === "generator")}
      >
        <AccordionItem value="generator">
          <AccordionTrigger className="flex justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4" />
              <span>Генерация контента на основе трендов</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card className="p-4">
              <p className="text-muted-foreground text-center py-8">
                Выберите тренды для генерации контента.
              </p>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }
  
  return (
    <Accordion
      type="single"
      collapsible
      className="w-full"
      value={isOpen ? "generator" : undefined}
      onValueChange={(value) => setIsOpen(value === "generator")}
    >
      <AccordionItem value="generator">
        <AccordionTrigger className="flex justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4" />
            <span>Генерация контента на основе трендов</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              className="mr-2"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(true);
              }}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Генерировать с ИИ
            </Button>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Используйте собранные тренды для генерации контента. Система будет учитывать ключевые слова кампании и позволяет создавать тексты, изображения и комбинированный контент для разных социальных платформ.
            </p>
            
            <TrendContentGenerator 
              selectedTrends={selectedTrends}
              campaignId={campaignId}
              keywords={keywords}
              onContentGenerated={handleContentGenerated}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}