import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface TextEnhancementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText: string;
  onSave: (enhancedText: string) => void;
}

// Предустановленные промпты для улучшения текста
const ENHANCEMENT_PROMPTS = [
  {
    id: "improve",
    name: "Улучшить текст",
    prompt: "Улучши этот текст, сделай его более привлекательным и интересным для чтения. Сохрани стиль и формат, но сделай его более ярким и запоминающимся."
  },
  {
    id: "shorten",
    name: "Сократить текст",
    prompt: "Сократи этот текст, сохранив его основной смысл и ключевые тезисы. Убери повторения и лишние детали."
  },
  {
    id: "expand",
    name: "Расширить текст",
    prompt: "Расширь и дополни этот текст деталями, примерами и пояснениями. Сделай его более информативным и полным."
  },
  {
    id: "friendly",
    name: "Сделать дружелюбнее",
    prompt: "Перепиши текст в более дружелюбном, разговорном стиле. Добавь личных обращений, замени формальные выражения на более простые и теплые."
  },
  {
    id: "professional",
    name: "Сделать профессиональнее",
    prompt: "Перепиши текст в более профессиональном стиле. Сделай его формальным, структурированным и солидным. Используй деловой тон."
  },
  {
    id: "fix",
    name: "Исправить ошибки",
    prompt: "Исправь в тексте грамматические, стилистические и пунктуационные ошибки. Улучши структуру предложений, сохраняя исходный смысл."
  },
  {
    id: "emoji",
    name: "Добавить эмодзи",
    prompt: "Добавь в текст уместные эмодзи, чтобы сделать его более ярким и привлекательным. Размести эмодзи рядом с соответствующими тезисами."
  }
];

// Сервисы AI и их модели
const AI_SERVICES = [
  {
    id: "claude",
    name: "Claude AI",
    default: true,
    models: [
      {
        id: "claude-3-haiku-20240307",
        name: "Claude 3 Haiku (быстрая)"
      },
      {
        id: "claude-3-sonnet-20240229",
        name: "Claude 3 Sonnet (сбалансированная)",
        default: true
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus (мощная)"
      }
    ]
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    models: [
      {
        id: "deepseek-chat",
        name: "DeepSeek Chat",
        default: true
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek Reasoner",
        default: false
      }
    ]
  },
  {
    id: "qwen",
    name: "Qwen",
    models: [
      {
        id: "qwen-max",
        name: "Qwen Max",
        default: true
      },
      {
        id: "qwen-plus",
        name: "Qwen Plus"
      }
    ]
  },
  {
    id: "gemini",
    name: "Gemini",
    models: [
      // Стабильные рабочие модели (подтверждено тестами)
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        default: true
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash"
      },
      {
        id: "gemini-1.5-flash-8b",
        name: "Gemini 1.5 Flash 8B"
      },
      {
        id: "gemini-2.0-flash-001",
        name: "Gemini 2.0 Flash"
      },
      {
        id: "gemini-2.0-flash-lite-001", 
        name: "Gemini 2.0 Flash Lite"
      },
      
      // Экспериментальные и preview модели (beta API)
      {
        id: "gemini-2.5-pro-preview-03-25",
        name: "Gemini 2.5 Pro (Preview) 🧪"
      },
      {
        id: "gemini-2.5-pro-exp-03-25",
        name: "Gemini 2.5 Pro (Experimental) 🧪"
      },
      {
        id: "gemini-2.0-flash-exp",
        name: "Gemini 2.0 Flash (Experimental) 🧪"
      },
      {
        id: "gemini-2.0-flash-exp-image-generation",
        name: "Gemini 2.0 Flash Image Gen 🧪"
      },
      {
        id: "gemini-2.0-flash-thinking-exp-01-21",
        name: "Gemini 2.0 Flash Thinking 🧪"
      },
      {
        id: "gemini-2.0-flash-live-001",
        name: "Gemini 2.0 Flash Live 🧪"
      },
      
      // Устаревшие модели (для обратной совместимости)
      {
        id: "gemini-pro",
        name: "Gemini Pro (Legacy)"
      },
      {
        id: "gemini-2.0-pro",
        name: "Gemini 2.0 Pro (Legacy)"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash (Legacy)"
      }
    ]
  }
];

