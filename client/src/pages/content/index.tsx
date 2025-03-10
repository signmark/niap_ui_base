import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Plus, Pencil, Calendar, Send, Trash2, FileText, 
  ImageIcon, Video, FilePlus2, CheckCircle2, Clock 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import type { Campaign, CampaignContent } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

// Создаем формат даты
const formatDate = (date: string | Date) => {
  if (!date) return "";
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ru });
};

export default function ContentPage() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [currentContent, setCurrentContent] = useState<CampaignContent | null>(null);
  const [newContent, setNewContent] = useState({
    content: "",
    contentType: "text",
    imageUrl: "",
    videoUrl: "",
    keywords: [] as string[]
  });
  const [scheduleDate, setScheduleDate] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Запрос списка кампаний
  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      const data = await response.json();
      return data.data || [];
    }
  });

  // Запрос списка контента для выбранной кампании
  const { data: campaignContent = [], isLoading: isLoadingContent } = useQuery<CampaignContent[]>({
    queryKey: ["/api/campaign-content", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];

      const response = await fetch(`/api/campaign-content?campaignId=${selectedCampaignId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaign content');
      }
      
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!selectedCampaignId
  });

  // Мутация для создания контента
  const createContentMutation = useMutation({
    mutationFn: async (contentData: any) => {
      return await apiRequest('/api/campaign-content', { 
        method: 'POST',
        data: contentData 
      });
    },
    onSuccess: () => {
      toast({
        description: "Контент успешно создан",
      });
      setIsCreateDialogOpen(false);
      setNewContent({
        content: "",
        contentType: "text",
        imageUrl: "",
        videoUrl: "",
        keywords: []
      });
      // Обновляем данные
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка при создании контента",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для обновления контента
  const updateContentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      return await apiRequest(`/api/campaign-content/${id}`, { 
        method: 'PATCH',
        data
      });
    },
    onSuccess: () => {
      toast({
        description: "Контент успешно обновлен",
      });
      setIsEditDialogOpen(false);
      setCurrentContent(null);
      // Обновляем данные
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка при обновлении контента",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для удаления контента
  const deleteContentMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/campaign-content/${id}`, { 
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        description: "Контент успешно удален",
      });
      // Обновляем данные
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка при удалении контента",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для планирования публикации
  const scheduleContentMutation = useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: string, scheduledAt: string }) => {
      return await apiRequest(`/api/campaign-content/${id}`, { 
        method: 'PATCH',
        data: {
          scheduledAt,
          status: 'scheduled'
        }
      });
    },
    onSuccess: () => {
      toast({
        description: "Публикация запланирована",
      });
      setIsScheduleDialogOpen(false);
      setCurrentContent(null);
      // Обновляем данные
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка при планировании публикации",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Обработчик создания контента
  const handleCreateContent = () => {
    if (!selectedCampaignId) {
      toast({
        description: "Выберите кампанию для создания контента",
        variant: "destructive"
      });
      return;
    }

    if (!newContent.content) {
      toast({
        description: "Введите текст контента",
        variant: "destructive"
      });
      return;
    }

    // Проверяем корректность URL для изображения или видео
    if (
      (newContent.contentType === "text-image" && !newContent.imageUrl) ||
      (newContent.contentType === "video" && !newContent.videoUrl) ||
      (newContent.contentType === "video-text" && !newContent.videoUrl)
    ) {
      toast({
        description: "Добавьте URL изображения или видео",
        variant: "destructive"
      });
      return;
    }

    createContentMutation.mutate({
      campaignId: selectedCampaignId,
      ...newContent,
      status: 'draft'
    });
  };

  // Обработчик обновления контента
  const handleUpdateContent = () => {
    if (!currentContent) return;

    updateContentMutation.mutate({
      id: currentContent.id,
      data: {
        content: currentContent.content,
        contentType: currentContent.contentType,
        imageUrl: currentContent.imageUrl,
        videoUrl: currentContent.videoUrl,
        keywords: currentContent.keywords
      }
    });
  };

  // Обработчик планирования публикации
  const handleScheduleContent = () => {
    if (!currentContent || !scheduleDate) return;

    scheduleContentMutation.mutate({
      id: currentContent.id,
      scheduledAt: new Date(scheduleDate).toISOString()
    });
  };

  // Фильтруем контент в зависимости от выбранной вкладки
  const filteredContent = campaignContent.filter(content => {
    if (activeTab === "all") return true;
    if (activeTab === "draft") return content.status === "draft";
    if (activeTab === "scheduled") return content.status === "scheduled";
    if (activeTab === "published") return content.status === "published";
    return true;
  });

  // Получаем иконку для типа контента
  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case "text":
        return <FileText className="h-4 w-4" />;
      case "text-image":
        return <ImageIcon className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      case "video-text":
        return <FilePlus2 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Получаем иконку для статуса
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft":
        return <Pencil className="h-4 w-4" />;
      case "scheduled":
        return <Clock className="h-4 w-4" />;
      case "published":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Pencil className="h-4 w-4" />;
    }
  };

  // Получаем цвет бейджа для статуса
  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "draft":
        return "outline";
      case "scheduled":
        return "secondary";
      case "published":
        return "default";
      default:
        return "outline";
    }
  };

  // Получаем текст статуса
  const getStatusText = (status: string) => {
    switch (status) {
      case "draft":
        return "Черновик";
      case "scheduled":
        return "Запланировано";
      case "published":
        return "Опубликовано";
      default:
        return "Черновик";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Управление контентом</h1>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)} 
          disabled={!selectedCampaignId || selectedCampaignId === "loading" || selectedCampaignId === "empty"}
        >
          <Plus className="mr-2 h-4 w-4" />
          Создать контент
        </Button>
      </div>

      {/* Выбор кампании */}
      <Card>
        <CardHeader>
          <CardTitle>Выберите кампанию</CardTitle>
          <CardDescription>Выберите кампанию для управления контентом</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedCampaignId}
            onValueChange={setSelectedCampaignId}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Выберите кампанию" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingCampaigns ? (
                <SelectItem value="loading">Загрузка...</SelectItem>
              ) : !campaigns || campaigns.length === 0 ? (
                <SelectItem value="empty">Нет доступных кампаний</SelectItem>
              ) : (
                campaigns.map((campaign) => (
                  <SelectItem
                    key={campaign.id}
                    value={campaign.id.toString()}
                  >
                    {campaign.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Контент кампании */}
      {selectedCampaignId && (
        <Card>
          <CardHeader>
            <CardTitle>Контент кампании</CardTitle>
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">Все</TabsTrigger>
                <TabsTrigger value="draft">Черновики</TabsTrigger>
                <TabsTrigger value="scheduled">Запланированные</TabsTrigger>
                <TabsTrigger value="published">Опубликованные</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoadingContent ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !filteredContent.length ? (
              <p className="text-center text-muted-foreground py-8">
                Нет контента для этой кампании
              </p>
            ) : (
              <div className="space-y-4">
                {filteredContent.map((content) => (
                  <Card key={content.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          {getContentTypeIcon(content.contentType)}
                          <Badge variant={getStatusBadgeVariant(content.status)}>
                            {getStatusIcon(content.status)}
                            <span className="ml-1">{getStatusText(content.status)}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setCurrentContent(content);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {content.status === "draft" && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setCurrentContent(content);
                                setIsScheduleDialogOpen(true);
                              }}
                            >
                              <Calendar className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              if (window.confirm("Вы уверены, что хотите удалить этот контент?")) {
                                deleteContentMutation.mutate(content.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mb-2">
                        <p className="whitespace-pre-wrap">{content.content}</p>
                      </div>
                      {content.contentType === "text-image" && content.imageUrl && (
                        <div className="mt-4">
                          <img 
                            src={content.imageUrl} 
                            alt="Content Image" 
                            className="rounded-md max-h-48 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://placehold.co/400x225?text=Image+Error";
                            }}
                          />
                        </div>
                      )}
                      {(content.contentType === "video" || content.contentType === "video-text") && content.videoUrl && (
                        <div className="mt-4">
                          <video 
                            src={content.videoUrl} 
                            controls 
                            className="rounded-md max-h-48 w-full"
                          />
                        </div>
                      )}
                      {content.keywords && content.keywords.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {content.keywords.map((keyword, index) => (
                            <Badge key={index} variant="secondary">{keyword}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 text-sm text-muted-foreground">
                        <p>Создано: {formatDate(content.createdAt)}</p>
                        {content.scheduledAt && (
                          <p>Запланировано: {formatDate(content.scheduledAt)}</p>
                        )}
                        {content.publishedAt && (
                          <p>Опубликовано: {formatDate(content.publishedAt)}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Диалог создания контента */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Создание нового контента</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contentType">Тип контента</Label>
              <Select
                value={newContent.contentType}
                onValueChange={(value) => setNewContent({...newContent, contentType: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип контента" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Только текст</SelectItem>
                  <SelectItem value="text-image">Текст с изображением</SelectItem>
                  <SelectItem value="video">Видео</SelectItem>
                  <SelectItem value="video-text">Видео с текстом</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Текст контента</Label>
              <Textarea
                id="content"
                placeholder="Введите текст контента"
                rows={5}
                value={newContent.content}
                onChange={(e) => setNewContent({...newContent, content: e.target.value})}
              />
            </div>
            {(newContent.contentType === "text-image") && (
              <div className="space-y-2">
                <Label htmlFor="imageUrl">URL изображения</Label>
                <Input
                  id="imageUrl"
                  placeholder="Введите URL изображения"
                  value={newContent.imageUrl}
                  onChange={(e) => setNewContent({...newContent, imageUrl: e.target.value})}
                />
              </div>
            )}
            {(newContent.contentType === "video" || newContent.contentType === "video-text") && (
              <div className="space-y-2">
                <Label htmlFor="videoUrl">URL видео</Label>
                <Input
                  id="videoUrl"
                  placeholder="Введите URL видео"
                  value={newContent.videoUrl}
                  onChange={(e) => setNewContent({...newContent, videoUrl: e.target.value})}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="keywords">Ключевые слова (через запятую)</Label>
              <Input
                id="keywords"
                placeholder="Например: здоровье, диета, питание"
                value={newContent.keywords.join(", ")}
                onChange={(e) => setNewContent({
                  ...newContent, 
                  keywords: e.target.value.split(",").map(k => k.trim()).filter(k => k)
                })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              type="button" 
              onClick={handleCreateContent}
              disabled={createContentMutation.isPending}
            >
              {createContentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования контента */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Редактирование контента</DialogTitle>
          </DialogHeader>
          {currentContent && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="content">Текст контента</Label>
                <Textarea
                  id="content"
                  placeholder="Введите текст контента"
                  rows={5}
                  value={currentContent.content}
                  onChange={(e) => setCurrentContent({...currentContent, content: e.target.value})}
                />
              </div>
              {(currentContent.contentType === "text-image") && (
                <div className="space-y-2">
                  <Label htmlFor="imageUrl">URL изображения</Label>
                  <Input
                    id="imageUrl"
                    placeholder="Введите URL изображения"
                    value={currentContent.imageUrl || ""}
                    onChange={(e) => setCurrentContent({...currentContent, imageUrl: e.target.value})}
                  />
                </div>
              )}
              {(currentContent.contentType === "video" || currentContent.contentType === "video-text") && (
                <div className="space-y-2">
                  <Label htmlFor="videoUrl">URL видео</Label>
                  <Input
                    id="videoUrl"
                    placeholder="Введите URL видео"
                    value={currentContent.videoUrl || ""}
                    onChange={(e) => setCurrentContent({...currentContent, videoUrl: e.target.value})}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="keywords">Ключевые слова (через запятую)</Label>
                <Input
                  id="keywords"
                  placeholder="Например: здоровье, диета, питание"
                  value={currentContent.keywords ? currentContent.keywords.join(", ") : ""}
                  onChange={(e) => setCurrentContent({
                    ...currentContent, 
                    keywords: e.target.value.split(",").map(k => k.trim()).filter(k => k)
                  })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              type="button" 
              onClick={handleUpdateContent}
              disabled={updateContentMutation.isPending}
            >
              {updateContentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог планирования публикации */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Планирование публикации</DialogTitle>
          </DialogHeader>
          {currentContent && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="scheduleDate">Дата и время публикации</Label>
                <Input
                  id="scheduleDate"
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsScheduleDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              type="button" 
              onClick={handleScheduleContent}
              disabled={scheduleContentMutation.isPending || !scheduleDate}
            >
              {scheduleContentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Запланировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}