import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Bot, Settings, Play, Square, Activity, Clock, Image, FileText, Zap } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';

interface BotConfig {
  enabled: boolean;
  frequency: number;
  contentTypes: string[];
  platforms: string[];
  moderationLevel: 'strict' | 'normal' | 'relaxed';
  maxPostsPerCycle: number;
}

interface BotStatus {
  isRunning: boolean;
  config: BotConfig | null;
  stats: {
    totalBotPosts: number;
    lastBotActivity: string | null;
    enabled: boolean;
  };
}

export default function BotSettings() {
  const { campaignId } = useParams();
  const { toast } = useToast();
  
  const [config, setConfig] = useState<BotConfig>({
    enabled: true,
    frequency: 240, // 4 часа
    contentTypes: ['text', 'image'],
    platforms: ['vk', 'telegram'],
    moderationLevel: 'normal',
    maxPostsPerCycle: 3
  });

  // Получение статуса бота
  const { data: botStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/autonomous-bot/status', campaignId],
    queryFn: () => apiRequest(`/api/autonomous-bot/status/${campaignId}`) as Promise<BotStatus>,
    refetchInterval: 10000 // обновляем каждые 10 секунд
  });

  // Получение логов бота
  const { data: botLogs } = useQuery({
    queryKey: ['/api/autonomous-bot/logs', campaignId],
    queryFn: () => apiRequest(`/api/autonomous-bot/logs/${campaignId}?limit=10`),
    refetchInterval: 30000 // обновляем каждые 30 секунд
  });

  // Запуск бота
  const startBotMutation = useMutation({
    mutationFn: () => apiRequest(`/api/autonomous-bot/start/${campaignId}`, {
      method: 'POST',
      body: JSON.stringify(config)
    }),
    onSuccess: () => {
      toast({
        title: 'Автономный бот запущен',
        description: 'Бот начнет создавать контент автоматически'
      });
      refetchStatus();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка запуска бота',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Остановка бота
  const stopBotMutation = useMutation({
    mutationFn: () => apiRequest(`/api/autonomous-bot/stop/${campaignId}`, {
      method: 'POST'
    }),
    onSuccess: () => {
      toast({
        title: 'Автономный бот остановлен',
        description: 'Автоматическое создание контента приостановлено'
      });
      refetchStatus();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка остановки бота',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Ручной запуск цикла
  const manualCycleMutation = useMutation({
    mutationFn: () => apiRequest(`/api/autonomous-bot/manual-cycle/${campaignId}`, {
      method: 'POST'
    }),
    onSuccess: () => {
      toast({
        title: 'Ручной цикл запущен',
        description: 'Бот создаст контент на основе текущих трендов'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка запуска цикла',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleConfigChange = (key: keyof BotConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handlePlatformToggle = (platform: string) => {
    setConfig(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }));
  };

  const handleContentTypeToggle = (type: string) => {
    setConfig(prev => ({
      ...prev,
      contentTypes: prev.contentTypes.includes(type)
        ? prev.contentTypes.filter(t => t !== type)
        : [...prev.contentTypes, type]
    }));
  };

  // Загружаем конфигурацию из статуса бота
  useEffect(() => {
    if (botStatus?.config) {
      setConfig(botStatus.config);
    }
  }, [botStatus?.config]);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Заголовок с иконкой робота */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <Bot size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Автономный SMM Бот</h1>
          <p className="text-muted-foreground">
            Умное создание и публикация контента на основе трендов
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Статус и управление */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity size={20} />
              Статус Бота
            </CardTitle>
            <CardDescription>
              Текущее состояние автономного бота
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Статус:</span>
              <Badge variant={botStatus?.isRunning ? 'default' : 'secondary'}>
                {botStatus?.isRunning ? 'Активен' : 'Остановлен'}
              </Badge>
            </div>
            
            {botStatus?.stats && (
              <>
                <div className="flex items-center justify-between">
                  <span>Создано постов:</span>
                  <Badge variant="outline">
                    {botStatus.stats.totalBotPosts}
                  </Badge>
                </div>
                
                {botStatus.stats.lastBotActivity && (
                  <div className="flex items-center justify-between">
                    <span>Последняя активность:</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(botStatus.stats.lastBotActivity).toLocaleString()}
                    </span>
                  </div>
                )}
              </>
            )}

            <Separator />

            <div className="flex gap-2">
              {botStatus?.isRunning ? (
                <Button 
                  onClick={() => stopBotMutation.mutate()}
                  disabled={stopBotMutation.isPending}
                  variant="destructive"
                  className="flex-1"
                >
                  <Square size={16} className="mr-2" />
                  Остановить Бота
                </Button>
              ) : (
                <Button 
                  onClick={() => startBotMutation.mutate()}
                  disabled={startBotMutation.isPending}
                  className="flex-1"
                >
                  <Play size={16} className="mr-2" />
                  Запустить Бота
                </Button>
              )}
              
              <Button
                onClick={() => manualCycleMutation.mutate()}
                disabled={manualCycleMutation.isPending}
                variant="outline"
              >
                <Zap size={16} className="mr-2" />
                Тест
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Настройки бота */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings size={20} />
              Конфигурация
            </CardTitle>
            <CardDescription>
              Настройки работы автономного бота
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Частота работы (минуты)</Label>
              <Input
                type="number"
                min="60"
                max="1440"
                value={config.frequency}
                onChange={(e) => handleConfigChange('frequency', parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">
                {config.frequency < 120 ? 'Каждые 1-2 часа' : 
                 config.frequency < 360 ? 'Каждые 2-6 часов' : 
                 'Реже чем раз в 6 часов'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Максимум постов за цикл</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={config.maxPostsPerCycle}
                onChange={(e) => handleConfigChange('maxPostsPerCycle', parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Уровень модерации</Label>
              <Select 
                value={config.moderationLevel} 
                onValueChange={(value) => handleConfigChange('moderationLevel', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relaxed">Мягкий</SelectItem>
                  <SelectItem value="normal">Обычный</SelectItem>
                  <SelectItem value="strict">Строгий</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Типы контента */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText size={20} />
              Типы Контента
            </CardTitle>
            <CardDescription>
              Какой контент будет создавать бот
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} />
                  <span>Текстовые посты</span>
                </div>
                <Switch
                  checked={config.contentTypes.includes('text')}
                  onCheckedChange={() => handleContentTypeToggle('text')}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image size={16} />
                  <span>Посты с изображениями</span>
                </div>
                <Switch
                  checked={config.contentTypes.includes('image')}
                  onCheckedChange={() => handleContentTypeToggle('image')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Платформы */}
        <Card>
          <CardHeader>
            <CardTitle>Целевые Платформы</CardTitle>
            <CardDescription>
              На какие соцсети будет публиковать бот
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'vk', name: 'ВКонтакте' },
                { key: 'telegram', name: 'Telegram' },
                { key: 'facebook', name: 'Facebook' },
                { key: 'instagram', name: 'Instagram' }
              ].map(platform => (
                <div 
                  key={platform.key}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    config.platforms.includes(platform.key) 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handlePlatformToggle(platform.key)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{platform.name}</span>
                    <div className={`w-4 h-4 rounded-full ${
                      config.platforms.includes(platform.key) ? 'bg-blue-500' : 'bg-gray-300'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Логи активности */}
      {botLogs?.logs && botLogs.logs.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={20} />
              Последняя Активность
            </CardTitle>
            <CardDescription>
              История работы автономного бота
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {botLogs.logs.slice(0, 5).map((log: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{log.details.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Платформы: {log.details.platforms?.join(', ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-1">
                      {log.details.status}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}