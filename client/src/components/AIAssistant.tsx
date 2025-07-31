import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Send, Bot, User, Calendar, Image, Video, Share2, Sparkles } from 'lucide-react';
import { useCampaignStore } from '@/lib/campaignStore';
import { useToast } from '@/hooks/use-toast';

interface AIMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: AIAction[];
}

interface AIAction {
  type: 'create_post' | 'schedule_post' | 'publish_now' | 'generate_image' | 'analyze_trends';
  label: string;
  data: any;
  status: 'pending' | 'completed' | 'failed';
}

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIAssistant({ isOpen, onClose }: AIAssistantProps) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Привет! Я ваш AI помощник для управления SMM контентом. Можете говорить или писать команды типа:\n\n• "Создай пост про новый продукт на завтра в Instagram"\n• "Запланируй серию постов про SMM на неделю"\n• "Опубликуй пост про акцию прямо сейчас во все сети"\n• "Сгенерируй изображение для поста про маркетинг"\n\nЧто хотите сделать?',
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const { selectedCampaignId } = useCampaignStore();
  const { toast } = useToast();

  // Инициализация распознавания речи
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'ru-RU';

      recognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript) {
          setInputText(prev => prev + transcript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Ошибка распознавания речи",
          description: "Попробуйте еще раз или введите текст вручную",
          variant: "destructive"
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [toast]);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);

    try {
      // Отправляем запрос к AI для обработки команды
      const response = await fetch('/api/ai-assistant/process-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          command: userMessage.content,
          campaignId: selectedCampaignId
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: AIMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: data.response,
          timestamp: new Date(),
          actions: data.actions || []
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Автоматически выполняем действия если они есть
        if (data.actions && data.actions.length > 0) {
          for (const action of data.actions) {
            await executeAction(action);
          }
        }
      } else {
        throw new Error(data.error || 'Ошибка обработки команды');
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Извините, произошла ошибка при обработке вашей команды. Попробуйте переформулировать запрос.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeAction = async (action: AIAction) => {
    try {
      switch (action.type) {
        case 'create_post':
          // Создание поста
          const createResponse = await fetch('/api/campaign-content', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({
              ...action.data,
              campaignId: currentCampaignId
            })
          });
          
          if (createResponse.ok) {
            toast({
              title: "Пост создан",
              description: "Контент успешно создан и добавлен в кампанию"
            });
          }
          break;

        case 'schedule_post':
          // Планирование публикации
          const scheduleResponse = await fetch('/api/schedule-publication', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({
              ...action.data,
              campaignId: currentCampaignId
            })
          });
          
          if (scheduleResponse.ok) {
            toast({
              title: "Публикация запланирована",
              description: `Пост будет опубликован ${new Date(action.data.scheduledDate).toLocaleString()}`
            });
          }
          break;

        case 'publish_now':
          // Немедленная публикация
          const publishResponse = await fetch('/api/publish-content', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({
              ...action.data,
              campaignId: currentCampaignId
            })
          });
          
          if (publishResponse.ok) {
            toast({
              title: "Опубликовано",
              description: "Контент успешно опубликован в выбранных социальных сетях"
            });
          }
          break;

        case 'generate_image':
          // Генерация изображения
          const imageResponse = await fetch('/api/generate-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify(action.data)
          });
          
          if (imageResponse.ok) {
            toast({
              title: "Изображение сгенерировано",
              description: "AI создал изображение для вашего поста"
            });
          }
          break;
      }
    } catch (error) {
      console.error('Action execution error:', error);
      toast({
        title: "Ошибка выполнения",
        description: `Не удалось выполнить действие: ${action.label}`,
        variant: "destructive"
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl h-[600px] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            AI Помощник SMM
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onClose}>
            ✕
          </Button>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col gap-4">
          {/* История сообщений */}
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      message.type === 'user' ? 'bg-blue-500' : 'bg-green-500'
                    }`}>
                      {message.type === 'user' ? (
                        <User className="h-4 w-4 text-white" />
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>
                    
                    <div className={`rounded-lg p-3 ${
                      message.type === 'user' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      
                      {/* Действия AI */}
                      {message.actions && message.actions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.actions.map((action, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {action.type === 'create_post' && <Image className="h-3 w-3 mr-1" />}
                                {action.type === 'schedule_post' && <Calendar className="h-3 w-3 mr-1" />}
                                {action.type === 'publish_now' && <Share2 className="h-3 w-3 mr-1" />}
                                {action.type === 'generate_image' && <Sparkles className="h-3 w-3 mr-1" />}
                                {action.label}
                              </Badge>
                              <Badge 
                                variant={
                                  action.status === 'completed' ? 'default' : 
                                  action.status === 'failed' ? 'destructive' : 'secondary'
                                }
                                className="text-xs"
                              >
                                {action.status === 'completed' ? '✓' : 
                                 action.status === 'failed' ? '✗' : '⏳'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="text-xs opacity-70 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                      <span className="text-sm text-gray-600">Обрабатываю команду...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Ввод сообщения */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Напишите команду или нажмите на микрофон для голосового ввода..."
                className="resize-none"
                rows={2}
                disabled={isProcessing}
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <Button
                onClick={isListening ? stopListening : startListening}
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                disabled={isProcessing}
                title={isListening ? "Остановить запись" : "Начать голосовой ввод"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              
              <Button 
                onClick={sendMessage}
                disabled={!inputText.trim() || isProcessing}
                size="icon"
                title="Отправить сообщение"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Примеры команд */}
          <div className="text-xs text-gray-500">
            <strong>Примеры команд:</strong> "Создай пост про новый продукт", "Запланируй на завтра в 9 утра", "Опубликуй сейчас в Instagram и VK"
          </div>
        </CardContent>
      </Card>
    </div>
  );
}