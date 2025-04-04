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
        id: "deepseek-coder",
        name: "DeepSeek Coder",
        default: true
      },
      {
        id: "deepseek-llm",
        name: "DeepSeek LLM"
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
    switch (selectedService) {
      case 'claude':
        return '/api/claude/improve-text';
      case 'deepseek':
        return '/api/deepseek/improve-text';
      case 'qwen':
        return '/api/qwen/improve-text';
      default:
        return '/api/claude/improve-text';
    }
  };
  
  // Мутация для улучшения текста
  const { mutate: improveText, isPending } = useMutation({
    mutationFn: async () => {
      const response = await api.post(getApiEndpoint(), {
        text,
        prompt: getCurrentPrompt(),
        model: selectedModelId,
        service: selectedService
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Произошла ошибка при улучшении текста');
      }
      
      return response.data.text;
    },
    onSuccess: (data) => {
      setEnhancedText(data);
      toast({
        title: "Готово!",
        description: "Текст успешно улучшен",
      });
    },
    onError: (error: any) => {
      // Проверяем, нужен ли API ключ
      if (error.response?.data?.needApiKey) {
        setHasApiKey(false);
      }
      
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось улучшить текст",
      });
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
      title: `Необходим API ключ ${selectedService === 'claude' ? 'Claude' : selectedService === 'deepseek' ? 'DeepSeek' : 'Qwen'}`,
      description: `Перейдите в настройки и добавьте API ключ ${selectedService === 'claude' ? 'Claude' : selectedService === 'deepseek' ? 'DeepSeek' : 'Qwen'}`,
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="original-text" className="mb-2 block">Исходный текст</Label>
                <Textarea
                  id="original-text"
                  placeholder="Введите текст для улучшения"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
              
              <div>
                <Label htmlFor="enhanced-text" className="mb-2 block">Улучшенный текст</Label>
                <Textarea
                  id="enhanced-text"
                  placeholder="Здесь появится улучшенный текст"
                  value={enhancedText}
                  onChange={(e) => setEnhancedText(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
            </div>
            
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="default"
                onClick={() => improveText()}
                disabled={isPending || !text.trim()}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Улучшить текст
              </Button>
              
              <div className="space-x-2">
                <DialogClose asChild>
                  <Button variant="outline" type="button">
                    Отмена
                  </Button>
                </DialogClose>
                
                <Button
                  type="button"
                  variant="default"
                  onClick={handleSave}
                  disabled={!enhancedText.trim()}
                >
                  Использовать текст
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}