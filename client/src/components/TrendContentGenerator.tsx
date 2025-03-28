import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { 
  Copy, 
  Loader2, 
  Send,
  Sparkles
} from "lucide-react";
import { SiTelegram, SiVk } from "react-icons/si";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

import { apiRequest } from "@/lib/queryClient";

// Схема формы для генерации контента
const contentGenerationSchema = z.object({
  title: z.string().min(3, "Заголовок должен содержать не менее 3 символов").optional(),
  description: z.string().min(10, "Описание должно содержать не менее 10 символов"),
});

type ContentGenerationFormValues = z.infer<typeof contentGenerationSchema>;

// Типы данных для трендов
export interface Trend {
  id: string;
  title: string;
  description?: string;
  url?: string;
}

interface TrendContentGeneratorProps {
  selectedTrends: Trend[];
  campaignId: string;
  keywords?: string[];
  onContentGenerated?: (content: any) => void;
}

export function TrendContentGenerator({
  selectedTrends,
  campaignId,
  keywords = [],
  onContentGenerated
}: TrendContentGeneratorProps) {
  const { toast } = useToast();
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["telegram"]);
  
  // Формируем строку с ключевыми словами для подсказки
  const keywordSuggestions = keywords?.length 
    ? keywords.slice(0, 5).join(", ") 
    : "правильное питание, здоровье, диета";

  // Получаем текстовое представление выбранных трендов
  const trendsText = selectedTrends.map(trend => 
    `${trend.title}${trend.description ? `: ${trend.description}` : ""}`
  ).join("\n\n");

  // Форма для генерации контента
  const form = useForm<ContentGenerationFormValues>({
    resolver: zodResolver(contentGenerationSchema),
    defaultValues: {
      title: "",
      description: `На основе трендов создайте пост${selectedPlatforms.includes("telegram") ? " для Telegram" : ""}. 
      
Используйте ключевые слова: ${keywordSuggestions}.

Тренды:
${trendsText}`
    },
  });

  // Мутация для генерации контента с использованием DeepSeek
  const generateContentMutation = useMutation({
    mutationFn: async (values: ContentGenerationFormValues) => {
      // Подготавливаем данные для отправки
      const trendInfo = selectedTrends.map(trend => ({
        title: trend.title,
        description: trend.description || "",
        url: trend.url || "",
      }));

      // Выполняем запрос к API
      const response = await apiRequest("/api/content/generate-deepseek", {
        method: "POST",
        data: {
          prompt: values.description,
          keywords: keywords,
          platform: selectedPlatforms[0] || "telegram",
          campaignId: campaignId,
          trends: trendInfo
        },
      });

      return response.data?.content || "";
    },
    onSuccess: (content) => {
      setGeneratedContent(content);
      
      toast({
        title: "Контент сгенерирован",
        description: "Контент успешно создан на основе выбранных трендов",
      });
      
      // Вызываем колбэк, если он передан
      if (onContentGenerated) {
        onContentGenerated({
          content,
          platform: selectedPlatforms[0] || "telegram"
        });
      }
    },
    onError: (error: Error) => {
      console.error("Error generating content:", error);
      toast({
        title: "Ошибка генерации",
        description: `Не удалось сгенерировать контент: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Обработчик отправки формы
  const onSubmit = (values: ContentGenerationFormValues) => {
    generateContentMutation.mutate(values);
  };

  // Обработчик копирования текста
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({
          title: "Скопировано",
          description: "Контент скопирован в буфер обмена",
        });
      })
      .catch((err) => {
        console.error("Не удалось скопировать: ", err);
        toast({
          title: "Ошибка",
          description: "Не удалось скопировать контент",
          variant: "destructive",
        });
      });
  };

  // Индикатор загрузки данных
  if (generateContentMutation.isPending) {
    return (
      <Card className="w-full mt-4">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <div className="text-sm">Генерация контента на основе трендов...</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full mt-4">
      <CardHeader>
        <CardTitle>Генерация контента</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <strong>Выбранные темы:</strong>
          <ul className="list-disc pl-5 mt-2">
            {selectedTrends.map((trend) => (
              <li key={trend.id}>{trend.title}</li>
            ))}
          </ul>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="telegram" 
                    checked={selectedPlatforms.includes("telegram")}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedPlatforms(["telegram"]);
                      } else {
                        setSelectedPlatforms([]);
                      }
                    }}
                  />
                  <Label 
                    htmlFor="telegram" 
                    className="flex items-center space-x-1 cursor-pointer"
                  >
                    <SiTelegram className="h-4 w-4 text-blue-500" />
                    <span>Telegram</span>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="vk" 
                    checked={selectedPlatforms.includes("vk")}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedPlatforms(["vk"]);
                      } else {
                        setSelectedPlatforms([]);
                      }
                    }}
                  />
                  <Label 
                    htmlFor="vk" 
                    className="flex items-center space-x-1 cursor-pointer"
                  >
                    <SiVk className="h-4 w-4 text-blue-500" />
                    <span>ВКонтакте</span>
                  </Label>
                </div>
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Заголовок (опционально)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Введите заголовок для поста или оставьте пустым для автогенерации" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание задачи для AI</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Опишите какой контент нужно сгенерировать на основе трендов" 
                        className="min-h-32" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={generateContentMutation.isPending}
                className="flex items-center space-x-2"
              >
                {generateContentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Генерация...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Сгенерировать контент</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>

        {generatedContent && (
          <div className="space-y-4 mt-6 border-t pt-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Сгенерированный контент</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => copyToClipboard(generatedContent)}
                className="flex items-center space-x-1"
              >
                <Copy className="h-4 w-4" />
                <span>Копировать</span>
              </Button>
            </div>
            
            <div className="rounded-lg border p-4 bg-muted/30">
              <div className="whitespace-pre-line text-sm">
                {generatedContent}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}