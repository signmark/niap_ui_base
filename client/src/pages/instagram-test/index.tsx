import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { apiRequest } from "@/lib/queryClient";

/**
 * Компонент для тестирования публикации видео в Instagram
 */
export default function InstagramTestPage() {
  const { toast } = useToast();
  const [videoUrl, setVideoUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("Тестовая публикация видео в Instagram #instagram #test");
  const [token, setToken] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedVideoUrl, setOptimizedVideoUrl] = useState("");
  const [result, setResult] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  /**
   * Обработчик публикации видео в Instagram
   */
  const handlePostVideo = async () => {
    if (!videoUrl) {
      toast({
        title: "Ошибка",
        description: "Введите URL видео для публикации",
        variant: "destructive"
      });
      return;
    }

    if (!token || !businessAccountId) {
      toast({
        title: "Ошибка",
        description: "Необходимо указать токен и ID бизнес-аккаунта Instagram",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const response = await apiRequest('/api/test/instagram-video', {
        method: "POST",
        data: {
          videoUrl,
          imageUrl: imageUrl || null,
          caption,
          token,
          businessAccountId
        }
      });

      setResult(response);

      if (response.success) {
        toast({
          title: "Успех!",
          description: "Видео успешно опубликовано в Instagram",
        });
      } else {
        toast({
          title: "Ошибка публикации",
          description: response.error || "Не удалось опубликовать видео",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Ошибка при публикации:", error);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при отправке запроса",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Обработчик оптимизации видео
   */
  const handleOptimizeVideo = async () => {
    if (!videoUrl) {
      toast({
        title: "Ошибка",
        description: "Введите URL видео для оптимизации",
        variant: "destructive"
      });
      return;
    }

    try {
      setOptimizing(true);
      const response = await apiRequest('/api/test/optimize-video', {
        method: "POST",
        data: {
          videoUrl,
          platform: "instagram"
        }
      });

      if (response.success) {
        setOptimizedVideoUrl(response.processedUrl);
        toast({
          title: "Успех!",
          description: "Видео успешно оптимизировано",
        });
      } else {
        toast({
          title: "Ошибка оптимизации",
          description: response.error || "Не удалось оптимизировать видео",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Ошибка при оптимизации:", error);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при отправке запроса",
        variant: "destructive"
      });
    } finally {
      setOptimizing(false);
    }
  };

  /**
   * Обработчик воспроизведения видео
   */
  const playVideo = (url: string) => {
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
      videoRef.current.play().catch(error => {
        console.error("Ошибка воспроизведения видео:", error);
        toast({
          title: "Ошибка воспроизведения",
          description: "Не удалось воспроизвести видео",
          variant: "destructive"
        });
      });
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Тестирование публикации видео в Instagram</h1>
      
      <Tabs defaultValue="optimize" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="optimize">Оптимизация видео</TabsTrigger>
          <TabsTrigger value="publish">Публикация видео</TabsTrigger>
        </TabsList>
        
        {/* Таб для оптимизации видео */}
        <TabsContent value="optimize" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Оптимизация видео для Instagram</CardTitle>
              <CardDescription>
                Приведение видео к параметрам, рекомендованным для Instagram
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video-url-optimize">URL видео</Label>
                <Input 
                  id="video-url-optimize" 
                  placeholder="https://example.com/video.mp4" 
                  value={videoUrl} 
                  onChange={e => setVideoUrl(e.target.value)}
                />
                <p className="text-sm text-gray-500">
                  URL видео для оптимизации (MP4, MOV, AVI)
                </p>
              </div>

              {optimizedVideoUrl && (
                <div className="mt-4 space-y-2">
                  <Label>Оптимизированное видео</Label>
                  <div className="rounded-md overflow-hidden border">
                    <div className="aspect-square bg-gray-100 flex items-center justify-center relative">
                      <video 
                        ref={videoRef} 
                        className="max-h-full max-w-full" 
                        controls
                        playsInline
                      >
                        <source src={optimizedVideoUrl} type="video/mp4" />
                        Ваш браузер не поддерживает воспроизведение видео.
                      </video>
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Input readOnly value={optimizedVideoUrl} />
                    <Button 
                      onClick={() => playVideo(optimizedVideoUrl)}
                      variant="outline"
                      className="w-full"
                    >
                      Воспроизвести
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleOptimizeVideo} disabled={optimizing} className="w-full">
                {optimizing ? <Spinner className="mr-2" /> : null}
                {optimizing ? "Оптимизация..." : "Оптимизировать видео"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Таб для публикации видео */}
        <TabsContent value="publish" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Публикация видео в Instagram</CardTitle>
              <CardDescription>
                Тестирование публикации видео и обработки API-запросов
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Instagram Access Token</Label>
                <Input 
                  id="token" 
                  placeholder="IGQVJYeE..." 
                  value={token} 
                  onChange={e => setToken(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-id">Business Account ID</Label>
                <Input 
                  id="business-id" 
                  placeholder="17841..." 
                  value={businessAccountId} 
                  onChange={e => setBusinessAccountId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-url">URL видео</Label>
                <Input 
                  id="video-url" 
                  placeholder="https://example.com/video.mp4" 
                  value={videoUrl} 
                  onChange={e => setVideoUrl(e.target.value)}
                />
                <p className="text-sm text-gray-500">
                  Используйте оптимизированное видео из предыдущего шага для лучших результатов
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-url">URL обложки (опционально)</Label>
                <Input 
                  id="image-url" 
                  placeholder="https://example.com/image.jpg" 
                  value={imageUrl} 
                  onChange={e => setImageUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="caption">Подпись к видео</Label>
                <Textarea 
                  id="caption" 
                  placeholder="Введите описание для видео..." 
                  value={caption} 
                  onChange={e => setCaption(e.target.value)}
                  rows={3}
                />
              </div>

              {result && (
                <div className="mt-4 p-4 rounded-md border">
                  <h3 className="font-semibold text-lg mb-2">Результат публикации:</h3>
                  <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handlePostVideo} disabled={loading} className="w-full">
                {loading ? <Spinner className="mr-2" /> : null}
                {loading ? "Публикация..." : "Опубликовать в Instagram"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}