import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { 
  AlertCircle, 
  CheckCircle2, 
  Copy, 
  Image, 
  Loader2, 
  Send, 
  Settings, 
  Sparkles,
  FileText,
  Instagram,
  Facebook,
  Tv
} from "lucide-react";
import { SiTelegram, SiVk } from "react-icons/si";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

// Схема формы для генерации контента
const contentGenerationSchema = z.object({
  title: z.string().min(3, "Заголовок должен содержать не менее 3 символов").optional(),
  description: z.string().min(10, "Описание должно содержать не менее 10 символов"),
  contentType: z.enum(["text", "text-image", "image", "video"]),
  tone: z.enum(["informative", "casual", "professional", "funny"]),
  platform: z.enum(["all", "vk", "telegram", "instagram", "facebook"]),
});

type ContentGenerationFormValues = z.infer<typeof contentGenerationSchema>;

// Типы данных для трендов
export interface Trend {
  id: string;
  title: string;
  description?: string;
  url?: string;
  image_url?: string;
  created_at?: string;
  source?: string;
  source_name?: string;
  source_type?: string;
  is_bookmarked?: boolean;
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
  const [includeImage, setIncludeImage] = useState(true);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("generation");
  
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
${trendsText}`,
      contentType: "text",
      tone: "informative",
      platform: "telegram",
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
          tone: values.tone,
          platform: values.platform,
          campaignId: campaignId,
          trends: trendInfo
        },
      });

      return response.data?.content || "";
    },
    onSuccess: (content) => {
      setGeneratedContent(content);
      setActiveTab("preview");
      
      toast({
        title: "Контент сгенерирован",
        description: "Контент успешно создан на основе выбранных трендов",
      });
      
      // Вызываем колбэк, если он передан
      if (onContentGenerated) {
        onContentGenerated({
          content,
          imageUrl: generatedImageUrl,
          platform: form.getValues("platform"),
          contentType: includeImage ? "text-image" : "text"
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

  // Мутация для генерации изображения
  const generateImageMutation = useMutation({
    mutationFn: async () => {
      setIsGeneratingImage(true);
      
      // Формируем промпт для генерации изображения на основе трендов
      const imagePrompt = `Create an image related to ${selectedTrends.map(t => t.title).join(", ")}. 
      The image should be high quality, photorealistic, suitable for social media post.`;
      
      // Выполняем запрос к API для генерации изображения
      const response = await apiRequest("/api/images/generate", {
        method: "POST",
        data: {
          prompt: imagePrompt,
          negativePrompt: "bad quality, blurry, text, watermark, low resolution",
          width: 1024,
          height: 1024,
          campaignId: campaignId
        },
      });

      return response.data?.imageURLs?.[0] || null;
    },
    onSuccess: (imageUrl) => {
      setGeneratedImageUrl(imageUrl);
      
      toast({
        title: "Изображение сгенерировано",
        description: "Изображение успешно создано на основе выбранных трендов",
      });
    },
    onError: (error: Error) => {
      console.error("Error generating image:", error);
      toast({
        title: "Ошибка генерации",
        description: `Не удалось сгенерировать изображение: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsGeneratingImage(false);
    }
  });

  // Обработчик отправки формы
  const onSubmit = (values: ContentGenerationFormValues) => {
    generateContentMutation.mutate(values);
    
    // Если выбран тип контента с изображением, генерируем изображение
    if (includeImage) {
      generateImageMutation.mutate();
    }
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
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <div className="text-sm">Генерация контента на основе трендов...</div>
            </div>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="generation">Генерация</TabsTrigger>
        <TabsTrigger value="preview" disabled={!generatedContent}>Просмотр</TabsTrigger>
      </TabsList>
      
      <TabsContent value="generation" className="space-y-4 py-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Выберите платформу</FormLabel>
                    <div className="flex flex-wrap gap-3 mt-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="telegram" 
                          checked={selectedPlatforms.includes("telegram")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPlatforms(prev => [...prev, "telegram"]);
                            } else {
                              setSelectedPlatforms(prev => prev.filter(p => p !== "telegram"));
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
                              setSelectedPlatforms(prev => [...prev, "vk"]);
                            } else {
                              setSelectedPlatforms(prev => prev.filter(p => p !== "vk"));
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
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="instagram" 
                          checked={selectedPlatforms.includes("instagram")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPlatforms(prev => [...prev, "instagram"]);
                            } else {
                              setSelectedPlatforms(prev => prev.filter(p => p !== "instagram"));
                            }
                          }}
                        />
                        <Label 
                          htmlFor="instagram" 
                          className="flex items-center space-x-1 cursor-pointer"
                        >
                          <Instagram className="h-4 w-4 text-pink-500" />
                          <span>Instagram</span>
                        </Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="facebook" 
                          checked={selectedPlatforms.includes("facebook")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPlatforms(prev => [...prev, "facebook"]);
                            } else {
                              setSelectedPlatforms(prev => prev.filter(p => p !== "facebook"));
                            }
                          }}
                        />
                        <Label 
                          htmlFor="facebook" 
                          className="flex items-center space-x-1 cursor-pointer"
                        >
                          <Facebook className="h-4 w-4 text-blue-600" />
                          <span>Facebook</span>
                        </Label>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center space-x-2">
                <Switch 
                  id="include-image" 
                  checked={includeImage}
                  onCheckedChange={setIncludeImage}
                />
                <Label htmlFor="include-image">Сгенерировать изображение</Label>
              </div>
              
              <FormField
                control={form.control}
                name="tone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тон контента</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите тон контента" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="informative">Информативный</SelectItem>
                        <SelectItem value="casual">Непринужденный</SelectItem>
                        <SelectItem value="professional">Профессиональный</SelectItem>
                        <SelectItem value="funny">С юмором</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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
                    <FormDescription>
                      Опишите что нужно сгенерировать на основе выбранных трендов. 
                      Можно указать формат, особые требования или ключевые слова.
                    </FormDescription>
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
      </TabsContent>
      
      <TabsContent value="preview" className="space-y-4 py-4">
        {generatedContent && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Сгенерированный контент</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => copyToClipboard(generatedContent)}
                className="flex items-center space-x-1"
              >
                <Copy className="h-4 w-4" />
                <span>Копировать</span>
              </Button>
            </div>
            
            <div className="rounded-lg border p-4 bg-muted/30">
              {isGeneratingImage && includeImage && (
                <div className="mb-4 flex justify-center">
                  <div className="rounded-lg bg-background border w-full max-w-md h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              
              {generatedImageUrl && includeImage && (
                <div className="mb-4 flex justify-center">
                  <img 
                    src={generatedImageUrl} 
                    alt="Сгенерированное изображение" 
                    className="rounded-lg max-h-96 object-cover"
                  />
                </div>
              )}
              
              <div className="whitespace-pre-line text-sm">
                {generatedContent}
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-4">
              <Button 
                variant="outline" 
                onClick={() => setActiveTab("generation")}
              >
                Вернуться к редактированию
              </Button>
              
              <div className="flex items-center space-x-2">
                {!generatedImageUrl && includeImage && (
                  <Button
                    variant="outline"
                    onClick={() => generateImageMutation.mutate()}
                    disabled={isGeneratingImage}
                    className="flex items-center space-x-2"
                  >
                    {isGeneratingImage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Генерация...</span>
                      </>
                    ) : (
                      <>
                        <Image className="h-4 w-4" />
                        <span>Сгенерировать изображение</span>
                      </>
                    )}
                  </Button>
                )}
                
                <Button className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Сохранить как пост</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}