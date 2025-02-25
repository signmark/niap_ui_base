import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { AddSourceDialog } from "@/components/AddSourceDialog";
import type { ContentSource, TrendTopic } from "@shared/schema";
import { useAuthStore } from "@/lib/store";

type Period = "3days" | "7days" | "14days" | "30days";

export default function Trends() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("7days");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const userId = useAuthStore((state) => state.userId);

  const { data: sources, isLoading: isLoadingSources } = useQuery({
    queryKey: ["/api/sources", userId],
    queryFn: async () => {
      const response = await directusApi.get("/items/content_sources", {
        params: {
          filter: {
            user_id: {
              _eq: userId
            }
          }
        }
      });
      return response.data?.data as ContentSource[];
    }
  });

  const { data: trendTopics, isLoading } = useQuery({
    queryKey: ["/api/trends", selectedPeriod],
    queryFn: async () => {
      const response = await directusApi.get("/items/trend_topics", {
        params: {
          filter: {
            created_at: {
              _gte: "$NOW(-" + selectedPeriod + ")"
            }
          },
          sort: ["-reactions", "-comments", "-views"]
        }
      });
      return response.data?.data as TrendTopic[];
    }
  });

  const filteredTopics = trendTopics?.filter(topic => 
    topic.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Анализ трендов</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Анализ популярных тем в медицине и нутрициологии
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить источник
        </Button>
      </div>

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
                  <TableHead>Тема</TableHead>
                  <TableHead>Источник</TableHead>
                  <TableHead className="text-right">Реакции</TableHead>
                  <TableHead className="text-right">Комментарии</TableHead>
                  <TableHead className="text-right">Просмотры</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTopics?.map((topic) => (
                  <TableRow key={topic.id}>
                    <TableCell>{topic.title}</TableCell>
                    <TableCell>
                      {sources?.find(s => s.id === topic.sourceId)?.name}
                    </TableCell>
                    <TableCell className="text-right">
                      {topic.reactions.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {topic.comments.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {topic.views.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AddSourceDialog onClose={() => setIsDialogOpen(false)} />
      </Dialog>
    </div>
  );
}