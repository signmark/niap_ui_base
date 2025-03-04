import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { directusApi } from "@/lib/directus";

interface Source {
  url: string;
  name: string;
  followers: number;
  description: string;
  platform: string;
}

interface KeywordTableProps {
  keywords: Array<{
    keyword: string;
    trend: number;
    competition: number;
    sources?: Source[];
  }>;
  existingKeywords: any[];
  isLoading: boolean;
  campaignId?: string;
  onKeywordsUpdated: () => void;
}

export function KeywordTable({
  keywords = [],
  existingKeywords = [],
  isLoading,
  campaignId,
  onKeywordsUpdated
}: KeywordTableProps) {
  const { add: toast } = useToast();
  const queryClient = useQueryClient();

  console.log("KeywordTable received keywords:", keywords);
  console.log("Sources from first keyword:", keywords[0]?.sources);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Собираем все уникальные источники из всех ключевых слов
  const allSources = keywords.reduce((acc: Source[], kw) => {
    if (kw.sources) {
      console.log("Processing sources for keyword:", kw.keyword, kw.sources);
      const uniqueSources = kw.sources.filter(source => 
        !acc.some(existing => existing.url === source.url)
      );
      return [...acc, ...uniqueSources];
    }
    return acc;
  }, []);

  console.log("All unique sources:", allSources);

  // Сортируем источники по количеству подписчиков
  const sortedSources = allSources.sort((a, b) => (b.followers || 0) - (a.followers || 0));

  return (
    <div className="space-y-8">
      {/* Таблица результатов поиска источников */}
      {sortedSources.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Найденные источники</h3>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Источник</TableHead>
                <TableHead>Имя</TableHead>
                <TableHead>Подписчики</TableHead>
                <TableHead>Платформа</TableHead>
                <TableHead>Описание</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSources.map((source, index) => {
                const formattedFollowers = source.followers >= 1000000 
                  ? `${(source.followers / 1000000).toFixed(1)}M`
                  : source.followers >= 1000 
                  ? `${(source.followers / 1000).toFixed(1)}K`
                  : source.followers.toString();

                return (
                  <TableRow key={index}>
                    <TableCell>
                      <a 
                        href={source.url.startsWith('http') ? source.url : `https://${source.url}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {source.name}
                      </a>
                    </TableCell>
                    <TableCell>{source.name}</TableCell>
                    <TableCell>{formattedFollowers}</TableCell>
                    <TableCell>{source.platform}</TableCell>
                    <TableCell>{source.description}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Таблица существующих ключевых слов */}
      {campaignId && existingKeywords.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Добавленные ключевые слова</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ключевое слово</TableHead>
                <TableHead>Тренд</TableHead>
                <TableHead>Конкуренция</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingKeywords.map((keyword) => (
                <TableRow key={keyword.id}>
                  <TableCell>{keyword.keyword}</TableCell>
                  <TableCell>{keyword.trend_score}</TableCell>
                  <TableCell>{keyword.mentions_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}