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
import { Loader2, Trash2 } from "lucide-react";

interface Keyword {
  id: string;
  keyword: string;
  trend_score: number;
  mentions_count: number;
}

interface KeywordTableProps {
  keywords: Keyword[];
  isLoading: boolean;
  onDelete: (id: string) => void;
}

export function KeywordTable({
  keywords = [],
  isLoading,
  onDelete
}: KeywordTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Нет ключевых слов
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ключевое слово</TableHead>
            <TableHead>Тренд</TableHead>
            <TableHead>Конкуренция</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keywords.map((keyword) => (
            <TableRow key={keyword.id}>
              <TableCell>{keyword.keyword}</TableCell>
              <TableCell>{keyword.trend_score}</TableCell>
              <TableCell>{keyword.mentions_count}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(keyword.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}