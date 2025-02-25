import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2, RefreshCw } from "lucide-react";
import { AddSourceDialog } from "@/components/AddSourceDialog";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import type { ContentSource, TrendTopic } from "@shared/schema";
import { useAuthStore } from "@/lib/store";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

type Period = "3days" | "7days" | "14days" | "30days";

export default function Trends() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("7days");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<TrendTopic[]>([]);
  const userId = useAuthStore((state) => state.userId);
  const { toast } = useToast();

  const { data: sources, isLoading: isLoadingSources } = useQuery({
    queryKey: ["/api/sources", userId],
    queryFn: async () => {
      const response = await apiRequest('/api/sources');
      return response;
    }
  });

  const { mutate: deleteSource } = useMutation({
    mutationFn: async (sourceId: number) => {
      return await apiRequest(`/api/sources/${sourceId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({
        title: "Успешно",
        description: "Источник удален"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const { data: trendTopics, isLoading } = useQuery({
    queryKey: ["/api/trends", selectedPeriod],
    queryFn: async () => {
      const response = await apiRequest('/api/trends', {
        params: { period: selectedPeriod }
      });
      return response;
    }
  });

  const toggleTopicSelection = (topic: TrendTopic) => {
    setSelectedTopics(prev => {
      const isSelected = prev.some(t => t.id === topic.id);
      if (isSelected) {
        return prev.filter(t => t.id !== topic.id);
      } else {
        return [...prev, topic];
      }
    });
  };

  const { mutate: collectTrends, isPending: isCollecting } = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/trends/collect', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trends"] });
      toast({
        title: "Успешно",
        description: "Запущен сбор трендов"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">SMM Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Анализ популярных тем и управление контентом в социальных медиа
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => collectTrends()}
            disabled={isCollecting}
          >
            {isCollecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сбор данных...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Собрать тренды
              </>
            )}
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить источник
          </Button>
        </div>
      </div>

      {/* Sources List */}
      <Card>
        <CardHeader>
          <CardTitle>Источники данных</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingSources ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : sources?.data?.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Нет добавленных источников
            </p>
          ) : (
            <div className="space-y-2">
              {sources?.data?.map((source) => (
                <div key={source.id} className="flex items-center justify-between p-2 rounded-lg border">
                  <div>
                    <h3 className="font-medium">{source.name}</h3>
                    <p className="text-sm text-muted-foreground">{source.url}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                      {source.type === 'website' ? 'Вебсайт' : 
                       source.type === 'telegram' ? 'Telegram канал' : 
                       source.type === 'vk' ? 'VK группа' : source.type}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSource(source.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trends Table */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex gap-4">
            <Select 
              value={selectedPeriod} 
              onValueChange={(value: Period) => setSelectedPeriod(value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Выберите период" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3days">За 3 дня</SelectItem>
                <SelectItem value="7days">За неделю</SelectItem>
                <SelectItem value="14days">За 2 недели</SelectItem>
                <SelectItem value="30days">За месяц</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Поиск по темам"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead>Тема</TableHead>
                  <TableHead>Источник</TableHead>
                  <TableHead className="text-right">Реакции</TableHead>
                  <TableHead className="text-right">Комментарии</TableHead>
                  <TableHead className="text-right">Просмотры</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(trendTopics?.data || [])
                  .filter(topic => topic.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((topic) => (
                    <TableRow key={topic.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTopics.some(t => t.id === topic.id)}
                          onCheckedChange={() => toggleTopicSelection(topic)}
                        />
                      </TableCell>
                      <TableCell>{topic.title}</TableCell>
                      <TableCell>
                        {sources?.data?.find(s => s.id === topic.sourceId)?.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {topic.reactions?.toLocaleString() ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {topic.comments?.toLocaleString() ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {topic.views?.toLocaleString() ?? 0}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedTopics.length > 0 && (
        <ContentGenerationPanel
          selectedTopics={selectedTopics}
          onGenerated={() => setSelectedTopics([])}
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AddSourceDialog onClose={() => setIsDialogOpen(false)} />
      </Dialog>
    </div>
  );
}