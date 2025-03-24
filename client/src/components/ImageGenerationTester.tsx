import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Компонент для тестирования FAL.AI API для генерации изображений
 */
export function ImageGenerationTester() {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("Здоровый завтрак на деревянном столе, яркие свежие фрукты и овощи, утренний свет");
  const [negativePrompt, setNegativePrompt] = useState("низкое качество, размытие, искажения");
  const [result, setResult] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("sdxl");
  const { toast } = useToast();

  // Функция для сохранения ключа API
  async function saveApiKey() {
    if (!apiKey) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Введите ключ API FAL.AI",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest("/api/save-fal-ai-key", {
        method: "POST",
        data: { apiKey },
      });

      if (response.success) {
        toast({
          title: "Успешно",
          description: "Ключ API FAL.AI сохранен",
        });
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
        description: "Не удалось сохранить ключ API FAL.AI",
      });
    } finally {
      setLoading(false);
    }
  }

  // Функция для тестирования API
  async function testImageGeneration() {
    if (!prompt) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Введите промпт для генерации изображения",
      });
      return;
    }

    setLoading(true);
    setError("");
    setResult([]);

    try {
      const endpoint = activeTab === "sdxl" ? "/api/test-fal-ai/sdxl" : "/api/test-fal-ai/schnell";
      
      const response = await apiRequest(endpoint, {
        method: "POST",
        data: { 
          prompt,
          negativePrompt
        },
      });

      if (response.success && response.images) {
        setResult(Array.isArray(response.images) ? response.images : [response.images]);
      } else {
        setError(response.message || "Не удалось сгенерировать изображение");
      }
    } catch (err) {
      console.error("Ошибка при генерации изображения:", err);
      setError("Произошла ошибка при выполнении запроса к API FAL.AI");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Настройка FAL.AI API</CardTitle>
          <CardDescription>
            Введите ключ API FAL.AI для генерации изображений
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Input
              placeholder="Введите ключ API FAL.AI (формат: fal_key_xxxx или xxxx:xxxx)"
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
          <CardTitle>Тестирование генерации изображений</CardTitle>
          <CardDescription>
            Протестируйте возможности FAL.AI для генерации изображений
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="sdxl">Fast SDXL</TabsTrigger>
                <TabsTrigger value="schnell">Schnell</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div>
              <label className="text-sm font-medium" htmlFor="prompt">
                Промпт:
              </label>
              <Textarea
                id="prompt"
                placeholder="Опишите изображение, которое хотите сгенерировать"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="negative-prompt">
                Негативный промпт:
              </label>
              <Textarea
                id="negative-prompt"
                placeholder="Опишите, что не должно быть на изображении"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Ошибка</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Результат:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {result.map((imageUrl, index) => (
                    <div key={index} className="border rounded-md overflow-hidden">
                      <img 
                        src={imageUrl} 
                        alt={`Сгенерированное изображение ${index + 1}`} 
                        className="w-full h-auto object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={testImageGeneration} disabled={loading || !prompt}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Сгенерировать изображение
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}