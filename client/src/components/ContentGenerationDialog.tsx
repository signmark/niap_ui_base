import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

type ApiService = 'apiservice' | 'deepseek' | 'qwen' | 'claude' | 'gemini' | 
  // Стабильные модели Gemini (подтверждено тестами)
  'gemini-1.5-pro' | 'gemini-1.5-flash' | 'gemini-1.5-flash-8b' |
  'gemini-2.0-flash-001' | 'gemini-2.0-flash-lite-001' |
  
  // Экспериментальные и preview модели (beta API)
  'gemini-2.5-pro-preview-03-25' | 'gemini-2.5-pro-exp-03-25' |
  'gemini-2.0-flash-exp' | 'gemini-2.0-flash-exp-image-generation' |
  'gemini-2.0-flash-thinking-exp-01-21' | 'gemini-2.0-flash-live-001' |
  
  // Устаревшие модели (для обратной совместимости)
  'gemini-pro' | 'gemini-2.0-pro' | 'gemini-2.0-flash';

export function ContentGenerationDialog({ campaignId, keywords, onClose }: ContentGenerationDialogProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<string | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [tone, setTone] = useState('informative');
  const [platform, setPlatform] = useState('facebook');
  const [selectedService, setSelectedService] = useState<ApiService>('deepseek');
  
  // Сопоставление выбранных сервисов с конкретными моделями API
  const getModelForService = (service: ApiService): string => {
    // Просто возвращаем имя модели как есть - сервер сам определит, 
    // какую версию API использовать (v1 или v1beta)
    return service;
  };

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

      // Используем единый маршрут для всех сервисов
      let apiEndpoint = '/api/generate-content';
      
      console.log(`Генерация контента через ${selectedService} API (endpoint: ${apiEndpoint})`);

      console.log('Передаем заголовок x-user-id:', localStorage.getItem('user_id'));
      console.log('Авторизационный токен:', authToken ? 'Присутствует (скрыт)' : 'Отсутствует');
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'x-user-id': localStorage.getItem('user_id') || ''
        },
        body: JSON.stringify({
          prompt: prompt,
          keywords: selectedKeywords,
          tone,
          campaignId,
          platform: platform, // Используется для всех сервисов
          service: selectedService, // Указываем выбранный сервис
          model: getModelForService(selectedService) // Используем маппинг для получения правильного названия модели
        })
      });

      if (!response.ok) {
        let errorText;
        try {
          const error = await response.json();
          errorText = error.error || error.message || `Ошибка HTTP: ${response.status}`;
        } catch (e) {
          // Если не удалось распарсить JSON, получаем текст ошибки
          const htmlText = await response.text();
          console.error('Ошибка не в формате JSON:', htmlText.substring(0, 200));
          errorText = `Ошибка сервера: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorText);
      }

      try {
        const data = await response.json();
        
        // Добавляем информацию о используемом сервисе
        return {
          content: data.content,
          service: data.service || selectedService
        };
      } catch (error) {
        console.error('Ошибка при обработке JSON ответа:', error);
        throw new Error('Ошибка при обработке ответа от сервера');
      }
    },
    onSuccess: (data) => {
      // Преобразуем контент в формат, подходящий для редактора
      // Заменяем обычные переносы строки на HTML-параграфы
      const content = data.content;
      const service = data.service;
      
      let formattedContent = content
        .split('\n\n').map((paragraph: string) => paragraph.trim()) // Разбиваем на параграфы
        .filter((p: string) => p) // Убираем пустые параграфы
        .map((paragraph: string) => {
          // Обрабатываем маркдаун-форматирование
          return paragraph
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Полужирный
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // Курсив
            .replace(/^#+ (.*)$/, (match: string, text: string) => { // Заголовки
              const level = (match.match(/^#+/) || ['#'])[0].length;
              return `<h${level}>${text}</h${level}>`;
            });
        })
        .map((p: string) => p.startsWith('<h') ? p : `<p>${p}</p>`) // Оборачиваем в <p>, если не заголовок
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto resize-handle dialog-content">
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
                <Label htmlFor="selectedService" className="text-right">
                  API Сервис
                </Label>
                <div className="col-span-3">
                  <Select
                    value={selectedService}
                    onValueChange={(value) => setSelectedService(value as ApiService)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Выберите API Сервис" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                      <SelectItem value="qwen">Qwen</SelectItem>
                      <SelectItem value="claude">Claude</SelectItem>
                      
                      {/* Стабильные модели Gemini */}
                      <SelectItem value="gemini">Gemini (Legacy)</SelectItem>
                      <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                      <SelectItem value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B</SelectItem>
                      <SelectItem value="gemini-2.0-flash-001">Gemini 2.0 Flash</SelectItem>
                      <SelectItem value="gemini-2.0-flash-lite-001">Gemini 2.0 Flash Lite</SelectItem>
                      
                      {/* Экспериментальные и preview модели */}
                      <SelectItem value="gemini-2.5-pro-preview-03-25">Gemini 2.5 Pro (Preview) 🧪</SelectItem>
                      <SelectItem value="gemini-2.5-pro-exp-03-25">Gemini 2.5 Pro (Exp) 🧪</SelectItem>
                      <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Exp) 🧪</SelectItem>
                      <SelectItem value="gemini-2.0-flash-exp-image-generation">Gemini 2.0 Flash Image 🧪</SelectItem>
                      <SelectItem value="gemini-2.0-flash-thinking-exp-01-21">Gemini 2.0 Flash Thinking 🧪</SelectItem>
                      <SelectItem value="gemini-2.0-flash-live-001">Gemini 2.0 Flash Live 🧪</SelectItem>
                      
                      {/* Устаревшие модели */}
                      <SelectItem value="gemini-2.0-pro">Gemini 2.0 Pro (Legacy)</SelectItem>
                      <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash (Legacy)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Показываем выбор платформы для всех сервисов и моделей */}
              {selectedService && (
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
                <div className="col-span-3 grid grid-cols-2 gap-2">
                  {keywords.length === 0 ? (
                    <p className="text-sm text-muted-foreground col-span-2">
                      Нет доступных ключевых слов. Добавьте их в раздел "Ключевые слова".
                    </p>
                  ) : (
                    // Отфильтруем ключевые слова, оставив только с положительным трендом
                    keywords
                      .filter(kw => kw.keyword && kw.keyword.trim() !== '' && kw.trendScore > 0)
                      .map((kw) => (
                        <div key={kw.id} className="flex items-start space-x-2">
                          <Checkbox 
                            id={`keyword-${kw.id}`}
                            checked={selectedKeywords.includes(kw.keyword)}
                            onCheckedChange={() => handleKeywordToggle(kw.keyword)}
                            className="mt-1"
                          />
                          <Label 
                            htmlFor={`keyword-${kw.id}`}
                            className="cursor-pointer text-sm"
                          >
                            {kw.keyword} ({kw.trendScore})
                          </Label>
                        </div>
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