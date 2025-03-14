import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import RichTextEditor from './RichTextEditor';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Определение интерфейса CampainKeyword локально
interface CampainKeyword {
  id: string;
  keyword: string;
  trendScore: number;
  campaignId: string;
}

interface ContentGenerationDialogProps {
  campaignId: string;
  keywords: CampainKeyword[];
  onClose: () => void;
}

type ApiService = 'perplexity' | 'deepseek';

export function ContentGenerationDialog({ campaignId, keywords, onClose }: ContentGenerationDialogProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<string | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [tone, setTone] = useState('informative');
  const [platform, setPlatform] = useState('facebook');
  const [selectedService, setSelectedService] = useState<ApiService>('perplexity');

  const { mutate: generateContent, isPending } = useMutation({
    mutationFn: async () => {
      if (!campaignId) {
        throw new Error('Выберите кампанию');
      }

      if (!prompt.trim()) {
        throw new Error('Введите промт для генерации');
      }

      if (selectedKeywords.length === 0) {
        throw new Error('Выберите ключевые слова');
      }

      setIsGenerating(true);

      // Получаем токен авторизации
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error('Требуется авторизация');
      }

      // Выбираем API в зависимости от выбранного сервиса
      const apiEndpoint = selectedService === 'perplexity' 
        ? '/api/generate-content' 
        : '/api/content/generate-deepseek';
      
      console.log(`Генерация контента через ${selectedService} API`);

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          prompt: prompt,
          keywords: selectedKeywords,
          tone,
          campaignId,
          platform: platform // Используется только для DeepSeek
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Не удалось сгенерировать контент');
      }

      const data = await response.json();
      
      // Добавляем информацию о используемом сервисе
      return {
        content: data.content,
        service: data.service || selectedService
      };
    },
    onSuccess: (data) => {
      // Преобразуем контент в формат, подходящий для редактора
      // Заменяем обычные переносы строки на HTML-параграфы
      const content = data.content;
      const service = data.service;
      
      let formattedContent = content
        .split('\n\n').map(paragraph => paragraph.trim()) // Разбиваем на параграфы
        .filter(p => p) // Убираем пустые параграфы
        .map(paragraph => {
          // Обрабатываем маркдаун-форматирование
          return paragraph
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Полужирный
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // Курсив
            .replace(/^#+ (.*)$/, (match, text) => { // Заголовки
              const level = (match.match(/^#+/)[0].length);
              return `<h${level}>${text}</h${level}>`;
            });
        })
        .map(p => p.startsWith('<h') ? p : `<p>${p}</p>`) // Оборачиваем в <p>, если не заголовок
        .join('');
      
      setGenerationResult(formattedContent);
      
      setIsGenerating(false);
      toast({
        title: 'Успешно',
        description: `Контент сгенерирован с помощью ${service}`
      });
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: error.message || 'Ошибка при генерации контента'
      });
    }
  });

  const { mutate: saveContent, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      if (!generationResult) {
        throw new Error('Сначала сгенерируйте контент');
      }

      if (!title.trim()) {
        throw new Error('Введите название для контента');
      }

      // Используем нашу серверную API вместо прямого обращения к Directus
      return await apiRequest('/api/campaign-content', {
        method: 'POST',
        data: {
          campaignId: campaignId,
          title: title,
          content: generationResult,
          contentType: 'text',
          prompt: prompt,
          keywords: selectedKeywords,
          status: 'draft'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-content', campaignId] });
      toast({
        title: 'Успешно',
        description: 'Контент сохранен'
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: error.message || 'Не удалось сохранить контент'
      });
    }
  });

  const handleKeywordToggle = (keyword: string) => {
    if (selectedKeywords.includes(keyword)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== keyword));
    } else {
      setSelectedKeywords([...selectedKeywords, keyword]);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto resize-handle">
        <DialogHeader>
          <DialogTitle>Генерация контента</DialogTitle>
          <DialogDescription>
            Используйте AI для генерации контента на основе ключевых слов и промта
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!generationResult ? (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="service" className="text-right">
                  API Сервис
                </Label>
                <div className="col-span-3">
                  <Tabs 
                    value={selectedService} 
                    onValueChange={(value) => setSelectedService(value as ApiService)}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="perplexity">Perplexity</TabsTrigger>
                      <TabsTrigger value="deepseek">DeepSeek</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
              
              {selectedService === 'deepseek' && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="platform" className="text-right">
                    Платформа
                  </Label>
                  <Select
                    value={platform}
                    onValueChange={setPlatform}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Выберите платформу" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="vk">ВКонтакте</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="tone" className="text-right">
                  Тон контента
                </Label>
                <Select
                  value={tone}
                  onValueChange={setTone}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Выберите тон контента" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="informative">Информативный</SelectItem>
                    <SelectItem value="friendly">Дружелюбный</SelectItem>
                    <SelectItem value="professional">Профессиональный</SelectItem>
                    <SelectItem value="casual">Повседневный</SelectItem>
                    <SelectItem value="humorous">С юмором</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="prompt" className="text-right">
                  Промт
                </Label>
                <Textarea
                  id="prompt"
                  placeholder="Опишите, какой контент вы хотите сгенерировать"
                  className="col-span-3"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">
                  Ключевые слова
                </Label>
                <div className="col-span-3 flex flex-wrap gap-2">
                  {keywords.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Нет доступных ключевых слов. Добавьте их в раздел "Ключевые слова".
                    </p>
                  ) : (
                    keywords.map((kw) => (
                      <Button
                        key={kw.id}
                        variant={selectedKeywords.includes(kw.keyword) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleKeywordToggle(kw.keyword)}
                      >
                        {kw.keyword}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  Название
                </Label>
                <Input
                  id="title"
                  placeholder="Введите название для контента"
                  className="col-span-3"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="generatedContent" className="text-right pt-2">
                  Результат
                </Label>
                <div className="col-span-3">
                  <div className="max-h-[300px] overflow-y-auto">
                    <RichTextEditor
                      content={generationResult || ''}
                      onChange={(html: string) => setGenerationResult(html)}
                      minHeight="200px"
                      className="tiptap"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {!generationResult ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Отмена
              </Button>
              <Button 
                onClick={() => generateContent()} 
                disabled={isPending || !prompt || selectedKeywords.length === 0}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Сгенерировать
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => setGenerationResult(null)}
              >
                Назад
              </Button>
              <Button 
                onClick={() => saveContent()} 
                disabled={isSaving || !title.trim()}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  "Сохранить"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}