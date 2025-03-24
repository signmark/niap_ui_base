import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";

/**
 * Компонент для тестирования DeepSeek API
 */
export function DeepSeekTester() {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("Напиши небольшой текст на тему здорового питания для публикации в социальных сетях");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedKey, setSavedKey] = useState(false);
  const { toast } = useToast();

  // Функция для сохранения ключа API
  async function saveApiKey() {
    if (!apiKey) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Введите ключ API DeepSeek",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest("/api/save-deepseek-key", {
        method: "POST",
        data: { apiKey },
      });

      if (response.success) {
        toast({
          title: "Успешно",
          description: "Ключ API DeepSeek сохранен",
        });
        setSavedKey(true);
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: response.message || "Не удалось сохранить ключ API",
        });
      }
    } catch (err) {
      console.error("Ошибка при сохранении ключа API:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить ключ API DeepSeek",
      });
    } finally {
      setLoading(false);
    }
  }

  // Функция для тестирования API
  async function testDeepSeekApi() {
    if (!prompt) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Введите запрос для тестирования",
      });
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await apiRequest("/api/test-deepseek", {
        method: "GET",
        params: { prompt },
      });

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.message || "Не удалось получить ответ от API");
      }
    } catch (err) {
      console.error("Ошибка при тестировании API:", err);
      setError("Произошла ошибка при выполнении запроса к API DeepSeek");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Настройка DeepSeek API</CardTitle>
          <CardDescription>
            Введите ключ API DeepSeek для использования в приложении
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Input
              placeholder="Введите ключ API DeepSeek"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
            />
            <p className="text-xs text-muted-foreground">
              Ключ API будет безопасно сохранен в базе данных и доступен только администратору проекта.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={saveApiKey} disabled={loading || !apiKey}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Сохранить ключ API
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Тестирование DeepSeek API</CardTitle>
          <CardDescription>
            Протестируйте возможности DeepSeek API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium" htmlFor="prompt">
                Запрос:
              </label>
              <Textarea
                id="prompt"
                placeholder="Введите запрос для DeepSeek API"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Ошибка</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Результат:</div>
                <div className="rounded-md border p-4 whitespace-pre-wrap text-sm">{result}</div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={testDeepSeekApi} disabled={loading || !prompt}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Протестировать API
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}