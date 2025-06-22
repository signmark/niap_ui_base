import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash, Settings } from "lucide-react";
import { CampaignForm } from "@/components/CampaignForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/store";
import { useCampaignStore } from "@/lib/campaignStore";
import { queryClient } from "@/lib/queryClient";
import type { Campaign } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { DeleteCampaignConfirmDialog } from "@/components/DeleteCampaignConfirmDialog";
import { EditCampaignDialog } from "@/components/EditCampaignDialog";

export default function Campaigns() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const { userId } = useAuthStore();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Состояние для диалога подтверждения удаления кампании
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<{id: string, name: string} | null>(null);
  
  // Состояние для диалога редактирования кампании
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<{id: string; name: string} | null>(null);
  
  // Получаем функции для управления кампаниями
  const { setSelectedCampaign } = useCampaignStore();
  
  // Запрос на получение списка кампаний
  const { data: campaignsResponse, isLoading, error } = useQuery<{data: Campaign[]}>({
    queryKey: ["/api/campaigns", userId],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const storedUserId = localStorage.getItem('user_id');
      
      console.log(`Авторизован с токеном, длина: ${token ? token.length : 'токен отсутствует'}`);
      
      if (!token) {
        throw new Error("Отсутствует токен авторизации");
      }
      
      if (!storedUserId && !userId) {
        throw new Error("Отсутствует ID пользователя");
      }
      
      const response = await fetch('/api/campaigns', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-user-id': storedUserId || userId || ''
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || "Не удалось загрузить кампании");
      }
      
      const result = await response.json();
      console.log('Campaigns loaded:', result.data?.length || 0);
      return result;
    },
    enabled: !!(userId || localStorage.getItem('user_id')), // Запрос выполняется только при наличии userId
  });
  
  // Сортировка кампаний по дате создания (сначала новые)
  const sortedCampaigns = useMemo(() => {
    if (!campaignsResponse?.data) return [];
    
    return [...campaignsResponse.data].sort((a, b) => {
      // Сначала проверяем, есть ли поле createdAt у кампаний
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      
      // Сортируем по убыванию даты (новые сначала)
      return dateB - dateA;
    });
  }, [campaignsResponse?.data]);

  // Мутация для обновления названия кампании
  const { mutate: updateCampaign } = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error("Отсутствует токен авторизации");
      }
      
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: name.trim() })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Не удалось обновить название");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", userId] });
      setEditingId(null);
      toast({
        title: "Успешно",
        description: "Название кампании обновлено"
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось обновить название"
      });
    }
  });

  // Простая мутация для инициирования процесса удаления
  const { mutate: initiateDeleteCampaign } = useMutation({
    mutationFn: async (campaign: { id: string; name: string }) => {
      // Сохраняем данные выбранной кампании и открываем диалог подтверждения
      setCampaignToDelete(campaign);
      setConfirmDialogOpen(true);
      return campaign;
    }
  });

  // Вспомогательные функции для управления состоянием
  const startEditing = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setEditedName(campaign.name);
  };

  const handleSave = () => {
    if (editingId && editedName.trim()) {
      updateCampaign({ id: editingId, name: editedName });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  // Показываем индикатор загрузки, если данные еще не получены
  if (isLoading) {
    return <div>Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Кампании</h1>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить кампанию
        </Button>
      </div>

      {error ? (
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
          Ошибка загрузки: {(error as Error).message}
        </div>
      ) : sortedCampaigns.length === 0 ? (
        // Отображаем инструкцию для новых пользователей
        <Card className="p-6 border-2 border-dashed border-gray-300">
          <div className="text-center space-y-6">
            <div className="mx-auto bg-gray-50 rounded-full w-20 h-20 flex items-center justify-center">
              <Plus className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Добро пожаловать в SMM Manager!</h2>
              <p className="text-gray-600 mb-4">
                У вас пока нет ни одной кампании. Создайте первую кампанию, чтобы начать работу.
              </p>
              <div className="space-y-4 max-w-lg mx-auto text-left">
                <div className="flex items-start">
                  <div className="bg-primary/10 rounded-full p-2 mr-3 mt-1">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Создайте кампанию</h3>
                    <p className="text-sm text-gray-500">Нажмите на кнопку "Добавить кампанию" и укажите название вашего проекта или бренда.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-primary/10 rounded-full p-2 mr-3 mt-1">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Заполните информацию о бизнесе</h3>
                    <p className="text-sm text-gray-500">После создания кампании заполните анкету с информацией о вашем бизнесе для качественной генерации контента.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-primary/10 rounded-full p-2 mr-3 mt-1">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Подключите социальные сети</h3>
                    <p className="text-sm text-gray-500">В настройках кампании подключите ваши социальные сети для возможности публикации контента.</p>
                  </div>
                </div>
              </div>
            </div>
            <Button 
              size="lg"
              onClick={() => setIsOpen(true)}
              className="px-8"
            >
              <Plus className="mr-2 h-5 w-5" />
              Создать первую кампанию
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCampaigns.map((campaign) => (
            <Card key={campaign.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                {editingId === campaign.id ? (
                  <div className="flex space-x-2 w-full">
                    <Input 
                      className="flex-1"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                    />
                    <Button 
                      className="px-2 h-8"
                      variant="ghost" 
                      onClick={handleSave}
                    >
                      Сохранить
                    </Button>
                    <Button 
                      className="px-2 h-8"
                      variant="ghost" 
                      onClick={() => setEditingId(null)}
                    >
                      Отмена
                    </Button>
                  </div>
                ) : (
                  <CardTitle className="flex items-center text-lg font-medium">
                    {campaign.name}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="ml-2 h-7 w-7"
                      onClick={() => startEditing(campaign)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </CardTitle>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">{campaign.description}</p>
                <div className="mt-4 flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => {
                      // Устанавливаем кампанию как выбранную
                      setSelectedCampaign(campaign.id, campaign.name);
                      console.log(`Выбрана кампания: ${campaign.name} (${campaign.id})`);
                      // Перенаправляем на страницу кампании
                      navigate(`/campaigns/${campaign.id}`);
                    }}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Управлять
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigate(`/campaigns/${campaign.id}/stories/new`);
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Истории
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingCampaign({id: campaign.id, name: campaign.name});
                      setEditDialogOpen(true);
                    }}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Настройки
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Инициируем процесс удаления кампании через новую функцию
                      initiateDeleteCampaign({id: campaign.id, name: campaign.name});
                    }}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Диалог для добавления новой кампании */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <CampaignForm onClose={() => setIsOpen(false)} />
      </Dialog>

      {/* Диалог подтверждения удаления кампании с данными */}
      <DeleteCampaignConfirmDialog 
        open={confirmDialogOpen} 
        onOpenChange={setConfirmDialogOpen}
        campaign={campaignToDelete}
        onDelete={() => {
          // После успешного удаления обновляем список кампаний
          queryClient.invalidateQueries({ queryKey: ["/api/campaigns", userId] });
          // Сбрасываем состояние
          setCampaignToDelete(null);
        }}
      />

      {/* Диалог редактирования кампании */}
      {editingCampaign && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <EditCampaignDialog
            campaignId={editingCampaign.id}
            currentName={editingCampaign.name}
            onClose={() => {
              setEditDialogOpen(false);
              setEditingCampaign(null);
              // Обновляем список кампаний после редактирования
              queryClient.invalidateQueries({ queryKey: ["/api/campaigns", userId] });
            }}
          />
        </Dialog>
      )}
    </div>
  );
}