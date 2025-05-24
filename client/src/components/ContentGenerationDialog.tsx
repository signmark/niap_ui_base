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

type ApiService = 'apiservice' | 'deepseek' | 'qwen' | 'claude' | 'gemini' | 'gemini-1.5-pro' | 'gemini-1.5-flash' | 'gemini-2.0-flash' | 'gemini-2.0-pro-exp';

export function ContentGenerationDialog({ campaignId, keywords, onClose }: ContentGenerationDialogProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<string | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [tone, setTone] = useState('informative');
  const [platform, setPlatform] = useState('facebook');
  const [selectedService, setSelectedService] = useState<ApiService>('gemini-2.0-flash');

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

      // Выбираем правильный API маршрут в зависимости от выбранного сервиса
      let apiEndpoint = '/api/generate-content'; // Единый маршрут для всех сервисов
      
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
          platform: platform, // Используется для всех сервисов
          service: selectedService // Указываем выбранный сервис
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Не удалось сгенерировать контент');
      }

      const data = await response.json();
      
      console.log('Получен ответ от API генерации контента:', data);
      
      // Проверяем наличие контента и добавляем информацию о используемом сервисе
      if (!data.content) {
        console.error('API вернул данные без поля content:', data);
        throw new Error('Сервер вернул некорректный формат данных');
      }
      
      return {
        content: data.content,
        service: data.service || selectedService
      };
    },
    onSuccess: (data) => {
      // Преобразуем контент в формат, подходящий для редактора
      console.log('Получены данные для форматирования:', data);
      
      const content = data.content || '';
      const service = data.service || 'AI';
      
      console.log('Начинаем форматирование контента:', content);
      
      // Простая проверка на наличие HTML-тегов
      if (content.includes('<p>') || content.includes('<div>') || content.includes('<h1>')) {
        console.log('Контент уже содержит HTML-теги, используем как есть');
        setGenerationResult(content);
      } else {
        // Форматируем обычный текст в HTML
        try {
          let formattedContent = '';
          
          // Разбиваем текст на параграфы по двойному переносу строки
          const paragraphs = content.split('\n\n')
            .map(p => p.trim())
            .filter(p => p.length > 0);
          
          console.log('Разбито на параграфы:', paragraphs.length);
          
          if (paragraphs.length > 0) {
            formattedContent = paragraphs
              .map((paragraph: string) => {
                // Обрабатываем маркдаун-форматирование
                let processed = paragraph
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Полужирный
                  .replace(/\*(.*?)\*/g, '<em>$1</em>'); // Курсив
                
                // Обрабатываем заголовки
                if (/^#+ /.test(processed)) {
                  const match = processed.match(/^(#+) (.*)/);
                  if (match) {
                    const level = Math.min(match[1].length, 6); // ограничиваем h1-h6
                    return `<h${level}>${match[2]}</h${level}>`;
                  }
                }
                
                // Оборачиваем в параграф, если это не заголовок
                return `<p>${processed}</p>`;
              })
              .join('');
          } else {
            // Если разбивка на параграфы не сработала, оборачиваем весь текст в один параграф
            formattedContent = `<p>${content
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')}</p>`;
          }
          
          console.log('Отформатированный контент:', formattedContent);
          setGenerationResult(formattedContent);
        } catch (error) {
          console.error('Ошибка при форматировании контента:', error);
          // В случае ошибки форматирования просто используем текст как есть, обернутый в параграф
          setGenerationResult(`<p>${content}</p>`);
        }
      }
      
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
    <Dialog open={true} onOpenChange={() => onClose()} modal={true}>
      <DialogContent className={!generationResult ? "sm:max-w-[600px] max-h-[95vh] overflow-y-auto" : "sm:max-w-[600px] max-h-[600px] overflow-y-auto"}>
        <DialogHeader className="mb-0 pb-1">
          <DialogTitle>{generationResult ? "Результат генерации контента" : "Генерация контента"}</DialogTitle>
          {!generationResult && (
            <DialogDescription className="text-xs">
              Используйте AI для генерации контента на основе ключевых слов и промта
            </DialogDescription>
          )}
        </DialogHeader>

        {!generationResult ? (
          <div className="grid gap-4 py-4">
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
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                    <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                    <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="gemini-2.0-pro-exp">Gemini 2.0 Pro Experimental</SelectItem>

                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {(selectedService === 'deepseek' || selectedService === 'claude' || selectedService.includes('gemini')) && (
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

            <div className="grid grid-cols-4 items-start gap-3">
              <Label className="text-right pt-2 text-sm">
                Ключевые слова
              </Label>
              <div className="col-span-3 grid grid-cols-2 gap-1 max-h-[150px] overflow-y-auto border rounded p-1">
                {keywords.length === 0 ? (
                  <p className="text-xs text-muted-foreground col-span-2">
                    Нет доступных ключевых слов. Добавьте их в раздел "Ключевые слова".
                  </p>
                ) : (
                  // Отфильтруем ключевые слова, оставив только с положительным трендом
                  keywords
                    .filter(kw => kw.keyword && kw.keyword.trim() !== '' && kw.trendScore > 0)
                    .map((kw) => (
                      <div key={kw.id} className="flex items-start space-x-1">
                        <Checkbox 
                          id={`keyword-${kw.id}`}
                          checked={selectedKeywords.includes(kw.keyword)}
                          onCheckedChange={() => handleKeywordToggle(kw.keyword)}
                          className="mt-0.5"
                        />
                        <Label 
                          htmlFor={`keyword-${kw.id}`}
                          className="cursor-pointer text-xs"
                        >
                          {kw.keyword} ({kw.trendScore})
                        </Label>
                      </div>
                    ))
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-2">
              <Button variant="outline" onClick={onClose} size="sm" className="w-[100px]">
                Отмена
              </Button>
              <Button 
                onClick={() => generateContent()} 
                size="sm"
                className="w-[150px]"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-1 h-3 w-3" />
                    Сгенерировать
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-4 mb-2">
              <Label htmlFor="title" className="whitespace-nowrap">
                Название:
              </Label>
              <Input
                id="title"
                placeholder="Введите название для контента"
                className="flex-grow"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <Label htmlFor="generatedContent" className="text-left mb-2 font-bold text-lg">
                Результат генерации:
              </Label>
              <div className="min-h-0 border rounded max-h-[300px] overflow-auto">
                <RichTextEditor
                  value={generationResult || ''}
                  onChange={(html: string) => setGenerationResult(html)}
                  minHeight={150}
                  className="tiptap w-full"
                  enableResize={false}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-2 pt-2 border-t flex-shrink-0">
          {!generationResult ? (
            <>

            </>
          ) : (
            <div className="flex w-full justify-between space-x-4">
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
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}