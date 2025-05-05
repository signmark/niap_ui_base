import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
    'claude': 'Claude AI',
    'gemini': 'Gemini',
    'qwen': 'Qwen'
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
  // API keys states
  const [perplexityKey, setPerplexityKey] = useState("");
  const [apifyKey, setApifyKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [falAiKey, setFalAiKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [qwenKey, setQwenKey] = useState("");
  const [xmlRiverUserId, setXmlRiverUserId] = useState("16797");
  const [xmlRiverApiKey, setXmlRiverApiKey] = useState("");
  
  // Testing states
  const [perplexityTesting, setPerplexityTesting] = useState<TestingState>({ status: 'idle' });
  const [apifyTesting, setApifyTesting] = useState<TestingState>({ status: 'idle' });
  const [deepseekTesting, setDeepseekTesting] = useState<TestingState>({ status: 'idle' });
  const [falAiTesting, setFalAiTesting] = useState<TestingState>({ status: 'idle' });
  const [claudeTesting, setClaudeTesting] = useState<TestingState>({ status: 'idle' });
  const [geminiTesting, setGeminiTesting] = useState<TestingState>({ status: 'idle' });
  const [qwenTesting, setQwenTesting] = useState<TestingState>({ status: 'idle' });
  const [xmlRiverTesting, setXmlRiverTesting] = useState<TestingState>({ status: 'idle' });
  
  // Component states
  const { toast } = useToast();
  const userId = useAuthStore((state) => state.userId);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Query to fetch API keys
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

  // Load keys from API when component mounts
  useEffect(() => {
    if (apiKeys) {
      // Process XMLRiver key separately since it contains two fields
      const xmlRiverKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'xmlriver');
      if (xmlRiverKeyData && xmlRiverKeyData.api_key) {
        try {
          const credentials = JSON.parse(xmlRiverKeyData.api_key) as XMLRiverCredentials;
          setXmlRiverUserId(credentials.user || "16797");
          setXmlRiverApiKey(credentials.key || "");
        } catch (e) {
          console.error('Error parsing XMLRiver credentials:', e);
        }
      }

      // Set other keys
      const perplexityKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'perplexity');
      const apifyKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'apify');
      const deepseekKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'deepseek');
      const falAiKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'fal_ai');
      const claudeKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'claude');
      const geminiKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'gemini');
      const qwenKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'qwen');
      
      setPerplexityKey(perplexityKeyData?.api_key || "");
      setApifyKey(apifyKeyData?.api_key || "");
      setDeepseekKey(deepseekKeyData?.api_key || "");
      setFalAiKey(falAiKeyData?.api_key || "");
      setClaudeKey(claudeKeyData?.api_key || "");
      setGeminiKey(geminiKeyData?.api_key || "");
      setQwenKey(qwenKeyData?.api_key || "");
    }
  }, [apiKeys]);

  // Delete API key mutation
  const deleteMutation = useMutation({
    mutationFn: async (keyId: string) => {
      console.log(`Удаление ключа с ID: ${keyId}`);
      // Фиксим проблему с двойным префиксом /api/api/ при работе с маршрутами
      await api.delete(`/api/user-api-keys/${keyId}`);
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "API ключ удален",
      });
      refetch();
    },
    onError: (error: Error) => {
      console.error('Error deleting API key:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: `Не удалось удалить API ключ: ${error.message}`,
      });
    }
  });

  // Function to save API keys
  const saveSettings = async (): Promise<boolean> => {
    setIsPending(true);
    try {
      // Collect all keys in an array
      const keysToSave = [
        { service_name: 'perplexity', api_key: perplexityKey },
        { service_name: 'apify', api_key: apifyKey },
        { service_name: 'deepseek', api_key: deepseekKey },
        { service_name: 'fal_ai', api_key: falAiKey },
        { service_name: 'claude', api_key: claudeKey },
        { service_name: 'gemini', api_key: geminiKey },
        { service_name: 'qwen', api_key: qwenKey },
        { 
          service_name: 'xmlriver', 
          api_key: JSON.stringify({ user: xmlRiverUserId, key: xmlRiverApiKey }) 
        }
      ];

      // Filter to only include keys that are filled in
      const filledKeys = keysToSave.filter(key => key.api_key.trim() !== '');
      
      // Send to server
      const response = await api.post('/api/user-api-keys', {
        keys: filledKeys
      });

      if (response.status === 200) {
        toast({
          title: "Успешно",
          description: "API ключи сохранены"
        });
        refetch();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error saving API keys:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: `Не удалось сохранить API ключи: ${error.message}`
      });
      return false;
    } finally {
      setIsPending(false);
    }
  };

  // Functions for API key deletion dialog
  const confirmDeleteApiKey = (keyId: string) => {
    setKeyToDelete(keyId);
  };
  
  const deleteApiKey = () => {
    if (keyToDelete) {
      deleteMutation.mutate(keyToDelete);
      setKeyToDelete(null);
    }
  };
  
  const cancelDeleteApiKey = () => {
    setKeyToDelete(null);
  };
  
  // Generic function for testing API keys
  const testApiKey = async (
    keyType: 'perplexity' | 'apify' | 'deepseek' | 'fal_ai' | 'xmlriver' | 'claude' | 'gemini' | 'qwen',
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

    if (additionalValidation && !additionalValidation()) {
      return;
    }

    setTestingState({ status: 'testing' });
    
    try {
      // First save the key
      console.log('Saving API settings before testing');
      const saveSuccess = await saveSettings();
      if (!saveSuccess) {
        setTestingState({ status: 'error', message: 'Не удалось сохранить ключ перед тестированием' });
        return;
      }
      
      // Special endpoint for FAL.AI testing
      if (keyType === 'fal_ai') {
        try {
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
          console.error('Error testing FAL.AI key:', err);
          
          let errorMessage = 'Ошибка при проверке API ключа';
          if (err.response?.data?.error) {
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
      
      // Special endpoint for Claude API testing
      if (keyType === 'claude') {
        try {
          console.log('Sending Claude key for verification, length:', keyValue.length);
          
          const response = await api.post('/claude/test-api-key', {
            apiKey: keyValue
          });
          
          console.log('Server response for Claude key test:', response.data);
          
          if (response.data.success && response.data.isValid === true) {
            console.log('Claude API key passed validation');
            setTestingState({ 
              status: 'success', 
              message: 'API ключ Claude работает' 
            });
            toast({
              title: "Успешно",
              description: "API ключ Claude работает корректно"
            });
          } else {
            console.log('Claude API key validation failed: isValid =', response.data.isValid);
            setTestingState({ 
              status: 'error', 
              message: response.data.error || 'Недействительный API ключ Claude'
            });
            toast({
              variant: "destructive",
              title: "Ошибка API ключа",
              description: "API ключ не прошел проверку на сервере. Проверьте ключ и попробуйте снова."
            });
          }
          return;
        } catch (err: any) {
          console.error('Error testing Claude key:', err);
          
          let errorMessage = 'Ошибка при проверке API ключа. Убедитесь, что ключ верный и имеет правильный формат.';
          if (err.response?.data?.error) {
            errorMessage = 'Ошибка при проверке ключа. Сервер вернул: ' + err.response.data.error;
          } else if (err.message) {
            errorMessage = 'Ошибка при проверке ключа: ' + err.message;
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
      
      // For other keys just report successful saving
      const serviceNames: Record<string, string> = {
        perplexity: 'Perplexity',
        apify: 'Apify',
        deepseek: 'DeepSeek',
        xmlriver: 'XMLRiver',
        fal_ai: 'FAL.AI',
        gemini: 'Gemini',
        qwen: 'Qwen'
      };
      
      const serviceName = serviceNames[keyType] || keyType;
      
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

  // Test functions for each API key type
  const testFalAiKey = () => testApiKey('fal_ai', falAiKey, setFalAiTesting);
  const testDeepseekKey = () => testApiKey('deepseek', deepseekKey, setDeepseekTesting);
  const testPerplexityKey = () => testApiKey('perplexity', perplexityKey, setPerplexityTesting);
  const testApifyKey = () => testApiKey('apify', apifyKey, setApifyTesting);
  const testClaudeKey = () => testApiKey('claude', claudeKey, setClaudeTesting);
  const testGeminiKey = () => testApiKey('gemini', geminiKey, setGeminiTesting);
  const testQwenKey = () => testApiKey('qwen', qwenKey, setQwenTesting);
  const testXmlRiverKey = () => {
    const validation = () => {
      if (!xmlRiverUserId.trim()) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Необходимо указать ID пользователя XMLRiver"
        });
        return false;
      }
      return true;
    };
    
    testApiKey('xmlriver', xmlRiverApiKey, setXmlRiverTesting, validation);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <DialogContent className="dialog-content">
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DialogContent>
    );
  }
  
  // Main render
  return (
    <>
      {/* Delete confirmation dialog */}
      {keyToDelete && (
        <Dialog open={!!keyToDelete} onOpenChange={(open) => !open && setKeyToDelete(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Подтверждение удаления</DialogTitle>
              <DialogDescription>
                Вы уверены, что хотите удалить этот API ключ? Это действие нельзя отменить.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-between sm:justify-between mt-4">
              <Button variant="outline" onClick={cancelDeleteApiKey}>
                Отмена
              </Button>
              <Button variant="destructive" onClick={deleteApiKey} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  "Удалить"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Main settings dialog content */}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dialog-content">
        <DialogHeader>
          <DialogTitle>Настройки API ключей</DialogTitle>
          <DialogDescription>
            Управление API ключами для генерации текста и изображений
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* FAL.AI section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h3 className="text-lg font-medium">FAL.AI API</h3>
                <Badge variant={apiKeys?.some((k: ApiKey) => k.service_name === 'fal_ai' && k.api_key) ? "success" : "destructive"} className="ml-2">
                  {apiKeys?.some((k: ApiKey) => k.service_name === 'fal_ai' && k.api_key) ? "Настроен" : "Требуется настройка"}
                </Badge>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1 cursor-help">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Ключ FAL.AI используется для быстрой генерации изображений.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="falai-key">API ключ FAL.AI</Label>
              <div className="flex space-x-2">
                <Input
                  id="falai-key"
                  type="password"
                  placeholder="fal.xxxxxxxxxx"
                  value={falAiKey}
                  className="flex-1"
                  onChange={(e) => setFalAiKey(e.target.value)}
                />
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  onClick={testFalAiKey}
                  disabled={!falAiKey.trim() || falAiTesting.status === 'testing' || isPending}
                  className={cn(
                    "w-20",
                    falAiTesting.status === 'success' && "bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800",
                    falAiTesting.status === 'error' && "bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                  )}
                >
                  {falAiTesting.status === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : falAiTesting.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : falAiTesting.status === 'error' ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    "Проверить"
                  )}
                </Button>
              </div>
              {falAiTesting.status === 'error' && (
                <p className="text-xs text-red-600">{falAiTesting.message}</p>
              )}
              {falAiTesting.status === 'success' && (
                <p className="text-xs text-green-600">{falAiTesting.message}</p>
              )}
            </div>
          </div>

          {/* DeepSeek section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h3 className="text-lg font-medium">DeepSeek API</h3>
                <Badge variant={apiKeys?.some((k: ApiKey) => k.service_name === 'deepseek' && k.api_key) ? "success" : "destructive"} className="ml-2">
                  {apiKeys?.some((k: ApiKey) => k.service_name === 'deepseek' && k.api_key) ? "Настроен" : "Требуется настройка"}
                </Badge>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1 cursor-help">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Ключ DeepSeek используется для перевода и генерации текста.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deepseek-key">API ключ DeepSeek</Label>
              <div className="flex space-x-2">
                <Input
                  id="deepseek-key"
                  type="password"
                  placeholder="dsk.xxxxxxxxxx"
                  value={deepseekKey}
                  className="flex-1"
                  onChange={(e) => setDeepseekKey(e.target.value)}
                />
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  onClick={testDeepseekKey}
                  disabled={!deepseekKey.trim() || deepseekTesting.status === 'testing' || isPending}
                  className={cn(
                    "w-20",
                    deepseekTesting.status === 'success' && "bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800",
                    deepseekTesting.status === 'error' && "bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                  )}
                >
                  {deepseekTesting.status === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : deepseekTesting.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : deepseekTesting.status === 'error' ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    "Проверить"
                  )}
                </Button>
              </div>
              {deepseekTesting.status === 'error' && (
                <p className="text-xs text-red-600">{deepseekTesting.message}</p>
              )}
              {deepseekTesting.status === 'success' && (
                <p className="text-xs text-green-600">{deepseekTesting.message}</p>
              )}
            </div>
          </div>

          {/* Claude section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h3 className="text-lg font-medium">Claude API</h3>
                <Badge 
                  variant={
                    apiKeys?.some((k: ApiKey) => k.service_name === 'claude' && k.api_key) ? "outline" : "destructive"
                  } 
                  className="ml-2"
                >
                  {apiKeys?.some((k: ApiKey) => k.service_name === 'claude' && k.api_key) ? "Требует проверки" : "Требуется настройка"}
                </Badge>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1 cursor-help">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Ключ Claude Anthropic используется для анализа текста и тенденций.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="claude-key">API ключ Claude</Label>
              <div className="flex space-x-2">
                <Input
                  id="claude-key"
                  type="password"
                  placeholder="sk-ant-api03-xxxxxxxxxxxx"
                  value={claudeKey}
                  className="flex-1"
                  onChange={(e) => setClaudeKey(e.target.value)}
                />
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  onClick={testClaudeKey}
                  disabled={!claudeKey.trim() || claudeTesting.status === 'testing' || isPending}
                  className={cn(
                    "w-20",
                    claudeTesting.status === 'success' && "bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800",
                    claudeTesting.status === 'error' && "bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                  )}
                >
                  {claudeTesting.status === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : claudeTesting.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : claudeTesting.status === 'error' ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    "Проверить"
                  )}
                </Button>
              </div>
              {claudeTesting.status === 'error' && (
                <p className="text-xs text-red-600">{claudeTesting.message}</p>
              )}
              {claudeTesting.status === 'success' && (
                <p className="text-xs text-green-600">{claudeTesting.message}</p>
              )}
            </div>
          </div>

          {/* Perplexity section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h3 className="text-lg font-medium">Perplexity API</h3>
                <Badge variant={apiKeys?.some((k: ApiKey) => k.service_name === 'perplexity' && k.api_key) ? "success" : "destructive"} className="ml-2">
                  {apiKeys?.some((k: ApiKey) => k.service_name === 'perplexity' && k.api_key) ? "Настроен" : "Требуется настройка"}
                </Badge>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1 cursor-help">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Ключ Perplexity используется для рекомендаций и генерации текста.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="perplexity-key">API ключ Perplexity</Label>
              <div className="flex space-x-2">
                <Input
                  id="perplexity-key"
                  type="password"
                  placeholder="pplx-xxxxxxxxxx"
                  value={perplexityKey}
                  className="flex-1"
                  onChange={(e) => setPerplexityKey(e.target.value)}
                />
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  onClick={testPerplexityKey}
                  disabled={!perplexityKey.trim() || perplexityTesting.status === 'testing' || isPending}
                  className={cn(
                    "w-20",
                    perplexityTesting.status === 'success' && "bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800",
                    perplexityTesting.status === 'error' && "bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                  )}
                >
                  {perplexityTesting.status === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : perplexityTesting.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : perplexityTesting.status === 'error' ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    "Проверить"
                  )}
                </Button>
              </div>
              {perplexityTesting.status === 'error' && (
                <p className="text-xs text-red-600">{perplexityTesting.message}</p>
              )}
              {perplexityTesting.status === 'success' && (
                <p className="text-xs text-green-600">{perplexityTesting.message}</p>
              )}
            </div>
          </div>

          {/* Apify section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h3 className="text-lg font-medium">Apify API</h3>
                <Badge variant={apiKeys?.some((k: ApiKey) => k.service_name === 'apify' && k.api_key) ? "success" : "destructive"} className="ml-2">
                  {apiKeys?.some((k: ApiKey) => k.service_name === 'apify' && k.api_key) ? "Настроен" : "Требуется настройка"}
                </Badge>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1 cursor-help">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Ключ Apify используется для сбора данных и парсинга.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="apify-key">API ключ Apify</Label>
              <div className="flex space-x-2">
                <Input
                  id="apify-key"
                  type="password"
                  placeholder="apify_api_xxxxxxxxxx"
                  value={apifyKey}
                  className="flex-1"
                  onChange={(e) => setApifyKey(e.target.value)}
                />
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  onClick={testApifyKey}
                  disabled={!apifyKey.trim() || apifyTesting.status === 'testing' || isPending}
                  className={cn(
                    "w-20",
                    apifyTesting.status === 'success' && "bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800",
                    apifyTesting.status === 'error' && "bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                  )}
                >
                  {apifyTesting.status === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : apifyTesting.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : apifyTesting.status === 'error' ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    "Проверить"
                  )}
                </Button>
              </div>
              {apifyTesting.status === 'error' && (
                <p className="text-xs text-red-600">{apifyTesting.message}</p>
              )}
              {apifyTesting.status === 'success' && (
                <p className="text-xs text-green-600">{apifyTesting.message}</p>
              )}
            </div>
          </div>

          {/* XMLRiver section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h3 className="text-lg font-medium">XMLRiver API</h3>
                <Badge 
                  variant={
                    apiKeys?.some((k: ApiKey) => k.service_name === 'xmlriver' && k.api_key) ? "success" : "destructive"
                  } 
                  className="ml-2"
                >
                  {apiKeys?.some((k: ApiKey) => k.service_name === 'xmlriver' && k.api_key) ? "Настроен" : "Требуется настройка"}
                </Badge>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1 cursor-help">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Ключ XMLRiver используется для аналитики и сбора данных.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="xmlriver-user-id">ID пользователя XMLRiver</Label>
              <Input
                id="xmlriver-user-id"
                type="text"
                placeholder="16797"
                value={xmlRiverUserId}
                onChange={(e) => setXmlRiverUserId(e.target.value)}
              />

              <Label htmlFor="xmlriver-key">API ключ XMLRiver</Label>
              <div className="flex space-x-2">
                <Input
                  id="xmlriver-key"
                  type="password"
                  placeholder="Ключ XMLRiver"
                  value={xmlRiverApiKey}
                  className="flex-1"
                  onChange={(e) => setXmlRiverApiKey(e.target.value)}
                />
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  onClick={testXmlRiverKey}
                  disabled={!xmlRiverApiKey.trim() || !xmlRiverUserId.trim() || xmlRiverTesting.status === 'testing' || isPending}
                  className={cn(
                    "w-20",
                    xmlRiverTesting.status === 'success' && "bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800",
                    xmlRiverTesting.status === 'error' && "bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                  )}
                >
                  {xmlRiverTesting.status === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : xmlRiverTesting.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : xmlRiverTesting.status === 'error' ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    "Проверить"
                  )}
                </Button>
              </div>
              {xmlRiverTesting.status === 'error' && (
                <p className="text-xs text-red-600">{xmlRiverTesting.message}</p>
              )}
              {xmlRiverTesting.status === 'success' && (
                <p className="text-xs text-green-600">{xmlRiverTesting.message}</p>
              )}
            </div>
          </div>

          {/* Gemini section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h3 className="text-lg font-medium">Gemini API</h3>
                <Badge 
                  variant={
                    apiKeys?.some((k: ApiKey) => k.service_name === 'gemini' && k.api_key) ? "outline" : "destructive"
                  } 
                  className="ml-2"
                >
                  {apiKeys?.some((k: ApiKey) => k.service_name === 'gemini' && k.api_key) ? "Требует проверки" : "Требуется настройка"}
                </Badge>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1 cursor-help">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Ключ Google Gemini используется для генерации текста и аналитики.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gemini-key">API ключ Gemini</Label>
              <div className="flex space-x-2">
                <Input
                  id="gemini-key"
                  type="password"
                  placeholder="AIzaSyxxxxxxxxxx"
                  value={geminiKey}
                  className="flex-1"
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  onClick={testGeminiKey}
                  disabled={!geminiKey.trim() || geminiTesting.status === 'testing' || isPending}
                  className={cn(
                    "w-20",
                    geminiTesting.status === 'success' && "bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800",
                    geminiTesting.status === 'error' && "bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                  )}
                >
                  {geminiTesting.status === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : geminiTesting.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : geminiTesting.status === 'error' ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    "Проверить"
                  )}
                </Button>
              </div>
              {geminiTesting.status === 'error' && (
                <p className="text-xs text-red-600">{geminiTesting.message}</p>
              )}
              {geminiTesting.status === 'success' && (
                <p className="text-xs text-green-600">{geminiTesting.message}</p>
              )}
            </div>
          </div>

          {/* Qwen section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h3 className="text-lg font-medium">Qwen API</h3>
                <Badge 
                  variant={
                    apiKeys?.some((k: ApiKey) => k.service_name === 'qwen' && k.api_key) ? "outline" : "destructive"
                  } 
                  className="ml-2"
                >
                  {apiKeys?.some((k: ApiKey) => k.service_name === 'qwen' && k.api_key) ? "Требует проверки" : "Требуется настройка"}
                </Badge>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1 cursor-help">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Ключ Qwen используется для генерации текста и многоязычной поддержки.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qwen-key">API ключ Qwen</Label>
              <div className="flex space-x-2">
                <Input
                  id="qwen-key"
                  type="password"
                  placeholder="dashdxxxxxx"
                  value={qwenKey}
                  className="flex-1"
                  onChange={(e) => setQwenKey(e.target.value)}
                />
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  onClick={testQwenKey}
                  disabled={!qwenKey.trim() || qwenTesting.status === 'testing' || isPending}
                  className={cn(
                    "w-20",
                    qwenTesting.status === 'success' && "bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800",
                    qwenTesting.status === 'error' && "bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                  )}
                >
                  {qwenTesting.status === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : qwenTesting.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : qwenTesting.status === 'error' ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    "Проверить"
                  )}
                </Button>
              </div>
              {qwenTesting.status === 'error' && (
                <p className="text-xs text-red-600">{qwenTesting.message}</p>
              )}
              {qwenTesting.status === 'success' && (
                <p className="text-xs text-green-600">{qwenTesting.message}</p>
              )}
            </div>
          </div>

          {/* Existing API Keys section */}
          {apiKeys && apiKeys.length > 0 && (
            <div className="space-y-2 mt-6">
              <h3 className="text-lg font-medium">Сохраненные API ключи</h3>
              <div className="rounded-md border">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Сервис
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Ключ
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-popover divide-y divide-border">
                    {apiKeys.map((key: ApiKey) => (
                      <tr key={key.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {getServiceDisplayName(key.service_name)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="bg-muted px-2 py-1 rounded-md font-mono text-xs">
                            {key.service_name === 'xmlriver' ? 'Составной ключ' : 
                              key.api_key.substring(0, 4) + '...' + key.api_key.substring(key.api_key.length - 4)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => confirmDeleteApiKey(key.id)}
                            disabled={deleteMutation.isPending && keyToDelete === key.id}
                            className="text-red-600 hover:text-red-900 hover:bg-red-50"
                          >
                            {deleteMutation.isPending && keyToDelete === key.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : null}
                            Удалить
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <Button 
          type="button" 
          onClick={saveSettings} 
          className="mt-4 w-full" 
          disabled={isPending}
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
      </DialogContent>
    </>
  );
}
