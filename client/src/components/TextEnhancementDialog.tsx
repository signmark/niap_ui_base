import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import RichTextEditor from './RichTextEditor';

interface TextEnhancementDialogProps {
  open: boolean;
  onClose: () => void;
  originalText: string;
  onApply: (enhancedText: string) => void;
}

export function TextEnhancementDialog({ open, onClose, originalText, onApply }: TextEnhancementDialogProps) {
  const { toast } = useToast();
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedText, setEnhancedText] = useState<string>("");
  const [instructionsText, setInstructionsText] = useState("");

  // If dialog is opened, initialize with the original text
  useState(() => {
    if (open) {
      setEnhancedText(originalText);
    }
  });

  const enhanceText = async () => {
    if (!originalText) {
      toast({
        title: "Ошибка",
        description: "Нет текста для улучшения",
        variant: "destructive"
      });
      return;
    }

    if (!instructionsText) {
      toast({
        title: "Укажите инструкции",
        description: "Пожалуйста, введите инструкции для улучшения текста",
        variant: "destructive"
      });
      return;
    }

    setIsEnhancing(true);

    try {
      // Получаем токен авторизации
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error('Требуется авторизация');
      }

      const response = await fetch('/api/claude/improve-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          text: originalText,
          prompt: instructionsText
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Не удалось улучшить текст');
      }

      const data = await response.json();
      setEnhancedText(data.text || "");

      toast({
        title: "Текст улучшен",
        description: "Текст был успешно улучшен с помощью Claude AI",
      });
    } catch (error) {
      console.error('Ошибка при улучшении текста:', error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось улучшить текст",
        variant: "destructive"
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleApply = () => {
    onApply(enhancedText);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Улучшение текста с помощью Claude AI</DialogTitle>
          <DialogDescription>
            Введите инструкции для улучшения текста. Например: "Сделать текст более кратким",
            "Исправить грамматические ошибки", "Сделать тон более дружелюбным" и т.д.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="instructions">Инструкции для улучшения</Label>
            <Textarea
              id="instructions"
              placeholder="Например: Сделать текст более кратким и улучшить форматирование"
              rows={3}
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Исходный текст</Label>
            <div className="border rounded-md p-2 bg-muted/10 min-h-[100px] whitespace-pre-wrap">
              {originalText || "Нет текста для улучшения"}
            </div>
          </div>

          <Button
            onClick={enhanceText}
            disabled={isEnhancing || !instructionsText}
            className="w-full"
          >
            {isEnhancing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Улучшаем текст...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Улучшить текст с помощью Claude AI
              </>
            )}
          </Button>

          {enhancedText && (
            <div className="grid gap-2">
              <Label>Улучшенный текст</Label>
              <RichTextEditor
                content={enhancedText}
                onChange={setEnhancedText}
                minHeight="200px"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            onClick={handleApply} 
            disabled={!enhancedText || isEnhancing}
          >
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}