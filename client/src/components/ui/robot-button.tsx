import React from "react";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RobotButtonProps {
  sourceId: string;
  className?: string;
}

export function RobotButton({ sourceId, className }: RobotButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClick = async () => {
    if (!sourceId) {
      toast({
        title: "Ошибка",
        description: "ID источника не указан",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Отправляем POST-запрос на webhook URL с sourceId
      const response = await fetch("https://n8n.nplanner.ru/webhook/0b4d5ad4-00bf-420a-b107-5f09a9ae913c", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sourceId })
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка при отправке запроса: ${response.status}`);
      }
      
      const data = await response.json();
      
      toast({
        title: "Успешно",
        description: "Задание на обработку источника отправлено"
      });
      
      console.log("Robot task response:", data);
    } catch (error) {
      console.error("Error sending robot task:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось отправить задание",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      className={className}
      onClick={handleClick}
      disabled={isLoading}
    >
      <Bot size={16} className={`${isLoading ? 'animate-pulse' : ''}`} />
    </Button>
  );
}