export function TextEnhancementDialog({
  open,
  onOpenChange,
  initialText,
  onSave
}: TextEnhancementDialogProps) {
  const [text, setText] = useState(initialText);
  const [enhancedText, setEnhancedText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState("improve");
  const [selectedService, setSelectedService] = useState(AI_SERVICES.find(s => s.default)?.id || "claude");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [hasApiKey, setHasApiKey] = useState(true); // Предполагаем, что ключ есть, потом проверим
  
  const { toast } = useToast();
  
  // Получаем доступные модели для выбранного сервиса
  const getModelsForService = () => {
    const service = AI_SERVICES.find(s => s.id === selectedService);
    return service ? service.models : [];
  };
  
  // Устанавливаем модель по умолчанию при выборе сервиса
  useEffect(() => {
    const service = AI_SERVICES.find(s => s.id === selectedService);
    if (service) {
      const defaultModel = service.models.find(m => m.default);
      setSelectedModelId(defaultModel?.id || service.models[0]?.id || "");
    }
  }, [selectedService]);

  // Сбрасываем состояние при открытии диалога
  useEffect(() => {
    if (open) {
      setText(initialText);
      setEnhancedText("");
    }
  }, [open, initialText]);

  // Получаем текущий промпт
  const getCurrentPrompt = () => {
    const selectedPrompt = ENHANCEMENT_PROMPTS.find(p => p.id === selectedPromptId);
    return customPrompt || (selectedPrompt ? selectedPrompt.prompt : "");
  };

  // Получение эндпоинта API в зависимости от выбранного сервиса
  const getApiEndpoint = () => {
    return '/api/improve-text';  // Единый маршрут для всех сервисов
  };
  
  // Получение правильного названия модели в зависимости от выбранного сервиса
  const getModelName = (service: string, modelId: string): string => {
    // Для всех сервисов просто возвращаем ID модели как есть
    return modelId;
  };
  
  // Логирование в консоль для отладки
  console.log(`TextEnhancementDialog: будет использован API эндпоинт ${getApiEndpoint()}`);
  console.log(`TextEnhancementDialog: выбранный сервис - ${selectedService}, модель - ${selectedModelId}`);
  
  // Мутация для улучшения текста - ТОЧНО КАК В ContentGenerationDialog
  const { mutate: improveText, isPending } = useMutation({
    mutationFn: async () => {
      if (!text.trim()) {
        throw new Error('Введите текст для улучшения');
      }
      
      // Получаем токен авторизации
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error('Требуется авторизация');
      }
      
      // Используем единый маршрут для всех сервисов
      let apiEndpoint = '/api/improve-text';
      
      console.log(`Улучшение текста через ${selectedService} API (endpoint: ${apiEndpoint})`);
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          text,
          prompt: getCurrentPrompt(),
          model: getModelName(selectedService, selectedModelId),
          service: selectedService
        })
      });
      
      if (!response.ok) {
        let errorText;
        try {
          const error = await response.json();
          errorText = error.error || `Ошибка HTTP: ${response.status}`;
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
          text: data.text,
          service: data.service || selectedService
        };
      } catch (e) {
        console.error('Ошибка при обработке JSON ответа:', e);
        throw new Error('Ошибка при обработке ответа от сервера');
      }
    },
    onSuccess: (data) => {
      setEnhancedText(data);
      
      // Показываем уведомление об успешном улучшении
      toast({
        title: "Готово!",
        description: "Текст успешно улучшен и применен в редакторе",
      });
      
      // Сразу же сохраняем улучшенный текст и закрываем диалог
      onSave(data);
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Ошибка TextEnhancementDialog:', error);
      
      // Проверяем, нужен ли API ключ
      if (error.response?.data?.needApiKey || 
          (typeof error === 'object' && error?.message?.includes('API ключ') && 
           error?.message?.includes('не настроен'))) {
        setHasApiKey(false);
        
        toast({
          variant: "destructive",
          title: "Необходим API ключ",
          description: `Перейдите в настройки и добавьте API ключ ${selectedService.toUpperCase()}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: error.message || "Не удалось улучшить текст",
        });
      }
    }
  });

  // Обработчик сохранения улучшенного текста
  const handleSave = () => {
    onSave(enhancedText);
    onOpenChange(false);
  };

  // Обработчик изменения стиля улучшения
  const handlePromptChange = (value: string) => {
    setSelectedPromptId(value);
    // Сбрасываем кастомный промпт при выборе предустановленного
    setCustomPrompt("");
  };

  // Обработчик изменения модели
  const handleModelChange = (value: string) => {
    setSelectedModelId(value);
  };

  // Открытие настроек, если API ключ не настроен
  const openSettings = () => {
    // Закрываем текущий диалог
    onOpenChange(false);
    
    // Открываем диалог настроек
    document.getElementById('settings-dialog-trigger')?.click();
    
    toast({
      title: `Необходим API ключ ${
        selectedService === 'claude' ? 'Claude' : 
        selectedService === 'deepseek' ? 'DeepSeek' : 
        selectedService === 'gemini' ? 'Gemini' : 'Qwen'
      }`,
      description: `Перейдите в настройки и добавьте API ключ ${
        selectedService === 'claude' ? 'Claude' : 
        selectedService === 'deepseek' ? 'DeepSeek' : 
        selectedService === 'gemini' ? 'Gemini' : 'Qwen'
      }`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Улучшение текста с помощью AI</DialogTitle>
        </DialogHeader>
        
        {!hasApiKey ? (
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
              <h3 className="text-lg font-medium text-amber-800 mb-2">Требуется настройка API ключа</h3>
              <p className="text-amber-700 mb-4">
                Для использования {selectedService === 'claude' ? 'Claude AI' : selectedService === 'deepseek' ? 'DeepSeek' : 'Qwen'} необходимо добавить API ключ в настройках.
              </p>
              <Button variant="outline" onClick={openSettings}>
                Открыть настройки
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="enhancement-type" className="mb-2 block">Тип улучшения</Label>
                <Select value={selectedPromptId} onValueChange={handlePromptChange}>
                  <SelectTrigger id="enhancement-type">
                    <SelectValue placeholder="Выберите тип улучшения" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENHANCEMENT_PROMPTS.map(prompt => (
                      <SelectItem key={prompt.id} value={prompt.id}>
                        {prompt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="service-select" className="mb-2 block">AI сервис</Label>
                  <Select 
                    value={selectedService} 
                    onValueChange={(value) => setSelectedService(value)}
                  >
                    <SelectTrigger id="service-select">
                      <SelectValue placeholder="Выберите AI сервис" />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_SERVICES.map(service => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="model-select" className="mb-2 block">Модель</Label>
                  <Select value={selectedModelId} onValueChange={handleModelChange}>
                    <SelectTrigger id="model-select">
                      <SelectValue placeholder="Выберите модель" />
                    </SelectTrigger>
                    <SelectContent>
                      {getModelsForService().map((model: {id: string, name: string}) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div>
              <Label htmlFor="custom-prompt" className="mb-2 block">Пользовательская инструкция (необязательно)</Label>
              <Textarea
                id="custom-prompt"
                placeholder="Введите свою инструкцию для AI, если хотите задать конкретные требования к улучшению текста"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-20"
              />
            </div>
            
            {/* Скрытые текстовые поля - мы скрываем их от пользователя, но они все еще используются для хранения данных */}
            <div className="hidden">
              <Textarea
                id="original-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <Textarea
                id="enhanced-text"
                value={enhancedText}
                onChange={(e) => setEnhancedText(e.target.value)}
              />
            </div>
            
            {/* Индикатор загрузки во время обработки */}
            {isPending && (
              <div className="my-4 flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm font-medium">Улучшаем текст...</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Это может занять некоторое время в зависимости от размера текста и выбранной модели
                </div>
              </div>
            )}
            
            <div className="flex justify-between pt-4">
              {!isPending && !enhancedText?.trim() ? (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => improveText()}
                  disabled={isPending || !text?.trim()}
                  className="w-full"
                >
                  Улучшить и применить текст
                </Button>
              ) : (
                <div className="flex justify-between w-full">
                  <DialogClose asChild>
                    <Button variant="outline" type="button">
                      Отмена
                    </Button>
                  </DialogClose>
                  
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleSave}
                    disabled={!enhancedText?.trim() || isPending}
                  >
                    Использовать улучшенный текст
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}