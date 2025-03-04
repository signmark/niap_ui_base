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

// Normalize Instagram URLs
function normalizeInstagramUrl(url: string): string {
  if (!url) return '';

  // Remove http/https and www
  let normalized = url.replace(/^https?:\/\/(www\.)?/, '');

  // Handle @username format
  if (normalized.startsWith('@')) {
    normalized = `instagram.com/${normalized.substring(1)}`;
  }

  // Handle just username format
  if (!normalized.includes('/')) {
    normalized = `instagram.com/${normalized}`;
  }

  return normalized;
}

interface Keyword {
  id: string;
  keyword: string;
  trend_score: number;
  mentions_count: number;
  campaign_id: string;
}

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
  existingKeywords: Keyword[];
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
      const uniqueSources = kw.sources.filter(source => 
        !acc.some(existing => existing.url === source.url)
      );
      return [...acc, ...uniqueSources];
    }
    return acc;
  }, []);

  // Сортируем источники по количеству подписчиков
  const sortedSources = allSources.sort((a, b) => (b.followers || 0) - (a.followers || 0));

  console.log('Rendering sources:', sortedSources);

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
                const normalizedUrl = normalizeInstagramUrl(source.url);
                const formattedFollowers = source.followers >= 1000000 
                  ? `${(source.followers / 1000000).toFixed(1)}M`
                  : source.followers >= 1000 
                  ? `${(source.followers / 1000).toFixed(1)}K`
                  : source.followers.toString();

                return (
                  <TableRow key={index}>
                    <TableCell>
                      <a 
                        href={`https://${normalizedUrl}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        @{normalizedUrl.split('/').pop()}
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