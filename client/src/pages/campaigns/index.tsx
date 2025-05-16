import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Plus, Search, Pencil, AlertTriangle, Trash } from "lucide-react";
import { CampaignForm } from "@/components/CampaignForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/store";
import { useCampaignStore } from "@/lib/campaignStore";
import { directusApi } from "@/lib/directus";
import { queryClient } from "@/lib/queryClient";
import type { Campaign } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Интерфейс для информации о связанных данных кампании
interface RelatedDataInfo {
  hasContent: boolean;
  hasKeywords: boolean;
  hasTrends: boolean;
  totalItems: {
    content: number;
    keywords: number;
    trends: number;
  };
}

// Интерфейс для ответа API при попытке удаления кампании с данными
interface DeleteErrorResponse {
  success: false;
  error: string;
  message: string;
  relatedData: RelatedDataInfo;
  requireConfirmation: boolean;
}

export default function Campaigns() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const { userId } = useAuthStore();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Состояния для диалога подтверждения удаления кампании
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<{id: string, name: string} | null>(null);
  const [deleteWithData, setDeleteWithData] = useState(false);
  const [relatedData, setRelatedData] = useState<RelatedDataInfo | null>(null);
  
  // Получаем функции для управления кампаниями
  const { setSelectedCampaign, markCampaignAsDeleted } = useCampaignStore();
  const { getAuthToken } = useAuthStore();
  
  const { data: campaignsResponse, isLoading, error } = useQuery<{data: Campaign[]}>({
    queryKey: ["/api/campaigns", userId],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const storedUserId = localStorage.getItem('user_id');
      
      console.log('Fetching campaigns with:',
        'token:', token ? `${token.substring(0, 10)}...` : 'none',
        'userId:', storedUserId || userId
      );
      
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

  const { mutate: updateCampaign } = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const token = getAuthToken();
      if (!token) {
        throw new Error("Отсутствует токен авторизации");
      }
      
      // Используем REST API вместо прямого обращения к Directus
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
      toast({
        title: "Успешно",
        description: "Название кампании обновлено"
      });
      setEditingId(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось обновить название"
      });
    }
  });

  const { mutate: deleteCampaign } = useMutation({
    mutationFn: async (id: string) => {
      // Получаем токен напрямую из localStorage - точно такой же, как в Postman
      let token = localStorage.getItem('auth_token');
      
      console.log(`Токен для удаления кампании: ${token ? 'найден, длина: ' + token.length : 'НЕ НАЙДЕН!'}`);
      
      // Для отладки выведем все ключи из localStorage
      console.log('Содержимое localStorage:');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          console.log(`${key}: ${value ? (key.includes('token') ? value.slice(0, 10) + '...' : value.length + ' символов') : 'null'}`);
        }
      }
      
      // Если нет токена, попробуем получить его из auth объекта
      if (!token) {
        const auth = JSON.parse(localStorage.getItem('auth-storage') || '{}');
        console.log('Проверяем auth-storage:', auth);
        if (auth.state?.token && typeof auth.state.token === 'string') {
          token = auth.state.token;
          console.log('Получен токен из auth-storage, длина:', token.length);
        } else {
          console.error('Токен не найден ни в одном из хранилищ');
          throw new Error("Отсутствует токен авторизации");
        }
      }
      
      // Дополнительная проверка после попыток найти токен
      if (typeof token !== 'string' || token.length < 10) {
        console.error('Токен некорректный:', token);
        throw new Error("Некорректный токен авторизации");
      }
      
      // Проверяем наличие токена перед использованием
      if (!token) {
        throw new Error("Не удалось получить токен авторизации из всех доступных источников");
      }
      
      console.log(`[УДАЛЕНИЕ] Начинаем процесс удаления кампании ${id}`);
      
      try {
        // Шаг 1: Последовательное удаление связанных данных
        let hasRelatedData = false;
        let relatedDataCounts = {
          keywords: 0,
          trends: 0, 
          content: 0
        };
        
        try {
          // Сначала проверяем наличие связанных данных
          console.log('[УДАЛЕНИЕ] Проверка наличия ключевых слов');
          const keywordsCheckResponse = await fetch(`https://directus.nplanner.ru/items/campaign_keywords?filter[campaign_id][_eq]=${id}&limit=1`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (keywordsCheckResponse.ok) {
            const keywordsData = await keywordsCheckResponse.json();
            relatedDataCounts.keywords = keywordsData.data?.length || 0;
            if (relatedDataCounts.keywords > 0) hasRelatedData = true;
            console.log(`[УДАЛЕНИЕ] Найдено ${relatedDataCounts.keywords} ключевых слов для кампании`);
          }
          
          console.log('[УДАЛЕНИЕ] Проверка наличия тем трендов');
          const trendsCheckResponse = await fetch(`https://directus.nplanner.ru/items/campaign_trend_topics?filter[campaign_id][_eq]=${id}&limit=1`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (trendsCheckResponse.ok) {
            const trendsData = await trendsCheckResponse.json();
            relatedDataCounts.trends = trendsData.data?.length || 0;
            if (relatedDataCounts.trends > 0) hasRelatedData = true;
            console.log(`[УДАЛЕНИЕ] Найдено ${relatedDataCounts.trends} тем трендов для кампании`);
          }
          
          console.log('[УДАЛЕНИЕ] Проверка наличия контента');
          const contentCheckResponse = await fetch(`https://directus.nplanner.ru/items/campaign_content?filter[campaign_id][_eq]=${id}&limit=1`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (contentCheckResponse.ok) {
            const contentData = await contentCheckResponse.json();
            relatedDataCounts.content = contentData.data?.length || 0;
            if (relatedDataCounts.content > 0) hasRelatedData = true;
            console.log(`[УДАЛЕНИЕ] Найдено ${relatedDataCounts.content} контента для кампании`);
          }
          
          // Если обнаружены связанные данные, показываем диалог подтверждения
          if (hasRelatedData && !deleteWithData) {
            console.log('[УДАЛЕНИЕ] Обнаружены связанные данные, требуется подтверждение');
            return {
              success: false,
              error: 'Нельзя удалить кампанию со связанными данными',
              requireConfirmation: true,
              relatedData: {
                hasContent: relatedDataCounts.content > 0,
                hasKeywords: relatedDataCounts.keywords > 0,
                hasTrends: relatedDataCounts.trends > 0,
                totalItems: {
                  content: relatedDataCounts.content,
                  keywords: relatedDataCounts.keywords,
                  trends: relatedDataCounts.trends
                }
              }
            };
          }
          
          // Проверили связанные данные, теперь удаляем через наш новый серверный API,
          // который последовательно удалит все связанные данные, а затем кампанию
          console.log('[УДАЛЕНИЕ] Используем серверный API для удаления кампании и связанных данных');
        } catch (relatedError) {
          console.warn('[УДАЛЕНИЕ] Ошибка при проверке связанных данных:', relatedError);
        }
        
        // Теперь используем напрямую серверный API, чтобы удалить кампанию вместе с связанными данными
        console.log('[УДАЛЕНИЕ] Отправляем запрос на удаление в серверный API');
        
        // Собираем URL с параметром forceDelete, если пользователь подтвердил удаление с данными
        const url = `/api/campaigns/${id}${deleteWithData ? '?forceDelete=true' : ''}`;
        console.log(`[УДАЛЕНИЕ] URL запроса: ${url}, forceDelete=${deleteWithData}`);
        
        try {
          const serverResponse = await fetch(url, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (serverResponse.ok) {
            console.log('[УДАЛЕНИЕ] Кампания успешно удалена через серверный API');
            return { success: true, id };
          }
            // Если запрос неуспешен, получаем текст ошибки и логируем
          const serverErrorText = await serverResponse.text();
          console.error('[УДАЛЕНИЕ] Ошибка при удалении через API сервера:', serverResponse.status, serverErrorText);
          
          // Проверяем ответ на наличие информации о связанных данных
          try {
            const errorData = JSON.parse(serverErrorText);
            if (errorData.requireConfirmation && errorData.relatedData) {
              console.log('[УДАЛЕНИЕ] Сервер сообщил о наличии связанных данных:', errorData.relatedData);
              setRelatedData(errorData.relatedData);
              setConfirmDialogOpen(true);
              return { 
                success: false, 
                requireConfirmation: true,
                relatedData: errorData.relatedData 
              };
            }
          } catch (parseError) {
            console.warn('[УДАЛЕНИЕ] Не удалось разобрать ответ сервера как JSON:', parseError);
          }
          
          // Если это не ошибка с требованием подтверждения, возвращаем общую ошибку
          return { 
            success: false, 
            error: `Ошибка при удалении: ${serverResponse.status} ${serverErrorText}` 
          };
        } catch (serverError) {
          console.error('[УДАЛЕНИЕ] Ошибка при обращении к API сервера:', serverError);
          return { 
            success: false, 
            error: serverError instanceof Error ? serverError.message : 'Неизвестная ошибка сервера' 
          };
        }
      } catch (error: any) {
        console.error('[УДАЛЕНИЕ] Критическая ошибка при удалении кампании:', error);
        
        // Проверяем ошибку на наличие ограничений внешнего ключа
        if (error.message && (
            error.message.includes('Constraint violation') || 
            error.message.includes('Foreign key constraint failed') ||
            error.message.includes('foreign key'))) {
          
          // Проверяем наличие связанных данных и возвращаем соответствующий результат
          return {
            success: false,
            error: 'Нельзя удалить кампанию со связанными данными. Сначала удалите все связанные данные.',
            requireConfirmation: true,
            relatedData: {
              hasContent: true,
              hasKeywords: true,
              hasTrends: true,
              totalItems: {
                content: 1, // Предполагаем минимум 1 элемент каждого типа
                keywords: 1,
                trends: 1
              }
            }
          };
        }
        
        // Иначе просто перебрасываем ошибку дальше
        throw error;
      }
    },
    onSuccess: (result: any) => {
      // Сбрасываем состояние
      const deletedCampaignId = campaignToDelete?.id || result?.id;
      setCampaignToDelete(null);
      setDeleteWithData(false);
      setRelatedData(null);
      setConfirmDialogOpen(false);
      
      if (deletedCampaignId) {
        // Удаляем кампанию из кэша запросов напрямую
        queryClient.setQueryData(["/api/campaigns", userId], (oldData: any) => {
          if (!oldData || !oldData.data) return oldData;
          console.log(`Удаляем кампанию ${deletedCampaignId} из кэша React Query`);
          return {
            ...oldData,
            data: oldData.data.filter((campaign: any) => campaign.id !== deletedCampaignId)
          };
        });
        
        // Также обновляем альтернативный ключ запроса без userId
        try {
          queryClient.setQueryData(["/api/campaigns"], (oldData: any) => {
            if (!oldData || !oldData.data) return oldData;
            return {
              ...oldData,
              data: oldData.data.filter((campaign: any) => campaign.id !== deletedCampaignId)
            };
          });
        } catch (err) {
          console.warn('Ошибка при обновлении кэша без userId:', err);
        }
      }
      
      // Показываем уведомление об успешном удалении
      toast({
        title: "Успешно",
        description: deleteWithData 
          ? "Кампания и все связанные данные успешно удалены" 
          : "Кампания успешно удалена"
      });
    },
    onError: (error: Error) => {
      // Не показываем ошибку, если это запрос на подтверждение
      if (error.message === "confirmation_required") {
        return;
      }
      
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

      {!campaignsResponse?.data?.length ? (
        <div className="flex flex-col items-center justify-center py-12 px-6 bg-muted/30 rounded-lg border border-dashed border-muted">
          <div className="text-center max-w-lg">
            <h2 className="text-xl font-semibold mb-3">Добро пожаловать в SMM Manager!</h2>
            <p className="text-muted-foreground mb-6">
              Для начала работы необходимо создать кампанию и заполнить данные. 
              Кампания - это базовая единица организации вашего контента и аналитики.
            </p>
            <div className="space-y-4 mb-6">
              <div className="flex items-start">
                <div className="bg-primary/10 text-primary h-6 w-6 rounded-full flex items-center justify-center mr-3 flex-shrink-0">1</div>
                <p className="text-sm text-left">Создайте кампанию, нажав на кнопку "Добавить кампанию" выше</p>
              </div>
              <div className="flex items-start">
                <div className="bg-primary/10 text-primary h-6 w-6 rounded-full flex items-center justify-center mr-3 flex-shrink-0">2</div>
                <p className="text-sm text-left">Добавьте данные о социальных сетях, с которыми хотите работать</p>
              </div>
              <div className="flex items-start">
                <div className="bg-primary/10 text-primary h-6 w-6 rounded-full flex items-center justify-center mr-3 flex-shrink-0">3</div>
                <p className="text-sm text-left">Создавайте и публикуйте контент через систему, отслеживайте результаты</p>
              </div>
            </div>
            <Button 
              size="lg" 
              onClick={() => setIsOpen(true)}
              className="w-full md:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Создать первую кампанию
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Сортируем кампании: сначала новые, потом старые */}
          {campaignsResponse.data
            .sort((a, b) => {
              // При отсутствии дат у одной из кампаний, считаем что она старее
              if (!a.createdAt) return 1;
              if (!b.createdAt) return -1;
              // Сортируем по убыванию даты (новые сначала)
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })
            .map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                {editingId === campaign.id ? (
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="font-semibold"
                    autoFocus
                  />
                ) : (
                  <CardTitle className="flex items-center gap-2">
                    <span 
                      className="cursor-pointer flex-grow"
                      onClick={() => startEditing(campaign)}
                    >
                      {campaign.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
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
                  {/* Обновлено: устанавливаем выбранную кампанию при нажатии на "Управлять" */}
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
                      // Устанавливаем информацию о кампании для удаления
                      setCampaignToDelete({id: campaign.id, name: campaign.name});
                      // Сбрасываем флаг принудительного удаления - сначала покажем диалог
                      setDeleteWithData(false);
                      // Добавляем подробное логирование
                      console.log(`Инициировано удаление кампании ${campaign.name} (${campaign.id})`);
                      // Запускаем процесс удаления, который сначала проверит наличие связанных данных
                      deleteCampaign(campaign.id);
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <CampaignForm onClose={() => setIsOpen(false)} />
      </Dialog>

      {/* Диалог подтверждения удаления кампании с данными */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent style={{ backgroundColor: "white", opacity: 1 }} className="fixed z-50 bg-white shadow-lg w-full max-w-lg rounded-lg border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Подтверждение удаления
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-700">
              {relatedData && (
                <div className="space-y-4">
                  <p>
                    Кампания "{campaignToDelete?.name}" содержит связанные данные, которые также будут удалены:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    {relatedData.hasContent && (
                      <li>Контент{relatedData.totalItems.content > 0 ? `: ${relatedData.totalItems.content} шт.` : ""}</li>
                    )}
                    {relatedData.hasKeywords && (
                      <li>Ключевые слова{relatedData.totalItems.keywords > 0 ? `: ${relatedData.totalItems.keywords} шт.` : ""}</li>
                    )}
                    {relatedData.hasTrends && (
                      <li>Темы трендов{relatedData.totalItems.trends > 0 ? `: ${relatedData.totalItems.trends} шт.` : ""}</li>
                    )}
                  </ul>
                  <p className="text-amber-600 font-medium">
                    Это действие невозможно отменить. Удаленные данные будут потеряны безвозвратно.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              style={{ backgroundColor: "#f3f4f6" }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded"
              onClick={() => {
                setCampaignToDelete(null);
                setDeleteWithData(false);
                setRelatedData(null);
              }}
            >
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              style={{ backgroundColor: "#dc2626" }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              onClick={() => {
                if (campaignToDelete) {
                  console.log("Подтверждаем удаление кампании со всеми данными:", campaignToDelete.id);
                  // Устанавливаем флаг принудительного удаления
                  setDeleteWithData(true);
                  // Запускаем процесс удаления
                  deleteCampaign(campaignToDelete.id);
                  // Закрываем диалог (не требуется, так как он закроется в обработчике успешного удаления)
                }
              }}
            >
              <Trash className="h-4 w-4 mr-2" />
              Удалить со всеми данными
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}