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

export default function CrawlerTasks() {
  const { add } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["/api/crawler-tasks"],
    queryFn: async () => {
      const response = await directusApi.get('/items/crawler_tasks', {
        params: {
          sort: ['-created_at']
        }
      });
      return response.data?.data || [];
    }
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
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-center text-muted-foreground">Нет активных задач</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID кампании</TableHead>
                  <TableHead>ID источника</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Время начала</TableHead>
                  <TableHead>Время создания</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task: any) => (
                  <TableRow key={task.id}>
                    <TableCell>{task.campaign_id}</TableCell>
                    <TableCell>{task.source_id}</TableCell>
                    <TableCell>{task.status}</TableCell>
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