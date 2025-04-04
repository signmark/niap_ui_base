import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { useAuthStore } from "@/lib/store";
import { Loader2, HelpCircle, CheckCircle2, XCircle, Info as InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Функция для получения читаемого названия сервиса по его внутреннему идентификатору
function getServiceDisplayName(serviceName: string): string {
  const serviceNames: Record<string, string> = {
    'perplexity': 'Perplexity',
    'apify': 'Apify',
    'deepseek': 'DeepSeek',
    'fal_ai': 'FAL.AI',
    'xmlriver': 'XMLRiver',
    'claude': 'Claude AI'
  };
  
  return serviceNames[serviceName] || serviceName;
}

interface ApiKey {
  id: string;
  service_name: string;
  api_key: string;
}

// Интерфейс для XMLRiver ключа
interface XMLRiverCredentials {
  user: string;
  key: string;
}

// Типы состояния тестирования ключа API
type TestingStatus = 'idle' | 'testing' | 'success' | 'error';

interface TestingState {
  status: TestingStatus;
  message?: string;
}

export function SettingsDialog() {
  const [perplexityKey, setPerplexityKey] = useState("");
  const [apifyKey, setApifyKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [falAiKey, setFalAiKey] = useState("");
  const [claudeKey, setClaudeKey] = useState(""); // Добавлен ключ Claude
  // XMLRiver API credentials
  const [xmlRiverUserId, setXmlRiverUserId] = useState("16797"); // Значение по умолчанию
  const [xmlRiverApiKey, setXmlRiverApiKey] = useState("");
  
  // Состояния тестирования ключей
  const [perplexityTesting, setPerplexityTesting] = useState<TestingState>({ status: 'idle' });
  const [apifyTesting, setApifyTesting] = useState<TestingState>({ status: 'idle' });
  const [deepseekTesting, setDeepseekTesting] = useState<TestingState>({ status: 'idle' });
  const [falAiTesting, setFalAiTesting] = useState<TestingState>({ status: 'idle' });
  const [claudeTesting, setClaudeTesting] = useState<TestingState>({ status: 'idle' }); // Добавлено состояние тестирования Claude
  // Состояния для соцсетей убраны, т.к. токены перенесены в настройки кампаний
  const [xmlRiverTesting, setXmlRiverTesting] = useState<TestingState>({ status: 'idle' });
  
  const { toast } = useToast();
  const userId = useAuthStore((state) => state.userId);

  const { data: apiKeys, isLoading, refetch } = useQuery({
    queryKey: ["user_api_keys"],
    queryFn: async () => {
      try {
        const response = await directusApi.get('/items/user_api_keys', {
          params: {
            filter: {
              user_id: {
                _eq: userId
              }
            },
            fields: ['id', 'service_name', 'api_key']
          }
        });
        return response.data?.data || [];
      } catch (error) {
        console.error('Error fetching API keys:', error);
        throw error;
      }
    },
    enabled: !!userId
  });

  // Обобщенная функция для тестирования API ключей
  const testApiKey = async (
    keyType: 'perplexity' | 'apify' | 'deepseek' | 'fal_ai' | 'xmlriver' | 'claude',
    keyValue: string,
    setTestingState: React.Dispatch<React.SetStateAction<TestingState>>,
    additionalValidation?: () => boolean
  ) => {
    if (!keyValue.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: `Необходимо указать API ключ ${keyType === 'fal_ai' ? 'FAL.AI' : keyType === 'xmlriver' ? 'XMLRiver' : keyType}`
      });
      return;
    }

    // Дополнительная валидация если есть
    if (additionalValidation && !additionalValidation()) {
      return;
    }

    setTestingState({ status: 'testing' });
    
    try {
      // Сначала сохраняем ключ
      await saveSettings();
      
      // Для FAL.AI есть специальный эндпоинт тестирования
      if (keyType === 'fal_ai') {
        try {
          // Используем новый тестовый эндпоинт
          const response = await api.get('/test-fal-ai');
          if (response.data.success) {
            setTestingState({ 
              status: 'success', 
              message: 'API ключ FAL.AI работает' 
            });
            toast({
              title: "Успешно",
              description: "API ключ FAL.AI работает корректно"
            });
          } else {
            setTestingState({ 
              status: 'error', 
              message: response.data.error || 'Ошибка при проверке API ключа'
            });
            toast({
              variant: "destructive",
              title: "Ошибка API ключа",
              description: response.data.error || 'API ключ FAL.AI не работает'
            });
          }
          return;
        } catch (err: any) {
          console.error('Ошибка при тестировании FAL.AI ключа:', err);
          
          let errorMessage = 'Ошибка при проверке API ключа';
          if (err.response && err.response.data && err.response.data.error) {
            errorMessage = err.response.data.error;
          } else if (err.message) {
            errorMessage = err.message;
          }
          
          setTestingState({ 
            status: 'error', 
            message: errorMessage
          });
          
          toast({
            variant: "destructive",
            title: "Ошибка проверки",
            description: errorMessage
          });
          return;
        }
      }
      
      // Для остальных ключей просто сообщаем об успешном сохранении
      const serviceNames = {
        perplexity: 'Perplexity',
        apify: 'Apify',
        deepseek: 'DeepSeek',
        xmlriver: 'XMLRiver',
        fal_ai: 'FAL.AI'
      };
      
      const serviceName = serviceNames[keyType as keyof typeof serviceNames] || keyType;
      
      toast({
        title: "Проверка API ключа",
        description: `Ключ ${serviceName} сохранен. Проверьте работу через соответствующий функционал.`
      });
      
      setTestingState({ status: 'success', message: 'API ключ сохранен' });
    } catch (error: any) {
      setTestingState({ 
        status: 'error', 
        message: error.message || 'Ошибка при сохранении API ключа'
      });
      toast({
        variant: "destructive",
        title: "Ошибка сохранения",
        description: error.message || `Не удалось сохранить API ключ ${getServiceDisplayName(keyType)}`
      });
    }
  };

  // Вызовы обобщенной функции для каждого типа ключа
  const testFalAiKey = () => testApiKey('fal_ai', falAiKey, setFalAiTesting);
  const testDeepseekKey = () => testApiKey('deepseek', deepseekKey, setDeepseekTesting);
  const testPerplexityKey = () => testApiKey('perplexity', perplexityKey, setPerplexityTesting);
  const testApifyKey = () => testApiKey('apify', apifyKey, setApifyTesting);
  const testClaudeKey = () => testApiKey('claude', claudeKey, setClaudeTesting);
  // Токены социальных сетей (Instagram и Facebook) были перемещены
  // в настройки каждой кампании и убраны из глобальных настроек
  
  const testXmlRiverKey = () => testApiKey('xmlriver', xmlRiverApiKey, setXmlRiverTesting, () => {
    if (!xmlRiverUserId.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Необходимо указать User ID для XMLRiver"
      });
      return false;
    }
    return true;
  });
  
  useEffect(() => {
    if (apiKeys) {
      const perplexityKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'perplexity');
      const apifyKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'apify');
      const deepseekKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'deepseek');
      const falAiKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'fal_ai');
      const xmlRiverKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'xmlriver');
      const claudeKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'claude');
      // Социальные сети перенесены в настройки кампаний

      if (perplexityKeyData) {
        setPerplexityKey(perplexityKeyData.api_key);
      }
      if (apifyKeyData) {
        setApifyKey(apifyKeyData.api_key);
      }
      if (deepseekKeyData) {
        setDeepseekKey(deepseekKeyData.api_key);
      }
      if (falAiKeyData) {
        setFalAiKey(falAiKeyData.api_key);
      }
      if (claudeKeyData) {
        setClaudeKey(claudeKeyData.api_key);
      }
      
      // Обработка XMLRiver ключа
      if (xmlRiverKeyData) {
        try {
          // Пытаемся распарсить JSON с user и key
          const credentials = JSON.parse(xmlRiverKeyData.api_key) as XMLRiverCredentials;
          setXmlRiverUserId(credentials.user);
          setXmlRiverApiKey(credentials.key);
        } catch (e) {
          // Если не получилось распарсить, значит ключ в старом формате
          // Пробуем разделить на user_id:api_key
          const apiKey = xmlRiverKeyData.api_key;
          if (apiKey.includes(':')) {
            const [user, key] = apiKey.split(':');
            setXmlRiverUserId(user.trim());
            setXmlRiverApiKey(key.trim());
          } else {
            // Если разделителя нет, считаем что это просто ключ
            setXmlRiverApiKey(apiKey.trim());
          }
        }
      }
    }
  }, [apiKeys]);

  const { mutate: saveSettings, isPending } = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error("Пользователь не авторизован");
      }

      // Формируем ключ для XMLRiver, объединяя user_id и api_key в JSON
      const xmlRiverCombinedKey = JSON.stringify({
        user: xmlRiverUserId.trim(),
        key: xmlRiverApiKey.trim()
      });

      const services = [
        { name: 'perplexity', key: perplexityKey },
        { name: 'apify', key: apifyKey },
        { name: 'deepseek', key: deepseekKey },
        { name: 'fal_ai', key: falAiKey },
        { name: 'claude', key: claudeKey },
        { name: 'xmlriver', key: xmlRiverCombinedKey }
      ];
      // Токены социальных сетей перенесены в настройки кампаний

      for (const service of services) {
        // Пропускаем пустые ключи, кроме XMLRiver, которому нужно сохранить user_id даже если ключ пуст
        if (!service.key && service.name !== 'xmlriver') continue;
        if (service.name === 'xmlriver' && !xmlRiverApiKey.trim()) continue;

        const existingKey = apiKeys?.find((key: ApiKey) => key.service_name === service.name);

        if (existingKey) {
          await directusApi.patch(`/items/user_api_keys/${existingKey.id}`, {
            api_key: service.key
          });
        } else {
          await directusApi.post('/items/user_api_keys', {
            user_id: userId,
            service_name: service.name,
            api_key: service.key
          });
        }
      }
      // Обновляем список ключей после сохранения
      await refetch();
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Настройки сохранены"
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось сохранить настройки"
      });
    }
  });

  if (isLoading) {
    return (
      <DialogContent className="dialog-content">
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dialog-content">
      <DialogHeader>
        <DialogTitle>Настройки API ключей</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <Label className="text-base font-medium">API Ключ Perplexity</Label>
            <Badge variant={apiKeys?.some((k: ApiKey) => k.service_name === 'perplexity' && k.api_key) ? "success" : "destructive"}>
              {apiKeys?.some((k: ApiKey) => k.service_name === 'perplexity' && k.api_key) ? "Настроен" : "Требуется настройка"}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              value={perplexityKey}
              onChange={(e) => setPerplexityKey(e.target.value)}
              placeholder="Введите API ключ Perplexity (начинается с prx-)"
              className={cn("flex-1", !perplexityKey && "border-amber-400 focus-visible:ring-amber-400")}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://perplexity.ai/settings', '_blank')}
                    className="shrink-0 border-amber-400 text-amber-600"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Получить ключ на сайте Perplexity</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button 
              variant="outline" 
              size="sm"
              onClick={testPerplexityKey}
              disabled={!perplexityKey.trim() || isPending}
              className="shrink-0"
            >
              {perplexityTesting.status === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : perplexityTesting.status === 'success' ? (
                <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
              ) : perplexityTesting.status === 'error' ? (
                <XCircle className="h-4 w-4 mr-1 text-red-500" />
              ) : null}
              Проверить
            </Button>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium">
              Ключ используется для поиска источников и генерации контента через Perplexity
            </p>
            <ul className="list-disc list-inside pl-2 text-xs">
              <li>Необходим для функции "Искать источники" на странице Источники</li>
              <li>Формат ключа: начинается с "prx-", например "prx-y9t5v@8HL..."</li>
              <li>Ключ можно получить в <a href="https://perplexity.ai/settings" target="_blank" className="text-blue-500 hover:underline">настройках аккаунта Perplexity</a></li>
            </ul>
          </div>
          {perplexityTesting.status === 'error' && (
            <p className="text-sm text-red-500">{perplexityTesting.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>API Ключ Apify</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={apifyKey}
              onChange={(e) => setApifyKey(e.target.value)}
              placeholder="Введите API ключ"
              className="flex-1"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={testApifyKey}
              disabled={!apifyKey.trim() || isPending}
              className="shrink-0"
            >
              {apifyTesting.status === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : apifyTesting.status === 'success' ? (
                <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
              ) : apifyTesting.status === 'error' ? (
                <XCircle className="h-4 w-4 mr-1 text-red-500" />
              ) : null}
              Проверить
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Ключ используется для парсинга социальных сетей
          </p>
          {apifyTesting.status === 'error' && (
            <p className="text-sm text-red-500">{apifyTesting.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label>API Ключ DeepSeek</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={deepseekKey}
              onChange={(e) => setDeepseekKey(e.target.value)}
              placeholder="Введите API ключ"
              className="flex-1"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={testDeepseekKey}
              disabled={!deepseekKey.trim() || isPending || deepseekTesting.status === 'testing'}
              className="shrink-0"
            >
              {deepseekTesting.status === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : deepseekTesting.status === 'success' ? (
                <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
              ) : deepseekTesting.status === 'error' ? (
                <XCircle className="h-4 w-4 mr-1 text-red-500" />
              ) : null}
              Проверить
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Ключ используется для анализа веб-сайтов и генерации контента
          </p>
          {deepseekTesting.status === 'error' && (
            <p className="text-sm text-red-500">{deepseekTesting.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label>API Ключ FAL.AI</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={falAiKey}
              onChange={(e) => setFalAiKey(e.target.value)}
              placeholder="Введите API ключ"
              className="flex-1"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={testFalAiKey}
              disabled={!falAiKey.trim() || isPending || falAiTesting.status === 'testing'}
              className="shrink-0"
            >
              {falAiTesting.status === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : falAiTesting.status === 'success' ? (
                <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
              ) : falAiTesting.status === 'error' ? (
                <XCircle className="h-4 w-4 mr-1 text-red-500" />
              ) : null}
              Проверить
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Ключ используется для генерации изображений и медиа-контента
          </p>
          {falAiTesting.status === 'error' && (
            <p className="text-sm text-red-500">{falAiTesting.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <Label className="text-base font-medium">API Ключ Claude AI</Label>
            <Badge variant={apiKeys?.some((k: ApiKey) => k.service_name === 'claude' && k.api_key) ? "success" : "destructive"}>
              {apiKeys?.some((k: ApiKey) => k.service_name === 'claude' && k.api_key) ? "Настроен" : "Требуется настройка"}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
              placeholder="Введите API ключ Claude AI"
              className={cn("flex-1", !claudeKey && "border-amber-400 focus-visible:ring-amber-400")}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://console.anthropic.com/settings/keys', '_blank')}
                    className="shrink-0 border-amber-400 text-amber-600"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Получить ключ на сайте Anthropic</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button 
              variant="outline" 
              size="sm"
              onClick={testClaudeKey}
              disabled={!claudeKey.trim() || isPending}
              className="shrink-0"
            >
              {claudeTesting.status === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : claudeTesting.status === 'success' ? (
                <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
              ) : claudeTesting.status === 'error' ? (
                <XCircle className="h-4 w-4 mr-1 text-red-500" />
              ) : null}
              Проверить
            </Button>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium">
              Ключ используется для улучшения текста и генерации контента через Claude AI
            </p>
            <ul className="list-disc list-inside pl-2 text-xs">
              <li>Необходим для функции "Улучшить текст" при редактировании постов</li>
              <li>Обеспечивает доступ к Claude 3.7 Sonnet для высококачественной генерации текста</li>
              <li>Ключ можно получить в <a href="https://console.anthropic.com/settings/keys" target="_blank" className="text-blue-500 hover:underline">настройках консоли Anthropic</a></li>
            </ul>
          </div>
          {claudeTesting.status === 'error' && (
            <p className="text-sm text-red-500">{claudeTesting.message}</p>
          )}
        </div>
        
        <Separator className="my-4" />
        
        <div className="space-y-4">
          <div className="flex items-center">
            <Label className="text-lg font-semibold">XMLRiver (Yandex.Wordstat)</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-2">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>XMLRiver используется для получения точных данных по ключевым словам из Яндекс.Вордстат. Требует user ID и API ключ.</p>
                  <p className="mt-2">Получить можно на сайте: <a href="https://xmlriver.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">xmlriver.com</a></p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>User ID в XMLRiver</Label>
              <Input
                type="text"
                value={xmlRiverUserId}
                onChange={(e) => setXmlRiverUserId(e.target.value)}
                placeholder="Введите ID пользователя XMLRiver"
              />
              <p className="text-sm text-muted-foreground">
                ID вашего аккаунта в XMLRiver
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>API Ключ XMLRiver</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={xmlRiverApiKey}
                  onChange={(e) => setXmlRiverApiKey(e.target.value)}
                  placeholder="Введите API ключ XMLRiver"
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={testXmlRiverKey}
                  disabled={!xmlRiverApiKey.trim() || !xmlRiverUserId.trim() || isPending || xmlRiverTesting.status === 'testing'}
                  className="shrink-0"
                >
                  {xmlRiverTesting.status === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : xmlRiverTesting.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                  ) : xmlRiverTesting.status === 'error' ? (
                    <XCircle className="h-4 w-4 mr-1 text-red-500" />
                  ) : null}
                  Проверить
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Ключ для доступа к API XMLRiver
              </p>
              {xmlRiverTesting.status === 'error' && (
                <p className="text-sm text-red-500">{xmlRiverTesting.message}</p>
              )}
            </div>
          </div>
        </div>

        <Separator className="my-4" />
        
        <div className="space-y-4">
          <div className="flex items-center">
            <Label className="text-lg font-semibold">Настройки социальных сетей</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-2">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Настройки токенов социальных сетей были перенесены в настройки каждой кампании.</p>
                  <p className="mt-2">Вы можете настроить публикацию в соцсети при создании или редактировании кампании.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-4">
            <div className="flex">
              <InfoIcon className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">Информация</h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                  <p>Токены доступа к социальным сетям (VK, Telegram, Facebook, Instagram) 
                  теперь настраиваются индивидуально для каждой кампании.</p>
                  <p className="mt-1">Это позволяет публиковать контент в разные аккаунты и группы 
                  для разных кампаний.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <Button
          onClick={() => saveSettings()}
          disabled={isPending}
          className="w-full mt-6"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            "Сохранить"
          )}
        </Button>
      </div>
    </DialogContent>
  );
}