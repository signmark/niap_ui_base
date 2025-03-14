import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Plus, Search, Pencil } from "lucide-react";
import { CampaignForm } from "@/components/CampaignForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/store";
import { directusApi } from "@/lib/directus";
import { queryClient } from "@/lib/queryClient";
import type { Campaign } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";

export default function Campaigns() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const { userId } = useAuthStore();
  const { toast } = useToast();

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
      const token = getAuthToken();
      if (!token) {
        throw new Error("Отсутствует токен авторизации");
      }
      
      // Используем REST API вместо прямого обращения к Directus
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Не удалось удалить кампанию");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", userId] });
      toast({
        title: "Успешно",
        description: "Кампания удалена"
      });
    },
    onError: (error: Error) => {
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaignsResponse?.data?.map((campaign) => (
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
                <Link href={`/campaigns/${campaign.id}`}>
                  <Button variant="secondary" size="sm">
                    <Search className="mr-2 h-4 w-4" />
                    Управлять
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteCampaign(campaign.id)}
                >
                  Удалить
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <CampaignForm onClose={() => setIsOpen(false)} />
      </Dialog>
    </div>
  );
}