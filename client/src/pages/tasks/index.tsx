import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Campaign {
  id: string;
  name: string;
}

interface Source {
  id: string;
  url: string;
}

interface Task {
  id: string;
  campaign_id: string;
  source_id: string;
  status: string;
  started_at: string | null;
  created_at: string;
}

export default function CrawlerTasks() {
  const { add } = useToast();
  const queryClient = useQueryClient();

  // Получаем список задач
  const { data: tasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ["/api/crawler-tasks"],
    queryFn: async () => {
      const response = await directusApi.get('/items/crawler_tasks', {
        params: {
          sort: ['-created_at'],
          fields: ['*']
        }
      });
      console.log('Tasks response:', response.data);
      return response.data?.data || [];
    }
  });

  // Получаем названия кампаний
  const { data: campaigns = {} } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const campaignIds = [...new Set(tasks.map(task => task.campaign_id))];
      if (campaignIds.length === 0) return {};

      console.log('Fetching campaigns for IDs:', campaignIds);

      try {
        const response = await directusApi.get('/items/user_campaigns', {
          params: {
            filter: {
              id: {
                _in: campaignIds
              }
            }
          }
        });

        console.log('Campaigns response:', response.data);

        const campaignsMap = (response.data?.data || []).reduce((acc: Record<string, string>, campaign: Campaign) => {
          acc[campaign.id] = campaign.name;
          return acc;
        }, {});

        console.log('Campaigns map:', campaignsMap);
        return campaignsMap;
      } catch (error) {
        console.error('Error fetching campaigns:', error);
        return {};
      }
    },
    enabled: tasks.length > 0
  });

  // Получаем URLs источников
  const { data: sources = {} } = useQuery({
    queryKey: ["/api/sources"],
    queryFn: async () => {
      const sourceIds = [...new Set(tasks.map(task => task.source_id))];
      if (sourceIds.length === 0) return {};

      const response = await directusApi.get('/items/campaign_content_sources', {
        params: {
          filter: {
            id: {
              _in: sourceIds
            }
          },
          fields: ['id', 'url']
        }
      });

      return (response.data?.data || []).reduce((acc: Record<string, string>, source: Source) => {
        acc[source.id] = source.url;
        return acc;
      }, {});
    },
    enabled: tasks.length > 0
  });

  const handleDelete = async (taskId: string) => {
    try {
      await directusApi.delete(`/items/crawler_tasks/${taskId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/crawler-tasks"] });
      add({ description: "Задача успешно удалена" });
    } catch (error) {
      console.error('Error deleting task:', error);
      add({
        variant: "destructive",
        description: "Не удалось удалить задачу"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'В ожидании';
      case 'processing':
        return 'Выполняется';
      case 'completed':
        return 'Завершено';
      case 'failed':
        return 'Ошибка';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Задачи краулера</h1>
        <p className="text-muted-foreground mt-2">
          Управление задачами сбора данных
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          {isTasksLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-center text-muted-foreground">Нет активных задач</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Кампания</TableHead>
                  <TableHead>URL источника</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Время начала</TableHead>
                  <TableHead>Время создания</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task: Task) => (
                  <TableRow key={task.id}>
                    <TableCell>{campaigns[task.campaign_id] || '—'}</TableCell>
                    <TableCell>
                      {sources[task.source_id] ? (
                        <a 
                          href={sources[task.source_id]} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {sources[task.source_id]}
                        </a>
                      ) : '—'}
                    </TableCell>
                    <TableCell>{getStatusText(task.status)}</TableCell>
                    <TableCell>{task.started_at ? formatDate(task.started_at) : '—'}</TableCell>
                    <TableCell>{formatDate(task.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(task.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}