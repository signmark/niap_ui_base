import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export function useWebSocket() {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Подключаемся к WebSocket серверу
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket подключен');
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'scheduled_content_found':
            toast({
              title: "Найден запланированный контент",
              description: message.data.message,
              duration: 3000,
            });
            break;
            
          case 'content_published':
            toast({
              title: "Публикация завершена",
              description: message.data.message,
              duration: 5000,
            });
            break;
            
          default:
            console.log('Неизвестный тип WebSocket сообщения:', message.type);
        }
      } catch (error) {
        console.error('Ошибка обработки WebSocket сообщения:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket отключен');
    };

    ws.onerror = (error) => {
      console.error('Ошибка WebSocket:', error);
    };

    // Cleanup при размонтировании
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [toast]);

  return wsRef.current;
}